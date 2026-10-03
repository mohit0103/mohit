// Data access. Thin wrappers over D1 so the rest of the code reads like plain functions.

export interface Fact {
	id: number;
	text: string;
	category: string;
	created_at: string;
}
export interface Person {
	id: number;
	name: string;
	relation: string;
	notes: string;
	birthday: string;
	last_contact: string | null;
}
export interface Plan {
	id: number;
	title: string;
	starts_at: string;
	all_day: number;
	followup_at: string | null;
	followup_question: string;
	remind_before: number;
	status: string;
	outcome: string;
	source: string;
	followup_sent: number;
	prealert_sent: number;
}
export interface Reminder {
	id: number;
	text: string;
	due_at: string;
	sent_at: string | null;
	done: number;
}
export interface Goal {
	id: number;
	title: string;
	cadence: string;
	status: string;
	streak: number;
	last_checkin: string | null;
}
export interface DiaryEntry {
	date: string;
	summary: string;
	notes: string;
	mood_label: string;
	mood_score: number | null;
}
export interface Message {
	id: number;
	role: 'user' | 'jarvis';
	text: string;
	kind: string;
	at: string;
}
export interface EmailRow {
	uid: number;
	sender: string;
	subject: string;
	received_at: string;
	summary: string;
	kind: string;
	importance: string;
	briefed: number;
}
export interface AdminItem {
	id: number;
	kind: string;
	title: string;
	due_at: string | null;
	amount: string;
	status: string;
	notified: number;
}

async function all<T>(db: D1Database, sql: string, ...args: unknown[]): Promise<T[]> {
	const r = await db
		.prepare(sql)
		.bind(...args)
		.all<T>();
	return r.results ?? [];
}
async function first<T>(db: D1Database, sql: string, ...args: unknown[]): Promise<T | null> {
	return (await db
		.prepare(sql)
		.bind(...args)
		.first<T>()) ?? null;
}
async function run(db: D1Database, sql: string, ...args: unknown[]): Promise<number> {
	const r = await db
		.prepare(sql)
		.bind(...args)
		.run();
	return Number(r.meta?.changes ?? 0);
}
async function insert(db: D1Database, sql: string, ...args: unknown[]): Promise<number> {
	const r = await db
		.prepare(sql)
		.bind(...args)
		.run();
	return Number(r.meta?.last_row_id ?? 0);
}

export class Store {
	constructor(readonly db: D1Database) {}

