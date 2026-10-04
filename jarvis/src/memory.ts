// Memory updates: the LLM proposes structured changes; code validates and applies them.
import { Store } from './store';
import { addDays, atLocal, localDate, localMinutes, parseTime, utc } from './time';
import type { Schema } from './types';

export interface MemoryOps {
	facts_add: { text: string; category: string }[];
	facts_remove: number[];
	people: { name: string; relation: string; notes: string; birthday: string }[];
	plans_add: { title: string; starts_at: string; all_day: boolean; followup_question: string; followup_at: string }[];
	plans_update: { id: number; status: string; outcome: string; new_starts_at: string }[];
	reminders_add: { text: string; due_at: string }[];
	reminders_cancel: number[];
	goals_add: { title: string; cadence: string }[];
	goals_checkin: { id: number; note: string }[];
	goals_stop: number[];
	admin_done: number[];
	mood_label: string;
	mood_score: number;
	diary_note: string;
}

const str = { type: 'STRING' };
const int = { type: 'INTEGER' };
const arr = (items: Schema): Schema => ({ type: 'ARRAY', items });
const obj = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({ type: 'OBJECT', properties, required });

export const memorySchema: Schema = obj({
	facts_add: arr(obj({ text: str, category: { type: 'STRING', enum: ['personal', 'preference', 'work', 'health', 'money', 'routine', 'other'] } })),
	facts_remove: arr(int),
	people: arr(obj({ name: str, relation: str, notes: str, birthday: str })),
	plans_add: arr(obj({ title: str, starts_at: str, all_day: { type: 'BOOLEAN' }, followup_question: str, followup_at: str })),
	plans_update: arr(obj({ id: int, status: { type: 'STRING', enum: ['done', 'cancelled', 'rescheduled'] }, outcome: str, new_starts_at: str })),
	reminders_add: arr(obj({ text: str, due_at: str })),
	reminders_cancel: arr(int),
	goals_add: arr(obj({ title: str, cadence: { type: 'STRING', enum: ['daily', 'weekly', 'once'] } })),
	goals_checkin: arr(obj({ id: int, note: str })),
	goals_stop: arr(int),
	admin_done: arr(int),
	mood_label: str,
	mood_score: int,
	diary_note: str,
});

export const MEMORY_RULES = `MEMORY RULES (fill the "memory" object; use empty arrays/strings and mood_score 0 when nothing applies):
- facts_add: lasting facts about him worth remembering (likes, dislikes, job, routines, health, money, places, things he did). Short third-person sentences, e.g. "Prefers window seats". Not things already in FACTS. Not plans (those go in plans_add).
- facts_remove: ids of facts that are now wrong or that he asked you to forget.
- people: anyone he mentions by name, with relation and a short note of what you learned. birthday as MM-DD if known, else "".
- plans_add: any future event or plan he mentions (appointments, trips, meetings, flights, exams, parties, deadlines).
  starts_at is ISO 8601 with +05:30, resolved from the calendar above (e.g. "Friday" = the coming Friday). Use the stated time; if no time, set all_day true and use T00:00.
  followup_question: a natural, caring question to ask afterwards ("How did the dentist go?"). followup_at: when to ask (ISO +05:30) or "" to let the app choose.
- plans_update: when he tells you how a plan went (status done + outcome), that it was cancelled, or that it moved (rescheduled + new_starts_at),
  including corrections like "not tomorrow, it's Sunday the 11th". Use plan ids from PLANS.
- reminders_add: only when he explicitly asks to be reminded. due_at ISO +05:30 ("in 2 hours" = current time + 2h).
  Never for things Jarvis already does on its own (the 7 AM briefing, the 7 PM check-in, follow-ups) or for questions about them.
- reminders_cancel: ids of reminders he cancels.
- goals_add: only goals or habits he agrees to track. goals_checkin: he did a tracked habit today. goals_stop: he wants to stop tracking.
- admin_done: ids from LIFE ADMIN that he says are paid, received or sorted.
- mood_label/mood_score: his mood if he expresses one (score 1 = awful ... 5 = great), else "" and 0.
- diary_note: one short line about anything notable that happened to him today, else "".`;

export interface ApplyResult {
	summary: string[];
}

