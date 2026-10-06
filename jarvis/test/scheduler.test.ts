import { describe, expect, it } from 'vitest';
import { otherPlaces, pickNudgeTimes, tick } from '../src/scheduler';
import { LlmError } from '../src/types';
import { makeWorld, rows } from './harness';

function scriptDefaults(w: ReturnType<typeof makeWorld>) {
	w.llm.on('morning briefing', (req) => ({ spoken: `Good morning Mohit! ${req.turns[0].text.includes('light rain') ? 'Take an umbrella.' : ''}`, details: '• item' }));
	w.llm.on('evening check-in', () => ({ spoken: 'Hey Mohit, how was your day?', details: '' }));
	w.llm.on('weekly review', () => ({ spoken: 'What a week!', details: '' }));
	w.llm.on('caring text', () => ({ send: true, message: 'Random buddy message!' }));
	w.llm.on('for his diary', () => ({ summary: 'Mohit had a good day.', mood_label: 'good', mood_score: 4 }));
	w.llm.on('month in review', () => ({ spoken: 'Your month!', details: '' }));
}

describe('daily rhythm', () => {
	it('sends the morning briefing once at 07:00 as text plus a tap-to-play audio file (never an auto-playing voice note)', async () => {
		const w = makeWorld('2026-10-05T06:55:00+05:30');
		scriptDefaults(w);
		await tick(w.deps);
		expect(w.tg.visible()).toEqual([]);
		w.clock.set('2026-10-05T07:00:00+05:30');
		await tick(w.deps);
		w.clock.advance(5);
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => s.type === 'voice')).toEqual([]);
		const audio = w.tg.visible().filter((s) => s.type === 'audio');
		expect(audio.map((a) => a.text)).toEqual(['Morning briefing']);
		expect(w.tg.visible().findIndex((s) => s.type === 'text')).toBeLessThan(w.tg.visible().findIndex((s) => s.type === 'audio')); // message lands first
		expect(w.speech.spoken[0]).toContain('Take an umbrella');
		expect(w.tg.visible().some((s) => s.type === 'text' && s.text.includes('• item'))).toBe(true);
		const prompt = w.llm.calls.find((c) => c.turns[0].text.includes('morning briefing'))!.turns[0].text;
		expect(prompt).toContain('AI & TECH HEADLINES: OpenAI ships new model');
		expect(prompt).toMatch(/suggest one small goal/);
	});

	it('briefs with real headlines, the weather where he is, and without routine bank alerts', async () => {
		const w = makeWorld('2026-10-05T07:00:00+05:30');
		scriptDefaults(w);
		w.db.raw.exec("INSERT INTO facts (text, category, created_at) VALUES ('His hometown is Nagpur.', 'personal', 'x'), ('Lives in Bengaluru', 'personal', 'x')");
		w.db.raw.exec("INSERT INTO emails (uid, sender, subject, received_at, summary, kind, importance) VALUES (1, 'HDFC', 'Alert', '2026-10-05T00:00:00.000Z', 'Rs 100 debited via UPI', 'finance', 'low'), (2, 'Priya', 'Deck', '2026-10-05T00:00:00.000Z', 'Priya needs the deck by 4', 'work', 'high')");
		await tick(w.deps);
		const prompt = w.llm.calls.find((c) => c.turns[0].text.includes('morning briefing'))!.turns[0].text;
		expect(prompt).toContain('WEATHER in Nagpur: Nagpur on today');
		expect(prompt).not.toContain('WEATHER in Bengaluru:'); // home is listed once, as home base
		expect(prompt).toContain('Priya needs the deck by 4');
		expect(prompt).not.toContain('Rs 100 debited');
		expect(prompt).toMatch(/never say the news is quiet/);
		expect(otherPlaces(['Lives in Bangalore', 'Currently in Mumbai for work'], 'Bengaluru')).toEqual(['Mumbai']);
	});

	it('falls back to a live web search when every news feed is empty', async () => {
		const w = makeWorld('2026-10-05T07:00:00+05:30');
		scriptDefaults(w);
		w.deps.feeds.news = async () => [];
		w.llm.on('You list news headlines', () => '1. OpenAI releases a new reasoning model for coding\n2. India launches a national AI compute grid');
		await tick(w.deps);
		const prompt = w.llm.calls.find((c) => c.turns[0].text.includes('morning briefing'))!.turns[0].text;
		expect(prompt).toContain('AI & TECH HEADLINES: OpenAI releases a new reasoning model for coding || India launches a national AI compute grid');
		expect(w.llm.calls.find((c) => c.system.includes('You list news headlines'))!.search).toBe(true);
	});

	it('catches up a missed briefing slot, but not hours later', async () => {
		const w = makeWorld('2026-10-05T08:40:00+05:30');
		scriptDefaults(w);
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => s.type === 'audio').length).toBe(1);

		const w2 = makeWorld('2026-10-05T11:30:00+05:30');
		scriptDefaults(w2);
		w2.llm.on('spontaneous', () => ({ send: false, message: '' }));
		await tick(w2.deps);
		expect(w2.tg.visible().filter((s) => s.type === 'audio')).toEqual([]);
	});

	it('still briefs (plain version) when the LLM is down', async () => {
		const w = makeWorld('2026-10-05T07:00:00+05:30');
		w.llm.failWith = new LlmError('quota', 'quota');
		await tick(w.deps);
		const v = w.tg.visible();
		expect(v.length).toBeGreaterThan(0);
		expect(w.speech.spoken[0]).toMatch(/Good morning Mohit! My brain is a bit slow/);
		expect(w.speech.spoken[0]).toMatch(/light rain/);
	});

	it('does a weekly review on Sunday evening instead of the normal check-in', async () => {
		const w = makeWorld('2026-10-04T19:00:00+05:30'); // Sunday
		scriptDefaults(w);
		await tick(w.deps);
		const req = w.llm.calls.find((c) => /weekly review/.test(c.turns[0].text));
		expect(req).toBeTruthy();
		expect(rows(w, "SELECT kind FROM messages WHERE role = 'jarvis'").map((r) => r.kind)).toContain('review');
	});

	it('writes the diary late at night, and catches up yesterday if missed', async () => {
		const w = makeWorld('2026-10-05T10:00:00+05:30');
		scriptDefaults(w);
		w.llm.on('spontaneous', () => ({ send: false, message: '' }));
		w.db.raw.exec("INSERT INTO messages (role, text, kind, at) VALUES ('user', 'Great day at work!', 'chat', '2026-10-04T10:00:00.000Z')");
		await tick(w.deps);
		expect(rows(w, 'SELECT date, summary, mood_score FROM diary')).toEqual([{ date: '2026-10-04', summary: 'Mohit had a good day.', mood_score: 4 }]);
	});

	it('sends a monthly recap on the 1st when there is enough diary', async () => {
		const w = makeWorld('2026-11-01T09:00:00+05:30');
		scriptDefaults(w);
		w.llm.on('spontaneous', () => ({ send: false, message: '' }));
		for (const d of ['2026-10-10', '2026-10-15', '2026-10-20']) w.db.raw.exec(`INSERT INTO diary (date, summary) VALUES ('${d}', 'stuff')`);
		await tick(w.deps);
		expect(w.speech.spoken).toContain('Your month!');
	});
});

