# Jarvis: personal Telegram voice assistant

Mohit's friendly-buddy AI assistant. It talks over Telegram voice notes and text, remembers everything,
and messages first: a morning briefing, an evening check-in, and follow-ups.

## Decisions (from interview, 2026-10-03)

| Topic | Choice |
|---|---|
| Hosting | Cloudflare Workers (free): instant replies, cron triggers, D1 database |
| Persona | Friendly buddy, calls him **Mohit**; warm, casual, jokes |
| Voice | Male, warm English voice |
| Brain | Gemini free tier (Google may use free-tier data; accepted) |
| Replies | Mirror: voice note if he sends voice, text if he types; briefings always voice |
| Morning briefing | 07:00 IST: emails, today's plans, Bengaluru weather, news on his topics, fun fact, goals/habits |
| Evening check-in | 19:00 IST: how was the day, tomorrow's alerts, due follow-ups |
| Proactivity | Chatty: extra friendly check-ins, "on this day", nudges about people and goals |
| Quiet hours | None (but random chatty messages stay within 09:00–22:00) |
| Memory | Remember everything; "forget that" always works |
| Email | Gmail read-only via app password (IMAP) |
| Actions (later) | Allowed only after Mohit replies "yes" to a read-back |
| City | Bengaluru (Asia/Kolkata) |

## Architecture

```
Telegram  <──webhook──>  Cloudflare Worker  ──>  Gemini (brain, understands voice notes)
                              │    │           ──>  Workers AI (speech-to-text / text-to-speech)
                              │    └──cron──>  briefing, check-in, follow-ups, reminders, email sync
                              └──>  D1 database: facts, people, plans, reminders, diary, moods, goals, emails
Gmail (IMAP, app password) ──> email reader model (no tools, outputs only structured facts)
Free data: Open-Meteo weather, Google News RSS
```

Secrets live in GitHub Secrets. A GitHub Action deploys the Worker and copies the secrets into it,
so no token ever goes through chat.

## Memory model

- **facts**: about Mohit (preferences, work, health, likes). Facts are superseded, never silently overwritten.
- **people**: name, relation, notes, birthday, last contact.
- **plans**: an event, its time, status (planned → done / cancelled), follow-up question and time, outcome.
- **reminders**: an explicit "remind me" with an exact time.
- **diary**: a daily summary plus mood.
- **goals and habits**: target, check-ins, streak.
- **life admin**: bills, deliveries, renewals, documents and expiry dates, extracted from email.

Code owns the lifecycle of every plan and reminder (scheduling, status, firing). The LLM only extracts and phrases.

## Feature backlog (v1 = all four groups)

1. **Briefing + follow-ups**: 07:00 voice briefing; 19:00 check-in; night-before alerts; "how was the dentist?";
   "remind me in 2 hours"; snooze buttons.
2. **Journal + moods**: diary from chats; mood tracking; Sunday weekly-review voice note; monthly recap;
   "on this day".
3. **Life admin**: bills and EMIs due, deliveries, refunds, subscription renewals, document expiry, all from email.
4. **People + goals**: birthdays with gift ideas from past chats, "call mom" nudges, promises made, habits and streaks.
5. **Control**: `/memory` (what Jarvis knows), "forget that", `/pause`, `/export`, health check.
6. **Later**: Gmail drafts and sends with a yes/no read-back; Google Calendar.

## Safety

- Only Mohit's Telegram chat ID is accepted; everything else is ignored.
- Email text is untrusted. A separate tool-less model turns it into JSON fields; the chat model never sees raw email.
- Any outbound action requires an explicit "yes" after a read-back.
- Telegram webhook secret header; secrets only in GitHub and Cloudflare secret stores.

## Testing for robustness

- Unit tests: date resolution ("next Friday", "tomorrow evening", IST across midnight), scheduler firing and
  dedupe, memory merge and supersede, quiet windows, email parsing.
- Scenario tests with a fake Telegram and a fake Gemini: dentist follow-up end to end, flight email → night-before
  alert, "forget that", Gemini rate-limited → graceful reply, duplicate webhook deliveries.
- Live smoke test after every deploy (bot replies to `/ping`), plus a daily self-check message if a cron fails.
- CI runs the tests on every push; deploy only if they pass.

## Setup Mohit does on his phone (about 15 minutes)

1. Telegram: message @BotFather → `/newbot` → copy the token.
2. Cloudflare: free signup → create an API token (template "Edit Cloudflare Workers") → copy the token and account ID.
3. Gemini key from aistudio.google.com (may already exist as `GOOGLE_API_KEY`).
4. Gmail: turn on 2-step verification → create an app password.
5. Add these as GitHub repo secrets (GitHub app → repo → Settings → Secrets).

## Build phases

1. Skeleton: Worker, Telegram webhook, D1 schema, chat with memory, voice in and out, tests, CI deploy.
2. Scheduler: reminders, plans and follow-ups, 07:00 and 19:00 messages, weather and news.
3. Email: IMAP sync, safe extraction, life-admin tracking, night-before alerts from tickets.
4. Journal, people and goals: diary, moods, reviews, birthdays, habits, chatty nudges.
5. Hardening: scenario tests, failure handling, `/memory` and `/export`, polish.