/** Validates and applies memory ops. Bad items are skipped, never fatal. */
export async function applyMemory(store: Store, ops: Partial<MemoryOps> | undefined, now: Date): Promise<ApplyResult> {
	const summary: string[] = [];
	if (!ops) return { summary };
	const at = utc(now);
	const today = localDate(now);

	for (const f of list(ops.facts_add)) {
		const text = clean(f?.text, 300);
		if (text && (await store.addFact(text, clean(f.category, 20) || 'other', at))) summary.push(`fact: ${text}`);
	}
	for (const id of list(ops.facts_remove)) if (Number.isInteger(id) && (await store.supersedeFact(id, at))) summary.push(`forgot fact ${id}`);

	for (const p of list(ops.people)) {
		const name = clean(p?.name, 60);
		if (!name) continue;
		const birthday = /^\d{2}-\d{2}$/.test(p.birthday ?? '') ? p.birthday : '';
		await store.upsertPerson({ name, relation: clean(p.relation, 60), notes: clean(p.notes, 200), birthday, contacted: true }, at);
		summary.push(`person: ${name}`);
	}

	for (const p of list(ops.plans_add)) {
		const title = clean(p?.title, 120);
		const start = parseTime(p?.starts_at);
		if (!title || !start) continue;
		if (start.getTime() < now.getTime() - 12 * 3600_000) continue; // past events are diary material, not plans
		const allDay = Boolean(p.all_day);
		const followup = chooseFollowup(start, allDay, parseTime(p.followup_at), now);
		const id = await store.addPlan({
			title,
			starts_at: utc(start),
			all_day: allDay,
			followup_at: followup ? utc(followup) : null,
			followup_question: clean(p.followup_question, 200) || `How did ${title.toLowerCase()} go?`,
			remind_before: true,
			at,
		});
		if (id) summary.push(`plan: ${title}`);
	}

	for (const u of list(ops.plans_update)) {
		if (!Number.isInteger(u?.id)) continue;
		const plan = await store.plan(u.id);
		if (!plan || plan.status !== 'planned') continue;
		if (u.status === 'done' || u.status === 'cancelled') {
			await store.updatePlan(plan.id, { status: u.status, outcome: clean(u.outcome, 300) });
			summary.push(`plan ${plan.id} ${u.status}`);
		} else if (u.status === 'rescheduled') {
			const start = parseTime(u.new_starts_at);
			if (!start) continue;
			const followup = chooseFollowup(start, Boolean(plan.all_day), null, now);
			await store.updatePlan(plan.id, {
				starts_at: utc(start),
				followup_at: followup ? utc(followup) : null,
				followup_sent: 0,
				prealert_sent: 0,
			});
			summary.push(`plan ${plan.id} moved`);
		}
	}

	for (const r of list(ops.reminders_add)) {
		const text = clean(r?.text, 200);
		const due = parseTime(r?.due_at);
		if (!text || !due) continue;
		// A reminder slightly in the past (model rounding) fires right away; a far-past one is a mistake.
		if (due.getTime() < now.getTime() - 3600_000) continue;
		await store.addReminder(text, utc(due), at);
		summary.push(`reminder: ${text}`);
	}
	for (const id of list(ops.reminders_cancel)) if (Number.isInteger(id) && (await store.cancelReminder(id))) summary.push(`cancelled reminder ${id}`);

	for (const g of list(ops.goals_add)) {
		const title = clean(g?.title, 100);
		const cadence = ['daily', 'weekly', 'once'].includes(g?.cadence) ? g.cadence : 'daily';
		if (title && (await store.addGoal(title, cadence, at))) summary.push(`goal: ${title}`);
	}
	for (const c of list(ops.goals_checkin)) {
		if (!Number.isInteger(c?.id)) continue;
		await store.checkinGoal(c.id, clean(c.note, 200), at, today, addDays(today, -1));
		summary.push(`goal ${c.id} done`);
	}
	for (const id of list(ops.goals_stop)) if (Number.isInteger(id)) await store.setGoalStatus(id, 'dropped');
	for (const id of list(ops.admin_done))
		if (Number.isInteger(id)) {
			await store.setAdminStatus(id, 'done');
			summary.push(`admin ${id} done`);
		}

	const mood = clean(ops.mood_label, 40);
	const score = Number(ops.mood_score);
	if (mood && score >= 1 && score <= 5) {
		await store.addMood(mood, Math.round(score), at);
		summary.push(`mood: ${mood}`);
	}
	const note = clean(ops.diary_note, 300);
	if (note) await store.appendDiaryNote(today, note);
	return { summary };
}

/**
 * When to ask "how did it go?". Timed events: about 2 hours after the start, kept between 10:00 and 21:30.
 * All-day events: folded into the 19:00 check-in that day.
 */
export function chooseFollowup(start: Date, allDay: boolean, asked: Date | null, now: Date): Date | null {
	if (asked && asked > start && asked > now) return asked;
	const day = localDate(start);
	if (allDay) return atLocal(day, 19, 0);
	let t = new Date(start.getTime() + 2 * 3600_000);
	const mins = localMinutes(t);
	const tDay = localDate(t);
	if (tDay !== day || mins > 21 * 60 + 30) t = atLocal(addDays(day, 1), 10, 0);
	else if (mins < 10 * 60) t = atLocal(tDay, 10, 0);
	return t;
}

function list<T>(v: T[] | undefined): T[] {
	return Array.isArray(v) ? v.slice(0, 20) : [];
}

function clean(v: unknown, max: number): string {
	return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
