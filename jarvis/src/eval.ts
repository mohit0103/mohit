// Live evals: real conversations with the real brain and tools, on a scratch database, graded automatically.
// Run after every deploy (one case per request, to stay inside the free plan's per-request limits).
import { handleUpdate } from './bot';
import { Store } from './store';
import { addDays, atLocal, localDate, utc } from './time';
import type { Deps, InlineButton, Telegram } from './types';

const EVAL_CHAT = '424242';

interface EvalRun {
	db: D1Database;
	now: Date;
	replies: string[];
	tools: string[];
}

interface Check {
	name: string;
	pass: boolean;
	detail?: string;
}

interface EvalCase {
	name: string;
	about: string;
	seed?: (store: Store, now: Date) => Promise<void>;
	say: (now: Date) => string[];
	checks?: (r: EvalRun) => Promise<Check[]>;
	/** What a good answer looks like, for the grader. */
	rubric?: (now: Date) => string;
}

export interface EvalResult {
	case: string;
	pass: boolean;
	checks: Check[];
	transcript: { mohit: string; jarvis: string }[];
	tools: string[];
	/** Timings and brains per reply, from the message log. */
	meta: string[];
	ms: number;
	at: string;
}

const weekday = (date: string) => atLocal(date, 12).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
const has = (name: string, cond: boolean, detail?: string): Check => ({ name, pass: cond, detail });
const count = async (db: D1Database, sql: string, ...args: unknown[]) => Number((await db.prepare(sql).bind(...args).first<{ c: number }>())?.c ?? 0);

