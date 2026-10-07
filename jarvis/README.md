# Jarvis

Mohit's personal AI buddy on Telegram. It talks in voice notes and text, remembers everything,
and reaches out first: a morning briefing, an evening check-in, "how did the dentist go?" follow-ups,
reminders, bills and travel pulled from Gmail, birthdays, goals, and a diary.

Runs free on Cloudflare Workers, with Gemini as the brain and Workers AI for voice.
Setup from a phone: [SETUP.md](SETUP.md). Design and decisions: [PLAN.md](PLAN.md).

## Layout

| File | What it does |
|---|---|
| `src/index.ts` | Worker entry: Telegram webhook (secret-checked), `/health`, `/diag`, `/review`, `/eval`, cron tick |
| `src/agent/loop.ts` | The agent core: think → call tools → see results → repeat → self-check → answer. Validates tool arguments against their schemas, turns tool errors and timeouts into results the model reacts to, dedupes repeated calls, lets the model fix a draft that claims something no tool did, and reports completed actions even if the brain fails mid-way |
| `src/agent/tools.ts` | What the agent can do: recall (search all memory and old chats), remember/forget, people, reminders, plans, goals, Gmail, web search, weather anywhere |
| `src/agent/verify.ts` | The self-check that compares a draft reply with what the tools actually did |
| `src/bot.ts` | Pairing, commands, buttons, and the conversation (runs the agent; background memory follows on the next cron tick) |
| `src/eval.ts` | Live evals: scripted real conversations on a scratch database (`EVAL_DB`), graded by checks and a rubric |
| `src/db.ts` | Counts D1 queries (the free plan allows 50 per invocation) so optional work waits for a quieter tick |
| `src/memory.ts` | Memory schema and validation; code owns plan, follow-up and reminder timing |
| `src/scheduler.ts` | Every 5 minutes: reminders, briefing, check-in, weekly/monthly reviews, follow-ups, heads-ups, nudges, diary |
| `src/email/` | Read-only IMAP client, MIME parsing, and email triage by a tool-less model |
| `src/services.ts` | Telegram, brains with native tool calling (Gemini → Groq → Cloudflare), speech, weather and news |
| `src/store.ts` | D1 queries; `migrations/` holds the schema |

## Develop

```
npm install
npm test             # 80 unit and scenario tests (fake Telegram/Gemini, real SQLite)
npx tsc --noEmit
./scripts/smoke.sh   # boots the Worker in workerd and exercises the real request paths
URL=https://<worker>.workers.dev KEY=<webhook secret> node scripts/evals.mjs   # live evals against the deployed brain (CI runs these after every deploy)
```

CI (`.github/workflows/jarvis.yml`) runs all of these on every push and deploys only if they pass.
