// Real implementations of the external services: Telegram, Gemini, Workers AI speech, weather and news.
import type { AgentMsg, AgentStepRequest, AgentStepResult, Feeds, InlineButton, Llm, LlmRequest, Speech, Telegram, Weather } from './types';
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

// Each model has its own free daily quota, so a longer list means more free capacity. Unknown names sit out for a day.
export const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

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
	/** Model health read once per invocation (each D1 read counts against the free plan's 50 queries). */
	private healthCache: string | null | undefined;

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
		return this.run({ tier: req.tier, fast: req.fast, search: Boolean(req.search && !req.schema) }, body, (data) => {
			const text = data?.candidates?.[0]?.content?.parts
				?.filter((p: any) => !p.thought)
				.map((p: any) => p.text ?? '')
				.join('')
				.trim();
			return text || undefined;
		});
	}

	/** One agent step with native function calling. Tool results go back as functionResponse parts. */
	async agentStep(req: AgentStepRequest): Promise<AgentStepResult> {
		const contents: any[] = [];
		const lastUser = req.messages.map((m) => m.role).lastIndexOf('user');
		req.messages.forEach((m, i) => {
			if (m.role === 'user') {
				const parts: any[] = [{ text: m.text }];
				if (i === lastUser) for (const img of req.images ?? []) parts.push({ inline_data: { mime_type: img.mime, data: toBase64(img.data) } });
				contents.push({ role: 'user', parts });
			} else if (m.role === 'model') {
				if (m.by?.startsWith('gemini') && m.raw) contents.push(m.raw);
				else {
					// Steps answered by another brain carry no thought signature; Gemini accepts this documented placeholder.
					const parts: any[] = m.text ? [{ text: m.text }] : [];
					m.calls.forEach((c, j) => parts.push({ functionCall: { name: c.name, args: c.args }, ...(j === 0 ? { thoughtSignature: 'skip_thought_signature_validator' } : {}) }));
					if (parts.length) contents.push({ role: 'model', parts });
				}
			} else {
				contents.push({ role: 'user', parts: m.results.map((r) => ({ functionResponse: { name: r.name, response: { result: r.result } } })) });
			}
		});
		const body: any = {
			system_instruction: { parts: [{ text: req.system }] },
			contents,
			tools: [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
			toolConfig: { functionCallingConfig: { mode: req.toolChoice === 'none' ? 'NONE' : 'AUTO' } },
			generationConfig: { temperature: req.temperature ?? 0.7 },
		};
		return this.run({ fast: req.fast, agent: true }, body, (data) => {
			const content = data?.candidates?.[0]?.content;
			const parts: any[] = content?.parts ?? [];
			const text = parts
				.filter((p) => !p.thought && typeof p.text === 'string')
				.map((p) => p.text)
				.join('')
				.trim();
			const calls = parts
				.filter((p) => p.functionCall?.name)
				.map((p, i) => ({ id: String(p.functionCall.id ?? `call_${contents.length}_${i}`), name: String(p.functionCall.name), args: (p.functionCall.args ?? {}) as Record<string, unknown> }));
			if (!text && !calls.length) return undefined;
			return { text, calls, raw: { role: 'model', parts }, by: 'gemini' };
		});
	}

	/**
	 * The shared model loop: skips resting models, tries each in order, benches models that hit their quota or don't
	 * exist, and drops the thinking or search setting when a model rejects it.
	 */
	private async run<T>(opts: { tier?: 'best' | 'light'; fast?: boolean; search?: boolean; agent?: boolean }, body: any, parse: (data: any) => T | undefined): Promise<T> {
		if (!this.key) throw new LlmError('GEMINI_API_KEY is not set', 'config');
		if (this.healthCache === undefined) this.healthCache = (await this.memo?.get().catch(() => null)) ?? null;
		const health = parseHealth(this.healthCache);
		const startHealth = JSON.stringify(health);
		const now = this.clock();
		const available = this.models.filter((m) => !(health[m]?.until > now));
		// Every model is resting (quota or missing): fail fast instead of burning requests.
		if (!available.length) throw new LlmError('all Gemini models are resting (free quota used up)', 'quota');
		const order = opts.tier === 'light' ? [...available.filter((m) => m.includes('lite')), ...available.filter((m) => !m.includes('lite'))] : available;
		const benched = (model: string, minutes: number, why: string) => (health[model] = { until: now + minutes * 60_000, why });
		const save = async () => {
			if (JSON.stringify(health) === startHealth) return;
			this.healthCache = JSON.stringify(health);
			await this.memo?.set(this.healthCache).catch(() => undefined);
		};
		let lastKind: LlmError['kind'] = 'unavailable';
		let lastMsg = '';
		const skipped: string[] = [];
		for (const model of order) {
			let thinking = opts.fast || opts.agent ? thinkingFor(model) : undefined;
			let search = Boolean(opts.search);
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
					const out = parse(data);
					if (out !== undefined) {
						delete health[model];
						await save();
						if (out && typeof out === 'object' && 'by' in out) (out as { by?: string }).by = `${model.replace(/^gemini-/, 'gemini:')}${skipped.length ? `(after ${skipped.join(',')})` : ''}`;
						return out;
					}
					lastKind = 'bad_response';
					lastMsg = `empty answer from ${model} (${data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? 'unknown'})`;
					break; // try the next model
				}
				lastMsg = `${model}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`;
				skipped.push(`${model.replace(/^gemini-/, '')}:${res.status}`);
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

/** Light thinking for quick replies: Gemini 2.x takes a token budget, Gemini 3+ a level (low, medium or high). */
export function thinkingFor(model: string): Record<string, unknown> {
	return /gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: 'low' };
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
		private groq: GroqLlm | null = null,
	) {}

	async transcribe(audio: Uint8Array, mime: string): Promise<string> {
		if (this.groq) {
			try {
				const text = await this.groq.transcribe(audio, mime, WHISPER_HINT);
				if (text) return text;
			} catch (e) {
				console.warn('groq transcription failed', e);
			}
		}
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

	async weatherFor(place: string, date?: string): Promise<string | null> {
		try {
			const geo: any = await (await this.fetcher(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place.split(',')[0].trim())}&count=1&language=en`)).json();
			const loc = geo?.results?.[0];
			if (!loc) return null;
			const res = await this.fetcher(
				`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current=temperature_2m&timezone=auto&forecast_days=16`,
			);
			if (!res.ok) return null;
			const d: any = await res.json();
			const days: string[] = d.daily?.time ?? [];
			const i = date ? days.indexOf(date) : 0;
			if (i < 0) return `${loc.name}: no forecast for ${date} yet (forecasts go about 2 weeks ahead).`;
			const rain = d.daily?.precipitation_probability_max?.[i];
			const parts = [
				`${loc.name}${loc.admin1 ? `, ${loc.admin1}` : ''}${loc.country ? `, ${loc.country}` : ''} on ${days[i]}`,
				WEATHER_CODES[d.daily?.weather_code?.[i]] ?? 'mixed weather',
				`${Math.round(d.daily?.temperature_2m_min?.[i])}–${Math.round(d.daily?.temperature_2m_max?.[i])}°C`,
				i === 0 && d.current ? `now ${Math.round(d.current.temperature_2m)}°C` : '',
				rain != null ? `${rain}% chance of rain` : '',
			].filter(Boolean);
			return parts.join(', ');
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

// ---------- Backup brain: Cloudflare Workers AI ----------

const BACKUP_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** An open model on Cloudflare's free allowance, used when every Gemini model is out of free quota. Text only. */
export class WorkersLlm implements Llm {
	constructor(private ai: Ai) {}

	async generate(req: LlmRequest): Promise<string> {
		const base = req.search ? `${req.system}\n\n(You can't browse the web right now. If this needs current information, say you couldn't look it up instead of guessing.)` : req.system;
		const system = req.schema ? `${base}\n\nRespond with ONLY a JSON object matching this schema (no prose, no code fences):\n${JSON.stringify(req.schema)}` : base;
		const messages = [{ role: 'system', content: system }, ...req.turns.map((t) => ({ role: t.role === 'model' ? 'assistant' : 'user', content: t.text }))];
		const res: any = await (this.ai as any).run(BACKUP_MODEL, { messages, max_tokens: req.schema ? 1200 : 400, temperature: req.temperature ?? 0.7 });
		const text = typeof res?.response === 'string' ? res.response : JSON.stringify(res?.response ?? '');
		if (!text.trim()) throw new LlmError('backup model returned nothing', 'bad_response');
		return text.trim();
	}

	/** No native tool calling here: the model asks for a tool with a one-line JSON object instead. */
	async agentStep(req: AgentStepRequest): Promise<AgentStepResult> {
		if (req.images?.length) throw new LlmError('backup brain cannot see photos', 'bad_response');
		const toolHelp =
			req.toolChoice === 'none'
				? 'Answer him now in plain words.'
				: `TOOLS you can use:\n${req.tools.map((t) => `- ${t.name}: ${t.description} Args: ${JSON.stringify(toJsonSchema(t.parameters))}`).join('\n')}\n\nTo use a tool, your whole reply must be ONLY one JSON object, e.g. {"tool": "web_search", "args": {"query": "..."}}. You'll get the result, then you can reply to him. Use a tool whenever you need a fact, the weather, his past or to actually do something (remind, save, forget); never say "let me check" or "I'll do it" without the tool. Otherwise reply to him in plain words.`;
		const turns = flattenAgent(req.messages);
		const text = await this.generate({ system: `${req.system}\n\n${toolHelp}`, turns, temperature: req.temperature });
		const parsed = req.toolChoice === 'none' ? undefined : (parseJsonLoose(text) as { tool?: unknown; args?: unknown } | undefined);
		if (parsed && typeof parsed.tool === 'string' && req.tools.some((t) => t.name === parsed.tool)) {
			const args = parsed.args && typeof parsed.args === 'object' ? (parsed.args as Record<string, unknown>) : {};
			return { text: '', calls: [{ id: `cf_${req.messages.length}`, name: parsed.tool, args }], by: 'cloudflare' };
		}
		return { text, calls: [], by: 'cloudflare' };
	}
}

/** Agent history as plain alternating turns, for brains without native tool calling. */
export function flattenAgent(messages: AgentMsg[]): { role: 'user' | 'model'; text: string }[] {
	const turns: { role: 'user' | 'model'; text: string }[] = [];
	const push = (role: 'user' | 'model', text: string) => {
		if (!text) return;
		const last = turns[turns.length - 1];
		if (last && last.role === role) last.text += `\n${text}`;
		else turns.push({ role, text });
	};
	for (const m of messages) {
		if (m.role === 'user') push('user', m.text);
		else if (m.role === 'model') push('model', [m.text, ...m.calls.map((c) => JSON.stringify({ tool: c.name, args: c.args }))].filter(Boolean).join('\n'));
		else push('user', m.results.map((r) => `[tool ${r.name} result] ${JSON.stringify(r.result).slice(0, 3000)}`).join('\n'));
	}
	while (turns.length && turns[0].role === 'model') turns.shift();
	if (!turns.length || turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', text: '(continue)' });
	return turns;
}

/** Gemini's schema subset (type: "OBJECT") to standard JSON Schema (type: "object"). */
export function toJsonSchema(schema: unknown): unknown {
	if (Array.isArray(schema)) return schema.map(toJsonSchema);
	if (!schema || typeof schema !== 'object') return schema;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(schema)) out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : toJsonSchema(v);
	return out;
}

/**
 * Tries brains in order (Gemini, then Groq, then Cloudflare) so Jarvis never goes silent when one is out of
 * free quota. Requests with audio or images only go to brains that accept them.
 */
export class FallbackLlm implements Llm {
	private chain: { name: string; llm: Llm; media: boolean }[];
	constructor(
		primary: Llm,
		backups: Llm | null | { name: string; llm: Llm; media?: boolean }[],
		private onBackup?: (why: string) => Promise<void>,
	) {
		const rest = Array.isArray(backups) ? backups.map((b) => ({ ...b, media: Boolean(b.media) })) : backups ? [{ name: 'backup', llm: backups, media: false }] : [];
		this.chain = [{ name: 'gemini', llm: primary, media: true }, ...rest];
	}

	async generate(req: LlmRequest): Promise<string> {
		const hasMedia = Boolean(req.audio || req.images?.length);
		// Background work goes to the backups first, saving Gemini's small daily quota for live chat and photos.
		const ordered = req.tier === 'light' && this.chain.length > 1 ? [...this.chain.slice(1, -1), this.chain[0], ...this.chain.slice(-1)] : this.chain;
		const usable = ordered.filter((b) => b.media || !hasMedia);
		let lastError: unknown;
		for (let i = 0; i < usable.length; i++) {
			try {
				const text = await usable[i].llm.generate(req);
				if (i > 0 && req.tier !== 'light') await this.onBackup?.(`answered by ${usable[i].name} (${String(lastError).slice(0, 100)})`).catch(() => undefined);
				return text;
			} catch (e) {
				lastError = e;
			}
		}
		throw lastError instanceof Error ? lastError : new LlmError(String(lastError), 'unavailable');
	}

	async agentStep(req: AgentStepRequest): Promise<AgentStepResult> {
		const usable = this.chain.filter((b) => b.media || !req.images?.length);
		let lastError: unknown;
		for (let i = 0; i < usable.length; i++) {
			const { llm, name } = usable[i];
			try {
				const out = llm.agentStep
					? await llm.agentStep(req)
					: { text: await llm.generate({ system: req.system, turns: flattenAgent(req.messages), temperature: req.temperature, fast: req.fast }), calls: [], by: name };
				if (i > 0) await this.onBackup?.(`agent step by ${name} (${String(lastError).slice(0, 100)})`).catch(() => undefined);
				return { ...out, by: out.by ?? name };
			} catch (e) {
				lastError = e;
			}
		}
		throw lastError instanceof Error ? lastError : new LlmError(String(lastError), 'unavailable');
	}
}

// ---------- Groq (OpenAI-compatible, very fast, generous free tier) ----------

export const GROQ_MODELS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];

export class GroqLlm implements Llm {
	private models: string[];
	/** Models that hit a rate limit, resting until the time Groq gave (per invocation). */
	private resting = new Map<string, number>();
	constructor(
		private key: string,
		models?: string,
		private fetcher: typeof fetch = (input, init) => fetch(input, init),
		private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
		private clock: () => number = Date.now,
	) {
		this.models = models
			? models
					.split(',')
					.map((m) => m.trim())
					.filter(Boolean)
			: GROQ_MODELS;
	}

	async generate(req: LlmRequest): Promise<string> {
		if (req.audio || req.images?.length) throw new LlmError('groq brain is text-only here', 'bad_response');
		const system = req.schema ? `${req.system}\n\nRespond with ONLY a JSON object matching this schema:\n${JSON.stringify(req.schema)}` : req.system;
		const messages = [{ role: 'system', content: system }, ...req.turns.map((t) => ({ role: t.role === 'model' ? 'assistant' : 'user', content: t.text }))];
		// Groq's compound model searches the web on its own, so lookups still work when Gemini is resting.
		const models = req.search && !req.schema ? ['groq/compound-mini', ...this.models] : this.models;
		return this.chat(models, (model) => {
			const body: Record<string, unknown> = { model, messages, temperature: req.temperature ?? 0.7, max_tokens: req.schema ? 1500 : 500 };
			if (req.schema) body.response_format = { type: 'json_object' };
			return body;
		}, (msg) => String(msg?.content ?? '').trim() || undefined);
	}

	/** Native OpenAI-style tool calling. The smartest tool-using model goes first. */
	async agentStep(req: AgentStepRequest): Promise<AgentStepResult> {
		if (req.images?.length) throw new LlmError('groq brain is text-only here', 'bad_response');
		const messages: any[] = [{ role: 'system', content: req.system }];
		for (const m of req.messages) {
			if (m.role === 'user') messages.push({ role: 'user', content: m.text });
			else if (m.role === 'model')
				messages.push({
					role: 'assistant',
					content: m.text || null,
					...(m.calls.length ? { tool_calls: m.calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}),
				});
			else for (const r of m.results) messages.push({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.result).slice(0, 6000) });
		}
		const tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: toJsonSchema(t.parameters) } }));
		const models = ['openai/gpt-oss-120b', ...this.models.filter((m) => m !== 'openai/gpt-oss-120b')];
		return this.chat(
			models,
			(model) => ({ model, messages, tools, tool_choice: req.toolChoice === 'none' ? 'none' : 'auto', temperature: req.temperature ?? 0.7, max_tokens: 700 }),
			(msg) => {
				const text = String(msg?.content ?? '').trim();
				const calls = (msg?.tool_calls ?? []).map((c: any, i: number) => {
					let args: Record<string, unknown> = {};
					try {
						args = JSON.parse(c.function?.arguments || '{}');
					} catch {
						// a malformed call just runs with no arguments; the tool reports what's missing
					}
					return { id: String(c.id ?? `groq_${i}`), name: String(c.function?.name ?? ''), args };
				});
				return text || calls.length ? { text, calls, by: 'groq' } : undefined;
			},
		);
	}

	private async chat<T>(models: string[], build: (model: string) => Record<string, unknown>, parse: (msg: any) => T | undefined): Promise<T> {
		let lastMsg = '';
		let lastKind: LlmError['kind'] = 'unavailable';
		const skipped: string[] = [];
		const awake = models.filter((m) => !((this.resting.get(m) ?? 0) > this.clock()));
		for (const [i, model] of (awake.length ? awake : models).entries()) {
			let res: Response;
			try {
				res = await this.fetcher('https://api.groq.com/openai/v1/chat/completions', {
					method: 'POST',
					headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}` },
					body: JSON.stringify(build(model)),
				});
			} catch (e) {
				lastMsg = String(e);
				continue;
			}
			if (res.ok) {
				const data: any = await res.json().catch(() => null);
				const out = parse(data?.choices?.[0]?.message);
				if (out !== undefined) {
					// Say which model answered and which were skipped (rate limits), for the review timeline.
					if (out && typeof out === 'object' && 'by' in out) (out as { by?: string }).by = `groq:${model.split('/').pop()}${skipped.length ? `(after ${skipped.join(',')})` : ''}`;
					return out;
				}
				lastMsg = `groq ${model}: empty answer`;
				lastKind = 'bad_response';
				continue;
			}
			lastMsg = `groq ${model}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`;
			if (res.status === 401 || res.status === 403) throw new LlmError(lastMsg, 'config');
			lastKind = res.status === 429 ? 'quota' : 'unavailable';
			skipped.push(`${model.split('/').pop()}:${res.status}`);
			if (res.status === 429) {
				// Per-minute limits clear in seconds: for the best model, a short wait beats a weaker model.
				const wait = Number(res.headers.get('retry-after')) || 20;
				if (i === 0 && wait <= 3 && !skipped.slice(0, -1).length) {
					await this.sleep(wait * 1000);
					try {
						const again = await this.fetcher('https://api.groq.com/openai/v1/chat/completions', {
							method: 'POST',
							headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}` },
							body: JSON.stringify(build(model)),
						});
						if (again.ok) {
							const out = parse(((await again.json().catch(() => null)) as any)?.choices?.[0]?.message);
							if (out !== undefined) {
								if (out && typeof out === 'object' && 'by' in out) (out as { by?: string }).by = `groq:${model.split('/').pop()}(waited ${wait}s)`;
								return out;
							}
						}
					} catch {
						// fall through to the next model
					}
				}
				this.resting.set(model, this.clock() + wait * 1000);
			}
		}
		throw new LlmError(lastMsg || 'groq failed', lastKind);
	}

	/** Groq's hosted Whisper: fast, accurate speech-to-text. */
	async transcribe(audio: Uint8Array, mime: string, prompt: string): Promise<string> {
		const form = new FormData();
		form.set('file', new Blob([audio], { type: mime }), mime.includes('ogg') ? 'voice.ogg' : 'voice.mp3');
		form.set('model', 'whisper-large-v3-turbo');
		form.set('language', 'en');
		form.set('prompt', prompt);
		form.set('response_format', 'json');
		const res = await this.fetcher('https://api.groq.com/openai/v1/audio/transcriptions', {
			method: 'POST',
			headers: { authorization: `Bearer ${this.key}` },
			body: form,
		});
		if (!res.ok) throw new Error(`groq transcription ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`);
		const data: any = await res.json();
		return String(data?.text ?? '').trim();
	}
}