describe('chatty nudges', () => {
	it('picks one afternoon and one early-evening slot (never late at night)', () => {
		for (const seed of [0, 0.5, 0.999]) {
			const [a, b] = pickNudgeTimes(() => seed);
			expect(a).toBeGreaterThanOrEqual(11 * 60);
			expect(a).toBeLessThanOrEqual(17 * 60 + 30);
			expect(b).toBeGreaterThanOrEqual(19 * 60 + 45);
			expect(b).toBeLessThanOrEqual(20 * 60 + 30);
		}
	});

	it('sends each nudge at most once, and never mid-conversation', async () => {
		const w = makeWorld('2026-10-05T10:00:00+05:30');
		scriptDefaults(w);
		w.db.raw.exec("INSERT INTO runs (key, at) VALUES ('briefing:2026-10-05', 'x'), ('checkin:2026-10-05', 'x')");
		await tick(w.deps);
		const times = rows(w, "SELECT v FROM kv WHERE k = 'nudges:2026-10-05'")[0].v.split(',').map(Number);
		// Pretend he just messaged right at the first nudge slot.
		const slot = new Date(Date.UTC(2026, 9, 5, 0, 0) - 330 * 60_000 + times[0] * 60_000);
		w.db.raw.prepare("INSERT INTO messages (role, text, kind, at) VALUES ('user', 'busy chatting', 'chat', ?)").run(new Date(slot.getTime() - 10 * 60_000).toISOString());
		w.clock.set(slot.toISOString());
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => /Random buddy/.test(s.text))).toEqual([]);
		// Later, quiet again: the evening slot fires once.
		const slot2 = new Date(Date.UTC(2026, 9, 5, 0, 0) - 330 * 60_000 + times[1] * 60_000);
		w.clock.set(slot2.toISOString());
		await tick(w.deps);
		w.clock.advance(5);
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => /Random buddy/.test(s.text)).length).toBe(1);
		const prompt = w.llm.calls.find((c) => c.turns[0].text.includes('caring text'))!.turns[0].text;
		expect(prompt).toMatch(/Never send random jokes, trivia or facts/);
		expect(prompt).toContain('RECENT CHAT: Mohit: busy chatting');
	});
});

describe('pause', () => {
	it('stays quiet while paused but still delivers explicit reminders', async () => {
		const w = makeWorld('2026-10-05T06:00:00+05:30');
		scriptDefaults(w);
		w.db.raw.exec("INSERT INTO kv (k, v) VALUES ('paused_until', '2026-10-05T10:00:00.000Z')"); // 15:30 IST
		w.db.raw.exec("INSERT INTO reminders (text, due_at, created_at) VALUES ('Take medicine', '2026-10-05T01:35:00.000Z', 'x')"); // 07:05 IST
		w.clock.set('2026-10-05T07:05:00+05:30');
		await tick(w.deps);
		const texts = w.tg.visible().map((s) => s.text);
		expect(texts.some((t) => /Take medicine/.test(t))).toBe(true);
		expect(w.tg.visible().filter((s) => s.type === 'voice')).toEqual([]); // no briefing
	});
});

