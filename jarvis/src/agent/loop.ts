// The agent core. The model thinks, calls tools, sees the results and decides when it is done:
//   messages -> model -> tool calls? -> validate -> run -> results back -> repeat -> draft -> self-check -> answer.
// Mistakes are handled here, in one place, for every tool:
//   - bad arguments are caught against the tool's schema before anything runs, with a precise fix-it message;
//   - a failing or slow tool becomes an error result the model can react to (retry, change course, or be honest);
//   - repeated identical calls are answered from the earlier result instead of running twice;
//   - the draft answer is checked against what actually happened (e.g. claiming an action no tool performed), and
//     the model gets one chance to correct it;
//   - if the brain dies after actions already succeeded, the reply is built from those results, so nothing done is lost.
import { flattenAgent } from '../services';
import { LlmError, type AgentMsg, type AgentStepRequest, type AgentStepResult, type Llm, type Schema, type ToolCall, type ToolSpec } from '../types';

export interface Tool<C> {
	spec: ToolSpec;
	/** 'write' tools change something (a reminder, a plan); 'read' tools only look things up. */
	effect?: 'read' | 'write';
	run(args: Record<string, any>, ctx: C): Promise<unknown>;
	/** A plain sentence saying what a successful write did, used if the brain fails before it can say so itself. */
	confirm?(result: any): string | null;
}

export interface TraceEntry {
	tool: string;
	args: Record<string, unknown>;
	ms: number;
	ok: boolean;
	effect: 'read' | 'write';
	result?: unknown;
}

export interface AgentResult {
	text: string;
	trace: TraceEntry[];
	steps: number;
	by?: string;
	/** True when the brain failed mid-way and the answer was assembled from completed actions. */
	recovered?: boolean;
	/** Problems the self-check found in a draft (and that the model then fixed). */
	revised?: string[];
	/** Each model step: which brain answered and how long it took (for review). */
	timeline: { by?: string; ms: number }[];
}

export interface AgentOptions<C> {
	system: string;
	messages: AgentMsg[];
	tools: Tool<C>[];
	ctx: C;
	maxSteps?: number;
	temperature?: number;
	images?: { mime: string; data: Uint8Array }[];
	toolTimeoutMs?: number;
	/** Wall-clock budget: once spent, the model is asked to answer with what it has. */
	budgetMs?: number;
	/** Checks a draft against the trace; returns what's wrong (to be fixed) or null when it's fine. */
	verify?: (draft: string, trace: TraceEntry[]) => string | null;
	/** Called before tools run, e.g. to keep the "typing…" indicator alive. */
	onTools?: (calls: ToolCall[]) => Promise<void> | void;
	clock?: () => number;
}

const MAX_CALLS_PER_STEP = 5;

export async function runAgent<C>(llm: Llm, o: AgentOptions<C>): Promise<AgentResult> {
	const maxSteps = o.maxSteps ?? 6;
	const clock = o.clock ?? Date.now;
	const started = clock();
	const messages = [...o.messages];
	const trace: TraceEntry[] = [];
	const revised: string[] = [];
	const byName = new Map(o.tools.map((t) => [t.spec.name, t]));
	const specs = o.tools.map((t) => t.spec);
	const done = new Map<string, unknown>();
	let by: string | undefined;
	let forceAnswer = false;
	const timeline: { by?: string; ms: number }[] = [];

	const step = async (toolChoice: 'auto' | 'none'): Promise<AgentStepResult> => {
		const req: AgentStepRequest = { system: o.system, messages, tools: specs, toolChoice, temperature: o.temperature, fast: true, images: o.images };
		const t0 = clock();
		const res = llm.agentStep
			? await llm.agentStep(req)
			: { text: await llm.generate({ system: o.system, turns: flattenAgent(messages), temperature: o.temperature, fast: true, images: o.images }), calls: [] };
		by = res.by ?? by;
		timeline.push({ by: res.by, ms: clock() - t0 });
		return res;
	};

	try {
		for (let n = 0; n < maxSteps; n++) {
			const last = n === maxSteps - 1 || forceAnswer || clock() - started > (o.budgetMs ?? 30_000);
			const res = await step(last ? 'none' : 'auto');
			const calls = last ? [] : res.calls.slice(0, MAX_CALLS_PER_STEP);

			if (!calls.length) {
				const draft = res.text.trim();
				if (!draft) {
					if (last) break;
					forceAnswer = true; // neither words nor tools: ask once more for a plain answer
					continue;
				}
				const problem = revised.length === 0 && n < maxSteps - 1 ? o.verify?.(draft, trace) : null;
				if (!problem) return { text: draft, trace, steps: n + 1, by, timeline, ...(revised.length ? { revised } : {}) };
				// Self-check: show the model its own draft and what's wrong with it, and let it fix things (tools allowed).
				revised.push(problem);
				messages.push({ role: 'model', text: draft, calls: [], raw: res.raw, by: res.by });
				messages.push({ role: 'user', text: `[self-check, not from him] Before sending: ${problem} Fix it now: use the right tool if something still needs doing, then give your corrected reply to him.` });
				continue;
			}

			messages.push({ role: 'model', text: res.text, calls, raw: res.raw, by: res.by });
			await Promise.resolve(o.onTools?.(calls)).catch(() => undefined);
			const results = await Promise.all(calls.map((c) => execute(c)));
			messages.push({ role: 'tool', results });
		}
	} catch (e) {
		const recovered = recoverReply(trace, byName);
		if (recovered) return { text: recovered, trace, steps: -1, by, timeline, recovered: true };
		throw e;
	}
	const recovered = recoverReply(trace, byName);
	if (recovered) return { text: recovered, trace, steps: maxSteps, by, timeline, recovered: true };
	throw new LlmError('the agent finished without an answer', 'bad_response');

	async function execute(c: ToolCall): Promise<{ id: string; name: string; result: unknown }> {
		const t0 = clock();
		const tool = byName.get(c.name);
		const effect = tool?.effect ?? 'read';
		let result: unknown;
		let ok = false;
		const args = (c.args && typeof c.args === 'object' ? c.args : {}) as Record<string, unknown>;
		if (!tool) {
			result = { ok: false, error: `There is no tool called "${c.name}".`, fix: `Use one of: ${[...byName.keys()].join(', ')}.` };
		} else {
			const checked = checkArgs(tool.spec.parameters, args);
			const key = `${c.name}:${stableJson(checked.args)}`;
			if (checked.errors.length) {
				result = { ok: false, error: `Invalid arguments for ${c.name}: ${checked.errors.join('; ')}.`, fix: 'Call it again with corrected arguments.' };
			} else if (done.has(key)) {
				ok = true;
				result = { ok: true, note: 'Already done earlier in this turn; same result.', result: done.get(key) };
			} else {
				try {
					const out = await withTimeout(tool.run(checked.args, o.ctx), o.toolTimeoutMs ?? 15_000, c.name);
					ok = !(out && typeof out === 'object' && (out as { ok?: unknown }).ok === false);
					result = out && typeof out === 'object' && !Array.isArray(out) ? { ok, ...(out as object) } : { ok, result: out };
					if (ok) done.set(key, result);
				} catch (e) {
					result = { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 300), fix: 'Fix the arguments and retry once, try another way, or tell him honestly it did not work.' };
				}
			}
		}
		trace.push({ tool: c.name, args, ms: clock() - t0, ok, effect, result });
		return { id: c.id, name: c.name, result };
	}
}