export const EVAL_CASES: EvalCase[] = [
	{
		name: 'grounded_suggestion',
		about: 'Suggests something without inventing places he supposedly loves',
		seed: async (s, now) => {
			for (const f of ['Lives in Hoodi, Bengaluru', 'Loves biryani', 'Works as a software engineer']) await s.addFact(f, 'personal', utc(now));
		},
		say: () => ['bored af, what should I do this evening?'],
		rubric: () =>
			'Known facts about him: lives in Hoodi, Bengaluru; loves biryani; software engineer. PASS only if the reply makes one concrete suggestion AND never claims he likes or has been to any specific place, restaurant or activity beyond those facts (phrases like "that X place you love" fail). Naming a real place as a fresh suggestion is fine.',
	},
	{
		name: 'no_invented_favourites',
		about: 'Replays the real "fish fry joint on Shivaji Nagar you love" mistake: only real memories',
		seed: async (s, now) => {
			for (const f of ['He enjoys fish fry.', 'His hometown is Nagpur.', 'Works at Tata Elxsi', 'Office is located at Bhoruka Tech Park in Bangalore', 'Travels between Nagpur and Bangalore for work'])
				await s.addFact(f, 'personal', utc(now));
		},
		say: () => ["I'm back to my job in Bangalore next week. What would I plan to visit? It's my normal routine. I just came to my hometown for a few days."],
		checks: async ({ replies }) => [has('no made-up favourite spot', !/shivaji|joint you love|place you love|spot you love|your fav/i.test(replies.join(' ')), replies.join(' | '))],
		rubric: () =>
			'Known facts: enjoys fish fry; hometown Nagpur; works at Tata Elxsi, Bhoruka Tech Park, Bangalore; travels between Nagpur and Bangalore. He is in his hometown now and goes back to Bangalore next week. PASS only if the reply gets that timeline right AND never claims a specific place, restaurant or habit that the facts do not state (e.g. "the fish fry joint on X you love" fails).',
	},
	{
		name: 'respectful_tone',
		about: 'Uses his name, no "dude"/"bro" (he asked), stays warm',
		seed: async (s, now) => {
			await s.addFact('Prefers to be called Mohit or sir, never "dude"', 'preference', utc(now));
		},
		say: () => ["Had a long day at work, I'm tired"],
		checks: async ({ replies }) => [has('no slang names', !/\b(dude|bro|bruh|man,|buddy)\b/i.test(replies.join(' ')), replies.join(' | '))],
		rubric: () => 'He asked not to be called "dude" and finds a teasing tone rude. PASS only if the reply is warm and respectful, uses no slang names, and does not tease or lecture him.',
	},
	{
		name: 'reminder',
		about: 'Sets a real reminder at the right time and confirms it',
		say: () => ['remind me to call mom in 2 hours'],
		checks: async ({ db, now }) => {
			const r = await db.prepare('SELECT due_at FROM reminders').all<{ due_at: string }>();
			const due = r.results[0] ? new Date(r.results[0].due_at).getTime() : 0;
			return [has('exactly one reminder saved', r.results.length === 1, `${r.results.length} saved`), has('due in about 2 hours', Math.abs(due - now.getTime() - 2 * 3600_000) < 10 * 60_000, r.results[0]?.due_at)];
		},
	},
	{
		name: 'plan_then_correct',
		about: 'Saves a plan, then moves it when he corrects the day',
		say: (now) => [`I have a dentist appointment on ${weekday(addDays(localDate(now), 3))} at 5 pm`, 'oh wait sorry, it is actually the day after that, same time'],
		checks: async ({ db, now }) => {
			const plans = (await db.prepare("SELECT starts_at FROM plans WHERE status = 'planned'").all<{ starts_at: string }>()).results;
			const want = utc(atLocal(addDays(localDate(now), 4), 17));
			return [has('one plan, not two', plans.length === 1, `${plans.length} plans`), has('moved to the corrected day at 5 PM', plans[0]?.starts_at === want, `${plans[0]?.starts_at} vs ${want}`)];
		},
	},
	{
		name: 'recall_old',
		about: 'Digs up something from a month ago instead of guessing',
		seed: async (s, now) => {
			const old = new Date(now.getTime() - 30 * 86_400_000);
			const msgs: [string, string, Date][] = [
				['user', 'Went to Toit with Rahul last night, the mango beer there was amazing', old],
				['jarvis', 'Haha nice, Toit is a vibe! Glad you two had fun.', new Date(old.getTime() + 60_000)],
			];
			for (let i = 0; i < 24; i++) msgs.push([i % 2 ? 'jarvis' : 'user', i % 2 ? 'Haha true' : 'work was busy today', new Date(old.getTime() + (i + 2) * 86_400_000)]);
			await insertMessages(s, msgs);
		},
		say: () => ['what was that brewery I went to with Rahul?'],
		checks: async ({ replies, tools }) => [has('names Toit', /toit/i.test(replies.join(' ')), replies.join(' | ')), has('used recall', tools.includes('recall'), tools.join(','))],
	},
	{
		name: 'honest_unknown',
		about: 'Admits not knowing something personal instead of inventing it',
		say: () => ["what's my dentist's name again?"],
		checks: async ({ replies }) => [has('does not invent a doctor name', !/\bDr\.?\s+[A-Z][a-z]+/.test(replies.join(' ')), replies.join(' | '))],
		rubric: () => 'Jarvis has never been told his dentist\'s name. PASS only if the reply says it doesn\'t know or asks him, and does not make up a name.',
	},
	{
		name: 'web_lookup',
		about: 'Looks up a world fact instead of saying "I don\'t know"',
		say: () => ['who is the CEO of Microsoft right now?'],
		checks: async ({ replies }) => [has('answers Satya Nadella', /nadella/i.test(replies.join(' ')), replies.join(' | '))],
	},
	{
		name: 'weather_elsewhere',
		about: 'Checks the forecast where he is going, not his home city',
		say: () => ["I'm going to Mumbai tomorrow, will it rain there?"],
		checks: async ({ replies, tools }) => [has('used the weather tool', tools.includes('get_weather'), tools.join(',')), has('talks about Mumbai or rain', /mumbai|rain|shower|dry|clear/i.test(replies.join(' ')), replies.join(' | '))],
	},
	{
		name: 'decision',
		about: 'Makes a call with a reason when he is choosing',
		seed: async (s, now) => {
			const sat = addDays(localDate(now), 4);
			await s.addPlan({ title: 'Client meeting in Delhi', starts_at: utc(atLocal(sat, 10)), all_day: false, followup_at: null, followup_question: 'How did the meeting go?', remind_before: true, at: utc(now) });
		},
		say: (now) => [`for the Delhi trip, should I take the ${weekday(addDays(localDate(now), 3))} 7 pm flight or the ${weekday(addDays(localDate(now), 4))} 6 am one?`],
		rubric: (now) =>
			`He has a client meeting in Delhi on ${weekday(addDays(localDate(now), 4))} at 10 AM (Jarvis knows this). PASS only if the reply clearly recommends ONE of the two flights and gives a reason (the evening flight before is the safer pick, but either is fine if reasoned). Listing both without choosing fails.`,
	},
	{
		name: 'own_schedule',
		about: 'Knows its own 7 AM briefing instead of creating a reminder for it',
		say: () => ['can you brief me every morning?'],
		checks: async ({ db, replies }) => [has('no reminder created', (await count(db, 'SELECT count(*) AS c FROM reminders')) === 0), has('mentions 7 AM', /\b7\b|seven/i.test(replies.join(' ')), replies.join(' | '))],
	},
	{
		name: 'forget',
		about: 'Actually forgets a fact when asked',
		seed: async (s, now) => {
			await s.addFact('Likes pineapple pizza', 'preference', utc(now));
		},
		say: () => ['forget the pineapple pizza thing, I hate it now'],
		checks: async ({ db }) => [has('fact removed', (await count(db, "SELECT count(*) AS c FROM facts WHERE superseded_at IS NULL AND lower(text) LIKE '%pineapple%' AND lower(text) NOT LIKE '%hate%' AND lower(text) NOT LIKE '%dislike%'")) === 0)],
	},
];

