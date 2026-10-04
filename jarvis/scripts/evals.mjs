// Runs every live eval case against the deployed Jarvis, one message per request, and prints a report.
// Usage: URL=https://jarvis.example.workers.dev KEY=<webhook secret> node scripts/evals.mjs [case ...]
const { URL: base, KEY: key } = process.env;
const only = process.argv.slice(2);
const get = async (path) => {
	const res = await fetch(`${base}${path}`, { headers: { 'x-jarvis-key': key } });
	const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
	if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
	return body;
};

const { cases, ready } = await get('/eval');
if (!ready) {
	console.log('::warning::EVAL_DB is not bound yet; skipping live evals');
	process.exit(0);
}
let failed = 0;
for (const c of cases.filter((c) => !only.length || only.includes(c.name))) {
	let result;
	try {
		let step = 0;
		for (;;) {
			const out = await get(`/eval?case=${c.name}&step=${step}`);
			if (out.result) {
				result = out.result;
				break;
			}
			step = out.next;
		}
	} catch (e) {
		result = { pass: false, checks: [{ name: 'ran', pass: false, detail: String(e.message ?? e) }], transcript: [], tools: [], ms: 0 };
	}
	if (!result.pass) failed++;
	console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${c.name} (${(result.ms / 1000).toFixed(1)}s) - ${c.about}`);
	for (const t of result.transcript) console.log(`      Mohit:  ${t.mohit}\n      Jarvis: ${t.jarvis.replace(/\n/g, ' / ')}`);
	if (result.tools.length) console.log(`      tools: ${result.tools.join(', ')}`);
	for (const m of result.meta ?? []) console.log(`      meta: ${m}`);
	for (const ch of result.checks.filter((x) => !x.pass)) {
		console.log(`      x ${ch.name}${ch.detail ? `: ${ch.detail}` : ''}`);
		if (process.env.GITHUB_ACTIONS) console.log(`::warning::eval ${c.name}: ${ch.name}${ch.detail ? ` (${ch.detail.slice(0, 150)})` : ''}`);
	}
}
console.log(`\n${cases.length - failed}/${cases.length} live evals passed`);
process.exit(failed ? 1 : 0);
