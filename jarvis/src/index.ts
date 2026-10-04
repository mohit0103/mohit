// Worker entry point: the Telegram webhook, a health check, and the cron tick.
import { handleUpdate } from './bot';
import { ImapMail, gmailSocket } from './email/imap';
import { tick } from './scheduler';
import { FallbackLlm, Gemini, GroqLlm, PublicFeeds, TelegramApi, WorkersLlm, WorkersSpeech } from './services';
import { Store } from './store';
import { ElevenLabs } from './eleven';
import { edgeSynthesize } from './edge';
import type { Deps, Env } from './types';
import { countQueries } from './db';
import { EVAL_CASES, runEvalStep } from './eval';

export function makeDeps(env: Env): Deps {
	const db = countQueries(env.DB);
	const store = new Store(db);
	const gemini = new Gemini(env.GEMINI_API_KEY, env.GEMINI_MODELS, undefined, undefined, {
		get: () => store.get('llm_health'),
		set: (h) => store.set('llm_health', h),
	});
	const groq = env.GROQ_API_KEY ? new GroqLlm(env.GROQ_API_KEY, env.GROQ_MODELS) : null;
	const backups = [...(groq ? [{ name: 'groq', llm: groq }] : []), ...(env.AI ? [{ name: 'cloudflare', llm: new WorkersLlm(env.AI) }] : [])];
	const llm = new FallbackLlm(gemini, backups, (why) => store.diag('backup brain', true, why.slice(0, 200), new Date().toISOString()));
	const now = () => new Date();
	return {
		db,
		tg: new TelegramApi(env.TELEGRAM_BOT_TOKEN),
		llm,
		speech: new WorkersSpeech(
			env.AI,
			store,
			now,
			env.TTS_SPEAKER || 'apollo',
			Number(env.TTS_DAILY_CHARS) || 3000,
			llm,
			(t, v) => edgeSynthesize(t, v),
			env.ELEVENLABS_API_KEY ? new ElevenLabs(env.ELEVENLABS_API_KEY, store, Number(env.ELEVENLABS_MONTHLY_CHARS) || 9500) : null,
			groq,
		),
		feeds: new PublicFeeds(Number(env.CITY_LAT) || 12.9716, Number(env.CITY_LON) || 77.5946),
		mail: env.GMAIL_ADDRESS && env.GMAIL_APP_PASSWORD ? new ImapMail(env.GMAIL_ADDRESS, env.GMAIL_APP_PASSWORD, gmailSocket) : null,
		now,
		random: Math.random,
		config: {
			ownerChatId: env.OWNER_CHAT_ID || undefined,
			pairCode: env.PAIR_CODE || undefined,
			name: 'Mohit',
			city: env.CITY || 'Bengaluru',
		},
	};
}

