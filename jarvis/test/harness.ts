// Test doubles: a real SQLite database behind the D1 API, plus scripted Telegram, LLM, speech, feeds and mail.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Deps, Feeds, InlineButton, Llm, LlmRequest, MailMessage, MailSource, Speech, Telegram } from '../src/types';
import { LlmError } from '../src/types';

const MIGRATION = ['0001_init.sql', '0002_message_meta.sql'].map((f) => readFileSync(fileURLToPath(String(new URL(`../migrations/${f}`, import.meta.url))), 'utf8')).join('\n');

const norm = (v: unknown) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

class Stmt {
	constructor(
		private db: DatabaseSync,
		private sql: string,
		private args: unknown[] = [],
	) {}
	bind(...args: unknown[]) {
		return new Stmt(this.db, this.sql, args.map(norm));
	}
	async first<T>(col?: string): Promise<T | null> {
		const row = this.db.prepare(this.sql).get(...(this.args as any[])) as any;
		if (!row) return null;
		return (col ? row[col] : { ...row }) as T;
	}
	async all<T>() {
		const rows = this.db.prepare(this.sql).all(...(this.args as any[])) as any[];
		return { results: rows.map((r) => ({ ...r })) as T[], success: true, meta: {} };
	}
	async run() {
		const r = this.db.prepare(this.sql).run(...(this.args as any[]));
		return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
	}
}

export function fakeD1(): D1Database & { raw: DatabaseSync } {
	const db = new DatabaseSync(':memory:');
	db.exec(MIGRATION);
	return {
		raw: db,
		prepare: (sql: string) => new Stmt(db, sql),
		batch: async (stmts: Stmt[]) => Promise.all(stmts.map((s) => s.run())),
		exec: async (sql: string) => {
			db.exec(sql);
			return { count: 0, duration: 0 };
		},
	} as any;
}

export interface Sent {
	type: 'text' | 'voice' | 'doc' | 'action' | 'callback';
	chatId?: string;
	text: string;
	buttons?: InlineButton[][];
}

export class FakeTelegram implements Telegram {
	sent: Sent[] = [];
	failNext = 0;
	files = new Map<string, Uint8Array>();
	async sendMessage(chatId: string, text: string, buttons?: InlineButton[][]) {
		if (this.failNext > 0) {
			this.failNext--;
			throw new Error('telegram down');
		}
		this.sent.push({ type: 'text', chatId, text, buttons });
	}
	async sendVoice(chatId: string, _audio: Uint8Array, _mime: string, caption?: string) {
		this.sent.push({ type: 'voice', chatId, text: caption ?? '' });
	}
	async sendChatAction(chatId: string, action: string) {
		this.sent.push({ type: 'action', chatId, text: action });
	}
	async getFile(id: string) {
		const f = this.files.get(id);
		if (!f) throw new Error('no file');
		return f;
	}
	async answerCallback(_id: string, text?: string) {
		this.sent.push({ type: 'callback', text: text ?? '' });
	}
	async sendDocument(chatId: string, data: Uint8Array, filename: string) {
		this.sent.push({ type: 'doc', chatId, text: `${filename}:${data.length}` });
	}
	/** Messages a person would see (text and voice), not chat actions. */
	visible() {
		return this.sent.filter((s) => s.type === 'text' || s.type === 'voice' || s.type === 'doc');
	}
	clear() {
		this.sent = [];
	}
}

type Handler = (req: LlmRequest) => unknown;

/** An LLM whose answers come from a list of handlers matched against the prompt. */
export class ScriptedLlm implements Llm {
	calls: LlmRequest[] = [];
	private handlers: { match: (r: LlmRequest) => boolean; fn: Handler }[] = [];
	failWith: LlmError | null = null;

	on(match: string | RegExp | ((r: LlmRequest) => boolean), fn: Handler) {
		const m =
			typeof match === 'function'
				? match
				: (r: LlmRequest) => {
						const text = r.system + '\n' + r.turns.map((t) => t.text).join('\n');
						return typeof match === 'string' ? text.includes(match) : match.test(text);
					};
		this.handlers.unshift({ match: m, fn });
		return this;
	}

	async generate(req: LlmRequest): Promise<string> {
		this.calls.push(req);
		if (this.failWith) throw this.failWith;
		for (const h of this.handlers) if (h.match(req)) {
			const v = h.fn(req);
			return typeof v === 'string' ? v : JSON.stringify(v);
		}
		throw new LlmError('no scripted answer for prompt', 'bad_response');
	}

	lastUserText(): string {
		const c = this.calls[this.calls.length - 1];
		return c.turns[c.turns.length - 1].text;
	}
}