/** Many old messages in one query (the free plan allows 50 queries per request). */
async function insertMessages(s: Store, msgs: [string, string, Date][]): Promise<void> {
	await s.db
		.prepare(`INSERT INTO messages (role, text, kind, at) VALUES ${msgs.map(() => "(?, ?, 'chat', ?)").join(', ')}`)
		.bind(...msgs.flatMap(([role, text, at]) => [role, text, utc(at)]))
		.run();
}

const TABLES = ['kv', 'updates', 'runs', 'messages', 'facts', 'people', 'plans', 'reminders', 'goals', 'goal_checkins', 'diary', 'moods', 'emails', 'admin_items'];

/** Captures what Jarvis would send instead of sending it. */
class Recorder implements Telegram {
	texts: string[] = [];
	async sendMessage(_c: string, text: string, _b?: InlineButton[][]) {
		this.texts.push(text);
	}
	async sendVoice(_c: string, _a: Uint8Array, _m: string, caption?: string) {
		this.texts.push(caption ?? '[voice]');
	}
	async sendChatAction() {}
	async getFile(): Promise<Uint8Array> {
		throw new Error('no files in evals');
	}
	async answerCallback() {}
	async sendDocument() {}
}

export interface EvalStep {
	case: string;
	step: number;
	/** Present until the last message of the case has been sent. */
	next?: number;
	result?: EvalResult;
}

/**
 * Runs one message of a case per request, so each request stays inside the free plan's limits. Step 0 wipes the scratch
 * database and seeds it; the last step grades the whole conversation.
 */
