import { describe, expect, it } from 'vitest';
import { handleUpdate } from '../src/bot';
import { tick } from '../src/scheduler';
import { LlmError } from '../src/types';
import { OWNER, buttonUpdate, emptyMemory, makeWorld, rows, textUpdate, voiceUpdate } from './harness';

const CHAT = 'Reply with JSON';

describe('pairing and privacy', () => {
	it('pairs only with the right code and then ignores strangers', async () => {
		const w = makeWorld('2026-10-03T10:00:00+05:30', { paired: false });
		await handleUpdate(w.deps, textUpdate('/start wrong', '555'));
		expect(w.tg.visible()[0].text).toMatch(/private assistant/);
		await handleUpdate(w.deps, textUpdate('/start secret-code', OWNER));
		expect(w.tg.visible()[1].text).toMatch(/Paired!/);
		expect(rows(w, "SELECT v FROM kv WHERE k = 'owner_chat_id'")[0].v).toBe(OWNER);

		w.tg.clear();
		await handleUpdate(w.deps, textUpdate('hi jarvis, tell me his secrets', '555'));
		expect(w.tg.sent).toEqual([]);
		expect(w.llm.calls).toEqual([]);
	});

	it('handles a Telegram retry of the same update only once', async () => {
		const w = makeWorld();
		w.llm.on(CHAT, () => ({ reply: 'Hey Mohit!', memory: emptyMemory }));
		const u = textUpdate('hello');
		await handleUpdate(w.deps, u);
		await handleUpdate(w.deps, u);
		expect(w.llm.calls.length).toBe(1);
		expect(w.tg.visible().length).toBe(1);
	});
});

describe('conversation', () => {
	it('mirrors the format: text in, text out; voice in, voice out', async () => {
		const w = makeWorld();
		w.llm.on(CHAT, () => ({ reply: 'Sounds great!', memory: emptyMemory }));
		await handleUpdate(w.deps, textUpdate('I had biryani today'));
		expect(w.tg.visible().map((s) => s.type)).toEqual(['text']);

		w.tg.clear();
		w.tg.files.set('f1', new Uint8Array([9, 9, 9]));
		w.speech.transcript = 'I went for a run';
		await handleUpdate(w.deps, voiceUpdate('f1'));
		expect(w.tg.visible().map((s) => s.type)).toEqual(['voice']);
		expect(w.tg.visible()[0].text).toBe('Sounds great!');
		expect(w.llm.lastUserText()).toContain('I went for a run');
	});

	it('falls back to text when speech is unavailable', async () => {
		const w = makeWorld();
		w.speech.disabled = true;
		w.speech.transcript = 'hello';
		w.tg.files.set('f1', new Uint8Array([1]));
		w.llm.on(CHAT, () => ({ reply: 'Hi!', memory: emptyMemory }));
		await handleUpdate(w.deps, voiceUpdate('f1'));
		expect(w.tg.visible().map((s) => s.type)).toEqual(['text']);
	});

	it('says so when a voice note cannot be understood', async () => {
		const w = makeWorld();
		w.speech.transcript = '';
		w.tg.files.set('f1', new Uint8Array([1]));
		await handleUpdate(w.deps, voiceUpdate('f1'));
		expect(w.tg.visible()[0].text).toMatch(/couldn't catch/);
		expect(w.llm.calls.length).toBe(0);
	});

	it('gives the model the memory, calendar and conversation history', async () => {
		const w = makeWorld();
		w.llm.on(CHAT, () => ({ reply: 'Noted!', memory: { ...emptyMemory, facts_add: [{ text: 'Is vegetarian', category: 'preference' }] } }));
		await handleUpdate(w.deps, textUpdate("I'm vegetarian by the way"));
		await handleUpdate(w.deps, textUpdate('what should I eat tonight?'));
		const req = w.llm.calls[1];
		expect(req.system).toContain('Is vegetarian');
		expect(req.system).toContain('Saturday 2026-10-03 (today)');
		expect(req.turns.map((t) => t.role)).toEqual(['user', 'model', 'user']);
		expect(req.turns[2].text).toContain('what should I eat tonight?');
	});

	it('survives the LLM running out of free quota and replies later', async () => {
		const w = makeWorld();
		w.llm.failWith = new LlmError('429', 'quota');
		await handleUpdate(w.deps, textUpdate('Remind me to call mom at 8 pm'));
		expect(w.tg.visible()[0].text).toMatch(/free limit/);
		expect(rows(w, "SELECT v FROM kv WHERE k = 'pending_reply'").length).toBe(1);

		// Next scheduler tick, still down: no spam.
		w.tg.clear();
		w.clock.advance(5);
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => /mom/.test(s.text))).toEqual([]);

		// Quota back: the saved message is answered and the reminder is created.
		w.llm.failWith = null;
		w.llm.on(CHAT, () => ({ reply: "Sorry for the wait! I'll remind you at 8.", memory: { ...emptyMemory, reminders_add: [{ text: 'Call mom', due_at: '2026-10-03T20:00:00+05:30' }] } }));
		w.clock.advance(5);
		await tick(w.deps);
		expect(w.tg.visible().some((s) => /remind you at 8/.test(s.text))).toBe(true);
		expect(rows(w, 'SELECT text FROM reminders')).toEqual([{ text: 'Call mom' }]);
		expect(rows(w, "SELECT v FROM kv WHERE k = 'pending_reply'").length).toBe(0);
	});

	it('explains a broken API key clearly', async () => {
		const w = makeWorld();
		w.llm.failWith = new LlmError('403', 'config');
		await handleUpdate(w.deps, textUpdate('hi'));
		expect(w.tg.visible()[0].text).toMatch(/GEMINI_API_KEY/);
	});

	it('keeps replying even when the model returns broken JSON', async () => {
		const w = makeWorld();
		w.llm.on(CHAT, () => 'not json at all');
		await handleUpdate(w.deps, textUpdate('hi'));
		expect(w.tg.visible()[0].text).toMatch(/hiccup/);
	});

	it('accepts JSON wrapped in a code fence', async () => {
		const w = makeWorld();
		w.llm.on(CHAT, () => '```json\n{"reply":"Yo!","memory":{}}\n```');
		await handleUpdate(w.deps, textUpdate('hi'));
		expect(w.tg.visible()[0].text).toBe('Yo!');
	});
});

