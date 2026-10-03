// Worker entry point: the Telegram webhook, a health check, and the cron tick.
import { handleUpdate } from './bot';
import { ImapMail, gmailSocket } from './email/imap';
import { tick } from './scheduler';
import { Gemini, PublicFeeds, TelegramApi, WorkersSpeech } from './services';
import { Store } from './store';
import type { Deps, Env } from './types';

export function makeDeps(env: Env): Deps {
	const store = new Store(env.DB);
	const llm = new Gemini(env.GEMINI_API_KEY, env.GEMINI_MODELS);
	const now = () => new Date();
	return {
		db: env.DB,
		tg: new TelegramApi(env.TELEGRAM_BOT_TOKEN),
		llm,
		speech: new WorkersSpeech(env.AI, store, now, env.TTS_SPEAKER || 'apollo', Number(env.TTS_DAILY_CHARS) || 3000, llm),
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
