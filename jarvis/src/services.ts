// Real implementations of the external services: Telegram, Gemini, Workers AI speech, weather and news.
import type { Feeds, InlineButton, Llm, LlmRequest, Speech, Telegram, Weather } from './types';
import { LlmError } from './types';
import { Store } from './store';
import { localDate, utc } from './time';
import { DEFAULT_VOICE, FALLBACK_EDGE_VOICE, VOICES, edgeSynthesize } from './edge';
import type { ElevenLabs } from './eleven';

// ---------- Telegram ----------

export class TelegramApi implements Telegram {
	constructor(
		private token: string,
		private fetcher: typeof fetch = (input, init) => fetch(input, init),
	) {}

	private async call(method: string, body: BodyInit, json = true): Promise<any> {
		const res = await this.fetcher(`https://api.telegram.org/bot${this.token}/${method}`, {
			method: 'POST',
			headers: json ? { 'content-type': 'application/json' } : undefined,
			body,
		});
		const data: any = await res.json().catch(() => ({}));
		if (!data.ok) throw new Error(`telegram ${method} failed: ${res.status} ${data.description ?? ''}`.trim());
		return data.result;
	}

	async sendMessage(chatId: string, text: string, buttons?: InlineButton[][]): Promise<void> {
		for (const part of splitText(text, 4000)) {
			const payload: Record<string, unknown> = { chat_id: chatId, text: part, link_preview_options: { is_disabled: true } };
			if (buttons?.length) payload.reply_markup = { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) };
			await this.call('sendMessage', JSON.stringify(payload));
		}
	}

	async sendVoice(chatId: string, audio: Uint8Array, mime: string, caption?: string): Promise<void> {
		const form = new FormData();
		form.set('chat_id', chatId);
		const ext = mime.includes('ogg') ? 'ogg' : 'mp3';
		form.set('voice', new Blob([audio], { type: mime }), `jarvis.${ext}`);
		if (caption) form.set('caption', caption.slice(0, 1024));
		await this.call('sendVoice', form, false);
	}

	async sendChatAction(chatId: string, action: 'typing' | 'record_voice'): Promise<void> {
		await this.call('sendChatAction', JSON.stringify({ chat_id: chatId, action })).catch(() => undefined);
	}

	async getFile(fileId: string): Promise<Uint8Array> {
		const f = await this.call('getFile', JSON.stringify({ file_id: fileId }));
		const res = await this.fetcher(`https://api.telegram.org/file/bot${this.token}/${f.file_path}`);
		if (!res.ok) throw new Error(`telegram file download failed: ${res.status}`);
		return new Uint8Array(await res.arrayBuffer());
	}

	async sendDocument(chatId: string, data: Uint8Array, filename: string, caption?: string): Promise<void> {
		const form = new FormData();
		form.set('chat_id', chatId);
		form.set('document', new Blob([data], { type: 'application/json' }), filename);
		if (caption) form.set('caption', caption.slice(0, 1024));
		await this.call('sendDocument', form, false);
	}

	async answerCallback(id: string, text?: string): Promise<void> {
		await this.call('answerCallbackQuery', JSON.stringify({ callback_query_id: id, text })).catch(() => undefined);
	}
}

export function splitText(text: string, max: number): string[] {
	if (text.length <= max) return [text];
	const parts: string[] = [];
	let rest = text;
	while (rest.length > max) {
		let cut = rest.lastIndexOf('\n', max);
		if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
		if (cut < max / 2) cut = max;
		parts.push(rest.slice(0, cut));
		rest = rest.slice(cut).trimStart();
	}
	if (rest) parts.push(rest);
	return parts;
}

// ---------- Gemini ----------

export const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

export class Gemini implements Llm {
	private models: string[];
	constructor(
		private key: string,
		models: string | undefined,
		private fetcher: typeof fetch = (input, init) => fetch(input, init),
		private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
		/**
		 * Shared model health (JSON {model: {until, why}}): models that were missing or over quota sit out
		 * for a while, then the best model is tried again, so one bad minute never pins us to a weaker model.
		 */
		private memo?: { get(): Promise<string | null>; set(health: string): Promise<void> },
		private clock: () => number = Date.now,
	) {
		this.models = models
			? models
					.split(',')
					.map((m) => m.trim())
					.filter(Boolean)
			: DEFAULT_MODELS;
	}

	private discovered = false;

	async generate(req: LlmRequest): Promise<string> {
		try {
			return await this.tryModels(req);
		} catch (e) {
			// Every configured model was unknown: ask Google which Flash models exist now and retry once.
			if (e instanceof LlmError && e.message.includes('not found') && !this.discovered) {
				this.discovered = true;
				const found = await this.discoverModels();
				if (found.length) {
					this.models = found;
					return this.tryModels(req);
				}
			}
			throw e;
		}
	}

