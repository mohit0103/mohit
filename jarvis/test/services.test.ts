import { describe, expect, it } from 'vitest';
import { ElevenLabs } from '../src/eleven';
import worker, { webhookSecret } from '../src/index';
import { Gemini, TelegramApi, WorkersSpeech, parseJsonLoose, parseRssTitles, speakable, splitText, thinkingFor } from '../src/services';
import { Store } from '../src/store';
import { LlmError } from '../src/types';
import { fakeD1 } from './harness';

type Call = { url: string; init?: RequestInit };
function fakeFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const calls: Call[] = [];
	const f = (async (input: any, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		return respond(url, init);
	}) as typeof fetch;
	return { f, calls };
}
const ok = (text: string) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
const noSleep = async () => {};

describe('Gemini client', () => {
	it('falls through models on quota and missing-model errors', async () => {
		const { f, calls } = fakeFetch((url) => {
			if (url.includes('model-a')) return new Response('quota', { status: 429 });
			if (url.includes('model-b')) return new Response('not found', { status: 404 });
			return ok('{"reply":"hi"}');
		});
		const g = new Gemini('key', 'model-a, model-b ,model-c', f, noSleep);
		expect(await g.generate({ system: 's', turns: [{ role: 'user', text: 'u' }], schema: { type: 'OBJECT' } })).toBe('{"reply":"hi"}');
		expect(calls.map((c) => c.url.split('/models/')[1].split(':')[0])).toEqual(['model-a', 'model-b', 'model-c']);
		const body = JSON.parse(String(calls[2].init!.body));
		expect(body.generationConfig.responseMimeType).toBe('application/json');
		expect((calls[2].init!.headers as any)['x-goog-api-key']).toBe('key'); // key in a header, not the URL
		expect(calls[2].url).not.toContain('key=');
	});

	it('retries a server error once before moving on', async () => {
		let n = 0;
		const { f } = fakeFetch(() => (++n === 1 ? new Response('oops', { status: 503 }) : ok('fine')));
		expect(await new Gemini('k', 'only', f, noSleep).generate({ system: 's', turns: [{ role: 'user', text: 'u' }] })).toBe('fine');
	});

	it('reports quota exhaustion and bad keys distinctly', async () => {
		const quota = new Gemini('k', 'a,b', fakeFetch(() => new Response('x', { status: 429 })).f, noSleep);
		await expect(quota.generate({ system: '', turns: [{ role: 'user', text: '' }] })).rejects.toMatchObject({ kind: 'quota' });
		const bad = new Gemini('k', 'a', fakeFetch(() => new Response('API key not valid', { status: 400 })).f, noSleep);
		await expect(bad.generate({ system: '', turns: [{ role: 'user', text: '' }] })).rejects.toMatchObject({ kind: 'config' });
		await expect(new Gemini('', 'a').generate({ system: '', turns: [] })).rejects.toBeInstanceOf(LlmError);
	});

	it('treats an empty or blocked answer as a failure and tries the next model', async () => {
		const { f } = fakeFetch((url) => (url.includes('/a:') ? Response.json({ candidates: [{ finishReason: 'SAFETY' }] }) : ok('ok')));
		expect(await new Gemini('k', 'a,b', f, noSleep).generate({ system: '', turns: [{ role: 'user', text: '' }] })).toBe('ok');
	});

	it('sends voice notes inline with the last turn', async () => {
		const { f, calls } = fakeFetch(() => ok('hello'));
		await new Gemini('k', 'a', f, noSleep).generate({ system: '', turns: [{ role: 'user', text: 'transcribe' }], audio: { mime: 'audio/ogg', data: new Uint8Array([1, 2, 3]) } });
		const parts = JSON.parse(String(calls[0].init!.body)).contents[0].parts;
		expect(parts[1].inline_data).toEqual({ mime_type: 'audio/ogg', data: 'AQID' });
	});
});