describe('robustness', () => {
	it('one failing step does not stop the others', async () => {
		const w = makeWorld('2026-10-05T07:00:00+05:30');
		scriptDefaults(w);
		w.mail.fetchNew = async () => {
			throw new Error('imap down');
		};
		w.db.raw.exec("INSERT INTO reminders (text, due_at, created_at) VALUES ('Stretch', '2026-10-05T01:00:00.000Z', 'x')");
		const log = await tick(w.deps);
		expect(log.join()).toMatch(/email failed: Error: imap down/);
		expect(w.tg.visible().some((s) => /Stretch/.test(s.text))).toBe(true);
		expect(w.tg.visible().some((s) => s.type === 'audio')).toBe(true);
	});

	it('does nothing before pairing', async () => {
		const w = makeWorld('2026-10-05T07:00:00+05:30', { paired: false });
		expect(await tick(w.deps)).toEqual(['not paired']);
		expect(w.tg.sent).toEqual([]);
	});

	it('closes follow-ups he never answered after a few days', async () => {
		const w = makeWorld('2026-10-20T10:00:00+05:30');
		scriptDefaults(w);
		w.llm.on('spontaneous', () => ({ send: false, message: '' }));
		w.db.raw.exec(
			"INSERT INTO plans (title, starts_at, followup_at, followup_question, followup_sent, created_at) VALUES ('Party', '2026-10-10T12:00:00.000Z', '2026-10-10T14:00:00.000Z', 'How was it?', 1, 'x')",
		);
		await tick(w.deps);
		expect(rows(w, 'SELECT status FROM plans')[0].status).toBe('done');
	});
});

describe('delivery failures and life admin', () => {
	it('retries the briefing on the next tick if Telegram was down', async () => {
		const w = makeWorld('2026-10-05T07:00:00+05:30');
		scriptDefaults(w);
		w.speech.disabled = true; // text path, so the failing sendMessage is hit
		w.tg.failNext = 2; // first send and its retry both fail
		const log = await tick(w.deps);
		expect(log.join()).toMatch(/briefing failed/);
		w.clock.advance(5);
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => /Good morning Mohit/.test(s.text)).length).toBe(1);
	});

	it('reminds about bills due soon, stops after he says it is paid, and drops long-past items', async () => {
		const w = makeWorld('2026-10-06T07:00:00+05:30');
		scriptDefaults(w);
		w.db.raw.exec(`INSERT INTO admin_items (kind, title, due_at, amount, source_ref, created_at) VALUES
			('bill', 'Airtel bill', '2026-10-07T18:29:00.000Z', '₹799', 'mail:1', 'x'),
			('delivery', 'Old parcel', '2026-09-01T00:00:00.000Z', '', 'mail:2', 'x')`);
		await tick(w.deps);
		const prompt = w.llm.calls.find((c) => c.turns[0].text.includes('morning briefing'))!.turns[0].text;
		expect(prompt).toMatch(/bill: Airtel bill ₹799 due/);
		expect(prompt).not.toMatch(/Old parcel/);

		const { applyMemory } = await import('../src/memory');
		const { Store } = await import('../src/store');
		const { emptyMemory } = await import('./harness');
		await applyMemory(new Store(w.db), { ...emptyMemory, admin_done: [1] }, w.clock.now);
		expect(rows(w, 'SELECT status FROM admin_items WHERE id = 1')[0].status).toBe('done');
	});
});

describe('nightly self-review', () => {
	it('grades the day once and stores the result for review', async () => {
		const w = makeWorld('2026-10-05T23:50:00+05:30');
		scriptDefaults(w);
		w.llm.on('demanding reviewer', (req) => {
			expect(req.turns[0].text).toContain('Jarvis [chat; brain=9000]: I am not sure.');
			return { score: 6, summary: 'Mostly fine, one lazy answer', issues: [{ jarvis_said: 'I am not sure.', problem: 'Could have searched', better_reply: 'India won by 5 wickets!' }] };
		});
		w.db.raw.exec(`INSERT INTO messages (role, text, kind, at, meta) VALUES
			('user', 'who won the match?', 'chat', '2026-10-05T10:00:00.000Z', ''),
			('jarvis', 'I am not sure.', 'chat', '2026-10-05T10:00:09.000Z', 'brain=9000')`);
		await tick(w.deps);
		await tick(w.deps);
		const stored = JSON.parse(rows(w, "SELECT v FROM kv WHERE k = 'review:2026-10-05'")[0].v);
		expect(stored.score).toBe(6);
		expect(stored.issues[0].problem).toBe('Could have searched');
		expect(w.llm.calls.filter((c) => c.system.includes('demanding reviewer')).length).toBe(1);
	});
});
