# Jarvis

Mohit's personal AI buddy on Telegram. It talks in voice notes and text, remembers everything,
and reaches out first: a morning briefing, an evening check-in, "how did the dentist go?" follow-ups,
reminders, bills and travel pulled from Gmail, birthdays, goals, and a diary.

Runs free on Cloudflare Workers, with Gemini as the brain and Workers AI for voice.
Setup from a phone: [SETUP.md](SETUP.md). Design and decisions: [PLAN.md](PLAN.md).

## Layout

| File | What it does |
|---|---|
| `src/index.ts` | Worker entry: Telegram webhook (secret-checked), `/health`, cron tick |
| `src/bot.ts` | Pairing, commands, buttons, and the conversation (one LLM call returns the reply plus memory updates) |
| `src/memory.ts` | Memory schema and validation; code owns plan, follow-up and reminder timing |
| `src/scheduler.ts` | Every 5 minutes: reminders, briefing, check-in, weekly/monthly reviews, follow-ups, heads-ups, nudges, diary |
| `src/email/` | Read-only IMAP client, MIME parsing, and email triage by a tool-less model |
| `src/services.ts` | Telegram, Gemini (model fallback and discovery), Workers AI speech, weather and news |
| `src/store.ts` | D1 queries; `migrations/` holds the schema |

## Develop

```
npm install
npm test             # 80 unit and scenario tests (fake Telegram/Gemini, real SQLite)
npx tsc --noEmit
./scripts/smoke.sh   # boots the Worker in workerd and exercises the real request paths
```

CI (`.github/workflows/jarvis.yml`) runs all of these on every push and deploys only if they pass.
