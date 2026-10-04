// The self-check: before a reply goes out, compare what it claims with what the tools actually did.
import type { TraceEntry } from './loop';

const CLAIMS: { tools: string[]; pattern: RegExp; what: string }[] = [
	{
		tools: ['set_reminder'],
		pattern: /\b(i'?ll|i will|gonna) (remind|ping|nudge|text|message) you\b|\breminder('s| is)? (set|added|saved|done|locked)\b|\bset (a|the|your|that) reminder\b|\bi'?ve set\b/i,
		what: 'a reminder',
	},
	{
		tools: ['add_plan', 'update_plan'],
		pattern: /\b(i'?ve|i have|just) (saved|added|noted|logged|moved|rescheduled|updated|cancell?ed|marked)\b|\b(moved|rescheduled|shifted) (it|that|the|your)\b|\b(saved|added) (it|that|the|your) (plan|appointment|meeting|trip|flight|event)\b/i,
		what: 'a plan change',
	},
	{ tools: ['cancel_reminder'], pattern: /\b(cancell?ed|removed|deleted|scrapped) (the|that|your) reminder\b/i, what: 'a cancelled reminder' },
	{ tools: ['forget'], pattern: /\b(forgotten|forgot (it|that|about it)|wiped (it|that)|deleted (it|that) from (my )?memory)\b/i, what: 'forgetting something' },
	{ tools: ['track_goal', 'log_goal'], pattern: /\b(i'?m|i am|i'?ll be|now) tracking\b|\bstreak (is|now)\b|\blogged (it|that|your)\b/i, what: 'goal tracking' },
];

const ADMITS_FAILURE = /\b(couldn'?t|could not|can'?t|cannot|didn'?t|did not|wasn'?t able|failed|not able|glitch|problem|issue|sorry|oops|hmm)\b/i;

/** Returns what's wrong with a draft (for the model to fix) or null when it matches what happened. */
export function verifyReply(draft: string, trace: TraceEntry[]): string | null {
	const okTools = new Set(trace.filter((t) => t.ok).map((t) => t.tool));
	const problems: string[] = [];
	for (const c of CLAIMS) {
		if (c.pattern.test(draft) && !c.tools.some((t) => okTools.has(t))) problems.push(`your reply claims ${c.what}, but no ${c.tools.join('/')} call succeeded this turn. Either call the tool now, or don't claim it.`);
	}
	const failed = trace.filter((t) => !t.ok && t.effect === 'write' && !okTools.has(t.tool));
	if (failed.length && !ADMITS_FAILURE.test(draft)) {
		const f = failed[0];
		const err = (f.result as { error?: string } | undefined)?.error ?? 'it failed';
		problems.push(`${f.tool} failed (${err}). Retry with fixed arguments, or tell him honestly it didn't work.`);
	}
	return problems.length ? problems.join(' Also, ') : null;
}
