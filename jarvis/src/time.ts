// Local-time helpers. India has no daylight saving, so a fixed offset is exact.
export const OFFSET_MIN = 330; // Asia/Kolkata, UTC+05:30
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface LocalParts {
	year: number;
	month: number; // 1-12
	day: number;
	hour: number;
	minute: number;
	weekday: number; // 0 = Sunday
}

const pad = (n: number) => String(n).padStart(2, '0');

export function local(d: Date): LocalParts {
	const s = new Date(d.getTime() + OFFSET_MIN * 60_000);
	return {
		year: s.getUTCFullYear(),
		month: s.getUTCMonth() + 1,
		day: s.getUTCDate(),
		hour: s.getUTCHours(),
		minute: s.getUTCMinutes(),
		weekday: s.getUTCDay(),
	};
}

/** Local calendar date, "YYYY-MM-DD". */
export function localDate(d: Date): string {
	const p = local(d);
	return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight. */
export function localMinutes(d: Date): number {
	const p = local(d);
	return p.hour * 60 + p.minute;
}

/** The UTC instant of a local wall-clock time on a local date. */
export function atLocal(date: string, hour: number, minute = 0): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d, hour, minute) - OFFSET_MIN * 60_000);
}

export function addDays(date: string, n: number): string {
	return localDate(new Date(atLocal(date, 12).getTime() + n * DAY_MS));
}

/** ISO string with the local offset, e.g. 2026-10-03T19:00:00+05:30 (what the LLM reads and writes). */
export function isoLocal(d: Date): string {
	const p = local(d);
	const sign = OFFSET_MIN >= 0 ? '+' : '-';
	const a = Math.abs(OFFSET_MIN);
	return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/**
 * Parse a time the LLM produced. Accepts ISO with offset or Z; a naive "YYYY-MM-DDTHH:MM" or
 * "YYYY-MM-DD" is read as local time. Returns null for anything unparseable.
 */
export function parseTime(s: unknown): Date | null {
	if (typeof s !== 'string') return null;
	const t = s.trim();
	if (!t) return null;
	const head = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(t);
	if (!head || !realDate(+head[1], +head[2], +head[3])) return null;
	if (head[4] !== undefined && (+head[4] > 23 || +head[5] > 59)) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return validDate(atLocal(t, 0));
	const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(t);
	if (naive) return validDate(atLocal(naive[1], Number(naive[2]), Number(naive[3])));
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(t)) return null;
	return validDate(new Date(t));
}

function realDate(y: number, m: number, d: number): boolean {
	if (m < 1 || m > 12 || d < 1) return false;
	return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function validDate(d: Date): Date | null {
	return Number.isFinite(d.getTime()) ? d : null;
}

/** "Saturday 3 Oct 2026, 2:05 PM" */
export function human(d: Date, withDate = true): string {
	const p = local(d);
	const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
	const time = `${h12}:${pad(p.minute)} ${p.hour < 12 ? 'AM' : 'PM'}`;
	if (!withDate) return time;
	return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${time}`;
}

export function weekdayName(date: string): string {
	return WEEKDAYS[local(atLocal(date, 12)).weekday];
}

/** A small calendar of the coming days, which keeps the LLM from miscounting weekdays. */
export function calendarHint(now: Date, days = 14): string {
	const today = localDate(now);
	const lines: string[] = [];
	for (let i = 0; i < days; i++) {
		const d = addDays(today, i);
		const label = i === 0 ? ' (today)' : i === 1 ? ' (tomorrow)' : '';
		lines.push(`${weekdayName(d)} ${d}${label}`);
	}
	return lines.join('\n');
}

export const utc = (d: Date) => d.toISOString();