	/** Lists Flash text models that support generateContent, newest first. */
	async discoverModels(): Promise<string[]> {
		try {
			const res = await this.fetcher('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': this.key } });
			if (!res.ok) return [];
			const data: any = await res.json();
			return pickFlashModels((data.models ?? []).filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent')).map((m: any) => String(m.name).replace(/^models\//, '')));
		} catch {
			return [];
		}
	}

	private async tryModels(req: LlmRequest): Promise<string> {
		if (!this.key) throw new LlmError('GEMINI_API_KEY is not set', 'config');
		const health = parseHealth(await this.memo?.get().catch(() => null));
		const startHealth = JSON.stringify(health);
		const now = this.clock();
		const available = this.models.filter((m) => !(health[m]?.until > now));
		const order = available.length ? available : this.models;
		const benched = (model: string, minutes: number, why: string) => (health[model] = { until: now + minutes * 60_000, why });
		const save = async () => {
			if (JSON.stringify(health) !== startHealth) await this.memo?.set(JSON.stringify(health)).catch(() => undefined);
		};
		const contents = req.turns.map((t, i) => {
			const parts: any[] = [{ text: t.text }];
			if (i === req.turns.length - 1) {
				if (req.audio) parts.push({ inline_data: { mime_type: req.audio.mime, data: toBase64(req.audio.data) } });
				for (const img of req.images ?? []) parts.push({ inline_data: { mime_type: img.mime, data: toBase64(img.data) } });
			}
			return { role: t.role, parts };
		});
		const body: any = {
			system_instruction: { parts: [{ text: req.system }] },
			contents,
			generationConfig: { temperature: req.temperature ?? 0.7 },
		};
		if (req.schema) {
			body.generationConfig.responseMimeType = 'application/json';
			body.generationConfig.responseSchema = req.schema;
		}
		let lastKind: LlmError['kind'] = 'unavailable';
		let lastMsg = '';
		for (const model of order) {
			let thinking = req.fast ? thinkingFor(model) : undefined;
			let search = Boolean(req.search && !req.schema);
			for (let attempt = 0; attempt < 2; attempt++) {
				let res: Response;
				const payload: any = thinking ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: thinking } } : { ...body };
				if (search) payload.tools = [{ google_search: {} }];
				try {
					res = await this.fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
						method: 'POST',
						headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
						body: JSON.stringify(payload),
					});
				} catch (e) {
					lastMsg = String(e);
					await this.sleep(500);
					continue;
				}
				if (res.ok) {
					const data: any = await res.json().catch(() => null);
					const text = data?.candidates?.[0]?.content?.parts
						?.map((p: any) => p.text ?? '')
						.join('')
						.trim();
					if (text) {
						delete health[model];
						await save();
						return text;
					}
					lastKind = 'bad_response';
					lastMsg = `empty answer from ${model} (${data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? 'unknown'})`;
					break; // try the next model
				}
				lastMsg = `${model}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`;
				if (res.status === 429) {
					lastKind = 'quota';
					benched(model, 10, 'free quota hit');
					break; // each model has its own free quota, so move on
				}
				if (res.status === 400 && search && /tool|search|ground/i.test(lastMsg)) {
					search = false; // this model can't search; answer without it
					attempt--;
					continue;
				}
				if (res.status === 400 && thinking && /thinking/i.test(lastMsg)) {
					thinking = undefined; // this model doesn't take that thinking setting; retry plainly
					attempt--;
					continue;
				}
				if (res.status === 404 || res.status === 400) {
					if (res.status === 404) {
						lastMsg = `${model} not found`;
						benched(model, 24 * 60, 'not found');
					}
					lastKind = res.status === 400 && /API key/i.test(lastMsg) ? 'config' : 'bad_response';
					if (lastKind === 'config') throw new LlmError(lastMsg, 'config');
					break;
				}
				if (res.status === 401 || res.status === 403) throw new LlmError(lastMsg, 'config');
				lastKind = 'unavailable';
				await this.sleep(800 * (attempt + 1));
			}
		}
		await save();
		throw new LlmError(lastMsg || 'all models failed', lastKind);
	}
}

export function parseHealth(raw: string | null | undefined): Record<string, { until: number; why: string }> {
	try {
		const v = JSON.parse(raw ?? '{}');
		return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
	} catch {
		return {}; // older format (a bare model name) or garbage: start fresh
	}
}

/** Minimal thinking for quick replies: Gemini 2.x takes a token budget, Gemini 3+ a level. */
export function thinkingFor(model: string): Record<string, unknown> {
	return /gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' };
}