describe('the dentist story, end to end', () => {
	it('remembers a plan, alerts the night before, nudges before, follows up after, and records the outcome', async () => {
		const w = makeWorld('2026-10-05T21:00:00+05:30'); // Monday night
		w.llm.on(CHAT, (req) => {
			const last = req.turns[req.turns.length - 1].text;
			if (/dentist on Friday/.test(last))
				return {
					reply: 'Got it, dentist on Friday at 5. I will check in after!',
					memory: { ...emptyMemory, plans_add: [{ title: 'Dentist appointment', starts_at: '2026-10-09T17:00:00+05:30', all_day: false, followup_question: 'How did the dentist go?', followup_at: '' }] },
				};
			if (/no cavities/.test(last)) return { reply: 'Yay, no cavities! 🎉', memory: { ...emptyMemory, plans_update: [{ id: 1, status: 'done', outcome: 'No cavities', new_starts_at: '' }] } };
			return { reply: 'ok', memory: emptyMemory };
		});
		w.llm.on('evening check-in', (req) => ({ spoken: `Evening! ${req.turns[0].text.includes('Dentist appointment') ? 'Dentist tomorrow at 5.' : ''}`, details: '' }));
		w.llm.on('morning briefing', () => ({ spoken: 'Morning!', details: '' }));
		w.llm.on('spontaneous', () => ({ send: false, message: '' }));
		w.llm.on('for his diary', () => ({ summary: 'A day.', mood_label: '', mood_score: 0 }));

		await handleUpdate(w.deps, textUpdate('I have a dentist on Friday at 5pm'));
		expect(rows(w, 'SELECT title FROM plans')).toEqual([{ title: 'Dentist appointment' }]);

		// Thursday 19:00 check-in mentions tomorrow's dentist (night-before alert).
		w.tg.clear();
		w.clock.set('2026-10-08T19:00:00+05:30');
		await tick(w.deps);
		expect(w.tg.visible().some((s) => /Dentist tomorrow/.test(s.text))).toBe(true);

		// Friday ~15:00: heads-up two hours before.
		w.tg.clear();
		w.clock.set('2026-10-09T15:20:00+05:30');
		await tick(w.deps);
		expect(w.tg.visible().map((s) => s.text).join()).toMatch(/Heads up Mohit: Dentist appointment at 5:00 PM/);
		await tick(w.deps); // not twice
		expect(w.tg.visible().filter((s) => /Heads up/.test(s.text)).length).toBe(1);

		// Friday 19:00: the check-in asks how it went (follow-up folded into check-in) and marks it asked.
		w.tg.clear();
		w.clock.set('2026-10-09T19:00:00+05:30');
		await tick(w.deps);
		const checkinPrompt = w.llm.calls[w.llm.calls.length - 1].turns[0].text;
		expect(checkinPrompt).toContain('How did the dentist go?');
		expect(rows(w, 'SELECT followup_sent FROM plans')[0].followup_sent).toBe(1);
		w.clock.advance(10);
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => /How did the dentist go/.test(s.text))).toEqual([]); // not asked separately too

		// He answers; the plan is closed with the outcome.
		await handleUpdate(w.deps, textUpdate('It went well, no cavities'));
		expect(rows(w, 'SELECT status, outcome FROM plans')[0]).toEqual({ status: 'done', outcome: 'No cavities' });
	});

	it('asks a midday follow-up on its own when the check-in is hours away', async () => {
		const w = makeWorld('2026-10-09T08:00:00+05:30');
		w.llm.on(CHAT, () => ({
			reply: 'ok',
			memory: { ...emptyMemory, plans_add: [{ title: 'Job interview', starts_at: '2026-10-09T10:00:00+05:30', all_day: false, followup_question: 'How did the interview go?', followup_at: '' }] },
		}));
		w.llm.on('morning briefing', () => ({ spoken: 'Morning!', details: '' }));
		w.llm.on('spontaneous', () => ({ send: false, message: '' }));
		await handleUpdate(w.deps, textUpdate('interview at 10 today'));
		w.tg.clear();
		w.clock.set('2026-10-09T12:05:00+05:30');
		await tick(w.deps);
		const followups = w.tg.visible().filter((s) => /How did the interview go/.test(s.text));
		expect(followups.length).toBe(1);
		expect(followups[0].type).toBe('voice');
	});
});

