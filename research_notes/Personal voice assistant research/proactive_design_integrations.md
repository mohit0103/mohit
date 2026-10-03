# Proactive Personal AI Agents: Design Patterns, Integrations, Privacy/Security, Production Practice

Context: single-user (later multi-user) personal assistant in India that phones its user daily with briefings (email, calendar, reminders), night-before alerts (flights, appointments) and follow-ups on things the user said. Research current as of 3 Oct 2026. Research was time-boxed (~17 tool calls); gaps are flagged explicitly.

## 1. Proactive agent design: research, product precedents, scheduling, when to interrupt

### Takeaway
Research splits proactivity into "when to assist" and "how to assist". Even the best systems get modest accuracy on the "when" part (ProactiveBench fine-tuning reached about 66% F1), so a daily-call product should use fixed, user-chosen slots (morning briefing, night-before alert) plus a small, high-precision set of event triggers, not open-ended "the agent decides to call". OpenAI's own path (Pulse launched Sept 2025, reportedly folded into scheduled tasks in June 2026) points the same way: scheduled, user-controllable delivery. For the backend, use a durable-workflow engine (Temporal, or Pydantic AI's durable-execution integrations) or a job queue with persisted state, not bare cron.

### Cited Findings
- **ProactiveBench (Proactive Agent paper, arXiv 2410.12361):** 6,790 events built from real-world human activity. Annotators accepted or rejected proactive task predictions, and those labels trained a reward model that acts as an automatic judge of proactiveness. — [arXiv 2410.12361](https://arxiv.org/abs/2410.12361)
- Fine-tuning on ProactiveBench reached a **66.47% F1-score**. Later work frames proactivity as a "When + How" hierarchy: *When to Assist* is a binary timing classification and *How to Assist* is content generation. — [ProAgentBench, arXiv 2602.04482](https://arxiv.org/html/2602.04482)
- Newer benchmarks in the same line: ProAgentBench (real-world data, 2026), ProEvent (event-centric, arXiv 2607.17701), UniClawBench (real-world tasks, arXiv 2607.08768), "Anticipate and Learn" (using idle-time compute in proactive agents, arXiv 2605.25971), and PROBE (rich context, requires tool use to meet latent needs). — [ProEvent](https://arxiv.org/html/2607.17701); [UniClawBench](https://arxiv.org/pdf/2607.08768); [Anticipate and Learn](https://arxiv.org/pdf/2605.25971); [ProAgentBench related work](https://arxiv.org/html/2602.04482)
- "After Talking with 1,000 Personas" (arXiv 2602.04000) trains preference-aligned proactive assistants from large-scale simulated persona interactions. This is relevant for personalizing how proactive the assistant is for each user. — [arXiv 2602.04000](https://arxiv.org/pdf/2602.04000)
- **ChatGPT Pulse** (launched Sept 2025, Pro, mobile): research runs asynchronously overnight over memory, chat history, feedback and connected apps (Gmail, Google Calendar), and is delivered once a day as scannable visual cards. Users steer it with thumbs up/down and a "curate" request. A request made in the evening is aimed at the next morning's Pulse. — [OpenAI: Introducing ChatGPT Pulse](https://openai.com/index/introducing-chatgpt-pulse/)
- A search-result summary of the ChatGPT release notes says that **as of 17 June 2026 Pulse is being sunset "as proactive updates move into scheduled tasks"**, with Pro access continuing for 14 days. I could not confirm this from the primary page (the release-notes page returned 403). — [ChatGPT Release Notes (search snippet)](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- **ProMemAssist** (wearables, arXiv 2507.21378) uses a timing predictor that weighs the value of assistance against the cost of interruption, modeled on the user's working memory. In a 12-person study it gave more selective assistance and got higher engagement than an LLM baseline. — [ProMemAssist](https://arxiv.org/html/2507.21378v1)
- A five-day field study of proactive AI with developers found that suggestions delivered at natural workflow boundaries (for example right after a commit) got the highest engagement, while mid-task interventions were often dismissed. — [arXiv 2601.10253](https://arxiv.org/html/2601.10253v1)
- Classic notification research: whether a notification is accepted depends on its content and sender, and response time varies with the user's physical activity. Context largely determines whether someone can be interrupted. — [Mehrotra/Musolesi, UbiComp'15](http://www.mircomusolesi.org/papers/ubicomp15_designing.pdf); see also [adaptive notification scheduling large-scale study](https://www.researchgate.net/publication/326638656_Real-world_large-scale_study_on_adaptive_notification_scheduling_on_smartphones)
- **Durable execution:** Temporal splits work into deterministic, replayable *workflows* and *activities* (LLM, tool and API calls) that retry automatically. This survives crashes, rate limits and timeouts. Temporal **Schedules** can trigger "nudge" workflows periodically, and Temporal describes this pattern for "ambient agents". — [Temporal: ambient agents](https://temporal.io/blog/orchestrating-ambient-agents-with-temporal); [Temporal agentic AI](https://temporal.io/blog/build-resilient-agentic-ai-with-temporal); [Jacar explainer](https://jacar.es/en/durable-agent-execution-with-temporal/)
- Temporal and OpenAI shipped a public-preview integration that adds durable execution to the OpenAI Agents SDK. Pydantic AI documents its own Temporal integration, and Google has a Gemini + Temporal durable agent example. — [InfoQ](https://www.infoq.com/news/2025/09/temporal-aiagent); [Pydantic AI Temporal docs](https://pydantic.dev/docs/ai/integrations/durable_execution/temporal/); [Google AI: Gemini + Temporal](https://ai.google.dev/gemini-api/docs/temporal-example)

### Inferences
- Suggested architecture, which follows from the durable-execution and timing findings:
  1. **Ingestion workers** poll or receive push updates from Gmail and Calendar, extract structured "items" (flight, appointment, bill, delivery, promise) and store them.
  2. **Per-item workflows** (Temporal or equivalent) sleep until "T minus X" (for example 20:00 the night before a flight, or 3 hours before departure), then re-check the source (flight changed? meeting cancelled?) before alerting.
  3. **A per-user daily briefing schedule** in the user's timezone (IST), with an overnight pre-compute step like Pulse so the call starts instantly.
  4. **Follow-ups** ("remind me to call the bank Tuesday", or things mentioned on a call) become durable timers created by a tool call during the conversation.
- **When to interrupt:** default to user-set windows and a quiet-hours policy. Escalate from voice call to WhatsApp or SMS text to silence based on urgency. Learn from signals such as unanswered calls, early hang-ups and explicit "don't call me about this" to adjust timing and thresholds. The research shows mid-task interruptions get dismissed, so prefer predictable slots over cleverness.
- **Fallback channel order:** voice call, then if unanswered after N rings, a text summary on WhatsApp (if allowed, see section 3) or Telegram or push notification, then a retry call only for high-urgency items such as a flight-time change.

### Gaps
- I could not access the primary OpenAI release note for the Pulse sunset or for scheduled "Tasks" (403). Gemini's or Google's proactive features (for example Gemini scheduled actions) were not researched for lack of time.
- No quantitative data found on the acceptance rate of AI *phone calls* specifically, as opposed to notifications. Treat voice calls as more intrusive than push notifications; I found no study measuring this.
- Inngest, Trigger.dev, Celery and BullMQ were not compared against Temporal.

## 2. Extracting events, travel, bills and deliveries from email; Calendar; triage

### Takeaway
Use a hybrid. First parse schema.org JSON-LD or microdata when present (airlines and booking sites often embed FlightReservation). Fall back to LLM structured extraction with a strict schema. Then re-verify time-critical facts before alerting. Reading email content requires restricted Gmail scopes (see section 3), which is the main compliance cost.

### Cited Findings
- **Gmail FlightReservation markup** supports JSON-LD (`<script type="application/ld+json">`) and microdata. Core fields: reservation number, reservation status, passenger name, flight number, airline, departure and arrival airports, and times. Optional fields include `checkinUrl`, seat and ticket number. Multiple reservation items represent multi-leg itineraries. Gmail uses the markup for check-in buttons and boarding-pass details. — [Google Developers: FlightReservation](https://developers.google.com/workspace/gmail/markup/reference/flight-reservation)
- Gmail's restricted scopes include `gmail.readonly`, `gmail.metadata`, `gmail.modify`, `gmail.compose`, `gmail.insert`, `gmail.settings.basic` and full `mail.google.com`. — [Deepstrike CASA guide](https://deepstrike.io/blog/google-casa-security-assessment-2025); [Unipile scopes guide](https://www.unipile.com/gmail-api-scopes-guide/)
- **Google Calendar has no restricted scopes** (only sensitive ones), so calendar read and write needs the lighter sensitive-scope review. — [Agentic Fabriq](https://www.agenticfabriq.com/blog/google-oauth-verification-casa)
- The official Google Calendar MCP server exposes `create_event`, `delete_event`, `get_event`, `list_calendars`, `list_events`, `respond_to_event`, `search_events`, `suggest_time` and `update_event`. — [Google: Configure Calendar MCP](https://developers.google.com/workspace/calendar/api/guides/configure-mcp-server); [usecarly summary](https://www.usecarly.com/blog/gmail-mcp/)

### Inferences
- **Extraction pipeline:**
  1. Run the Gmail search pre-filter: category and labels, sender allowlist (airlines, IRCTC, banks, couriers, utility billers), and keywords such as "PNR", "booking", "due date" and "out for delivery".
  2. Parse JSON-LD if present.
  3. Otherwise run LLM extraction into typed schemas (Flight, Train, Appointment, Bill, Delivery, Commitment) with confidence scores and source message ID.
  4. Deduplicate across confirmation, update and cancellation emails.
  5. Write to Calendar only with user confirmation, or into a separate "Assistant" calendar.
- **Triage and importance:** rank by sender relationship (has the user replied to them before?), whether the email is directly addressed, deadlines or amounts detected, and thread recency. Have the LLM produce a one-line "why this matters" for the briefing. Keep the voice briefing to the top 3 to 5 items.
- Treat every extracted field as untrusted data (see section 5). For example, a spoofed "your flight is cancelled, call this number" email should never be read aloud as fact without checking the sender's authentication.

### Gaps
- I found no source confirming whether Indian carriers (IndiGo, Air India) or IRCTC currently embed schema.org markup. Verify empirically against the user's own inbox.
- No benchmark was found comparing LLM email extraction accuracy with rule-based parsers. Gmail push via Cloud Pub/Sub (`users.watch`) versus polling was not researched here.
- No published email-importance ranking research was gathered.

## 3. Integrations: Google OAuth/CASA, MCP servers, WhatsApp, Telegram, Indian data sources

### Takeaway
For a personal single-user build, run the Google OAuth app in Testing mode (up to 100 test users, though refresh tokens expire every 7 days, which is painful for an always-on agent). Alternatively use Internal mode in a Workspace org. Productizing Gmail reading means restricted-scope verification plus an annual CASA assessment, roughly 6+ weeks and assessor fees from about $500 to tens of thousands of dollars per year.

WhatsApp is cheap in India (about ₹0.115 per utility message) but has two problems. Meta's policy, in force from 15 Jan 2026, bans general-purpose AI assistants on the Business API. Proactive messages must also use pre-approved templates outside the 24-hour window. Position WhatsApp as a narrow notification channel (briefing summaries, reminders), not an open chat assistant.

### Cited Findings
**Google OAuth and CASA**
- Scope tiers: non-sensitive needs no review. Sensitive needs a privacy policy, demo video and justification (about 10 business days). Restricted needs full verification plus an annual security assessment when data touches your servers (Google's estimate is about 6 weeks). `gmail.send` is only sensitive, while reading content is restricted. — [Agentic Fabriq](https://www.agenticfabriq.com/blog/google-oauth-verification-casa)
- Testing mode allows up to 100 test users, with **7-day refresh-token expiry**. Unverified published apps hit a **100-user cap** for sensitive and restricted scopes. — [Agentic Fabriq](https://www.agenticfabriq.com/blog/google-oauth-verification-casa)
- **Limited Use policy:** user data cannot be used "to create, train, or improve a machine learning model beyond that specific user's personalized model". Check the data-use terms of any third-party LLM API you send data to. — [Agentic Fabriq](https://www.agenticfabriq.com/blog/google-oauth-verification-casa)
- CASA is done by Google-approved labs and revalidated yearly. Google charges nothing itself. Reported costs vary widely: about $500 per year (low-end Tier 2 via some assessors) and $3,000+ elsewhere. One vendor blog claims $5k to $75k+ for "small to large" apps; that figure includes remediation and consulting and is likely inflated. — [Deepstrike](https://deepstrike.io/blog/google-casa-security-assessment-2025); [ReverseBits](https://www.reversebits.tech/blog/gmail-api-compliance/); [Orbis: CASA Tier 2 in a weekend](https://meetorbis.com/blog/how-we-passed-google-casa-tier-2-with-claude); [dev.to Tier 2 experience](https://dev.to/rem4ik4ever/my-saas-passed-casa-tier-2-assessment-and-yours-can-to-here-is-how-1b20)
- Recommended launch strategy: ship v1 with sensitive scopes only (Calendar, `gmail.send`) and add restricted Gmail reading after the assessment clears. — [Agentic Fabriq](https://www.agenticfabriq.com/blog/google-oauth-verification-casa)

**MCP servers**
- Google runs **official remote MCP servers**, one per product: Gmail (`https://gmailmcp.googleapis.com/mcp/v1`), Calendar (`https://calendarmcp.googleapis.com/mcp/v1`), and others for Drive, Docs, Sheets, Slides, Chat and People. They are in **Developer Preview**. Using them requires a GCP project, the API and its MCP service enabled, an OAuth client, and enrollment in the Workspace Developer Preview Program. — [Google: Configure Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-servers); [usecarly](https://www.usecarly.com/blog/gmail-mcp/); [Felipe Fontoura](https://felipefontoura.com/articles/google-workspace-mcp/)
- Community alternatives: taylorwilsdon/google_workspace_mcp, aaronsb/google-workspace-mcp, and hawkxdev/google-workspace-mcp (five isolated remote servers). — [LobeHub listing](https://lobehub.com/mcp/taylorwilsdon-google_workspace_mcp); [aaronsb GitHub](https://github.com/aaronsb/google-workspace-mcp); [hawkxdev GitHub](https://github.com/hawkxdev/google-workspace-mcp)
- Security note: CVE-2025-46059 was an indirect prompt injection against the LangChain GmailToolkit that exfiltrated email. Third-party Gmail tool wrappers are an attack surface. — [ATR-2026-01964](https://agentthreatrule.org/en/rules/ATR-2026-01964)

**WhatsApp Business Cloud API (India)**
- Billing has been per message since 1 July 2025. India rates per delivered message: **marketing ₹0.8631; utility ₹0.115; authentication ₹0.115; service ₹0.115** after 1,000 free service messages per month per number. With 18% GST, utility is about ₹0.145. — [Flowcall (Oct 2026)](https://www.flowcall.co/blog/whatsapp-business-api-pricing); [MyOperator](https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026); [AiSensy](https://aisensy.com/pricing)
- **Change from 1 Oct 2026:** service messages (free-form replies inside the 24-hour window) and in-window utility templates are now charged at the utility rate, which ends free in-window replies. — [Flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing); [MyOperator](https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026)
- The 24-hour customer-service window opens or resets with each user message, and any message type is allowed inside it. Outside it, only approved templates are allowed. Meta can reclassify a template: promotional content turns utility into marketing (about 7x the cost). — [Flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing)
- **AI policy:** general-purpose, open-ended assistant chatbots (ChatGPT- or Perplexity-style) are banned on the Business API from **15 Jan 2026** for existing accounts and from 15 Oct 2025 for new ones. Structured bots for support, bookings, order tracking and notifications remain allowed. Breaking the rule risks API restriction or suspension. — [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban); [Gulf News](https://gulfnews.com/technology/no-more-chatgpt-and-perplexity-on-whatsapp-meta-bans-major-ai-chatbots-from-2026-1.500316016); [Alibaba Cloud guide](https://www.alibabacloud.com/help/en/chatapp/use-cases/whatsapp-ai-policy-2026-guide)

**Indian context: bank SMS**
- Google Play restricts READ_SMS to default SMS, Phone or Assistant handlers. Reading SMS for financial-data parsing **does not qualify** for the exceptions. Since 25 Oct 2023, financial-services apps in India face extra limits on SMS and call-log access, plus RBI-licensing declarations for lending apps. — [Play Console: SMS/Call Log policy](https://support.google.com/googleplay/android-developer/answer/10208820?hl=en); [TrustDecision](https://trustdecision.com/articles/financial-service-apps-meet-new-google-sms-compliance-mandates); [dev.to finance app experience](https://dev.to/zeta_byte/ive-been-working-on-a-personal-finance-app-called-finvantage-and-i-recently-hit-a-roadblock-4mjh)

### Inferences
- **For the personal build:** an always-on agent needs a non-expiring refresh token. Testing mode's 7-day expiry forces weekly re-auth, so options are (a) "In production" but unverified, which is acceptable for under 100 users who click through the warning, or (b) a Workspace account with an Internal app. Verify that option (a) avoids the 7-day expiry before relying on it.
- **WhatsApp:** a personal assistant that chats freely with its owner over the Business API risks the general-purpose-AI ban. Safer patterns:
  - Use utility templates ("Your briefing for today: {{1}}", "Reminder: {{1}} at {{2}}").
  - Keep in-window replies scoped to the user's own reminders and schedule.
  - Use **Telegram** for free-form text chat, since Telegram bots are free and have no template or 24-hour restrictions. I did not verify Telegram terms this session.
  - At personal scale, cost is trivial: about 3 to 5 utility messages a day is about ₹15 to 25 per month.
- **Bank and UPI tracking:** because Play policy blocks SMS reading, alternatives are bank transaction alert *emails* parsed via Gmail, a private sideloaded companion app (fine for personal use, not distributable on Play), or the RBI Account Aggregator framework for a product. Account Aggregator was not researched.

### Gaps
- Not researched this session: Telegram Bot API terms, weather APIs (IMD, OpenWeather, Tomorrow.io), news APIs, IRCTC or PNR status APIs (no official public API is known; unofficial scrapers carry ToS risk), flight-status APIs (AviationStack, FlightAware AeroAPI), the Account Aggregator / Sahamati ecosystem, and UPI.
- Not verified: whether the official Google MCP servers require restricted-scope verification themselves, or when they will reach GA.
- Notion and WhatsApp MCP servers were not surveyed.

## 4. Agent frameworks for the "brain"

### Takeaway
All the major SDKs now support MCP to some degree. The choice comes down to how much control you want over state and durability. LangGraph is the most production-hardened stateful graph. Pydantic AI is the lightest and type-safe, and has first-class durable execution (Temporal). The OpenAI Agents SDK has an official Temporal integration. Google ADK suits a Google-stack, multimodal setup. The Claude Agent SDK gives the strongest out-of-the-box agent loop (tools, MCP, permissions) but is heavier and more geared to coding agents. For a scheduled, long-running personal agent, durability should live in the orchestrator (Temporal or a queue), and the agent framework should run inside activities.

### Cited Findings
- Comparison summary:
  - Claude Agent SDK: Python and TypeScript, native MCP, a "reasoning-and-tools loop with a strong safety posture".
  - OpenAI Agents SDK: handoffs, adopted MCP, built-in tracing.
  - Google ADK: hierarchical multi-agent, native MCP, a composable layer in the Google stack.
  - LangGraph: graph state machine, MCP via adapters.
  - Pydantic AI: type-safe structured output.

  One comparison lists Pydantic AI as lacking MCP; this conflicts with Pydantic AI's documented MCP client support and should be verified. — [PartnerInAI](https://partnerinai.com/blogs/ai-agent-frameworks-comparison-openai-google-claude-langgraph); [Morph](https://www.morphllm.com/ai-agent-framework); [turion.ai](https://turion.ai/blog/langgraph-vs-openai-claude-agent-sdk-2026/)
- Vendor-blog production-reliability ratings, which are subjective: LangGraph 9/10, OpenAI Agents SDK and ADK 8/10, Claude Agent SDK 7/10. Footprint: Pydantic AI about 58 MB and about 15 lines for a basic agent; Claude Agent SDK about 299 MB and about 28 lines. — [Morph / respan](https://www.morphllm.com/ai-agent-framework); [respan.ai](https://www.respan.ai/articles/best-ai-agent-frameworks)
- Pydantic AI offers dependency injection, typed outputs and durable execution with little code. — [uvik](https://uvik.net/blog/python-ai-agent-frameworks/); [Pydantic AI Temporal](https://pydantic.dev/docs/ai/integrations/durable_execution/temporal/)
- Langfuse maintains its own open-source framework comparison. — [Langfuse blog](https://langfuse.com/blog/2025-03-19-ai-agent-comparison)

### Inferences
- **Practical stack for this product:**
  - Temporal (or a simpler Postgres-backed queue at first) runs schedules and timers.
  - Each run (briefing, alert, follow-up) calls a typed agent (Pydantic AI, or the Claude Agent SDK if Claude is the model) with a small, curated tool set.
  - The live voice call uses a separate real-time stack (LiveKit or Pipecat) with its own lightweight LLM loop and the same tools.
- Keep tools narrow (for example `get_today_events` or `get_flagged_emails`) rather than exposing the whole Gmail API. This improves reliability and reduces the injection blast radius.

### Gaps
- Most framework comparisons found were vendor or SEO blogs with subjective scores. I found no rigorous, independent benchmark of long-running personal-agent reliability.

## 5. Privacy and security: prompt injection via email, confirmations, encryption, DPDP Act, voice spoofing

### Takeaway
An email-reading agent that can also send messages, browse or place calls has all three parts of Simon Willison's "lethal trifecta": private data, untrusted content, and an outbound channel. Real attacks have already hit Gemini for Workspace, ChatGPT Deep Research (ShadowLeak) and LangChain's GmailToolkit. Filtering is not enough. Use architectural separation:
- A quarantined LLM reads emails and returns only typed fields.
- A privileged planner never sees raw email text (the Dual-LLM / CaMeL pattern).
- Outbound actions require explicit user confirmation.

For a product in India, DPDP obligations become fully enforceable on 13 May 2027.

### Cited Findings
**Prompt injection**
- **ShadowLeak (Sept 2025):** hidden instructions in an email (white-on-white text, CSS tricks) made ChatGPT Deep Research, while analyzing the inbox, exfiltrate personal data. It Base64-encoded the data into a URL opened with its browser tool, entirely server-side (zero-click). — [The Hacker News](https://thehackernews.com/2025/09/shadowleak-zero-click-flaw-leaks-gmail.html); [Paubox](https://www.paubox.com/blog/zero-click-attack-exposes-gmail-data-via-chatgpt-deep-research-agent)
- **Gemini for Workspace:** hidden instructions in an email can make Gemini's summaries show phishing content, with no links or attachments needed. — [Security Boulevard](https://securityboulevard.com/2026/01/google-gemini-ai-flaw-could-lead-to-gmail-compromise-phishing-2/)
- Calendar invites have also been used as an injection vector against Gmail and AI assistants. — [Dataconomy](https://dataconomy.com/2025/09/15/gmail-ai-prompt-injection-attack/)
- **CVE-2025-46059:** indirect prompt injection in the LangChain GmailToolkit leading to email exfiltration. Instructions hidden in emails, attachments or calendar invites are invisible to humans but followed by the AI. — [ATR-2026-01964](https://agentthreatrule.org/en/rules/ATR-2026-01964)
- Phishing emails now include prompt injections aimed at AI-based mail defenses. — [Cybersecurity News](https://cybersecuritynews.com/gmail-phishing-with-prompt-injection/)
- "Promptware kill chain": prompt injections have evolved into multistep malware delivery. — [arXiv 2601.09625](https://arxiv.org/pdf/2601.09625)

**Defensive patterns**
- **Lethal trifecta:** the combination of private-data access, exposure to untrusted content, and external communication makes injection catastrophic (EchoLeak and CamoLeak are examples). Remove at least one leg. — [AgentPatterns.ai](https://agentpatterns.ai/security/lethal-trifecta-threat-model/); [QED summary](https://szermer.github.io/QED/tier1-research/high-priority/The%20lethal%20trifecta%20for%20AI%20agents.html)
- **Dual-LLM vs CaMeL:** the Dual-LLM pattern quarantines the model that reads untrusted text, but values it extracts can still be manipulated. CaMeL has the privileged LLM write a plan or code, and an interpreter tracks the provenance of each variable and enforces policies before each tool call. It solved 77% of AgentDojo tasks with provable security. Principle: once untrusted input has been ingested, it must be impossible for it to trigger consequential actions. — [Zivis](https://www.zivis.ai/articles/lethal-trifecta-dual-llm-camel); [HackerNoon](https://hackernoon.com/you-cannot-filter-your-way-out-of-prompt-injection)

**India DPDP Act 2023 and Rules 2025**
- The DPDP Rules were notified on 13 Nov 2025 with phased compliance:
  - **13 Nov 2025:** Data Protection Board and definitions in force.
  - **13 Nov 2026:** Consent Manager registration opens (Rule 4).
  - **13 May 2027:** full obligations apply, including notice and consent, security safeguards, breach reporting, data-principal rights, retention limits and Significant Data Fiduciary duties.
  
  — [PIB: DPDP Rules notified](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf); [Glocert timeline](https://www.glocertinternational.com/resources/guides/dpdp-rules-2025-compliance-timeline/); [EY](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025)
- Consent Managers must be India-incorporated companies offering a single interoperable platform to give, manage, review or withdraw consent. Significant Data Fiduciaries must run an annual DPIA and audit and report to the Board. — [Seqrite](https://www.seqrite.com/blog/dpdp-rules-are-here-what-changed-from-the-draft/); [RuleExpert](https://ruleexpert.com/significant-data-fiduciary-obligations-dpdp-rules/)

### Inferences
- **Concrete controls for this assistant:**
  1. The email-reading model has no tools and outputs only JSON fitting a schema. Free-text fields are length-capped and never interpreted as instructions.
  2. The voice and briefing agent gets summaries, not raw HTML. Strip hidden text, CSS-hidden content and zero-width characters before any LLM sees the email.
  3. There is no generic URL fetch or web browse tool in the same context as private data.
  4. Every outbound action (send email, reply, RSVP, pay, message a third party) requires spoken or typed confirmation, with the exact recipient and content read back.
  5. Calendar writes go to a dedicated calendar.
  6. Phone numbers or links from emails are never read aloud as instructions ("call this number") without sender-authentication checks (SPF/DKIM pass, known sender).
- **Data protection:**
  - Encrypt OAuth refresh tokens with a KMS (envelope encryption, per-user data keys).
  - Encrypt stored extracted items and transcripts at rest. Set retention limits, for example raw transcripts kept 30 days and summaries kept longer.
  - Log every tool call for audit.
  - Use LLM providers with zero-retention or no-training terms, which Google Limited Use effectively requires.
- **DPDP for a product:** the assistant company would be a Data Fiduciary. It needs itemised notices, consent, erasure and access rights, breach notification, and security safeguards by May 2027. Processing other people's data that appears in the user's inbox (third parties) is a grey area worth legal review.
- **Voice spoofing:** if the assistant accepts commands by phone call, caller ID can be spoofed and voices can be cloned. Require an in-app confirmation or PIN for sensitive actions, and have the assistant only *place* calls outbound to the registered number rather than accept arbitrary inbound command calls.

### Gaps
- I found no authoritative source this session on voice-cloning or caller-ID spoofing risks specific to AI assistants, or on Indian telecom rules for automated outbound calls (TRAI DLT / UCC rules for robocalls were not researched; this is important if calls go through Indian telecom numbers).
- The full DPDP text was not fetched. Whether a single-user personal project counts as "personal or domestic purpose" (which the Act exempts) was not verified from the primary text.
- The DPDP penalty amounts were not captured.

## 6. Evaluation and observability of voice and LLM agents

### Takeaway
Instrument every call end to end with OpenTelemetry spans for speech-to-text, LLM, tools and text-to-speech. Langfuse has native integrations for LiveKit Agents, Pipecat and Vapi, and supports attaching audio to traces. On top of that, layer code checks plus LLM-as-judge evals over transcripts and tool calls, with alerts on latency (p95) and failures.

### Cited Findings
- Langfuse integrates with LiveKit Agents (OpenTelemetry), Pipecat (turn-level spans for STT, LLM and TTS, with time-to-first-byte) and Vapi. Audio files (mp3, wav, ogg) can be attached to traces for playback. — [CallSphere guide](https://callsphere.ai/blog/vw1h-build-voice-agent-observability-langfuse-opentelemetry); [Langfuse](https://langfuse.com/); [Langfuse GitHub](https://github.com/langfuse/langfuse)
- Code and LLM-as-judge evaluators can inspect structured `tool_calls` (for example "did the agent call search before answering"). Traces can be filtered by user, session, cost, latency or metadata, with dashboards and alerts. — [CallSphere](https://callsphere.ai/blog/vw1h-build-voice-agent-observability-langfuse-opentelemetry); [Langfuse agent observability](https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse)
- The OpenAI cookbook shows evaluating Agents SDK runs with Langfuse. — [OpenAI Cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/evaluate_agents)
- Voice adds a real-time pipeline (STT, LLM, TTS) where each stage can fail or add latency independently. OpenTelemetry end-to-end call tracing is recommended. — [Hamming AI OTel guide](https://hamming.ai/resources/opentelemetry-voice-agents-tracing-guide); [FutureAGI glossary](https://futureagi.com/glossary/voice-agent-observability/)

### Inferences
- **Evals specific to this product:**
  - **Briefing accuracy:** does every stated meeting, flight or bill match the source? This can be checked automatically against stored items.
  - **Omission rate:** did a high-priority item go unmentioned?
  - **Hallucinated items.**
  - **Injection resistance:** a red-team suite of malicious emails replayed nightly.
  - **Call outcomes:** answered, length, early hang-up, user corrections.
  - **Latency:** time to first audio, and turn latency p95.
  - Build a golden set from real (redacted) inbox snapshots and synthetic Indian-context emails (IRCTC PNRs, IndiGo itineraries, bank alerts).

### Gaps
- No independent comparison was gathered of voice-specific eval platforms (Hamming, Coval, Cekura and others) against Langfuse.

## 7. Making the assistant feel personal and friendly without being creepy

### Takeaway
Research on the "personalization-privacy paradox" and the "privacy-proactivity paradox" shows proactivity raises both perceived value and perceived intrusiveness. Remembered preferences read as attentive. References to stress, late-night behaviour or opaque inferences read as creepy. Transparency, user control and staying within expected context boundaries decide acceptance.

### Cited Findings
- A study of ChatGPT's memory feature (CHI'26, ACM DL) found "relational gains, privacy strains": memory improves the relationship but raises privacy concerns. — [ACM DL 10.1145/3772318.3791635](https://dl.acm.org/doi/10.1145/3772318.3791635)
- A remembered preference can signal attentiveness, whereas referencing stress or late-night behaviour can feel intrusive. Highly contextual, proactive personalization amplifies both value and intrusiveness. Going past perceived boundaries (excessive prediction, unsolicited recommendations, opaque data use) triggers creepiness and avoidance. — [Frontiers in Psychology 2026](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1934857/xml); [MDPI systematic review](https://www.mdpi.com/2078-2489/17/2/115)
- "The Privacy–Proactivity Paradox: Revisiting the Privacy Calculus in the Age of Proactive AI" (ECIS 2026): proactivity improves convenience but relies on sensitive data, which raises privacy risk. — [AISeL ECIS 2026](https://aisel.aisnet.org/ecis2026/security/security/4/)
- Users protect themselves with strategic disclosure, input obfuscation and refusing or working around features. — [arXiv 2508.07664 (RAG memory privacy perceptions)](https://arxiv.org/pdf/2508.07664)

### Inferences
- **Persona and UX rules:**
  1. **Cite the source** when bringing something up ("from the IndiGo email yesterday…", "you mentioned on Monday's call…"). This makes inferences legible rather than spooky.
  2. **Never volunteer sensitive inferences** (health, finances, relationships, mood or sleep patterns) unless the user opted in to that category.
  3. Offer an **"I'll stop mentioning this"** control on every call, and a viewable and editable memory list.
  4. Follow-ups should be **things the user explicitly said they'd do**, not things the agent guessed.
  5. Keep the persona consistent: warm, brief, uses the user's name sparingly, and handles Hinglish or code-switching if the user does.
  6. Start each call with a 1-line headline ("3 things today, one is urgent"), then let the user interrupt.
  7. Give the user a clear mute and snooze for proactive calls.
- Start conservative and expand proactivity as users give feedback, mirroring Pulse's thumbs-up/down and "curate" loop.

### Gaps
- Not covered: research on voice persona specifically (voice gender or accent preferences in India, parasocial-attachment risks with companion AI) and a dedicated companion-app UX study (Replika and similar).
