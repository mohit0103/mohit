import { describe, expect, it } from 'vitest';
import { addDays, atLocal, calendarHint, human, isoLocal, localDate, localMinutes, parseTime } from '../src/time';

describe('time helpers (IST)', () => {
	const now = new Date('2026-10-03T10:00:00+05:30'); // a Saturday

	it('reads local dates and minutes', () => {
		expect(localDate(now)).toBe('2026-10-03');
		expect(localMinutes(now)).toBe(600);
		// 20:00 UTC is already the next day in India
		expect(localDate(new Date('2026-10-03T20:00:00Z'))).toBe('2026-10-04');
	});

	it('converts local wall time to UTC', () => {
		expect(atLocal('2026-10-03', 7).toISOString()).toBe('2026-10-03T01:30:00.000Z');
		expect(isoLocal(atLocal('2026-10-03', 19))).toBe('2026-10-03T19:00:00+05:30');
	});

	it('adds days across month and year ends', () => {
		expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('parses the time formats an LLM produces', () => {
		expect(parseTime('2026-10-09T17:00:00+05:30')?.toISOString()).toBe('2026-10-09T11:30:00.000Z');
		expect(parseTime('2026-10-09T11:30:00Z')?.toISOString()).toBe('2026-10-09T11:30:00.000Z');
		expect(parseTime('2026-10-09T17:00')?.toISOString()).toBe('2026-10-09T11:30:00.000Z'); // naive = local
		expect(parseTime('2026-10-09')?.toISOString()).toBe('2026-10-08T18:30:00.000Z'); // local midnight
		for (const bad of ['', 'Friday', 'tomorrow 5pm', null, 42, '2026-13-45T99:99', '2026-02-30T10:00', '2026-10-09T25:00:00+05:30', '2026-10-09T10:00:00 garbage', undefined]) expect(parseTime(bad)).toBeNull();
	});

	it('formats for humans', () => {
		expect(human(atLocal('2026-10-03', 19, 5))).toBe('Saturday 3 Oct 2026, 7:05 PM');
		expect(human(atLocal('2026-10-03', 0, 0), false)).toBe('12:00 AM');
	});

	it('gives the model a correct weekday calendar', () => {
		const cal = calendarHint(now, 8).split('\n');
		expect(cal[0]).toBe('Saturday 2026-10-03 (today)');
		expect(cal[1]).toBe('Sunday 2026-10-04 (tomorrow)');
		expect(cal[6]).toBe('Friday 2026-10-09');
	});
});