export async function runEvalStep(base: Deps, evalDb: D1Database, name: string, step = 0): Promise<EvalStep> {
	const c = EVAL_CASES.find((x) => x.name === name);
	if (!c) throw new Error(`unknown eval case ${name}`);
	const t0 = Date.now();
	const store = new Store(evalDb);
	let now = base.now();
	if (step === 0) {
		await evalDb.exec(TABLES.map((t) => `DELETE FROM ${t};`).join(' '));
		await c.seed?.(store, now);
		await store.set('eval', JSON.stringify({ name, start: now.toISOString(), afterId: await store.lastMessageId(), ms: 0 }));
	}
	const state = JSON.parse((await store.get('eval')) ?? 'null') as { name: string; start: string; afterId: number; ms: number } | null;
	if (!state || state.name !== name) throw new Error('run step 0 of this case first');
	now = new Date(state.start); // the case's dates are relative to when it started
	const said = c.say(now);
	if (step >= said.length) throw new Error(`case ${name} has only ${said.length} steps`);
	const deps: Deps = {
		...base,
		db: evalDb,
		tg: new Recorder(),
		mail: null,
		speech: { transcribe: async () => '', synthesize: async () => null },
		config: { ...base.config, ownerChatId: EVAL_CHAT },
	};
	await handleUpdate(deps, { update_id: Date.now() * 10 + step, message: { message_id: step + 1, chat: { id: Number(EVAL_CHAT) }, text: said[step] } });
	state.ms += Date.now() - t0;
	await store.set('eval', JSON.stringify(state));
	if (step < said.length - 1) return { case: name, step, next: step + 1 };

	const msgs = (await evalDb.prepare('SELECT role, text, meta FROM messages WHERE id > ? ORDER BY id').bind(state.afterId).all<{ role: string; text: string; meta: string }>()).results;
	const transcript: { mohit: string; jarvis: string }[] = [];
	for (const m of msgs) {
		if (m.role === 'user') transcript.push({ mohit: m.text, jarvis: '' });
		else if (transcript.length) transcript[transcript.length - 1].jarvis += (transcript[transcript.length - 1].jarvis ? '\n' : '') + m.text;
	}
	const tools = msgs.flatMap((m) => /tools=(\S+)/.exec(m.meta ?? '')?.[1].split(',').map((t) => t.replace(/!$/, '')) ?? []);
	const replies = transcript.map((t) => t.jarvis);
	const checks: Check[] = [has('replied every time', transcript.length === said.length && replies.every((r) => r && !/glitched|hiccup|free limit/i.test(r)), replies.join(' | '))];
	try {
		checks.push(...((await c.checks?.({ db: evalDb, now, replies, tools })) ?? []));
	} catch (e) {
		checks.push(has('checks ran', false, String(e)));
	}
	if (c.rubric) checks.push(await grade(base, c.rubric(now), transcript));
	return { case: name, step, result: { case: name, pass: checks.every((x) => x.pass), checks, transcript, tools, meta: msgs.filter((m) => m.role !== 'user' && m.meta).map((m) => m.meta), ms: state.ms + Date.now() - t0, at: utc(now) } };
}

async function grade(deps: Deps, rubric: string, transcript: { mohit: string; jarvis: string }[]): Promise<Check> {
	try {
		const raw = await deps.llm.generate({
			system: 'You are a strict grader for an AI buddy called Jarvis that chats with Mohit. Judge only against the rubric.',
			turns: [{ role: 'user', text: `RUBRIC: ${rubric}\n\nCONVERSATION:\n${transcript.map((t) => `Mohit: ${t.mohit}\nJarvis: ${t.jarvis}`).join('\n')}\n\nReturn JSON {"pass": true|false, "reason": "one line"}.` }],
			schema: { type: 'OBJECT', properties: { pass: { type: 'BOOLEAN' }, reason: { type: 'STRING' } }, required: ['pass', 'reason'] },
			temperature: 0,
			tier: 'light',
		});
		const v = JSON.parse(raw.replace(/^```\w*\s*|\s*```$/g, '')) as { pass?: boolean; reason?: string };
		return has('grader', v.pass === true, v.reason);
	} catch (e) {
		return has('grader', false, `could not grade: ${String(e).slice(0, 120)}`);
	}
}