	// --- key/value ---
	async get(k: string): Promise<string | null> {
		const r = await first<{ v: string }>(this.db, 'SELECT v FROM kv WHERE k = ?', k);
		return r?.v ?? null;
	}
	async set(k: string, v: string): Promise<void> {
		await run(this.db, 'INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
	}
	async del(k: string): Promise<void> {
		await run(this.db, 'DELETE FROM kv WHERE k = ?', k);
	}

	/** Records the latest outcome of a subsystem (shown by /status). Never throws. */
	async diag(name: string, ok: boolean, info: string, at: string): Promise<void> {
		await this.set(`diag:${name}`, JSON.stringify({ ok, info: info.slice(0, 300), at })).catch(() => undefined);
	}
	async diags(): Promise<{ name: string; ok: boolean; info: string; at: string }[]> {
		const rows = await all<{ k: string; v: string }>(this.db, "SELECT k, v FROM kv WHERE k LIKE 'diag:%' ORDER BY k");
		return rows.map((r) => ({ name: r.k.slice(5), ...JSON.parse(r.v) }));
	}

	/** Claims a once-only key. Returns false when it was already claimed. */
	async claim(table: 'runs' | 'updates', key: string | number, at: string): Promise<boolean> {
		const col = table === 'runs' ? 'key' : 'id';
		return (await run(this.db, `INSERT OR IGNORE INTO ${table} (${col}, at) VALUES (?, ?)`, key, at)) > 0;
	}

	// --- messages ---
	async addMessage(role: 'user' | 'jarvis', text: string, kind: string, at: string): Promise<void> {
		await insert(this.db, 'INSERT INTO messages (role, text, kind, at) VALUES (?, ?, ?, ?)', role, text, kind, at);
	}
	async recentMessages(limit: number): Promise<Message[]> {
		const rows = await all<Message>(this.db, 'SELECT * FROM messages ORDER BY id DESC LIMIT ?', limit);
		return rows.reverse();
	}
	async messagesBetween(fromUtc: string, toUtc: string): Promise<Message[]> {
		return all<Message>(this.db, 'SELECT * FROM messages WHERE at >= ? AND at < ? ORDER BY id', fromUtc, toUtc);
	}
	async lastUserMessageAt(): Promise<string | null> {
		const r = await first<{ at: string }>(this.db, "SELECT at FROM messages WHERE role = 'user' ORDER BY id DESC LIMIT 1");
		return r?.at ?? null;
	}

	// --- facts ---
	async facts(): Promise<Fact[]> {
		return all<Fact>(this.db, 'SELECT id, text, category, created_at FROM facts WHERE superseded_at IS NULL ORDER BY id');
	}
	async addFact(text: string, category: string, at: string): Promise<number | null> {
		const dup = await first<{ id: number }>(
			this.db,
			'SELECT id FROM facts WHERE superseded_at IS NULL AND lower(text) = lower(?)',
			text,
		);
		if (dup) return null;
		return insert(this.db, 'INSERT INTO facts (text, category, created_at) VALUES (?, ?, ?)', text, category, at);
	}
	async supersedeFact(id: number, at: string): Promise<boolean> {
		return (await run(this.db, 'UPDATE facts SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL', at, id)) > 0;
	}
	async deleteFact(id: number): Promise<boolean> {
		return (await run(this.db, 'DELETE FROM facts WHERE id = ?', id)) > 0;
	}

	// --- people ---
	async people(): Promise<Person[]> {
		return all<Person>(this.db, 'SELECT * FROM people ORDER BY updated_at DESC LIMIT 80');
	}
	async upsertPerson(p: { name: string; relation?: string; notes?: string; birthday?: string; contacted?: boolean }, at: string) {
		const existing = await first<Person>(this.db, 'SELECT * FROM people WHERE name = ? COLLATE NOCASE', p.name);
		if (!existing) {
			await insert(
				this.db,
				'INSERT INTO people (name, relation, notes, birthday, last_contact, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
				p.name,
				p.relation ?? '',
				p.notes ?? '',
				p.birthday ?? '',
				p.contacted ? at : null,
				at,
			);
			return;
		}
		const notes = mergeNotes(existing.notes, p.notes ?? '');
		await run(
			this.db,
			'UPDATE people SET relation = ?, notes = ?, birthday = ?, last_contact = ?, updated_at = ? WHERE id = ?',
			p.relation || existing.relation,
			notes,
			p.birthday || existing.birthday,
			p.contacted ? at : existing.last_contact,
			at,
			existing.id,
		);
	}
	async deletePerson(name: string): Promise<boolean> {
		return (await run(this.db, 'DELETE FROM people WHERE name = ? COLLATE NOCASE', name)) > 0;
	}

	// --- plans ---
	async addPlan(p: {
		title: string;
		starts_at: string;
		all_day: boolean;
		followup_at: string | null;
		followup_question: string;
		remind_before: boolean;
		source?: string;
		source_ref?: string | null;
		at: string;
	}): Promise<number | null> {
		const dup = await first<{ id: number }>(
			this.db,
			"SELECT id FROM plans WHERE status = 'planned' AND lower(title) = lower(?) AND substr(starts_at, 1, 10) = substr(?, 1, 10)",
			p.title,
			p.starts_at,
		);
		if (dup) return null;
		const r = await this.db
			.prepare(
				`INSERT OR IGNORE INTO plans (title, starts_at, all_day, followup_at, followup_question, remind_before, source, source_ref, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				p.title,
				p.starts_at,
				p.all_day ? 1 : 0,
				p.followup_at,
				p.followup_question,
				p.remind_before ? 1 : 0,
				p.source ?? 'chat',
				p.source_ref ?? null,
				p.at,
			)
			.run();
		return Number(r.meta?.changes ?? 0) > 0 ? Number(r.meta?.last_row_id) : null;
	}
	async plan(id: number): Promise<Plan | null> {
		return first<Plan>(this.db, 'SELECT * FROM plans WHERE id = ?', id);
	}
	async updatePlan(id: number, f: Partial<Pick<Plan, 'status' | 'outcome' | 'starts_at' | 'followup_at' | 'followup_sent' | 'prealert_sent'>>) {
		const keys = Object.keys(f) as (keyof typeof f)[];
		if (!keys.length) return;
		await run(this.db, `UPDATE plans SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => f[k]), id);
	}
	/** Plans that matter for conversation: upcoming ones plus past ones still awaiting a follow-up. */
	async openPlans(fromUtc: string, toUtc: string): Promise<Plan[]> {
		return all<Plan>(
			this.db,
			"SELECT * FROM plans WHERE status = 'planned' AND starts_at >= ? AND starts_at < ? ORDER BY starts_at LIMIT 60",
			fromUtc,
			toUtc,
		);
	}
	async plansBetween(fromUtc: string, toUtc: string): Promise<Plan[]> {
		return all<Plan>(this.db, "SELECT * FROM plans WHERE status = 'planned' AND starts_at >= ? AND starts_at < ? ORDER BY starts_at", fromUtc, toUtc);
	}
	async dueFollowups(nowUtc: string): Promise<Plan[]> {
		return all<Plan>(
			this.db,
			"SELECT * FROM plans WHERE status = 'planned' AND followup_sent = 0 AND followup_at IS NOT NULL AND followup_at <= ? ORDER BY followup_at",
			nowUtc,
		);
	}
	async staleUnanswered(beforeUtc: string): Promise<Plan[]> {
		return all<Plan>(this.db, "SELECT * FROM plans WHERE status = 'planned' AND followup_sent = 1 AND followup_at < ?", beforeUtc);
	}

