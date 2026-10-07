# Existing Projects and Products Resembling a Proactive, Phone-Calling Personal "Jarvis"

Method note: GitHub stars/license/last-push figures below were pulled from the GitHub repository search API on 2026-10-03 (stars change daily; treat as approximate). Direct `gh api` / unauthenticated API access was blocked in this environment, so per-repo READMEs were not read; feature descriptions come from the repo descriptions/topics returned by the search API plus web sources. Several web sources are SEO/aggregator blogs; these are flagged where used.

## Q1. Which open-source projects implement personal voice assistants with phone calling, proactive check-ins, and long-term memory?

### Takeaway
No single mature OSS project does the full "Jarvis phones me daily, remembers everything, follows up" loop out of the box, but OpenClaw (MIT, ~391k stars) comes closest: a personal agent with a "heartbeat" loop for proactive behavior, cron-style skills, Gmail/Calendar tooling, and an official voice-call plugin (Twilio/Telnyx/Plivo, outbound + realtime). Everything else is a component: voice/telephony frameworks (Pipecat, LiveKit Agents, Bolna, Dograh, Vocode), memory layers (Mem0, Graphiti/Zep, Letta), and personal-assistant shells without telephony (Khoj, Leon, Omi, Open Interpreter 01).

### Cited Findings

Catalog (stars / license / last push as of 2026-10-03, from GitHub search API):