/** Keeps general-purpose Flash models (no TTS, image, live, embedding or preview variants), newest version first. */
export function pickFlashModels(names: string[]): string[] {
	const version = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
	return names
		.filter((n) => /^gemini-\d+(\.\d+)?-flash(-lite)?(-latest|-\d{3})?$/.test(n))
		.sort((a, b) => version(b) - version(a) || Number(a.includes('lite')) - Number(b.includes('lite')))
		.slice(0, 4);
}

/** Asks for JSON and parses it, tolerating code fences. */
export async function generateJson<T>(llm: Llm, req: LlmRequest): Promise<T> {
	const text = await llm.generate(req);
	const parsed = parseJsonLoose(text);
	if (parsed === undefined) throw new LlmError(`could not parse JSON: ${text.slice(0, 120)}`, 'bad_response');
	return parsed as T;
}

export function parseJsonLoose(text: string): unknown {
	const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
	const candidate = fenced ? fenced[1] : text;
	try {
		return JSON.parse(candidate);
	} catch {
		const start = candidate.search(/[{[]/);
		const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
		if (start >= 0 && end > start) {
			try {
				return JSON.parse(candidate.slice(start, end + 1));
			} catch {
				return undefined;
			}
		}
		return undefined;
	}
}

// ---------- Speech (Workers AI) ----------

const AURA = '@cf/deepgram/aura-2-en';
const MELO = '@cf/myshell-ai/melotts';
const WHISPER = '@cf/openai/whisper-large-v3-turbo';
/** Primes speech recognition with names it would otherwise mishear (Indian English, local places). */
const WHISPER_HINT =
	'Hey Jarvis, it is Mohit. Bengaluru, Bangalore, Nagpur, Hoodi, Whitefield, Koramangala, Indiranagar, Rajajinagar, HSR Layout, Hebbal, Marathahalli, Electronic City, Jayanagar, Yelahanka, Majestic, Futala, Sitabuldi, Dharampeth, mandir, yaar.';

export class WorkersSpeech implements Speech {
	constructor(
		private ai: Ai,
		private store: Store,
		private now: () => Date,
		private speaker = 'apollo',
		private dailyChars = 3000,
		private llmFallback?: Llm,
		private edge: ((text: string, voiceId: string) => Promise<Uint8Array>) | null = (t, v) => edgeSynthesize(t, v),
		private eleven: ElevenLabs | null = null,
	) {}

	async transcribe(audio: Uint8Array, mime: string): Promise<string> {
		try {
			const res: any = await (this.ai as any).run(WHISPER, { audio: toBase64(audio), language: 'en', vad_filter: true, initial_prompt: WHISPER_HINT });
			const text = String(res?.text ?? '').trim();
			if (text) return text;
		} catch (e) {
			console.warn('whisper failed', e);
		}
		if (!this.llmFallback) return '';
		const text = await this.llmFallback.generate({
			system: 'You transcribe voice notes. Output only the exact words spoken, nothing else.',
			turns: [{ role: 'user', text: 'Transcribe this voice note.' }],
			audio: { mime, data: audio },
			temperature: 0,
		});
		return text.trim();
	}

	/**
	 * Voices in order of quality: Microsoft neural (free, most human), Deepgram Aura (daily budget),
	 * then MeloTTS. Returns null if all fail, and the caller sends text instead.
	 */
	async synthesize(text: string, voice?: string): Promise<{ audio: Uint8Array; mime: string } | null> {
		const clean = speakable(text);
		if (!clean) return null;
		const errors: string[] = [];
		const at = utc(this.now());
		const fallback = this.eleven ? DEFAULT_VOICE : FALLBACK_EDGE_VOICE;
		let voiceKey = voice ?? ((await this.store.get('tts_voice')) || fallback);
		let v = VOICES[voiceKey] ?? VOICES[fallback];
		if (v.engine === 'eleven') {
			if (this.eleven) {
				try {
					const audio = await this.eleven.synthesize(clean, v.id, localDate(this.now()));
					await this.store.diag('voice', true, `ElevenLabs (${voiceKey})`, at);
					return { audio, mime: 'audio/mpeg' };
				} catch (e) {
					errors.push(`ElevenLabs: ${String(e).replace(/^Error: /, '').slice(0, 160)}`);
				}
			}
			voiceKey = FALLBACK_EDGE_VOICE;
			v = VOICES[voiceKey];
		}
		if (this.edge) {
			try {
				const audio = await this.edge(clean, v.id);
				await this.store.diag('voice', errors.length === 0, [`Microsoft voice (${voiceKey})`, ...errors].join('; '), at);
				return { audio, mime: 'audio/mpeg' };
			} catch (e) {
				errors.push(`natural voice: ${String(e).slice(0, 120)}`);
			}
		}
		const key = `tts_chars:${localDate(this.now())}`;
		const used = Number((await this.store.get(key)) ?? 0);
		const ai = this.ai as any;
		if (used + clean.length <= this.dailyChars) {
			try {
				const res = await ai.run(AURA, { text: clean, speaker: this.speaker, encoding: 'opus', container: 'ogg' });
				const audio = await toBytes(res);
				if (audio.length > 100) {
					await this.store.set(key, String(used + clean.length));
					await this.store.diag('voice', errors.length === 0, ['Aura voice', ...errors].join('; '), at);
					return { audio, mime: 'audio/ogg' };
				}
				errors.push('aura: empty audio');
			} catch (e) {
				errors.push(`aura: ${String(e).slice(0, 120)}`);
			}
		} else errors.push('aura: daily budget used');
		try {
			const res = await ai.run(MELO, { prompt: clean, lang: 'en' });
			const audio = await toBytes(res);
			if (audio.length > 100) {
				await this.store.diag('voice', false, ['backup voice', ...errors].join('; '), at);
				return { audio, mime: 'audio/mpeg' };
			}
			errors.push('melo: empty audio');
		} catch (e) {
			errors.push(`melo: ${String(e).slice(0, 120)}`);
		}
		await this.store.diag('voice', false, `no voice: ${errors.join('; ')}`, at);
		return null;
	}
}

/** Strips things that sound bad when read aloud: emoji, markdown, URLs. */
export function speakable(text: string): string {
	return text
		.replace(/https?:\/\/\S+/g, '')
		.replace(/[*_`#>~|]/g, '')
		.replace(/\p{Extended_Pictographic}|️|‍/gu, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{2,}/g, '\n')
		.trim()
		.slice(0, 1800);
}

async function toBytes(res: unknown): Promise<Uint8Array> {
	if (!res) return new Uint8Array();
	if (res instanceof Uint8Array) return res;
	if (res instanceof ArrayBuffer) return new Uint8Array(res);
	if (typeof Response !== 'undefined' && res instanceof Response) return new Uint8Array(await res.arrayBuffer());
	if (typeof ReadableStream !== 'undefined' && res instanceof ReadableStream) return new Uint8Array(await new Response(res).arrayBuffer());
	const r = res as any;
	if (typeof r.audio === 'string') return fromBase64(r.audio);
	if (r.audio) return toBytes(r.audio);
	return new Uint8Array();
}

export function toBase64(bytes: Uint8Array): string {
	let s = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
	const s = atob(b64);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}

// ---------- Weather & news ----------

const WEATHER_CODES: Record<number, string> = {
	0: 'clear sky',
	1: 'mostly clear',
	2: 'partly cloudy',
	3: 'overcast',
	45: 'foggy',
	48: 'foggy',
	51: 'light drizzle',
	53: 'drizzle',
	55: 'heavy drizzle',
	61: 'light rain',
	63: 'rain',
	65: 'heavy rain',
	80: 'rain showers',
	81: 'rain showers',
	82: 'violent rain showers',
	95: 'thunderstorms',
	96: 'thunderstorms with hail',
	99: 'thunderstorms with hail',
};

export class PublicFeeds implements Feeds {
	constructor(
		private lat: number,
		private lon: number,
		private fetcher: typeof fetch = (input, init) => fetch(input, init),
	) {}

	async weather(): Promise<Weather | null> {
		try {
			const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.lat}&longitude=${this.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current=temperature_2m&timezone=Asia%2FKolkata&forecast_days=1`;
			const res = await this.fetcher(url);
			if (!res.ok) return null;
			const d: any = await res.json();
			const code = d.daily?.weather_code?.[0];
			const rain = d.daily?.precipitation_probability_max?.[0];
			const parts = [
				`${WEATHER_CODES[code] ?? 'mixed weather'}`,
				`${Math.round(d.daily?.temperature_2m_min?.[0])}–${Math.round(d.daily?.temperature_2m_max?.[0])}°C`,
				`now ${Math.round(d.current?.temperature_2m)}°C`,
				rain != null ? `${rain}% chance of rain` : '',
			].filter(Boolean);
			return { summary: parts.join(', ') };
		} catch {
			return null;
		}
	}

	async news(): Promise<string[]> {
		const feeds = [
			'https://news.google.com/rss/search?q=artificial+intelligence+when:1d&hl=en-IN&gl=IN&ceid=IN:en',
			'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en',
		];
		const titles: string[] = [];
		for (const url of feeds) {
			try {
				const res = await this.fetcher(url);
				if (!res.ok) continue;
				titles.push(...parseRssTitles(await res.text()).slice(0, 8));
			} catch {
				// one feed failing is fine
			}
		}
		const seen = new Set<string>();
		return titles.filter((t) => {
			const k = t.toLowerCase().slice(0, 50);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}
}

export function parseRssTitles(xml: string): string[] {
	const out: string[] = [];
	const re = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml))) out.push(decodeEntities(m[1]).trim());
	return out.filter(Boolean);
}

export function decodeEntities(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&amp;/g, '&');
}