	// --- reminders ---
	async addReminder(text: string, dueAt: string, at: string): Promise<number> {
		return insert(this.db, 'INSERT INTO reminders (text, due_at, created_at) VALUES (?, ?, ?)', text, dueAt, at);
	}
	async dueReminders(nowUtc: string): Promise<Reminder[]> {
		return all<Reminder>(this.db, 'SELECT * FROM reminders WHERE done = 0 AND sent_at IS NULL AND due_at <= ? ORDER BY due_at', nowUtc);
	}
	async upcomingReminders(nowUtc: string, limit = 20): Promise<Reminder[]> {
		return all<Reminder>(this.db, 'SELECT * FROM reminders WHERE done = 0 AND sent_at IS NULL AND due_at > ? ORDER BY due_at LIMIT ?', nowUtc, limit);
	}
	async reminder(id: number): Promise<Reminder | null> {
		return first<Reminder>(this.db, 'SELECT * FROM reminders WHERE id = ?', id);
	}
	async markReminderSent(id: number, at: string): Promise<boolean> {
		return (await run(this.db, 'UPDATE reminders SET sent_at = ? WHERE id = ? AND sent_at IS NULL', at, id)) > 0;
	}
	async snoozeReminder(id: number, dueAt: string): Promise<void> {
		await run(this.db, 'UPDATE reminders SET due_at = ?, sent_at = NULL, done = 0 WHERE id = ?', dueAt, id);
	}
	async completeReminder(id: number): Promise<void> {
		await run(this.db, 'UPDATE reminders SET done = 1 WHERE id = ?', id);
	}
	async cancelReminder(id: number): Promise<boolean> {
		return (await run(this.db, 'UPDATE reminders SET done = 1 WHERE id = ? AND done = 0', id)) > 0;
	}

	// --- goals ---
	async goals(): Promise<Goal[]> {
		return all<Goal>(this.db, "SELECT * FROM goals WHERE status = 'active' ORDER BY id");
	}
	async addGoal(title: string, cadence: string, at: string): Promise<number | null> {
		const dup = await first<{ id: number }>(this.db, "SELECT id FROM goals WHERE status = 'active' AND lower(title) = lower(?)", title);
		if (dup) return null;
		return insert(this.db, 'INSERT INTO goals (title, cadence, created_at) VALUES (?, ?, ?)', title, cadence, at);
	}
	async checkinGoal(id: number, note: string, at: string, localToday: string, localYesterday: string): Promise<void> {
		const g = await first<Goal>(this.db, 'SELECT * FROM goals WHERE id = ?', id);
		if (!g) return;
		await insert(this.db, 'INSERT INTO goal_checkins (goal_id, note, at) VALUES (?, ?, ?)', id, note, at);
		const last = g.last_checkin;
		if (last === localToday) return;
		const streak = last === localYesterday ? g.streak + 1 : 1;
		await run(this.db, 'UPDATE goals SET streak = ?, last_checkin = ? WHERE id = ?', streak, localToday, id);
	}
	async setGoalStatus(id: number, status: string): Promise<void> {
		await run(this.db, 'UPDATE goals SET status = ? WHERE id = ?', status, id);
	}

	// --- diary & moods ---
	async addMood(label: string, score: number, at: string): Promise<void> {
		await insert(this.db, 'INSERT INTO moods (label, score, at) VALUES (?, ?, ?)', label, score, at);
	}
	async moodsSince(fromUtc: string): Promise<{ label: string; score: number; at: string }[]> {
		return all(this.db, 'SELECT label, score, at FROM moods WHERE at >= ? ORDER BY at', fromUtc);
	}
	async appendDiaryNote(date: string, note: string): Promise<void> {
		await run(
			this.db,
			`INSERT INTO diary (date, notes) VALUES (?, ?)
			 ON CONFLICT(date) DO UPDATE SET notes = CASE WHEN diary.notes = '' THEN excluded.notes ELSE diary.notes || ' | ' || excluded.notes END`,
			date,
			note,
		);
	}
	async setDiarySummary(date: string, summary: string, moodLabel: string, moodScore: number | null): Promise<void> {
		await run(
			this.db,
			`INSERT INTO diary (date, summary, mood_label, mood_score) VALUES (?, ?, ?, ?)
			 ON CONFLICT(date) DO UPDATE SET summary = excluded.summary, mood_label = excluded.mood_label, mood_score = excluded.mood_score`,
			date,
			summary,
			moodLabel,
			moodScore,
		);
	}
	async diary(limit: number): Promise<DiaryEntry[]> {
		return all<DiaryEntry>(this.db, 'SELECT * FROM diary ORDER BY date DESC LIMIT ?', limit);
	}
	async diaryOn(date: string): Promise<DiaryEntry | null> {
		return first<DiaryEntry>(this.db, 'SELECT * FROM diary WHERE date = ?', date);
	}
	async diaryRange(from: string, to: string): Promise<DiaryEntry[]> {
		return all<DiaryEntry>(this.db, 'SELECT * FROM diary WHERE date >= ? AND date <= ? ORDER BY date', from, to);
	}