| Project | Stars | License | Last push | Stack | What it is / relevance |
|---|---|---|---|---|---|
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | ~391,200 | MIT | 2026-10-03 | TypeScript | "The AI that really does things. Any OS. Any Platform." Topics: assistant, personal, own-your-data. Repo created 2025-11-24 (formerly Clawdbot/Moltbot per community repos). 9,161 open issues. |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | ~66,500 | Apache-2.0 | 2026-10-01 | Python | "The Memory Layer for AI Agents"; long-term memory, agentic memory. |
| [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | ~37,600 | AGPL-3.0 | 2026-08-02 | Python | "Your AI second brain. Self-hostable... schedule automations"; topics include stt, whatsapp-ai. |
| [getzep/graphiti](https://github.com/getzep/graphiti) | ~31,400 | Apache-2.0 | 2026-10-02 | Python | "Build Real-Time Knowledge Graphs for AI Agents" (temporal knowledge graph memory). |
| [letta-ai/letta](https://github.com/letta-ai/letta) (ex-MemGPT) | ~25,000 | Apache-2.0 | 2026-09-10 | Python | "Platform for stateful agents: AI with advanced memory that can learn and self-improve over time." |
| [livekit/livekit](https://github.com/livekit/livekit) | ~21,300 | (not retrieved) | active | Go | "End-to-end realtime stack for connecting humans and AI" (WebRTC SFU). |
| [leon-ai/leon](https://github.com/leon-ai/leon) | ~17,600 | MIT | 2026-10-03 | TypeScript/Node + Python | "Your open-source personal assistant"; topics: offline, privacy, speech-recognition, TTS. No telephony. |
| [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat) | ~16,200 | BSD-2-Clause | 2026-10-03 | Python | "Open Source framework for voice agents, multimodal apps, and realtime AI. Maintained by Daily." |
| [livekit/agents](https://github.com/livekit/agents) | ~14,500 | Apache-2.0 | 2026-10-03 | Python | "A framework for building realtime voice AI agents"; 936 open issues. |
| [BasedHardware/omi](https://github.com/BasedHardware/omi) | ~13,600 | MIT | 2026-10-03 | Python/Flutter/C | "AI that sees your screen, listens to your conversations and tells you what to do"; wearable (topics: friend, necklace, transcription). 1,531 open issues. |
| [dograh-hq/dograh](https://github.com/dograh-hq/dograh) | ~5,800 | BSD-2-Clause | 2026-10-02 | Python | Open-source voice-agent platform (description not retrieved). |
| [openinterpreter/01](https://github.com/openinterpreter/01) | ~5,160 | AGPL-3.0 | 2024-11-01 | Python | "Open-source voice interface for desktop, mobile, and ESP32 chips." Effectively dormant (no push in ~2 years). |
| [fixie-ai/ultravox](https://github.com/fixie-ai/ultravox) | ~4,570 | MIT | 2025-12-12 | Python | "A fast multimodal LLM for real-time voice" (speech-native model, not an app). |
| [vocodedev/vocode-core](https://github.com/vocodedev/vocode-core) | ~3,800 | MIT | 2024-11-15 | Python | "Build voice-based LLM agents. Modular + open source." Stale since late 2024. |
| [letta-ai/letta-code](https://github.com/letta-ai/letta-code) | ~3,500 | (not retrieved) | active | TypeScript | "Stateful agents that are like people, with memory, identity..." |
| [bolna-ai/bolna](https://github.com/bolna-ai/bolna) | ~780 | MIT | 2026-10-02 | Python | Indian open-source voice-agent framework focused on telephony/outbound. |
| [anwesha-bose/Saathi_AI](https://github.com/anwesha-bose/Saathi_AI) | 0 | n/a | 2026-07 | JS | Hackathon-style elder-care bot: "daily PSTN calls, medication reminders, wellbeing check-ins... GPT-4o, LangGraph, Twilio & Whisper." Useful as a reference design only. |

OpenClaw details:
- The voice-call plugin "enables OpenClaw to place outbound and accept inbound voice calls via Twilio, Telnyx, or Plivo, with optional realtime voice and streaming transcription"; supports "outbound notifications, multi-turn conversations, full-duplex realtime voice, streaming transcription, and inbound calls with allowlist policies"; TTS via core TTS with ElevenLabs/OpenAI overrides — [OpenClaw docs: Voice call plugin](https://docs.openclaw.ai/plugins/voice-call); code at [extensions/voice-call](https://github.com/openclaw/openclaw/tree/main/extensions/voice-call)
- Limitations: requires "a publicly reachable webhook URL" (fails if webhook resolves to loopback/private network) and runs "inside the Gateway process" — [OpenClaw docs](https://docs.openclaw.ai/plugins/voice-call)
- OpenClaw has a "heartbeat" loop that lets the agent initiate contact (periodic pings with configurable active hours); widely circulated anecdote of an agent that acquired a Twilio number and called its user with a morning briefing — [Hyperight](https://hyperight.com/openclaws-proactive-ai-agents-are-messaging-humans-and-organizing-themselves/); [Medium: Evolution of OpenClaw](https://medium.com/@chhetri.inside/evolution-of-openclaw-537a4ea7230f) (secondary, anecdotal)
- Ecosystem: third-party [ranacseruet/clawphone](https://github.com/ranacseruet/clawphone) adds cellular phone/SMS to OpenClaw; official [openclaw/gogcli](https://github.com/openclaw/gogcli) (~8.5k stars, "Google Workspace in your terminal": gmail, gcal, gdrive, contacts); a skill registry ([openclaw/clawhub](https://github.com/openclaw/clawhub)) and [awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) claiming 5,400+ skills, including e.g. a daily brief skill ([HN Daily Brief skill](https://clawbot.ai/skills/hn-daily-brief.html)) — GitHub search API / linked pages

Bolna (India-relevant):
- Supports inbound and outbound calls in English, Hindi and Hinglish; ships Twilio, Plivo and Exotel integrations plus custom SIP, configured via JSON agent definitions; Indian-language STT via Sarvam and Deepgram — [Bolna site](https://www.bolna.ai/); [Bolna Exotel docs](https://www.bolna.ai/docs/exotel); [Bolna Plivo blog](https://blog.bolna.ai/bolna-plivo-integration/); [thinnest.ai comparison](https://www.thinnest.ai/blog/open-source-voice-ai-frameworks) (vendor blog)

### Inferences
- The "Jarvis" stack is achievable today by composition: OpenClaw (or a custom orchestrator) + scheduler/heartbeat + Gmail/Calendar tools + voice-call plugin, or a custom build on Pipecat/LiveKit with Twilio/Plivo/Exotel + Mem0/Graphiti/Letta for memory.
- Pipecat and LiveKit Agents both have phone-call (Twilio/SIP) examples in their ecosystems (from prior knowledge; not re-verified this session) — these are the standard way to get low-latency phone voice.
- Khoj, Leon, Omi and 01 are "personal assistant" shells but lack telephony; Omi is the best OSS reference for "remember everything I say" (ambient transcription -> memories), but it is wearable-centric.
- Open Interpreter 01 and Vocode are effectively unmaintained; learn from, don't fork.

### Gaps
- Could not read READMEs directly (GitHub API blocked), so exact OpenClaw memory model, cron/heartbeat config syntax, and whether voice-call plugin carries long-term memory into calls are unverified ("agent voice context"/"session scope" mentioned only vaguely in docs).
- Did not retrieve metadata for OpenVoiceOS (ovos-core), Home Assistant Assist, Pipecat example repos (e.g. Twilio chatbot examples), livekit-examples/outbound-caller-python, twilio-samples realtime demos, Kyutai Moshi, HF speech-to-speech, Nous "Hermes agent". Treat as known-to-exist but unverified here.
- Found no OSS project specifically implementing "remember the dentist appointment -> call Friday evening to ask how it went" as a feature; this follow-up logic appears to be unbuilt in OSS.

## Q2. Which commercial products are closest, and what gaps exist?

### Takeaway
Big platforms are converging on "proactive briefing + memory + connectors" but deliver it as text/app cards or smart-speaker nudges, not outbound phone calls; ChatGPT Pulse was retired (mid-2026) in favor of scheduled tasks. Startups (Dume.ai, Coach Call AI) do place real phone calls but are narrow (work triage, accountability). Ambient-memory wearables were absorbed by Big Tech (Bee -> Amazon, Limitless -> Meta). The gap: a consumer product that phones you, carries deep personal memory, and does event-based follow-ups.

### Cited Findings
- **ChatGPT Pulse**: launched to Pro Sept 2025, proactive morning research cards from chat history, memory and connected Gmail/Calendar — [TechCrunch](https://techcrunch.com/2025/09/25/openai-launches-chatgpt-pulse-to-proactively-write-you-morning-briefs); OpenAI retired Pulse (announced ~June 2026, 14-day sunset) and replaced it with scheduled tasks that can produce a daily briefing from interests, past chats and connected apps — [Digit](https://www.digit.in/news/general/openai-is-retiring-chatgpt-pulse-and-replacing-it-with-scheduled-tasks-here-is-why.html); [Manton Reece, 2026-07-02](https://www.manton.org/2026/07/02/a-little-bummed-that-openai.html). One aggregator dates the retirement announcement to June 17, 2026 — [prowlo.com](https://prowlo.com/blog/chatgpt-pulse-shut-down) (low-quality source; exact date unverified).
- **Dume.ai**: claims "true two-way phone calling: you call your assistant for a morning briefing... and it can call you back with updates" — [Dume.ai blog](https://www.dume.ai/blog/we-tested-top-18-ai-voice-assistants-results-were-unexpected) (self-promotional source).
- **Lindy**: daily briefings by text (calendar, emails, tasks), iMessage integration; **Orchid** (YC): executive assistant in iMessage that "texts you your day each morning" — [Lindy blog](https://www.lindy.ai/blog/ai-phone-assistant); [YC AI assistant companies](https://www.ycombinator.com/companies/industry/ai-assistant)
- **Coach Call AI**: AI accountability partner with daily WhatsApp check-ins and real phone calls — [coachcall.ai](https://coachcall.ai/)
- **Sesame** (Oculus co-founders): iOS app launched May 2026 with four named voice agents, expanded to 39 countries; reviewed as the most human-like conversational voice, using Gemma 4 + custom speech models — [TechCrunch 2026-05-28](https://techcrunch.com/2026/05/28/sesame-the-conversational-ai-startup-from-oculus-founders-launches-its-ios-app/); [PCWorld](https://www.pcworld.com/article/3151873/sesame-ai-voice-app-is-the-best-ive-tested-thats-what-worries-me.html). A test build shows Tasks, Schedules, Skills and Gmail/Calendar/Drive connectors — [progressiverobot.com, 2026-09-30](https://www.progressiverobot.com/2026/09/30/sesame-ai-connectors-skills-task-management/) (secondary; feature not confirmed shipped).
- **Alexa+**: proactive nudges (leave early for traffic, sale alerts, routines on person recognition, garage-door alerts) — [Amazon](https://www.aboutamazon.com/news/devices/new-alexa-plus-amazon-devices); smart-speaker bound, not phone calls.
- **Bee**: acquired by Amazon July 2025, still sold as $49.99 pendant at bee.computer as of Aug 2026 — [layer3labs review](https://www.layer3labs.io/gear/reviews/bee-ai-pendant)
- **Limitless**: acquired by Meta, announced Dec 5 2025; sales to new customers stopped; existing owners on free plan with support "at least a year" — [AI Business](https://aibusiness.com/speech-recognition/meta-acquires-limitless); [becomefluent.io](https://becomefluent.io/blog/2026-05/what-happened-to-limitless-pendant/)
- **Dot** (New Computer): personalized memory-heavy companion shut down Oct 5, 2025 — [Cryptopolitan](https://www.cryptopolitan.com/dot-personalized-ai-shutting-down/); [startupnews.fyi](https://startupnews.fyi/2025/09/06/personalized-ai-companion-app-dot-is-shutting-down/)
- **Pi (Inflection)**: still online but largely maintenance mode after Microsoft hired most of the team in 2024 — [Turing Post](https://www.turingpost.com/p/inflectionai); [SolidAITech, 2026-06](https://www.solidaitech.com/2026/06/inflection-ai-guide.html) (secondary)
- **Friend** pendant ($129): always-listening companion that texts responses — [Fortune](https://fortune.com/2025/10/03/friend-ai-necklace-review-avi-schiffmann/)

### Inferences
- OpenAI moving from an inferred "Pulse" feed to user-defined scheduled tasks suggests explicit, user-controlled schedules beat opaque proactivity — a design signal for Jarvis (let the user define call times/topics; keep inferred follow-ups modest).
- Outbound phone calls remain a startup niche, likely because of telephony cost, regulation and annoyance risk; none of the big assistants (ChatGPT, Gemini, Alexa+) call your phone number.
- For an India-based user, a WhatsApp-voice or app-push-to-call channel may be more practical than PSTN; PSTN in India would route via Exotel/Plivo (Bolna supports both).

### Gaps
- Did not verify current Gemini Live/Gemini proactive features, Character.ai calls, Replika calls, Martin AI, Rabbit status, or ChatGPT voice memory specifics in 2026.
- Pricing of Dume.ai and Coach Call AI and their India availability not checked.

## Q3. Which projects are best to fork or reuse, and why? Plus lessons learned/complaints

### Takeaway
Best fork candidate: OpenClaw (MIT, extremely active, already has heartbeat proactivity + voice-call plugin + Google Workspace CLI), with the caveat of its enormous surface area and issue load. Best component reuse: Pipecat (BSD-2) or LiveKit Agents (Apache-2.0) for the call pipeline; Bolna (MIT) for Indian telephony/Hindi; Mem0 or Graphiti (Apache-2.0) for long-term memory, Letta (Apache-2.0) if you want a stateful-agent server. Learn-only: Khoj (AGPL), Open Interpreter 01 (AGPL, dormant), Vocode (stale), Omi (wearable-centric). Main user complaints in this category: creepiness/privacy of always-on memory, stale or misjudged proactive content, and unsolicited intrusiveness.

### Cited Findings
- License/maintenance facts per table in Q1 (GitHub search API, 2026-10-03): permissive + active = OpenClaw (MIT), Pipecat (BSD-2), LiveKit Agents (Apache-2.0), Mem0 (Apache-2.0), Graphiti (Apache-2.0), Letta (Apache-2.0), Leon (MIT), Omi (MIT), Bolna (MIT), Dograh (BSD-2). Copyleft: Khoj and 01 are AGPL-3.0. Stale: 01 (last push 2024-11-01), Vocode (2024-11-15).
- OpenClaw voice-call constraints: needs public webhook; plugin runs inside the Gateway; "voice-call" is an exclusive plugin slot (only one active instance) — [OpenClaw docs](https://docs.openclaw.ai/plugins/voice-call); [Medium](https://medium.com/@chhetri.inside/evolution-of-openclaw-537a4ea7230f)
- Pulse complaints: relevance "decayed instead of compounding"; it kept inferring interests long after users moved on; one Pro user said it "still latches onto questions i have resolved weeks ago"; most users never connected memory/Gmail/Calendar, making it shallow — [prowlo.com](https://prowlo.com/blog/chatgpt-pulse-shut-down) (aggregator); HN launch thread criticized AI-initiated messaging as obnoxious — same source; OpenAI said scheduled tasks are "faster, more reliable and easier to manage" — [Digit](https://www.digit.in/news/general/openai-is-retiring-chatgpt-pulse-and-replacing-it-with-scheduled-tasks-here-is-why.html)
- ChatGPT memory reliability problems acknowledged — [The Neuron](https://www.theneurondaily.com/p/chatgpt-admitted-its-memory-was-broken) (headline only; not read)
- Friend backlash: privacy concerns over passive listening, "creepy unsolicited advice," condescending replies, forgetting personal details mid-conversation, short battery; NYC subway ads defaced — [WebProNews](https://www.webpronews.com/friend-ai-necklace-sparks-backlash-for-privacy-woes-and-tech-flaws/); [TechBuzz review](https://www.techbuzz.ai/articles/friend-ai-necklace-review-the-129-wearable-that-bullies-you); [Rude Baguette](https://www.rudebaguette.com/en/2025/10/new-yorkers-hated-it-instantly-ai-friend-pendant-ads-defaced-with-graffiti-as-outrage-over-privacy-and-humanity-explodes/)
- Acquisition risk: customers "spooked" as Big Tech buys AI wearable startups (Bee, Limitless) — [SF Standard](https://sfstandard.com/2025/12/14/big-tech-scooping-ai-wearable-startups-customers-spooked/)
- Sesame reviewer: best voice tested, "that's what worries me" (emotional realism concerns) — [PCWorld](https://www.pcworld.com/article/3151873/sesame-ai-voice-app-is-the-best-ive-tested-thats-what-worries-me.html)

### Inferences
- Recommended architecture for the user: self-hosted orchestrator (OpenClaw fork, or a lean custom Python service) + Pipecat/LiveKit telephony pipeline + Mem0/Graphiti memory store with explicit "open loops" (events to follow up on) + scheduler. Self-hosting addresses the shutdown/acquisition risk seen with Dot, Limitless, Pulse.
- Design lessons: user-defined schedules and explicit opt-in follow-ups; memory that expires/resolves topics (avoid Pulse's "latches onto resolved questions"); a visible, editable memory store (avoid Friend-style creepiness); keep calls short with a skip/snooze option.
- Latency complaints were not directly found in sources this session; realtime speech-to-speech models (OpenAI Realtime, Ultravox, Sesame-style) are the standard mitigation.

### Gaps
- No Reddit (r/LocalLLaMA, r/selfhosted) threads were read; user-complaint evidence is mainly from press reviews and an aggregator.
- Code quality/modularity assessments are inferred from license, activity and issue counts, not from code review.
- India-specific regulation (TRAI/DLT rules for automated calls, recording consent) not researched here.