/** Telegram sends this header back on every webhook call; derived from the bot token so no extra secret is needed. */
export async function webhookSecret(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`jarvis-webhook:${token}`));
	return [...new Uint8Array(digest)]
		.slice(0, 24)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export default {
	async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(req.url);
		if (req.method === 'GET' && url.pathname === '/health') {
			const ok = await env.DB.prepare('SELECT 1 AS ok').first().catch(() => null);
			return Response.json({ ok: Boolean(ok), time: new Date().toISOString() });
		}
		if (req.method === 'GET' && url.pathname === '/diag') {
			// Subsystem status for the owner (no memories or messages). Same key as the webhook secret.
			if (req.headers.get('x-jarvis-key') !== (await webhookSecret(env.TELEGRAM_BOT_TOKEN))) return new Response('forbidden', { status: 403 });
			const store = new Store(env.DB);
			const counts = await env.DB.prepare(
				"SELECT (SELECT count(*) FROM facts WHERE superseded_at IS NULL) AS facts, (SELECT count(*) FROM plans) AS plans, (SELECT count(*) FROM emails) AS emails, (SELECT count(*) FROM messages) AS messages",
			).first();
			return Response.json({
				diags: await store.diags(),
				counts,
				features: { gmail: Boolean(env.GMAIL_ADDRESS && env.GMAIL_APP_PASSWORD), elevenlabs: Boolean(env.ELEVENLABS_API_KEY), groq: Boolean(env.GROQ_API_KEY) },
				voice: (await store.get('tts_voice')) ?? 'default',
			});
		}
		if (req.method === 'GET' && url.pathname === '/review') {
			// Recent conversation, timings and self-reviews, for improving Jarvis. Owner key only.
			if (req.headers.get('x-jarvis-key') !== (await webhookSecret(env.TELEGRAM_BOT_TOKEN))) return new Response('forbidden', { status: 403 });
			const hours = Math.min(Number(url.searchParams.get('hours')) || 24, 24 * 14);
			const since = new Date(Date.now() - hours * 3600_000).toISOString();
			const store = new Store(env.DB);
			const messages = (await env.DB.prepare('SELECT role, kind, at, meta, text FROM messages WHERE at >= ? ORDER BY id').bind(since).all()).results;
			const reviews = (await env.DB.prepare("SELECT k, v FROM kv WHERE k LIKE 'review:%' ORDER BY k DESC LIMIT 7").all<{ k: string; v: string }>()).results.map((r) => ({
				date: r.k.slice(7),
				...JSON.parse(r.v),
			}));
			const now = new Date();
			const memory = {
				facts: (await store.facts()).map((f) => f.text),
				plans: (await store.plansBetween(new Date(now.getTime() - 7 * 86_400_000).toISOString(), new Date(now.getTime() + 60 * 86_400_000).toISOString())).map((p) => ({ id: p.id, title: p.title, starts_at: p.starts_at, followup_at: p.followup_at })),
				reminders: (await store.upcomingReminders(now.toISOString(), 20)).map((r) => ({ id: r.id, text: r.text, due_at: r.due_at })),
				goals: (await store.goals()).map((g) => g.title),
			};
			return Response.json({ since, messages, reviews, memory, diags: await store.diags(), models: await store.get('llm_health') });
		}
		if (req.method === 'GET' && url.pathname === '/eval') {
			// Live evals on the scratch database: GET /eval lists cases; GET /eval?case=x&step=n runs one message.
			if (req.headers.get('x-jarvis-key') !== (await webhookSecret(env.TELEGRAM_BOT_TOKEN))) return new Response('forbidden', { status: 403 });
			const name = url.searchParams.get('case');
			if (!name) return Response.json({ cases: EVAL_CASES.map((c) => ({ name: c.name, about: c.about })), ready: Boolean(env.EVAL_DB) });
			if (!env.EVAL_DB) return Response.json({ error: 'EVAL_DB is not bound' }, { status: 500 });
			try {
				const out = await runEvalStep(makeDeps(env), countQueries(env.EVAL_DB), name, Number(url.searchParams.get('step')) || 0);
				if (out.result) await new Store(env.DB).set(`eval:${name}`, JSON.stringify(out.result));
				return Response.json(out);
			} catch (e) {
				return Response.json({ case: name, error: String(e) }, { status: 500 });
			}
		}
		if (req.method === 'POST' && url.pathname === '/telegram') {
			if (req.headers.get('x-telegram-bot-api-secret-token') !== (await webhookSecret(env.TELEGRAM_BOT_TOKEN))) {
				return new Response('forbidden', { status: 403 });
			}
			const update = await req.json().catch(() => null);
			if (update) {
				// Answer Telegram right away; the reply is produced in the background.
				ctx.waitUntil(
					handleUpdate(makeDeps(env), update).catch((e) => console.error('update failed', e)),
				);
			}
			return new Response('ok');
		}
		return new Response('Jarvis is running.', { status: 200 });
	},

	async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(
			tick(makeDeps(env))
				.then((log) => log.length && console.log('tick', log.join('; ')))
				.catch((e) => console.error('tick failed', e)),
		);
	},
} satisfies ExportedHandler<Env>;