	// --- email & life admin ---
	async addEmail(e: Omit<EmailRow, 'briefed'>): Promise<boolean> {
		return (
			(await run(
				this.db,
				'INSERT OR IGNORE INTO emails (uid, sender, subject, received_at, summary, kind, importance) VALUES (?, ?, ?, ?, ?, ?, ?)',
				e.uid,
				e.sender,
				e.subject,
				e.received_at,
				e.summary,
				e.kind,
				e.importance,
			)) > 0
		);
	}
	async unbriefedEmails(): Promise<EmailRow[]> {
		return all<EmailRow>(
			this.db,
			"SELECT * FROM emails WHERE briefed = 0 AND importance != 'low' ORDER BY CASE importance WHEN 'high' THEN 0 ELSE 1 END, received_at DESC LIMIT 15",
		);
	}
	async recentEmails(fromUtc: string): Promise<EmailRow[]> {
		return all<EmailRow>(this.db, "SELECT * FROM emails WHERE received_at >= ? AND importance != 'low' ORDER BY received_at DESC LIMIT 25", fromUtc);
	}
	async markEmailsBriefed(uids: number[]): Promise<void> {
		for (const uid of uids) await run(this.db, 'UPDATE emails SET briefed = 1 WHERE uid = ?', uid);
	}
	async urgentUnnotifiedEmails(): Promise<EmailRow[]> {
		return all<EmailRow>(this.db, "SELECT * FROM emails WHERE importance = 'high' AND briefed = 0 ORDER BY received_at");
	}
	async addAdminItem(i: { kind: string; title: string; due_at: string | null; amount: string; source_ref: string; at: string }): Promise<boolean> {
		return (
			(await run(
				this.db,
				'INSERT OR IGNORE INTO admin_items (kind, title, due_at, amount, source_ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
				i.kind,
				i.title,
				i.due_at,
				i.amount,
				i.source_ref,
				i.at,
			)) > 0
		);
	}
	/** Open items, minus ones whose date passed more than 3 days ago or undated ones older than 30 days. */
	async openAdminItems(nowUtc = new Date().toISOString()): Promise<AdminItem[]> {
		const threeDays = new Date(Date.parse(nowUtc) - 3 * 86_400_000).toISOString();
		const month = new Date(Date.parse(nowUtc) - 30 * 86_400_000).toISOString();
		return all<AdminItem>(
			this.db,
			"SELECT * FROM admin_items WHERE status = 'open' AND ((due_at IS NOT NULL AND due_at >= ?) OR (due_at IS NULL AND created_at >= ?)) ORDER BY COALESCE(due_at, '9999') LIMIT 40",
			threeDays,
			month,
		);
	}
	async setAdminStatus(id: number, status: string): Promise<void> {
		await run(this.db, 'UPDATE admin_items SET status = ? WHERE id = ?', status, id);
	}
	async markAdminNotified(id: number): Promise<void> {
		await run(this.db, 'UPDATE admin_items SET notified = 1 WHERE id = ?', id);
	}

	// --- maintenance ---
	async prune(beforeUtc: string): Promise<void> {
		await run(this.db, 'DELETE FROM updates WHERE at < ?', beforeUtc);
		await run(this.db, 'DELETE FROM runs WHERE at < ?', beforeUtc);
	}

	async exportAll(): Promise<Record<string, unknown[]>> {
		const out: Record<string, unknown[]> = {};
		for (const t of ['facts', 'people', 'plans', 'reminders', 'goals', 'goal_checkins', 'diary', 'moods', 'admin_items', 'messages']) {
			out[t] = await all(this.db, `SELECT * FROM ${t}`);
		}
		return out;
	}
}

function mergeNotes(a: string, b: string): string {
	if (!b || a.toLowerCase().includes(b.toLowerCase())) return a;
	const merged = a ? `${a}; ${b}` : b;
	return merged.length > 600 ? merged.slice(merged.length - 600) : merged;
}