describe('helpers', () => {
	it('parses loose JSON', () => {
		expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
		expect(parseJsonLoose('Sure! {"a":2} hope that helps')).toEqual({ a: 2 });
		expect(parseJsonLoose('nope')).toBeUndefined();
	});
	it('splits long Telegram messages on line breaks', () => {
		const parts = splitText(Array.from({ length: 100 }, (_, i) => `line ${i} ${'x'.repeat(50)}`).join('\n'), 1000);
		expect(parts.every((p) => p.length <= 1000)).toBe(true);
		expect(parts.join('\n')).toContain('line 99');
	});
	it('reads RSS titles', () => {
		const xml = '<rss><channel><title>Feed</title><item><title><![CDATA[AI &amp; you]]></title></item><item><title>Chips &#8377; up</title></item></channel></rss>';
		expect(parseRssTitles(xml)).toEqual(['AI & you', 'Chips ₹ up']);
	});
	it('makes text speakable', () => {
		expect(speakable('**Hey** Mohit 🎉 see https://x.com/a now')).toBe('Hey Mohit see now');
	});
});

describe('voice budget', () => {
	function fakeAi(fail: string[] = []) {
		const runs: string[] = [];
		const ai = {
			run: async (model: string) => {
				runs.push(model);
				if (fail.some((f) => model.includes(f))) throw new Error('model down');
				if (model.includes('aura')) return new Response(new Uint8Array(500)).body;
				if (model.includes('melo')) return { audio: Buffer.from(new Uint8Array(400)).toString('base64') };
				return { text: 'hello there' };
			},
		};
		return { ai: ai as unknown as Ai, runs };
	}

	it('uses the natural voice until the daily budget, then the backup voice', async () => {
		const { ai, runs } = fakeAi();
		const now = () => new Date('2026-10-03T10:00:00+05:30');
		const s = new WorkersSpeech(ai, new Store(fakeD1()), now, 'apollo', 100, undefined, null);
		expect((await s.synthesize('a'.repeat(80)))?.mime).toBe('audio/ogg');
		expect((await s.synthesize('b'.repeat(80)))?.mime).toBe('audio/mpeg');
		expect(runs).toEqual(['@cf/deepgram/aura-2-en', '@cf/myshell-ai/melotts']);
	});

	it('returns null (send text) when every voice fails', async () => {
		const { ai } = fakeAi(['aura', 'melo']);
		const s = new WorkersSpeech(ai, new Store(fakeD1()), () => new Date(), 'apollo', 3000, undefined, null);
		expect(await s.synthesize('hello')).toBeNull();
		expect(await s.synthesize('🎉')).toBeNull();
	});

	it('transcribes with Whisper and falls back to Gemini', async () => {
		const { ai } = fakeAi(['whisper']);
		const llm = { generate: async () => 'from gemini' };
		const s = new WorkersSpeech(ai, new Store(fakeD1()), () => new Date(), 'apollo', 3000, llm, null);
		expect(await s.transcribe(new Uint8Array([1]), 'audio/ogg')).toBe('from gemini');
		const ok = new WorkersSpeech(fakeAi().ai, new Store(fakeD1()), () => new Date());
		expect(await ok.transcribe(new Uint8Array([1]), 'audio/ogg')).toBe('hello there');
	});
});

describe('Telegram client', () => {
	it('sends JSON for text, multipart for voice, and surfaces API errors', async () => {
		const { f, calls } = fakeFetch((url) => (url.endsWith('/sendMessage') ? Response.json({ ok: true, result: {} }) : url.endsWith('/sendVoice') ? Response.json({ ok: false, description: 'Bad Request: wrong file' }) : Response.json({ ok: true })));
		const tg = new TelegramApi('TOKEN', f);
		await tg.sendMessage('1', 'hi', [[{ text: 'Done', data: 'r:done:1' }]]);
		const body = JSON.parse(String(calls[0].init!.body));
		expect(body.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'Done', callback_data: 'r:done:1' });
		await expect(tg.sendVoice('1', new Uint8Array([1]), 'audio/ogg', 'cap')).rejects.toThrow(/wrong file/);
		expect(calls[1].init!.body).toBeInstanceOf(FormData);
	});
});

