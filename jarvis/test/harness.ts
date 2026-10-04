// Test doubles: a real SQLite database behind the D1 API, plus scripted Telegram, LLM, speech, feeds and mail.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AgentStepRequest, AgentStepResult, Deps, Feeds, InlineButton, Llm, LlmRequest, MailMessage, MailSource, Speech, Telegram } from '../src/types';
import { LlmError } from '../src/types';

const MIGRATION = ['0001_init.sql', '0002_message_meta.sql'].map((f) => readFileSync(fileURLToPath(String(new URL(`../migrations/${f}`, import.meta.url))), 'utf8')).join('\n');

const norm = (v: unknown) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

/** Statements executed, to stay inside the free plan's 50 D1 queries per invocation. */
export const queryCount = { n: 0 };

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
		queryCount.n++;
		const row = this.db.prepare(this.sql).get(...(this.args as any[])) as any;
		if (!row) return null;
		return (col ? row[col] : { ...row }) as T;
	}
	async all<T>() {
		queryCount.n++;
		const rows = this.db.prepare(this.sql).all(...(this.args as any[])) as any[];
		return { results: rows.map((r) => ({ ...r })) as T[], success: true, meta: {} };
	}
	async run() {
		queryCount.n++;
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
type AgentHandler = (req: AgentStepRequest, flat: LlmRequest) => AgentStepResult | string;

/** An agent request seen as a plain one: his and Jarvis's words only (tool traffic left out). */
export function flatAgent(req: AgentStepRequest): LlmRequest {
	const turns: { role: 'user' | 'model'; text: string }[] = [];
	for (const m of req.messages) if (m.role !== 'tool' && m.text) turns.push({ role: m.role, text: m.text });
	return { system: req.system, turns, images: req.images, fast: req.fast };
}

/** An LLM whose answers come from a list of handlers matched against the prompt. */
export class ScriptedLlm implements Llm {
	calls: LlmRequest[] = [];
	private handlers: { match: (r: LlmRequest) => boolean; fn: Handler }[] = [];
	failWith: LlmError | null = null;
	agentCalls: AgentStepRequest[] = [];
	private agentHandlers: { match: (r: LlmRequest) => boolean; fn: AgentHandler }[] = [];

	onAgent(match: (r: LlmRequest) => boolean, fn: AgentHandler) {
		this.agentHandlers.unshift({ match, fn });
		return this;
	}

	async agentStep(req: AgentStepRequest): Promise<AgentStepResult> {
		const flat = flatAgent(req);
		this.calls.push(flat);
		this.agentCalls.push(structuredClone({ ...req, images: undefined }));
		if (this.failWith) throw this.failWith;
		for (const h of this.agentHandlers)
			if (h.match(flat)) {
				const v = h.fn(req, flat);
				return typeof v === 'string' ? { text: v, calls: [] } : v;
			}
		for (const h of this.handlers)
			if (h.match(flat)) {
				const v = h.fn(flat);
				return { text: typeof v === 'string' ? v : JSON.stringify(v), calls: [] };
			}
		throw new LlmError('no scripted answer for prompt', 'bad_response');
	}

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
	async weatherFor(place: string, date?: string) {
		return /nowhere/i.test(place) ? null : `${place} on ${date ?? 'today'}: thunderstorms, 25–31°C, 90% chance of rain`;
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
	searches: string[] = [];
	async search(query: string, max: number) {
		this.searches.push(query);
		const words = query.toLowerCase().split(/\s+or\s+|\s+/).filter(Boolean);
		return this.inbox.filter((m) => words.some((w) => `${m.subject} ${m.text}`.toLowerCase().includes(w))).slice(-max).reverse();
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

type ChatOut = { reply: string; memory?: Record<string, unknown>; calls?: { name: string; args: Record<string, unknown> }[] } | string;

/** Action-type memory ops become the agent's tool calls, the way a real model would act on them. */
function actionCalls(out: Exclude<ChatOut, string>) {
	const m = (out.memory ?? {}) as Record<string, any[]>;
	const calls: { name: string; args: Record<string, unknown> }[] = [...(out.calls ?? [])];
	for (const p of m.plans_add ?? []) calls.push({ name: 'add_plan', args: { title: p.title, starts_at: p.starts_at, all_day: p.all_day, followup_question: p.followup_question } });
	for (const u of m.plans_update ?? []) calls.push({ name: 'update_plan', args: { plan_id: u.id, status: u.status, outcome: u.outcome, new_starts_at: u.new_starts_at } });
	for (const r of m.reminders_add ?? []) calls.push({ name: 'set_reminder', args: { text: r.text, due_at: r.due_at } });
	for (const id of m.reminders_cancel ?? []) calls.push({ name: 'cancel_reminder', args: { reminder_id: id } });
	for (const g of m.goals_add ?? []) calls.push({ name: 'track_goal', args: { title: g.title, cadence: g.cadence } });
	return calls.map((c, i) => ({ id: `t${i}`, ...c }));
}

/**
 * Scripts a chat from one function: the agent (tool calls first, then the reply once tool results are in) and the
 * background memory pass that follows (which only sees what he said in the batch being processed).
 */
export function onChat(w: World, fn: (req: LlmRequest) => ChatOut) {
	w.llm.onAgent((r) => r.system.includes('Reply with just your message'), (req, flat) => {
		const out = fn(flat);
		if (typeof out === 'string') return out;
		const calls = req.messages.some((m) => m.role === 'tool') ? [] : actionCalls(out);
		return calls.length ? { text: '', calls } : out.reply;
	});
	w.llm.on((r) => r.system.includes('You maintain the long-term memory'), (r) => {
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

/** Tool results the agent saw during the run, by tool name. */
export function toolResults(w: World, name: string): unknown[] {
	const out: unknown[] = [];
	for (const c of w.llm.agentCalls) for (const m of c.messages) if (m.role === 'tool') for (const r of m.results) if (r.name === name) out.push(r.result);
	return [...new Set(out.map((o) => JSON.stringify(o)))].map((o) => JSON.parse(o));
}
