import { describe, expect, it } from 'vitest';
import { handleUpdate, isSmallTalk } from '../src/bot';
import { Store } from '../src/store';
import { tick } from '../src/scheduler';
import { LlmError } from '../src/types';
import { OWNER, buttonUpdate, emptyMemory, makeWorld, onChat, rows, textUpdate, toolResults, voiceUpdate } from './harness';


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
		onChat(w, () => ({ reply: 'Hey Mohit!', memory: emptyMemory }));
		const u = textUpdate('hello');
		await handleUpdate(w.deps, u);
		await handleUpdate(w.deps, u);
		expect(w.llm.calls.filter((c) => c.system.includes('Reply with just your message')).length).toBe(1);
		expect(w.tg.visible().length).toBe(1);
	});
});

describe('conversation', () => {
	it('mirrors the format: text in, text out; voice in, voice out', async () => {
		const w = makeWorld();
		onChat(w, () => ({ reply: 'Sounds great!', memory: emptyMemory }));
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
		onChat(w, () => ({ reply: 'Hi!', memory: emptyMemory }));
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
		onChat(w, () => ({ reply: 'Noted!', memory: { ...emptyMemory, facts_add: [{ text: 'Is vegetarian', category: 'preference' }] } }));
		await handleUpdate(w.deps, textUpdate("I'm vegetarian by the way"));
		w.clock.advance(5);
		await tick(w.deps); // background memory runs from the cron tick
		await handleUpdate(w.deps, textUpdate('what should I eat tonight?'));
		const replies = w.llm.calls.filter((c) => c.system.includes('Reply with just your message'));
		const req = replies[1];
		expect(req.fast).toBe(true);
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
		onChat(w, () => ({ reply: "Sorry for the wait! I'll remind you at 8.", memory: { ...emptyMemory, reminders_add: [{ text: 'Call mom', due_at: '2026-10-03T20:00:00+05:30' }] } }));
		w.clock.advance(5);
		await tick(w.deps); // still inside the 15-minute retry back-off: no call
		expect(w.tg.visible().some((s) => /remind you at 8/.test(s.text))).toBe(false);
		w.clock.advance(10);
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

	it('says it had a hiccup when the model returns nothing', async () => {
		const w = makeWorld();
		onChat(w, () => '   ');
		await handleUpdate(w.deps, textUpdate('hi'));
		expect(w.tg.visible()[0].text).toMatch(/hiccup/);
	});

	it('accepts JSON wrapped in a code fence', async () => {
		const w = makeWorld();
		onChat(w, () => '```json\n{"reply":"Yo!","memory":{}}\n```');
		await handleUpdate(w.deps, textUpdate('hi'));
		expect(w.tg.visible()[0].text).toBe('Yo!');
	});
});

describe('the dentist story, end to end', () => {
	it('remembers a plan, alerts the night before, nudges before, follows up after, and records the outcome', async () => {
		const w = makeWorld('2026-10-05T21:00:00+05:30'); // Monday night
		onChat(w, (req) => {
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
		onChat(w, () => ({
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

describe('email on request, status and voices', () => {
	const triage = (w: ReturnType<typeof makeWorld>) =>
		w.llm.on('email triage filter', () => ({
			items: [{ uid: 1, importance: 'high', kind: 'work', summary: 'Priya (manager): needs the deck by 4 PM', event_title: '', event_starts_at: '', event_all_day: false, followup_question: '', due_title: '', due_at: '', amount: '', urgent: false }],
		}));

	it('checks Gmail right away when he asks about email, and the model knows it has access', async () => {
		const w = makeWorld();
		triage(w);
		w.mail.inbox = [{ uid: 1, from: 'Priya', subject: 'Deck', date: w.clock.now, text: 'Need the deck by 4' }];
		onChat(w, (r) => (/emails/.test(r.turns.at(-1)!.text) ? { reply: 'Priya needs the deck by 4!', calls: [{ name: 'check_email', args: { query: '', days: 1 } }] } : 'np'));
		await handleUpdate(w.deps, textUpdate('Any important emails today?'));
		expect(w.mail.calls).toBe(1);
		expect(JSON.stringify(toolResults(w, 'check_email'))).toContain('Priya (manager): needs the deck by 4 PM');
		expect(w.llm.calls[0].system).toMatch(/you DO have read-only access to his Gmail/);
		expect(w.tg.visible().at(-1)!.text).toBe('Priya needs the deck by 4!');
		expect(rows(w, "SELECT meta FROM messages WHERE role = 'jarvis'").at(-1).meta).toContain('tools=check_email');
		// A non-email message doesn't hit Gmail.
		await handleUpdate(w.deps, textUpdate('cool thanks'));
		expect(w.mail.calls).toBe(1);
	});

	it('/emails lists important mail, and reports a Gmail login problem plainly', async () => {
		const w = makeWorld();
		triage(w);
		w.mail.inbox = [{ uid: 1, from: 'Priya', subject: 'Deck', date: w.clock.now, text: 'x' }];
		await handleUpdate(w.deps, textUpdate('/emails'));
		expect(w.tg.visible().at(-1)!.text).toMatch(/❗ Priya \(manager\)/);
		w.mail.fetchNew = async () => {
			throw new Error('imap LOGIN failed: NO [AUTHENTICATIONFAILED] Invalid credentials');
		};
		await handleUpdate(w.deps, textUpdate('/emails'));
		expect(w.tg.visible().at(-1)!.text).toMatch(/couldn't check Gmail: imap LOGIN failed/);
		await handleUpdate(w.deps, textUpdate('/status'));
		expect(w.tg.visible().at(-1)!.text).toMatch(/⚠️ email .*AUTHENTICATIONFAILED/);
	});

	it('/voices sends samples and a button sets the voice', async () => {
		const w = makeWorld();
		await handleUpdate(w.deps, textUpdate('/voices'));
		expect(w.tg.visible().filter((s) => s.type === 'voice').length).toBe(6);
		await handleUpdate(w.deps, buttonUpdate('v:prabhat'));
		expect(rows(w, "SELECT v FROM kv WHERE k = 'tts_voice'")[0].v).toBe('prabhat');
	});
});

describe('photos and safety net', () => {
	it('looks at photos he sends and reacts to them', async () => {
		const w = makeWorld();
		w.tg.files.set('p1', new Uint8Array([0xff, 0xd8, 1, 2]));
		onChat(w, () => ({ reply: 'That sunset shot is fire, post it!' }));
		await handleUpdate(w.deps, { update_id: 9001, message: { message_id: 1, chat: { id: Number(OWNER) }, caption: 'Can I post this?', photo: [{ file_id: 'small' }, { file_id: 'p1' }] } });
		const req = w.llm.calls.find((c) => c.system.includes('Reply with just your message'))!;
		expect(req.images?.[0].mime).toBe('image/jpeg');
		expect([...req.images![0].data]).toEqual([0xff, 0xd8, 1, 2]);
		expect(req.turns.at(-1)!.text).toContain('[sent a photo] Can I post this?');
		expect(w.tg.visible().at(-1)!.text).toMatch(/sunset shot is fire/);
	});

	it('never leaves him without an answer when something unexpected breaks', async () => {
		const w = makeWorld();
		onChat(w, () => ({ reply: 'hi' }));
		w.deps.speech.synthesize = async () => {
			throw new Error('boom');
		};
		const realSay = w.tg.sendMessage.bind(w.tg);
		let first = true;
		w.tg.sendMessage = async (c, t, b) => {
			if (first) {
				first = false;
				throw new Error('telegram hiccup');
			}
			return realSay(c, t, b);
		};
		w.tg.failNext = 0;
		await handleUpdate(w.deps, textUpdate('yo'));
		expect(w.tg.visible().map((s) => s.text).join(' ')).toMatch(/hi|glitched/);
	});
});

describe('memory saving', () => {
	it('saves memory from the cron tick (never during the reply) and retries saves that failed', async () => {
		const w = makeWorld();
		let memoryCalls = 0;
		let memoryDown = false;
		w.llm.on((r) => r.system.includes('Reply with just your message'), () => 'haha nice');
		w.llm.on((r) => r.system.includes('You maintain the long-term memory'), (r) => {
			memoryCalls++;
			if (memoryDown) throw new LlmError('429', 'quota');
			return r.turns[0].text.includes('dentist') ? { ...emptyMemory, facts_add: [{ text: 'Goes to Dr. Rao for dental care', category: 'health' }] } : emptyMemory;
		});
		await handleUpdate(w.deps, textUpdate('haha'));
		await handleUpdate(w.deps, textUpdate('my dentist is Dr. Rao, she is great'));
		expect(memoryCalls).toBe(0);
		await tick(w.deps);
		expect(memoryCalls).toBe(0); // too fresh: he may still be talking

		memoryDown = true;
		w.clock.advance(5);
		await tick(w.deps);
		expect(memoryCalls).toBe(1);
		expect(rows(w, 'SELECT count(*) AS c FROM facts')[0].c).toBe(0);

		memoryDown = false;
		w.clock.advance(15);
		await tick(w.deps); // retries the failed batch, including the earlier small talk
		expect(rows(w, 'SELECT text FROM facts')).toEqual([{ text: 'Goes to Dr. Rao for dental care' }]);
		await tick(w.deps);
		expect(memoryCalls).toBe(2); // nothing left to process
	});
});

describe('watchdog', () => {
	it('answers a message whose reply never went out (e.g. the run was cut off)', async () => {
		const w = makeWorld();
		new Store(w.db).addMessage('user', 'What time is my flight?', 'chat', w.clock.now.toISOString());
		onChat(w, () => 'Your flight is at 9:40 PM on Sunday!');
		await tick(w.deps);
		expect(w.tg.visible()).toEqual([]); // too soon: it may still be on its way
		w.clock.advance(3);
		await tick(w.deps);
		expect(w.tg.visible().map((m) => m.text)).toEqual(['Your flight is at 9:40 PM on Sunday!']);
		w.clock.advance(5);
		await tick(w.deps);
		expect(w.tg.visible()).toHaveLength(1); // answered once
	});
});

describe('small talk detection', () => {
	it('recognises throwaway replies but not real content', () => {
		for (const t of ['ok', 'haha', 'Yeah!', 'thanks', '👍', 'good night']) expect(isSmallTalk(t)).toBe(true);
		for (const t of ['remind me at 8', 'I went to the gym', 'my sister is visiting', 'no, cancel the battery reminder']) expect(isSmallTalk(t)).toBe(false);
	});
});

describe('photo albums', () => {
	const photo = (id: number, fileId: string, group?: string, caption?: string) => ({
		update_id: 20000 + id,
		message: { message_id: id, chat: { id: Number(OWNER) }, photo: [{ file_id: fileId }], media_group_id: group, caption },
	});

	it('answers an album plus a follow-up question once, looking at every photo', async () => {
		const w = makeWorld();
		w.tg.files.set('a', new Uint8Array([1]));
		w.tg.files.set('b', new Uint8Array([2]));
		onChat(w, (r) => ({ reply: `Seeing ${r.images?.length ?? 0} photos` }));
		await Promise.all([
			handleUpdate(w.deps, photo(501, 'a', 'album1')),
			handleUpdate(w.deps, photo(502, 'b', 'album1')),
			handleUpdate(w.deps, { update_id: 20503, message: { message_id: 503, chat: { id: Number(OWNER) }, text: 'Which one should I post?' } }),
		]);
		const replies = w.tg.visible();
		expect(replies.length).toBe(1);
		expect(replies[0].text).toBe('Seeing 2 photos');
	});

	it('answers an album without a question once, after gathering it', async () => {
		const w = makeWorld();
		w.tg.files.set('a', new Uint8Array([1]));
		w.tg.files.set('b', new Uint8Array([2]));
		onChat(w, (r) => ({ reply: `Seeing ${r.images?.length ?? 0} photos` }));
		await Promise.all([handleUpdate(w.deps, photo(601, 'a', 'album2')), handleUpdate(w.deps, photo(602, 'b', 'album2'))]);
		expect(w.tg.visible().map((s) => s.text)).toEqual(['Seeing 2 photos']);
	});
});