describe('webhook endpoint', () => {
	const env = { DB: fakeD1(), TELEGRAM_BOT_TOKEN: 'T', GEMINI_API_KEY: 'k' } as any;
	const ctx = { waitUntil: (_p: Promise<unknown>) => {}, passThroughOnException() {} } as any;

	it('rejects calls without the Telegram secret header', async () => {
		const res = await worker.fetch(new Request('https://j.dev/telegram', { method: 'POST', body: '{}' }), env, ctx);
		expect(res.status).toBe(403);
	});

	it('accepts Telegram calls with the right secret and answers immediately', async () => {
		const pending: Promise<unknown>[] = [];
		const res = await worker.fetch(
			new Request('https://j.dev/telegram', { method: 'POST', body: JSON.stringify({ update_id: 1 }), headers: { 'x-telegram-bot-api-secret-token': await webhookSecret('T') } }),
			env,
			{ ...ctx, waitUntil: (p: Promise<unknown>) => pending.push(p) },
		);
		expect(res.status).toBe(200);
		expect(pending.length).toBe(1);
		await Promise.all(pending);
	});

	it('serves a health check', async () => {
		const res = await worker.fetch(new Request('https://j.dev/health'), env, ctx);
		expect(await res.json()).toMatchObject({ ok: true });
	});
});

