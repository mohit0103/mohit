import { describe, expect, it } from 'vitest';
import { EVAL_CASES, runEvalStep } from '../src/eval';
import { addDays, atLocal, localDate, utc } from '../src/time';
import { fakeD1, makeWorld, onChat, rows } from './harness';

describe('live evals', () => {
	it('runs a case on the scratch database, never touching his real memory', async () => {
		const w = makeWorld();
		const evalDb = fakeD1();
		w.db.raw.prepare("INSERT INTO facts (text, category, created_at) VALUES ('Real fact', 'other', 'x')").run();
		onChat(w, () => ({ reply: "Done, I'll remind you at 12!", memory: { reminders_add: [{ text: 'Call mom', due_at: '2026-10-03T12:00:00+05:30' }] } }));
		const out = await runEvalStep(w.deps, evalDb, 'reminder', 0);
		expect(out.result?.pass).toBe(true);
		expect(out.result?.tools).toEqual(['set_reminder']);
		expect(out.result?.transcript).toEqual([{ mohit: 'remind me to call mom in 2 hours', jarvis: "Done, I'll remind you at 12!" }]);
		expect(rows(w, 'SELECT count(*) AS c FROM reminders')[0].c).toBe(0); // real database untouched
		expect(rows(w, 'SELECT text FROM facts')).toEqual([{ text: 'Real fact' }]);
		expect(w.tg.visible()).toEqual([]); // nothing was sent to him
	});

	it('runs multi-message cases one step per request and grades with the rubric', async () => {
		const w = makeWorld();
		const evalDb = fakeD1();
		const day = (n: number) => utc(atLocal(addDays(localDate(w.clock.now), n), 17)).replace('.000Z', 'Z');
		onChat(w, (r) => {
			const last = r.turns.at(-1)!.text;
			if (/dentist/.test(last)) return { reply: 'Saved!', memory: { plans_add: [{ title: 'Dentist', starts_at: day(3), all_day: false, followup_question: '' }] } };
			return { reply: 'Moved it!', memory: { plans_update: [{ id: 1, status: 'rescheduled', outcome: '', new_starts_at: day(4) }] } };
		});
		const first = await runEvalStep(w.deps, evalDb, 'plan_then_correct', 0);
		expect(first).toEqual({ case: 'plan_then_correct', step: 0, next: 1 });
		const done = await runEvalStep(w.deps, evalDb, 'plan_then_correct', 1);
		expect(done.result?.checks.map((c) => [c.name, c.pass])).toEqual([
			['replied every time', true],
			['one plan, not two', true],
			['moved to the corrected day at 5 PM', true],
		]);

		w.llm.on('strict grader', (r) => ({ pass: !/Hoodi/.test(r.turns[0].text.split('CONVERSATION')[1]), reason: 'checked' }));
		onChat(w, () => 'Grab some biryani and catch a movie!');
		const graded = await runEvalStep(w.deps, evalDb, 'grounded_suggestion', 0);
		expect(graded.result?.checks.at(-1)).toEqual({ name: 'grader', pass: true, detail: 'checked' });
	});

	it('flags failures: a glitch reply, a made-up name, a missed tool', async () => {
		const w = makeWorld();
		onChat(w, () => 'Your dentist is Dr. Mehta!');
		const out = await runEvalStep(w.deps, fakeD1(), 'honest_unknown', 0);
		expect(out.result?.pass).toBe(false);
		expect(out.result?.checks.find((c) => c.name === 'does not invent a doctor name')?.pass).toBe(false);
		await expect(runEvalStep(w.deps, fakeD1(), 'reminder', 1)).rejects.toThrow(/step 0/);
		expect(new Set(EVAL_CASES.map((c) => c.name)).size).toBe(EVAL_CASES.length);
	});
});
