import { describe, expect, it } from 'vitest';
import { runAgent, type Tool } from '../src/agent/loop';
import { TOOLS, keywords, type ToolCtx } from '../src/agent/tools';
import { unsupportedNames, verifyReply } from '../src/agent/verify';
import { handleUpdate } from '../src/bot';
import { tick } from '../src/scheduler';
import { countQueries, queriesUsed } from '../src/db';
import { FallbackLlm, Gemini, GroqLlm, WorkersLlm, toJsonSchema } from '../src/services';
import { Store } from '../src/store';
import { LlmError, type AgentStepRequest, type AgentStepResult, type Llm } from '../src/types';
import { emptyMemory, makeWorld, onChat, rows, textUpdate, toolResults } from './harness';

/** A brain that plays back a list of steps and records what it was shown. */
function stepper(steps: (AgentStepResult | ((r: AgentStepRequest) => AgentStepResult))[]): Llm & { seen: AgentStepRequest[] } {
	const seen: AgentStepRequest[] = [];
	return {
		seen,
		generate: async () => 'plain',
		agentStep: async (r) => {
			seen.push(structuredClone(r));
			const s = steps.shift();
			if (!s) throw new LlmError('script ran out', 'bad_response');
			return typeof s === 'function' ? s(r) : s;
		},
	};
}

const echo: Tool<null> = {
	spec: { name: 'echo', description: 'echo', parameters: { type: 'OBJECT', properties: { x: { type: 'STRING' } } } },
	run: async (a) => ({ echoed: a.x }),
};
const boom: Tool<null> = { spec: { name: 'boom', description: 'fails', parameters: { type: 'OBJECT', properties: {} } }, run: async () => Promise.reject(new Error('kaboom')) };
const call = (name: string, args: Record<string, unknown> = {}, id = name) => ({ id, name, args });
const base = { system: 'sys', messages: [{ role: 'user' as const, text: 'hi' }], ctx: null };

