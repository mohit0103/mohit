# Setting up Jarvis from your phone

About 15 minutes, all free. You create a few accounts and keys, paste them into GitHub as secrets,
and GitHub deploys Jarvis for you. No key ever needs to go into chat.

## 1. Create your Telegram bot (2 min)

1. In Telegram, open **@BotFather** and send `/newbot`.
2. Pick a name (e.g. *Jarvis*) and a username ending in `bot` (e.g. `mohit_jarvis_bot`).
3. BotFather replies with a **token** like `7123456789:AAH...`. Copy it.

## 2. Create a free Cloudflare account (5 min)

1. Sign up at **dash.cloudflare.com** (free plan, no card needed).
2. Open **Workers & Pages** once. This creates your free `workers.dev` address.
3. Go to **My Profile → API Tokens → Create Token**, use the template **"Edit Cloudflare Workers"**,
   and under *Account Resources* pick your account. Create it and copy the **token**.
4. Your **Account ID** is on the Workers & Pages overview page (right side) or in the URL after `dash.cloudflare.com/`.
5. Workers AI (used for Jarvis's voice) is included in the free plan.

## 3. Gemini key (1 min)

Open **aistudio.google.com/apikey** and create a key. If your repo already has a `GOOGLE_API_KEY`
secret (your fact-videos project uses one), Jarvis will reuse it, so you can skip this.

## 4. Gmail app password (3 min, optional but recommended)

1. Turn on **2-Step Verification** at myaccount.google.com/security.
2. Open **myaccount.google.com/apppasswords**, name it *Jarvis*, and copy the 16-letter password.
   Jarvis opens your inbox read-only and never marks anything as read.

## 5. Add the secrets in GitHub (3 min)

In the GitHub app or website: **mohit0103/mohit → Settings → Secrets and variables → Actions → New repository secret**.

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | account ID from step 2 |
| `TELEGRAM_BOT_TOKEN` | token from step 1 |
| `GEMINI_API_KEY` | key from step 3 (skip if `GOOGLE_API_KEY` exists) |
| `JARVIS_PAIR_CODE` | any password you make up, e.g. `tiger-mango-42` |
| `GMAIL_ADDRESS` | your Gmail address (optional) |
| `GMAIL_APP_PASSWORD` | app password from step 4 (optional) |
| `GROQ_API_KEY` | free key from console.groq.com → API Keys (optional: backup brain when Gemini's free limit runs out, and faster voice-note understanding) |

## 6. Deploy

Go to **Actions → Jarvis → Run workflow** (or push any change under `jarvis/`).
The workflow runs all the tests, creates the database, deploys the Worker, stores your secrets in it,
and connects Telegram. Its log ends with **"Jarvis is live"**.

## 7. Say hi

Open your bot in Telegram and send:

```
/start tiger-mango-42
```

(using your own pair code). Jarvis replies "Paired!". Only your Telegram account can talk to it from then on.

Then just talk to it, by voice note or text:
- "I have a dentist appointment on Friday at 5"
- "Remind me to call mom at 8 tonight"
- "My friend Rahul's birthday is 15 March"
- "What do you know about me?"

## Daily rhythm

- **7:00 AM**: voice briefing (emails, plans, weather, AI/tech news, a fun fact, goals)
- **7:00 PM**: check-in (how was your day, follow-ups, tomorrow's alerts). On Sundays this is a weekly review.
- **About 2 hours after events**: "How did it go?"
- **About 1–1.5 hours before timed events**: a heads-up
- **A couple of friendly nudges a day**, plus a monthly recap on the 1st

## If something goes wrong

- Send `/status` to see whether email, voice, the brain and the schedule are working (with the last error, if any).
- Send `/ping`. If there is no answer, check the latest **Actions → Jarvis** run.
- Send `/voices` to hear the available voices and pick one.
- "Brain hit its free limit": Gemini's free quota ran out. Jarvis saves your message and answers when quota returns.
- If voice notes sound robotic or turn into text, `/status` shows why: Jarvis falls back from the natural voice to Aura, then a backup voice, then text.
- To change a key, update the GitHub secret and re-run the workflow.