/** When the brain fails after actions succeeded, say what was done rather than losing it. */
function recoverReply<C>(trace: TraceEntry[], tools: Map<string, Tool<C>>): string | null {
	const lines = trace
		.filter((t) => t.ok && t.effect === 'write')
		.map((t) => tools.get(t.tool)?.confirm?.(t.result) ?? null)
		.filter((l): l is string => Boolean(l));
	return lines.length ? `${[...new Set(lines)].join(' ')} (My brain glitched before I could say more, but that part's done.)` : null;
}

/**
 * Validates arguments against a tool's schema (Gemini subset) and gently coerces what is safe to coerce
 * ("5" -> 5, "true" -> true). Unknown arguments are dropped. Returns the cleaned arguments and any errors.
 */
export function checkArgs(schema: Schema, args: Record<string, unknown>): { args: Record<string, unknown>; errors: string[] } {
	const props = (schema.properties ?? {}) as Record<string, Schema>;
	const required = (schema.required ?? []) as string[];
	const out: Record<string, unknown> = {};
	const errors: string[] = [];
	for (const [name, prop] of Object.entries(props)) {
		let v = args[name];
		const type = String(prop.type ?? 'STRING').toUpperCase();
		const missing = v === undefined || v === null || (typeof v === 'string' && !v.trim() && type !== 'STRING');
		if (missing) {
			if (required.includes(name)) errors.push(`"${name}" is required (${describe(prop)})`);
			continue;
		}
		if (type === 'INTEGER' || type === 'NUMBER') {
			const num = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : NaN;
			if (!Number.isFinite(num) || (type === 'INTEGER' && !Number.isInteger(num))) {
				errors.push(`"${name}" must be ${type === 'INTEGER' ? 'a whole number' : 'a number'}, got ${JSON.stringify(v)}`);
				continue;
			}
			v = num;
		} else if (type === 'BOOLEAN') {
			if (typeof v === 'string' && /^(true|false)$/i.test(v)) v = v.toLowerCase() === 'true';
			if (typeof v !== 'boolean') {
				errors.push(`"${name}" must be true or false`);
				continue;
			}
		} else if (type === 'STRING') {
			if (typeof v === 'number' || typeof v === 'boolean') v = String(v);
			if (typeof v !== 'string') {
				errors.push(`"${name}" must be text`);
				continue;
			}
			const allowed = prop.enum as string[] | undefined;
			if (allowed && !allowed.includes(v)) {
				const match = allowed.find((a) => a.toLowerCase() === String(v).toLowerCase().trim());
				if (!match) {
					errors.push(`"${name}" must be one of ${allowed.join(', ')}`);
					continue;
				}
				v = match;
			}
		}
		out[name] = v;
	}
	return { args: out, errors };
}

function describe(prop: Schema): string {
	return prop.enum ? `one of ${(prop.enum as string[]).join(', ')}` : String(prop.description ?? String(prop.type ?? 'text').toLowerCase());
}

function stableJson(v: Record<string, unknown>): string {
	return JSON.stringify(Object.keys(v)
		.sort()
		.map((k) => [k, v[k]]));
}

function withTimeout<T>(p: Promise<T>, ms: number, name: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return Promise.race([
		p,
		new Promise<never>((_, rej) => {
			timer = setTimeout(() => rej(new Error(`${name} took too long`)), ms);
		}),
	]).finally(() => clearTimeout(timer));
}

/** The conversation so far as agent messages (user/model alternating, starting and ending with him). */
export function historyToAgent(turns: { role: 'user' | 'model'; text: string }[]): AgentMsg[] {
	return turns.map((t) => (t.role === 'user' ? { role: 'user' as const, text: t.text } : { role: 'model' as const, text: t.text, calls: [] }));
}