describe('agent loop', () => {
	it('runs the tools the model asks for, feeds results back, and returns its answer', async () => {
		const llm = stepper([{ text: '', calls: [call('echo', { x: 'a' }, '1'), call('echo', { x: 'b' }, '2')] }, { text: 'Done: a and b', calls: [] }]);
		const out = await runAgent(llm, { ...base, tools: [echo] });
		expect(out.text).toBe('Done: a and b');
		expect(out.steps).toBe(2);
		expect(out.trace.map((t) => [t.tool, t.ok])).toEqual([
			['echo', true],
			['echo', true],
		]);
		const fed = llm.seen[1].messages.at(-1)!;
		expect(fed).toEqual({ role: 'tool', results: [{ id: '1', name: 'echo', result: { ok: true, echoed: 'a' } }, { id: '2', name: 'echo', result: { ok: true, echoed: 'b' } }] });
		expect(llm.seen[1].messages.at(-2)).toMatchObject({ role: 'model', calls: [{ id: '1' }, { id: '2' }] });
	});

	it('reports unknown tools and tool failures back to the model instead of crashing', async () => {
		const llm = stepper([{ text: '', calls: [call('nope'), call('boom')] }, { text: 'Sorry, that broke', calls: [] }]);
		const out = await runAgent(llm, { ...base, tools: [echo, boom] });
		const results = (llm.seen[1].messages.at(-1) as any).results;
		expect(results[0].result).toMatchObject({ ok: false, error: 'There is no tool called "nope".', fix: 'Use one of: echo, boom.' });
		expect(results[1].result).toMatchObject({ ok: false, error: 'kaboom' });
		expect(out.trace.every((t) => !t.ok)).toBe(true);
		expect(out.text).toBe('Sorry, that broke');
	});

	it('does not repeat an identical call, and forces an answer on the last step', async () => {
		let runs = 0;
		const counted: Tool<null> = { ...echo, run: async () => ++runs };
		const llm = stepper([(r) => ({ text: '', calls: [call('echo', { x: 1 }, String(r.messages.length))] }), (r) => ({ text: '', calls: [call('echo', { x: 1 }, String(r.messages.length))] }), (r) => ({ text: r.toolChoice === 'none' ? 'final' : '', calls: [call('echo')] })]);
		const out = await runAgent(llm, { ...base, tools: [counted], maxSteps: 3 });
		expect(runs).toBe(1);
		expect(llm.seen.map((s) => s.toolChoice)).toEqual(['auto', 'auto', 'none']);
		expect(out.text).toBe('final');
	});

	it('asks once more for words when the model returns nothing, then gives up cleanly', async () => {
		const llm = stepper([{ text: '', calls: [] }, { text: 'there you go', calls: [] }]);
		expect((await runAgent(llm, { ...base, tools: [echo] })).text).toBe('there you go');
		expect(llm.seen[1].toolChoice).toBe('none');
		await expect(runAgent(stepper([{ text: '', calls: [] }, { text: '', calls: [] }]), { ...base, tools: [echo] })).rejects.toThrow(/without an answer/);
	});

	it('catches bad arguments before a tool runs, coerces safe ones, and lets the model fix the call', async () => {
		const seen: unknown[] = [];
		const typed: Tool<null> = {
			spec: { name: 'typed', description: 't', parameters: { type: 'OBJECT', properties: { n: { type: 'INTEGER' }, kind: { type: 'STRING', enum: ['done', 'cancelled'] }, flag: { type: 'BOOLEAN' } }, required: ['n', 'kind'] } },
			run: async (a) => void seen.push(a),
		};
		const llm = stepper([{ text: '', calls: [call('typed', { kind: 'later' }, 'a')] }, { text: '', calls: [call('typed', { n: '7', kind: 'Done', flag: 'true', junk: 1 }, 'b')] }, { text: 'fixed it', calls: [] }]);
		const out = await runAgent(llm, { ...base, tools: [typed] });
		const first = (llm.seen[1].messages.at(-1) as any).results[0].result;
		expect(first.ok).toBe(false);
		expect(first.error).toMatch(/"n" is required.*"kind" must be one of done, cancelled/);
		expect(seen).toEqual([{ n: 7, kind: 'done', flag: true }]);
		expect(out.trace.map((t) => t.ok)).toEqual([false, true]);
	});

	it('self-checks the draft against what happened and lets the model correct it once', async () => {
		const llm = stepper([{ text: "Done, I'll remind you at 8!", calls: [] }, { text: '', calls: [call('echo', { x: 'r' })] }, { text: "Reminder's set for 8!", calls: [] }]);
		const verify = (draft: string, trace: { tool: string; ok: boolean }[]) => (trace.some((t) => t.ok) ? null : `no tool ran for "${draft}".`);
		const out = await runAgent(llm, { ...base, tools: [echo], verify });
		expect(out.text).toBe("Reminder's set for 8!");
		expect(out.revised).toEqual(['no tool ran for "Done, I\'ll remind you at 8!".']);
		expect((llm.seen[1].messages.at(-1) as any).text).toMatch(/^\[self-check, not from him\] Before sending: no tool ran/);
		// The check gives one chance only, so a stubborn draft still goes out rather than looping.
		const stubborn = stepper([{ text: 'a', calls: [] }, { text: 'b', calls: [] }]);
		expect((await runAgent(stubborn, { ...base, tools: [echo], verify: () => 'wrong' })).text).toBe('b');
	});

	it('still reports completed actions if the brain dies afterwards', async () => {
		const write: Tool<null> = { ...echo, effect: 'write', run: async () => ({ when: 'Sat 8 PM' }), confirm: (r) => `Reminder set for ${r.when}.` };
		const llm = stepper([{ text: '', calls: [call('echo', { x: 1 })] }]); // then the script runs out (brain failure)
		const out = await runAgent(llm, { ...base, tools: [write] });
		expect(out.recovered).toBe(true);
		expect(out.text).toMatch(/^Reminder set for Sat 8 PM\. \(My brain glitched/);
		await expect(runAgent(stepper([{ text: '', calls: [call('echo', { x: 1 })] }]), { ...base, tools: [echo] })).rejects.toThrow(/script ran out/); // nothing done: the error surfaces
	});

	it('answers with what it has once the time budget is spent', async () => {
		let t = 0;
		const llm = stepper([(r) => ((t += 40_000), { text: '', calls: [call('echo', { x: r.toolChoice })] }), (r) => ({ text: `forced=${r.toolChoice}`, calls: [] })]);
		expect((await runAgent(llm, { ...base, tools: [echo], budgetMs: 30_000, clock: () => t })).text).toBe('forced=none');
	});

	it('times out a stuck tool', async () => {
		const slow: Tool<null> = { ...echo, run: () => new Promise((r) => setTimeout(r, 1000)) };
		const llm = stepper([{ text: '', calls: [call('echo')] }, { text: 'ok', calls: [] }]);
		const out = await runAgent(llm, { ...base, tools: [slow], toolTimeoutMs: 20 });
		expect((llm.seen[1].messages.at(-1) as any).results[0].result.error).toMatch(/took too long/);
		expect(out.text).toBe('ok');
	});

	it('works with a brain that has no tool support', async () => {
		const plain: Llm = { generate: async () => 'just words' };
		expect((await runAgent(plain, { ...base, tools: [echo] })).text).toBe('just words');
	});
});

describe('self-check', () => {
	const t = (tool: string, ok: boolean, effect: 'read' | 'write' = 'write', result: unknown = {}) => ({ tool, ok, effect, args: {}, ms: 1, result });
	it('flags claimed actions that no tool performed', () => {
		expect(verifyReply("Sure, I'll remind you at 8!", [])).toMatch(/claims a reminder/);
		expect(verifyReply("Sure, I'll remind you at 8!", [t('set_reminder', true)])).toBeNull();
		expect(verifyReply("I've moved it to Saturday", [t('recall', true, 'read')])).toMatch(/claims a plan change/);
		expect(verifyReply('Forgotten, never happened 😄', [])).toMatch(/forgetting/);
		expect(verifyReply('Haha nice, enjoy the movie!', [])).toBeNull();
		expect(verifyReply("No more pineapple pizza, got it. I'll forget that fact about you.", [])).toMatch(/forgetting/);
		expect(verifyReply('Consider that memory officially deleted, dude.', [t('forget', true)])).toBeNull();
	});
	it('flags names presented as his memories that nothing supports', () => {
		const known = 'FACTS: He enjoys fish fry. His hometown is Nagpur. Office is at Bhoruka Tech Park in Bangalore.';
		const bad = "Sounds like you'll be back at the Bhoruka Tech Park grind, dude. How about hitting the fish fry joint on Shivaji Nagar you love?";
		expect(unsupportedNames(bad, known)).toEqual(['Shivaji', 'Nagar']);
		expect(verifyReply(bad, [], known)).toMatch(/"Shivaji", "Nagar" as something from his life/);
		expect(verifyReply('Back to Bhoruka Tech Park next week? Grab some fish fry in Nagpur before you leave!', [], known)).toBeNull();
		expect(verifyReply('Try Meghana Foods, people rave about their biryani.', [], known)).toBeNull(); // a suggestion, not a "memory"
		const recalled = [t('recall', true, 'read', { found: ['he said: went to Toit with Rahul'] })];
		expect(verifyReply('Last time you went to Toit with Rahul, right?', recalled, known)).toBeNull();
		expect(verifyReply('Last time you went to Toit with Rahul, right?', [], known)).toMatch(/"Toit", "Rahul"/);
	});

	it('flags promises to look something up later, since there is no later', () => {
		for (const d of ['Wait, seriously? Let me check that for you.', 'Mumbai tomorrow! Let me check the weather for you.', "One sec, I'll look it up"]) expect(verifyReply(d, [])).toMatch(/promises to check/);
		expect(verifyReply("It's Satya Nadella, dude.", [t('web_search', true, 'read')])).toBeNull();
	});
	it('flags a failed action the reply glosses over', () => {
		const failed = [t('set_reminder', false, 'write', { error: 'time is in the past' })];
		expect(verifyReply('All good!', failed)).toMatch(/set_reminder failed \(time is in the past\)/);
		expect(verifyReply("Hmm, couldn't set that, the time's already gone. Tomorrow?", failed)).toBeNull();
		expect(verifyReply('All good!', [...failed, t('set_reminder', true)])).toBeNull(); // retried and it worked
	});
});

describe('agent tools', () => {
	const setup = (iso = '2026-10-03T10:00:00+05:30') => {
		const w = makeWorld(iso);
		const store = new Store(w.db);
		const ctx: ToolCtx = { deps: w.deps, store, now: w.clock.now };
		const tool = (name: string) => TOOLS.find((t) => t.spec.name === name)!;
		return { w, store, ctx, run: (name: string, args: Record<string, unknown>) => tool(name).run(args, ctx) };
	};

	it('sets reminders with a readable confirmation, refuses past times and skips duplicates', async () => {
		const { w, run } = setup();
		expect(await run('set_reminder', { text: 'Call mom', due_at: '2026-10-03T20:00:00+05:30' })).toMatchObject({ ok: true, when: 'Saturday 3 Oct 2026, 8:00 PM' });
		expect(await run('set_reminder', { text: 'call mom', due_at: '2026-10-03T20:05:00+05:30' })).toMatchObject({ note: 'This reminder already existed.' });
		await expect(run('set_reminder', { text: 'X', due_at: '2026-10-02T09:00:00+05:30' })).rejects.toThrow(/already in the past/);
		await expect(run('set_reminder', { text: 'X', due_at: 'tonight' })).rejects.toThrow(/could not read the time/);
		expect(rows(w, 'SELECT count(*) AS c FROM reminders')[0].c).toBe(1);
	});

	it('adds a plan once, reschedules it, and records how it went', async () => {
		const { w, run } = setup();
		const added: any = await run('add_plan', { title: 'Dentist', starts_at: '2026-10-09T17:00:00+05:30', all_day: false });
		expect(added).toMatchObject({ ok: true, when: 'Friday 9 Oct 2026, 5:00 PM', followup: 'Friday 9 Oct 2026, 7:00 PM' });
		expect(await run('add_plan', { title: 'Dentist appointment', starts_at: '2026-10-09T17:00:00+05:30' })).toMatchObject({ note: expect.stringMatching(/Already saved/) });
		expect(await run('update_plan', { plan_id: added.id, status: 'rescheduled', new_starts_at: '2026-10-10T17:00:00+05:30' })).toMatchObject({ now_at: 'Saturday 10 Oct 2026, 5:00 PM' });
		await run('update_plan', { plan_id: added.id, status: 'done', outcome: 'No cavities' });
		expect(rows(w, 'SELECT starts_at, status, outcome FROM plans')).toEqual([{ starts_at: '2026-10-10T11:30:00.000Z', status: 'done', outcome: 'No cavities' }]);
		await expect(run('update_plan', { plan_id: 99, status: 'done' })).rejects.toThrow(/No plan 99/);
		await expect(run('add_plan', { title: 'Old', starts_at: '2026-09-01T10:00:00+05:30' })).rejects.toThrow(/in the past/);
	});

	it('recalls old conversations and says plainly when nothing is found', async () => {
		const { store, run } = setup();
		await store.addMessage('user', 'Went to Toit with Rahul, the mango beer was amazing', 'chat', '2026-08-20T15:00:00.000Z');
		await store.addFact('Loves biryani', 'preference', '2026-08-01T00:00:00.000Z');
		const hit: any = await run('recall', { query: 'that brewery with Rahul' });
		expect(hit.found.join('\n')).toContain('Toit with Rahul');
		const miss: any = await run('recall', { query: 'fish fry Shivaji Nagar' });
		expect(miss.found).toEqual([]);
		expect(miss.note).toMatch(/Don't guess/);
		expect(keywords('what was the name of that brewery?')).toEqual(['brewery']);
	});

	it('remembers, forgets, tracks goals, notes people and checks weather anywhere', async () => {
		const { w, run } = setup();
		const saved: any = await run('remember', { fact: 'Prefers window seats', category: 'preference' });
		expect(await run('remember', { fact: 'prefers window seats' })).toMatchObject({ saved: false });
		expect(await run('forget', { fact_id: saved.id })).toMatchObject({ forgotten: true });
		const goal: any = await run('track_goal', { title: 'Gym', cadence: 'daily' });
		expect(await run('log_goal', { goal_id: goal.id, action: 'did_it', note: '' })).toMatchObject({ streak: 1 });
		await run('note_person', { name: 'Rahul', relation: 'college friend', notes: 'Into craft beer', birthday: '03-15' });
		expect(rows(w, 'SELECT name, birthday FROM people')).toEqual([{ name: 'Rahul', birthday: '03-15' }]);
		expect(await run('get_weather', { place: 'Mumbai', date: '2026-10-04' })).toEqual({ forecast: expect.stringContaining('Mumbai on 2026-10-04') });
		await expect(run('get_weather', { place: 'Nowhere' })).rejects.toThrow(/could not find/);
	});

	it('searches the web through the brain with search turned on', async () => {
		const { w, run } = setup();
		w.llm.on('web research helper', (r) => `RCB won (asked: ${r.turns[0].text}, search=${r.search})`);
		expect(await run('web_search', { query: 'who won IPL 2026' })).toEqual({ answer: 'RCB won (asked: who won IPL 2026, search=true)' });
	});
});

describe('agent in conversation', () => {
	it('sets a reminder exactly once even though background memory also hears about it', async () => {
		const w = makeWorld();
		onChat(w, () => ({ reply: "Done, I'll ping you at 8!", memory: { ...emptyMemory, reminders_add: [{ text: 'Call mom', due_at: '2026-10-03T20:00:00+05:30' }] } }));
		await handleUpdate(w.deps, textUpdate('remind me to call mom at 8 tonight'));
		w.clock.advance(5);
		await tick(w.deps);
		expect(rows(w, 'SELECT text, due_at FROM reminders')).toEqual([{ text: 'Call mom', due_at: '2026-10-03T14:30:00.000Z' }]);
		expect(toolResults(w, 'set_reminder')[0]).toMatchObject({ ok: true, when: 'Saturday 3 Oct 2026, 8:00 PM' });
		expect(w.tg.visible().at(-1)!.text).toBe("Done, I'll ping you at 8!");
		const memoryCall = w.llm.calls.find((c) => c.system.includes('You maintain the long-term memory'))!;
		expect(JSON.stringify(memoryCall.schema)).not.toContain('reminders_add');
	});

	it('tells the model to ground personal details and to decide, with every tool available', async () => {
		const w = makeWorld();
		onChat(w, () => 'Go for the 7 AM flight, you will make the meeting easily.');
		await handleUpdate(w.deps, textUpdate('7am or 10pm flight to Delhi on Friday?'));
		const req = w.llm.agentCalls[0];
		expect(req.system).toMatch(/GROUNDING/);
		expect(req.system).toMatch(/make the call: pick one option/);
		expect(req.tools.map((t) => t.name)).toEqual(['recall', 'remember', 'forget', 'note_person', 'set_reminder', 'cancel_reminder', 'add_plan', 'update_plan', 'track_goal', 'log_goal', 'check_email', 'web_search', 'get_weather']);
	});
});

describe('query budget', () => {
	it('counts D1 queries, including through bind and batch', async () => {
		const w = makeWorld();
		const db = countQueries(w.db);
		await db.prepare('SELECT 1').first();
		await db.prepare('SELECT ?').bind(1).all();
		await db.batch([db.prepare('SELECT 1'), db.prepare('SELECT 2')]);
		expect(queriesUsed(db)).toBe(4);
		expect(queriesUsed(w.db)).toBe(0);
	});

	it('keeps a busy conversation turn well inside the 50-query free limit', async () => {
		const w = makeWorld();
		const db = countQueries(w.db);
		w.deps.db = db;
		await new Store(w.db).addMessage('user', 'went to Toit with Rahul', 'chat', '2026-09-01T10:00:00.000Z');
		onChat(w, () => ({
			reply: 'ok',
			calls: [
				{ name: 'recall', args: { query: 'Rahul beer' } },
				{ name: 'check_email', args: { query: 'Amazon' } },
				{ name: 'set_reminder', args: { text: 'x', due_at: '2026-10-03T20:00:00+05:30' } },
				{ name: 'add_plan', args: { title: 'Dinner', starts_at: '2026-10-05T20:00:00+05:30' } },
			],
		}));
		await handleUpdate(w.deps, textUpdate('remind me, plan dinner, any Amazon mail, and what beer did Rahul like?'));
		expect(w.tg.visible().at(-1)!.text).toBe('ok');
		expect(queriesUsed(db)).toBeLessThanOrEqual(40);
	});
});

describe('brains with tools', () => {
	type Call = { url: string; body: any };
	const fetchOf = (respond: (url: string, body: any) => Response) => {
		const calls: Call[] = [];
		const f = (async (input: any, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body ?? '{}'));
			calls.push({ url: String(input), body });
			return respond(String(input), body);
		}) as typeof fetch;
		return { f, calls };
	};
	const tools = [{ name: 'recall', description: 'search memory', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } }];

	it('Gemini: declares tools, skips thoughts, and echoes its own turn (with signature) next step', async () => {
		const parts = [{ text: 'thinking about it', thought: true }, { functionCall: { name: 'recall', args: { query: 'Rahul' } }, thoughtSignature: 'sig123' }];
		const { f, calls } = fetchOf((_u, body) => (body.contents.length === 1 ? Response.json({ candidates: [{ content: { role: 'model', parts } }] }) : Response.json({ candidates: [{ content: { parts: [{ text: 'Rahul likes beer' }] } }] })));
		const g = new Gemini('k', 'gemini-3.8-flash', f, async () => {});
		const s1 = await g.agentStep({ system: 's', messages: [{ role: 'user', text: 'who is Rahul?' }], tools });
		expect(s1).toMatchObject({ text: '', calls: [{ name: 'recall', args: { query: 'Rahul' } }], by: 'gemini' });
		expect(calls[0].body.tools[0].functionDeclarations[0].name).toBe('recall');
		expect(calls[0].body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
		const s2 = await g.agentStep({
			system: 's',
			messages: [{ role: 'user', text: 'who is Rahul?' }, { role: 'model', text: '', calls: s1.calls, raw: s1.raw, by: s1.by }, { role: 'tool', results: [{ id: s1.calls[0].id, name: 'recall', result: { found: ['friend'] } }] }],
			tools,
			toolChoice: 'none',
		});
		expect(s2.text).toBe('Rahul likes beer');
		const sent = calls[1].body;
		expect(sent.contents[1]).toEqual({ role: 'model', parts });
		expect(sent.contents[2]).toEqual({ role: 'user', parts: [{ functionResponse: { name: 'recall', response: { result: { found: ['friend'] } } } }] });
		expect(sent.toolConfig.functionCallingConfig.mode).toBe('NONE');
	});

	it('Gemini: turns from another brain get the placeholder signature', async () => {
		const { f, calls } = fetchOf(() => Response.json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
		const g = new Gemini('k', 'm', f, async () => {});
		await g.agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }, { role: 'model', text: '', calls: [call('recall', { query: 'a' })], by: 'groq' }, { role: 'tool', results: [{ id: 'recall', name: 'recall', result: 1 }] }], tools });
		expect(calls[0].body.contents[1].parts[0]).toEqual({ functionCall: { name: 'recall', args: { query: 'a' } }, thoughtSignature: 'skip_thought_signature_validator' });
	});

	it('Groq: OpenAI tool format in and out, smartest tool model first', async () => {
		const { f, calls } = fetchOf(() => Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'recall', arguments: '{"query":"Toit"}' } }] } }] }));
		const g = new GroqLlm('k', undefined, f);
		const out = await g.agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }, { role: 'model', text: 'hm', calls: [call('recall', { query: 'a' }, 'c0')] }, { role: 'tool', results: [{ id: 'c0', name: 'recall', result: { found: [] } }] }], tools });
		expect(out).toEqual({ text: '', calls: [{ id: 'c1', name: 'recall', args: { query: 'Toit' } }], by: 'groq:gpt-oss-120b' });
		const body = calls[0].body;
		expect(body.model).toBe('openai/gpt-oss-120b');
		expect(body.tools[0].function.parameters).toEqual({ type: 'object', properties: { query: { type: 'string' } }, required: ['query'] });
		expect(body.messages.slice(2)).toEqual([
			{ role: 'assistant', content: 'hm', tool_calls: [{ id: 'c0', type: 'function', function: { name: 'recall', arguments: '{"query":"a"}' } }] },
			{ role: 'tool', tool_call_id: 'c0', content: '{"found":[]}' },
		]);
	});

	it('Groq waits out a short rate limit on its best model, and rests a model with a long one', async () => {
		let n = 0;
		const waits: number[] = [];
		const { f, calls } = fetchOf((_u, body) => {
			n++;
			if (n === 1) return new Response('slow down', { status: 429, headers: { 'retry-after': '2' } });
			if (n === 3) return new Response('slow down', { status: 429, headers: { 'retry-after': '30' } });
			return Response.json({ choices: [{ message: { content: `hi from ${body.model}` } }] });
		});
		const g = new GroqLlm('k', undefined, f, async (ms) => void waits.push(ms));
		expect(await g.agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }], tools })).toMatchObject({ text: 'hi from openai/gpt-oss-120b', by: 'groq:gpt-oss-120b(waited 2s)' });
		expect(waits).toEqual([2000]);
		expect(await g.agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }], tools })).toMatchObject({ text: 'hi from llama-3.3-70b-versatile' });
		await g.agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }], tools });
		expect(calls.at(-1)!.body.model).toBe('llama-3.3-70b-versatile'); // gpt-oss is resting for 30s
	});

	it('Groq looks things up with its web-search model when asked to search', async () => {
		const { f, calls } = fetchOf(() => Response.json({ choices: [{ message: { content: 'RCB' } }] }));
		await new GroqLlm('k', undefined, f).generate({ system: 's', turns: [{ role: 'user', text: 'ipl?' }], search: true });
		expect(calls[0].body.model).toBe('groq/compound-mini');
	});

	it('Cloudflare backup asks for tools with a JSON line', async () => {
		const ai = { run: async (_m: string, input: any) => ({ response: input.messages[0].content.includes('TOOLS you can use') ? '{"tool":"recall","args":{"query":"Rahul"}}' : 'hi' }) } as any;
		const out = await new WorkersLlm(ai).agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }], tools });
		expect(out.calls).toEqual([{ id: 'cf_1', name: 'recall', args: { query: 'Rahul' } }]);
		expect((await new WorkersLlm(ai).agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }], tools, toolChoice: 'none' })).text).toBe('hi');
	});

	it('falls back to the next brain for an agent step, but photos only go to Gemini', async () => {
		const down: Llm = { generate: async () => '', agentStep: async () => Promise.reject(new LlmError('429', 'quota')) };
		const groq: Llm = { generate: async () => '', agentStep: async () => ({ text: 'from groq', calls: [] }) };
		const notes: string[] = [];
		const fb = new FallbackLlm(down, [{ name: 'groq', llm: groq }], async (w) => void notes.push(w));
		expect(await fb.agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }], tools })).toEqual({ text: 'from groq', calls: [], by: 'groq' });
		expect(notes[0]).toMatch(/agent step by groq/);
		await expect(fb.agentStep({ system: 's', messages: [{ role: 'user', text: 'x' }], tools, images: [{ mime: 'image/jpeg', data: new Uint8Array(1) }] })).rejects.toThrow('429');
	});

	it('converts schemas to standard JSON Schema', () => {
		expect(toJsonSchema({ type: 'OBJECT', properties: { a: { type: 'ARRAY', items: { type: 'INTEGER' } }, b: { type: 'STRING', enum: ['X'] } } })).toEqual({
			type: 'object',
			properties: { a: { type: 'array', items: { type: 'integer' } }, b: { type: 'string', enum: ['X'] } },
		});
	});
});

describe('quota routing', () => {
	it('sends background work to the backups first, saving Gemini for live chat', async () => {
		const order: string[] = [];
		const brain = (name: string): Llm => ({ generate: async () => (order.push(name), name) });
		const fb = new FallbackLlm(brain('gemini'), [{ name: 'groq', llm: brain('groq') }, { name: 'cloudflare', llm: brain('cloudflare') }]);
		expect(await fb.generate({ system: 's', turns: [], tier: 'light' })).toBe('groq');
		expect(await fb.generate({ system: 's', turns: [] })).toBe('gemini');
		expect(await fb.generate({ system: 's', turns: [], tier: 'light', images: [{ mime: 'image/jpeg', data: new Uint8Array(1) }] })).toBe('gemini');
	});
});