export class FakeSpeech implements Speech {
	spoken: string[] = [];
	transcript = '';
	disabled = false;
	async transcribe() {
		return this.transcript;
	}
	async synthesize(text: string) {
		if (this.disabled) return null;
		this.spoken.push(text);
		return { audio: new Uint8Array([1, 2, 3]), mime: 'audio/ogg' };
	}
}

export class FakeFeeds implements Feeds {
	async weather() {
		return { summary: 'light rain, 20–27°C, now 23°C, 70% chance of rain' };
	}
	async news() {
		return ['OpenAI ships new model', 'Indian AI startup raises funding', 'New chip doubles AI speed'];
	}
}

export class FakeMail implements MailSource {
	inbox: MailMessage[] = [];
	calls = 0;
	async fetchNew(sinceUid: number, max: number) {
		this.calls++;
		const fresh = this.inbox.filter((m) => m.uid > sinceUid);
		return { messages: fresh.slice(-max), lastUid: Math.max(sinceUid, ...fresh.map((m) => m.uid)) };
	}
}

export const emptyMemory = {
	facts_add: [],
	facts_remove: [],
	people: [],
	plans_add: [],
	plans_update: [],
	reminders_add: [],
	reminders_cancel: [],
	goals_add: [],
	goals_checkin: [],
	goals_stop: [],
	admin_done: [],
	mood_label: '',
	mood_score: 0,
	diary_note: '',
};

export const OWNER = '1001';

export interface World {
	deps: Deps;
	db: D1Database & { raw: DatabaseSync };
	tg: FakeTelegram;
	llm: ScriptedLlm;
	speech: FakeSpeech;
	mail: FakeMail;
	clock: { now: Date; set(iso: string): void; advance(minutes: number): void };
}

export function makeWorld(startIso = '2026-10-03T10:00:00+05:30', opts: { paired?: boolean } = {}): World {
	const db = fakeD1();
	const tg = new FakeTelegram();
	const llm = new ScriptedLlm();
	const speech = new FakeSpeech();
	const mail = new FakeMail();
	const clock = {
		now: new Date(startIso),
		set(iso: string) {
			this.now = new Date(iso);
		},
		advance(minutes: number) {
			this.now = new Date(this.now.getTime() + minutes * 60_000);
		},
	};
	let seed = 42;
	const deps: Deps = {
		db,
		tg,
		llm,
		speech,
		feeds: new FakeFeeds(),
		mail,
		now: () => clock.now,
		random: () => {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		},
		config: { pairCode: 'secret-code', name: 'Mohit', city: 'Bengaluru' },
		sleep: (ms: number) => new Promise((r) => setTimeout(r, Math.min(ms, 30))),
	};
	if (opts.paired !== false) db.raw.prepare("INSERT INTO kv (k, v) VALUES ('owner_chat_id', ?)").run(OWNER);
	return { deps, db, tg, llm, speech, mail, clock };
}

let updateId = 1;
export function textUpdate(text: string, chatId = OWNER) {
	return { update_id: updateId++, message: { message_id: updateId, chat: { id: Number(chatId) }, text } };
}
export function voiceUpdate(fileId: string, chatId = OWNER) {
	return { update_id: updateId++, message: { message_id: updateId, chat: { id: Number(chatId) }, voice: { file_id: fileId, mime_type: 'audio/ogg' } } };
}
export function buttonUpdate(data: string, chatId = OWNER) {
	return { update_id: updateId++, callback_query: { id: `cb${updateId}`, data, message: { chat: { id: Number(chatId) } }, from: { id: Number(chatId) } } };
}

/** Rows from a table, for assertions. */
export function rows(w: World, sql: string, ...args: any[]): any[] {
	return w.db.raw.prepare(sql).all(...args) as any[];
}

/** Scripts both chat calls from one function: the quick reply and the follow-up memory extraction. */
export function onChat(w: World, fn: (req: LlmRequest) => { reply: string; memory?: Record<string, unknown> } | string) {
	w.llm.on((r) => r.system.includes('Reply with just your message'), (r) => {
		const out = fn(r);
		return typeof out === 'string' ? out : out.reply;
	});
	w.llm.on((r) => r.system.includes('You maintain the long-term memory'), (r) => {
		// Show the script only what he said in the batch being processed.
		const block = /New messages to process[^\n]*\n([\s\S]*?)\n\nReturn the memory updates/.exec(r.turns.at(-1)!.text)?.[1] ?? '';
		const latest = block
			.split('\n')
			.filter((l) => !l.startsWith('Jarvis'))
			.map((l) => l.replace(/^\w+ \([^)]*\): /, ''))
			.join('\n');
		const out = fn({ ...r, turns: [{ role: 'user', text: latest }] });
		return typeof out === 'string' ? emptyMemory : { ...emptyMemory, ...(out.memory ?? {}) };
	});
}