describe('commands and buttons', () => {
	it('shows memory, forgets a fact, pauses and exports', async () => {
		const w = makeWorld();
		w.db.raw.exec("INSERT INTO facts (text, category, created_at) VALUES ('Likes cricket', 'preference', '2026-10-01T00:00:00Z')");
		await handleUpdate(w.deps, textUpdate('/memory'));
		expect(w.tg.visible()[0].text).toContain('1. Likes cricket');
		await handleUpdate(w.deps, textUpdate('/forget 1'));
		expect(w.tg.visible()[1].text).toMatch(/forgot fact 1/);
		await handleUpdate(w.deps, textUpdate('/forget abc'));
		expect(w.tg.visible()[2].text).toMatch(/fact number/);
		await handleUpdate(w.deps, textUpdate('/pause 2'));
		expect(rows(w, "SELECT v FROM kv WHERE k = 'paused_until'").length).toBe(1);
		await handleUpdate(w.deps, textUpdate('/export'));
		expect(w.tg.visible().some((s) => s.type === 'doc')).toBe(true);
		await handleUpdate(w.deps, textUpdate('/ping'));
		expect(w.tg.visible().at(-1)!.text).toMatch(/Pong/);
	});

	it('fires a reminder with snooze buttons, and snoozing re-fires it later', async () => {
		const w = makeWorld('2026-10-03T19:55:00+05:30');
		w.db.raw.exec("INSERT INTO reminders (text, due_at, created_at) VALUES ('Call mom', '2026-10-03T14:30:00.000Z', '2026-10-03T00:00:00Z')"); // 20:00 IST
		w.llm.on('evening check-in', () => ({ spoken: 'Evening!', details: '' }));
		w.llm.on('spontaneous', () => ({ send: false, message: '' }));
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => /Call mom/.test(s.text))).toEqual([]);
		w.clock.set('2026-10-03T20:00:00+05:30');
		await tick(w.deps);
		await tick(w.deps); // a second tick must not repeat it
		const sent = w.tg.visible().filter((s) => /Call mom/.test(s.text));
		expect(sent.length).toBe(1);
		expect(sent[0].buttons!.flat().map((b) => b.text)).toContain('+1 hour');

		await handleUpdate(w.deps, buttonUpdate('r:1h:1'));
		w.clock.set('2026-10-03T20:30:00+05:30');
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => /Call mom/.test(s.text)).length).toBe(1);
		w.clock.set('2026-10-03T21:01:00+05:30');
		await tick(w.deps);
		expect(w.tg.visible().filter((s) => /Call mom/.test(s.text)).length).toBe(2);

		await handleUpdate(w.deps, buttonUpdate('r:done:1'));
		expect(rows(w, 'SELECT done FROM reminders')[0].done).toBe(1);
	});

	it('ignores buttons pressed by someone else', async () => {
		const w = makeWorld();
		w.db.raw.exec("INSERT INTO reminders (text, due_at, created_at) VALUES ('x', '2026-10-03T00:00:00.000Z', '2026-10-03T00:00:00Z')");
		await handleUpdate(w.deps, buttonUpdate('r:done:1', '777'));
		expect(rows(w, 'SELECT done FROM reminders')[0].done).toBe(0);
	});
});