describe('model discovery', () => {
	it('finds current Flash models when the configured ones no longer exist', async () => {
		const { f, calls } = fakeFetch((url) => {
			if (url.includes('/models?')) {
				return Response.json({
					models: [
						{ name: 'models/gemini-4.1-flash', supportedGenerationMethods: ['generateContent'] },
						{ name: 'models/gemini-4.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
						{ name: 'models/gemini-4.1-flash-tts', supportedGenerationMethods: ['generateContent'] },
						{ name: 'models/gemini-4.1-pro', supportedGenerationMethods: ['generateContent'] },
						{ name: 'models/text-embedding-9', supportedGenerationMethods: ['embedContent'] },
					],
				});
			}
			if (url.includes('gemini-4.1-flash:')) return ok('hello from the future');
			return new Response('not found', { status: 404 });
		});
		const g = new Gemini('k', 'old-a,old-b', f, noSleep);
		expect(await g.generate({ system: '', turns: [{ role: 'user', text: 'hi' }] })).toBe('hello from the future');
		expect(calls.filter((c) => c.url.includes('/models?')).length).toBe(1);
	});
});

describe('natural voice first', () => {
	it('uses the Microsoft neural voice and the chosen voice, falling back to Aura on failure', async () => {
		const store = new Store(fakeD1());
		const used: string[] = [];
		const edgeOk = async (_t: string, v: string) => {
			used.push(v);
			return new Uint8Array(300);
		};
		const ai = { run: async () => new Response(new Uint8Array(500)).body } as unknown as Ai;
		const s = new WorkersSpeech(ai, store, () => new Date(), 'apollo', 3000, undefined, edgeOk);
		expect((await s.synthesize('hello'))?.mime).toBe('audio/mpeg');
		await store.set('tts_voice', 'prabhat');
		await s.synthesize('hello');
		expect(await s.synthesize('hello', 'brian')).not.toBeNull();
		expect(used).toEqual(['en-US-AndrewMultilingualNeural', 'en-IN-PrabhatNeural', 'en-US-BrianMultilingualNeural']);

		const broken = new WorkersSpeech(ai, store, () => new Date(), 'apollo', 3000, undefined, async () => {
			throw new Error('blocked');
		});
		expect((await broken.synthesize('hello'))?.mime).toBe('audio/ogg');
		const d = (await store.diags()).find((x) => x.name === 'voice')!;
		expect(d.ok).toBe(false);
		expect(d.info).toMatch(/natural voice: Error: blocked/);
	});
});

describe('ElevenLabs voice', () => {


	function elFetch(status = 200) {
		const calls: string[] = [];
		const f = (async (url: any, init?: any) => {
			calls.push(`${init?.method ?? 'GET'} ${String(url)}`);
			if (String(url).endsWith('/voices')) return Response.json({ voices: [{ name: 'Chris', voice_id: 'chris-id' }, { name: 'Will - friendly', voice_id: 'will-id' }] });
			if (status !== 200) return new Response('{"detail":{"status":"quota_exceeded"}}', { status });
			return new Response(new Uint8Array(400));
		}) as typeof fetch;
		return { f, calls };
	}

	it('is used first, resolves voices by name once, and meters the monthly allowance', async () => {
		const store = new Store(fakeD1());
		const { f, calls } = elFetch();
		const el = new ElevenLabs('k', store, 30, f);
		const edge = async () => new Uint8Array(300);
		const s = new WorkersSpeech({ run: async () => null } as unknown as Ai, store, () => new Date('2026-10-03T10:00:00Z'), 'apollo', 3000, undefined, edge, el);
		expect((await s.synthesize('hello there'))?.mime).toBe('audio/mpeg');
		await s.synthesize('hello again');
		expect(calls.filter((c) => c.endsWith('/voices')).length).toBe(1);
		expect(calls.filter((c) => c.includes('/text-to-speech/chris-id')).length).toBe(2);
		// Allowance (30 chars) is now spent: falls back to the Microsoft voice and says why.
		await s.synthesize('one more message please');
		const d = (await store.diags()).find((x) => x.name === 'voice')!;
		expect(d.info).toMatch(/Microsoft voice \(andrew\); ElevenLabs: monthly allowance used/);
	});

	it('stops calling ElevenLabs for the month after a quota error', async () => {
		const store = new Store(fakeD1());
		const { f, calls } = elFetch(402);
		const el = new ElevenLabs('k', store, 10000, f);
		await expect(el.synthesize('hi', 'Will', '2026-10-03')).rejects.toThrow(/ElevenLabs 402/);
		await expect(el.synthesize('hi', 'Will', '2026-10-04')).rejects.toThrow(/quota used up/);
		expect(calls.filter((c) => c.startsWith('POST')).length).toBe(1);
		await expect(el.synthesize('hi', 'Will', '2026-11-01')).rejects.toThrow(/ElevenLabs 402/); // new month, tries again
	});
});

describe('fast replies', () => {
	it('asks for minimal thinking in the right form per model generation', () => {
		expect(thinkingFor('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 });
		expect(thinkingFor('gemini-3.8-flash')).toEqual({ thinkingLevel: 'minimal' });
	});

	it('retries without the thinking setting if a model rejects it, and remembers the model that worked', async () => {
		const bodies: any[] = [];
		const { f, calls } = fakeFetch((url, init) => {
			const b = JSON.parse(String(init!.body));
			bodies.push(b);
			if (url.includes('/a:')) return new Response('not found', { status: 404 });
			if (b.generationConfig.thinkingConfig) return new Response('Unknown field thinking_level', { status: 400 });
			return ok('hey!');
		});
		let saved: string | null = null;
		const memo = { get: async () => saved, set: async (m: string) => void (saved = m) };
		const g = new Gemini('k', 'a,b', f, noSleep, memo);
		expect(await g.generate({ system: '', turns: [{ role: 'user', text: 'hi' }], fast: true })).toBe('hey!');
		expect(saved).toBe('b');
		calls.length = 0;
		await g.generate({ system: '', turns: [{ role: 'user', text: 'hi' }] });
		expect(calls[0].url).toContain('/b:'); // skips the dead model next time
	});
});

describe('web search', () => {
	it('adds Google Search for search requests and drops it if a model refuses', async () => {
		const bodies: any[] = [];
		const { f } = fakeFetch((_url, init) => {
			const b = JSON.parse(String(init!.body));
			bodies.push(b);
			return b.tools ? new Response('Search grounding is not supported', { status: 400 }) : ok('answer');
		});
		const g = new Gemini('k', 'm', f, noSleep);
		expect(await g.generate({ system: '', turns: [{ role: 'user', text: 'score?' }], search: true })).toBe('answer');
		expect(bodies[0].tools).toEqual([{ google_search: {} }]);
		expect(bodies[1].tools).toBeUndefined();
		// Never combined with JSON output.
		await g.generate({ system: '', turns: [{ role: 'user', text: 'x' }], search: true, schema: { type: 'OBJECT' } });
		expect(bodies.at(-1).tools).toBeUndefined();
	});
});
