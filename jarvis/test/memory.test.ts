import { describe, expect, it } from 'vitest';
import { applyMemory, chooseFollowup } from '../src/memory';
import { Store } from '../src/store';
import { atLocal, isoLocal } from '../src/time';
import { emptyMemory, makeWorld, rows } from './harness';

describe('chooseFollowup', () => {
	const now = new Date('2026-10-03T10:00:00+05:30');
	it('asks about two hours after a timed event', () => {
		expect(isoLocal(chooseFollowup(new Date('2026-10-09T17:00:00+05:30'), false, null, now)!)).toBe('2026-10-09T19:00:00+05:30');
	});
	it('moves late-night follow-ups to the next morning', () => {
		expect(isoLocal(chooseFollowup(new Date('2026-10-09T21:00:00+05:30'), false, null, now)!)).toBe('2026-10-10T10:00:00+05:30');
	});
	it('does not ask before 10 AM', () => {
		expect(isoLocal(chooseFollowup(new Date('2026-10-09T06:00:00+05:30'), false, null, now)!)).toBe('2026-10-09T10:00:00+05:30');
	});
	it('folds all-day events into the 7 PM check-in', () => {
		expect(isoLocal(chooseFollowup(new Date('2026-10-09T00:00:00+05:30'), true, null, now)!)).toBe('2026-10-09T19:00:00+05:30');
	});
	it('respects a sensible requested time but not one before the event', () => {
		const start = new Date('2026-10-09T17:00:00+05:30');
		expect(isoLocal(chooseFollowup(start, false, new Date('2026-10-09T20:30:00+05:30'), now)!)).toBe('2026-10-09T20:30:00+05:30');
		expect(isoLocal(chooseFollowup(start, false, new Date('2026-10-09T12:00:00+05:30'), now)!)).toBe('2026-10-09T19:00:00+05:30');
	});
});

describe('applyMemory', () => {
	it('stores valid items and skips garbage without throwing', async () => {
		const w = makeWorld();
		const store = new Store(w.db);
		const now = w.clock.now;
		const res = await applyMemory(
			store,
			{
				...emptyMemory,
				facts_add: [{ text: 'Loves filter coffee', category: 'preference' }, { text: '  ', category: 'other' }, { text: 'loves FILTER coffee', category: 'preference' }],
				people: [{ name: 'Rahul', relation: 'college friend', notes: 'works at Infosys', birthday: '03-15' }, { name: '', relation: '', notes: '', birthday: '' }],
				plans_add: [
					{ title: 'Dentist', starts_at: '2026-10-09T17:00:00+05:30', all_day: false, followup_question: 'How did the dentist go?', followup_at: '' },
					{ title: 'Bad date', starts_at: 'next friday', all_day: false, followup_question: '', followup_at: '' },
					{ title: 'Old thing', starts_at: '2026-09-01T10:00:00+05:30', all_day: false, followup_question: '', followup_at: '' },
				],
				reminders_add: [{ text: 'Call mom', due_at: '2026-10-03T20:00:00+05:30' }, { text: 'Bad', due_at: 'later' }],
				goals_add: [{ title: 'Gym 3x a week', cadence: 'weekly' }, { title: 'Read', cadence: 'whenever' as any }],
				mood_label: 'happy',
				mood_score: 4,
				diary_note: 'Got a promotion',
			} as any,
			now,
		);
		expect(rows(w, 'SELECT text FROM facts').map((r) => r.text)).toEqual(['Loves filter coffee']);
		expect(rows(w, 'SELECT name, birthday FROM people')).toEqual([{ name: 'Rahul', birthday: '03-15' }]);
		const plans = rows(w, 'SELECT title, followup_at FROM plans');
		expect(plans).toEqual([{ title: 'Dentist', followup_at: atLocal('2026-10-09', 19).toISOString() }]);
		expect(rows(w, 'SELECT text FROM reminders').map((r) => r.text)).toEqual(['Call mom']);
		expect(rows(w, 'SELECT title, cadence FROM goals')).toEqual([
			{ title: 'Gym 3x a week', cadence: 'weekly' },
			{ title: 'Read', cadence: 'daily' },
		]);
		expect(rows(w, 'SELECT label, score FROM moods')).toEqual([{ label: 'happy', score: 4 }]);
		expect(rows(w, 'SELECT notes FROM diary')[0].notes).toBe('Got a promotion');
		expect(res.summary.length).toBeGreaterThan(5);
	});

	it('tolerates a completely malformed payload', async () => {
		const w = makeWorld();
		await expect(applyMemory(new Store(w.db), { facts_add: 'nope', plans_add: [null, 5], people: [{}] } as any, w.clock.now)).resolves.toBeTruthy();
		await expect(applyMemory(new Store(w.db), undefined, w.clock.now)).resolves.toEqual({ summary: [] });
	});

	it('reschedules, completes and forgets', async () => {
		const w = makeWorld();
		const store = new Store(w.db);
		const now = w.clock.now;
		await applyMemory(
			store,
			{
				...emptyMemory,
				facts_add: [{ text: 'Works at Acme', category: 'work' }],
				plans_add: [{ title: 'Dentist', starts_at: '2026-10-09T17:00:00+05:30', all_day: false, followup_question: 'How was it?', followup_at: '' }],
			},
			now,
		);
		await applyMemory(store, { ...emptyMemory, plans_update: [{ id: 1, status: 'rescheduled', outcome: '', new_starts_at: '2026-10-10T11:00:00+05:30' }] }, now);
		expect(rows(w, 'SELECT starts_at, followup_at FROM plans')[0]).toEqual({
			starts_at: atLocal('2026-10-10', 11).toISOString(),
			followup_at: atLocal('2026-10-10', 13).toISOString(),
		});
		await applyMemory(store, { ...emptyMemory, plans_update: [{ id: 1, status: 'done', outcome: 'No cavities!', new_starts_at: '' }], facts_remove: [1] }, now);
		expect(rows(w, 'SELECT status, outcome FROM plans')[0]).toEqual({ status: 'done', outcome: 'No cavities!' });
		expect(await store.facts()).toEqual([]);
		// Updating a closed plan or an unknown id does nothing.
		await applyMemory(store, { ...emptyMemory, plans_update: [{ id: 1, status: 'cancelled', outcome: '', new_starts_at: '' }, { id: 99, status: 'done', outcome: '', new_starts_at: '' }] }, now);
		expect(rows(w, 'SELECT status FROM plans')[0].status).toBe('done');
	});

	it('counts habit streaks per local day', async () => {
		const w = makeWorld('2026-10-03T08:00:00+05:30');
		const store = new Store(w.db);
		await store.addGoal('Gym', 'daily', w.clock.now.toISOString());
		const checkin = () => applyMemory(store, { ...emptyMemory, goals_checkin: [{ id: 1, note: '' }] }, w.clock.now);
		await checkin();
		await checkin(); // same day twice
		w.clock.advance(24 * 60);
		await checkin();
		expect(rows(w, 'SELECT streak FROM goals')[0].streak).toBe(2);
		w.clock.advance(3 * 24 * 60); // missed days reset the streak
		await checkin();
		expect(rows(w, 'SELECT streak FROM goals')[0].streak).toBe(1);
	});
});
