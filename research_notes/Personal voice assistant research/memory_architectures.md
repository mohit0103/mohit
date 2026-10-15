# Long-Term Memory Architectures for a Personal Voice Assistant (as of Oct 2026)

## How do the major memory frameworks work (Mem0, Letta, Zep/Graphiti, LangMem, Cognee, A-MEM, MemoryOS, Memobase, Supermemory, ChatGPT memory, Claude memory tool)? Licensing, self-hosting, maturity, API, cost

### Takeaway
The field has split into (a) drop-in "extracted fact" memory layers (Mem0, Supermemory, Memobase), (b) temporal knowledge graphs (Zep/Graphiti, Cognee), (c) agent harnesses where the agent edits its own memory (Letta/MemGPT, Claude memory tool), and (d) context-compression approaches (Mastra Observational Memory, ChatGPT's pre-loaded summary). Mem0, Graphiti, Letta and Cognee are Apache-2.0 and genuinely self-hostable; only Zep/Graphiti keeps a validity window on every fact by default, which matters for a "Friday dentist" style assistant.

### Cited Findings

**Mem0**
- Original paper (Apr 2025): two-phase pipeline — LLM extracts candidate facts from the latest exchange, then an update phase compares with similar existing memories and picks ADD / UPDATE / DELETE / NOOP; a graph variant (Mem0g) adds ~2% overall; claims 26% relative LLM-judge improvement over OpenAI memory on LoCoMo, 91% lower p95 latency and >90% token savings vs full context — [Mem0 paper, arXiv 2504.19413](https://arxiv.org/abs/2504.19413)
- April 2026 algorithm revision: single-pass, ADD-only extraction (no UPDATE/DELETE), agent-confirmed actions stored with equal weight as user facts, entity linking across memories, and multi-signal retrieval (semantic + BM25 + entity matching); ~6.7–7K tokens/query, p50 latency 0.88–1.09 s (end-to-end) — [Mem0 benchmark blog](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)
- Apache-2.0 OSS (platform features proprietary); self-host with Postgres/pgvector or SQLite/Qdrant; 66,223 GitHub stars (Sept 28 2026); Python SDK v2.2.1; external graph drivers removed in v2.0.0; pricing Starter $19/mo, Pro $249/mo (includes graph memory), Enterprise on-prem; $24M raised — [Mnemoverse Q3 2026 comparison (vendor-authored)](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)
- Temporal handling on Mem0 platform = date-aware ranking + `latest_only` flag (answers "which version is current", not "what was true on date X") — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)

**Zep / Graphiti**
- Graphiti is a "temporally-aware knowledge graph engine" with episode, semantic-entity, and community subgraphs; bi-temporal model (event time + ingestion/transaction time), edge invalidation when new facts contradict old ones; DMR 94.8% vs MemGPT 93.4%; LongMemEval accuracy gains up to 18.5% and ~90% latency reduction vs full-context baseline — [Zep paper, arXiv 2501.13956](https://arxiv.org/abs/2501.13956)
- Apache-2.0; backends Neo4j, FalkorDB, embedded FalkorDBLite, Neptune; ~31K stars; Zep Cloud free tier 10K credits/mo, Flex $125/mo (50K credits), Enterprise in customer cloud — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)
- Zep Community Edition is deprecated; self-hosting now means running Graphiti + your own graph DB; credits billed per episode (1 credit per 350 bytes) — [Atlan: Zep vs Mem0](https://atlan.com/know/zep-vs-mem0/)
- "Only Zep/Graphiti keeps a validity window on every fact by default" (valid_at/invalid_at) — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)
- Zep advertises P95 retrieval under 250 ms and has a LiveKit voice integration — [Zep x LiveKit blog](https://blog.getzep.com/zep-livekit/)

**Letta (MemGPT)**
- MemGPT treats the context window like OS virtual memory: in-context "core memory" blocks the agent edits via tools, plus recall (conversation) and archival (vector) storage it pages in/out — [MemGPT paper, arXiv 2310.08560](https://arxiv.org/abs/2310.08560)
- Sleep-time agents: creating a sleep-time-enabled agent spins up a primary agent plus a background sleep-time agent that rewrites the primary agent's in-context memory blocks during idle time; Letta's sleep-time compute paper (Apr 2025) reports up to ~5x reduction in test-time compute on GSM-Symbolic/AIME without accuracy loss — [Letta: Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute/)
- 2026 state: Apache-2.0, local CLI or app server; source moving to letta-code with "git-tracked memory files" (MemFS) edited by file tools; pricing free (3 agents), $20/mo, API $20 + $0.10/agent; $10M seed; it is a full agent harness, not a drop-in memory API — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)
- Letta showed a plain filesystem agent (grep/search_files/open/close, GPT-4o-mini) reaching 74.0% on LoCoMo, beating Mem0's reported numbers — [Bloo-mind "Benchmark Theatre"](https://essays.bloo-mind.ai/posts/2026-05-20-mem-eval/)

**Cognee**
- Apache-2.0 knowledge-graph memory engine; embedded defaults (SQLite, LanceDB, graph store); ~20 search types including temporal; bi-temporal conflict resolution only in Enterprise (manual end-dating otherwise); v1.6.1; $7.5M seed (Feb 2026); hosted $1/M tokens + $5/workspace — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)

**Supermemory**
- MIT main repo, but local self-host is a prebuilt single-machine server binary (v0.0.8, pre-1.0, source not public); maintains static/dynamic user profiles; vendor claims sub-300 ms p50; $2.6M seed — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)

**LangMem (LangChain/LangGraph)**
- MIT; episodic/semantic/procedural memory primitives for LangGraph; v0.0.30 (Oct 2025) with no releases since; measured p95 of 59.82 s in one benchmark — viable only if already on LangGraph and writing in background — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)

**A-MEM**
- Zettelkasten-style: each new memory becomes a note with LLM-generated context, keywords, tags; system links it to related historical notes and can "evolve" (update) old notes; NeurIPS 2025; claims up to 6x gains on multi-hop and 85–93% lower memory-op token usage — [A-MEM, arXiv 2502.12110](https://arxiv.org/abs/2502.12110)

**MemoryOS / Memobase**
- MemoryOS: OS-inspired short/mid/long-term hierarchy with update, retrieval and generation modules; Memobase: user-profile-centric backend maintaining structured, evolving profiles plus event timelines — [awesome-agent-memory list](https://github.com/mnemoverse/awesome-agent-memory)

**Mastra Observational Memory (notable 2026 entrant)**
- Observer agent converts raw messages into dense, dated, prioritized observations; Reflector agent periodically merges/condenses and drops stale items; each observation carries observation date, referenced date and relative date; 3–6x compression on text; append-only stable prefix gives high prompt-cache hit rates (4–10x token cost cuts); LongMemEval 94.87% (gpt-5-mini), 84.23% (gpt-4o) — [Mastra research](https://mastra.ai/research/observational-memory)

**OpenAI ChatGPT memory**
- Two mechanisms: "saved memories" (explicit, user-viewable/editable/deletable) and "reference chat history" (inferred from past chats, not an editable list, only toggleable); both toggled in Settings → Personalization — [OpenAI: Memory and new controls](https://openai.com/index/memory-and-new-controls-for-chatgpt/)
- Third-party analysis: chat-history memory acts like a frequently-updated summary pre-loaded into context at chat start rather than fetched per question — [memx.app explainer](https://memx.app/blog/chatgpt-reference-chat-history-vs-saved-memories/) (secondary source; OpenAI does not publish internals)

**Claude memory tool (API)**
- Tool type `memory_20250818`; Claude checks a `/memories` directory before tasks and uses view/create/str_replace/insert/delete/rename commands; storage is client-side — the developer's handler maps `/memories` onto per-user storage, and must restrict paths to prevent traversal — [Claude memory tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)

### Inferences
- For a voice assistant, Mem0 (drop-in, low latency) or Graphiti (validity windows, explicit temporal reasoning) are the most production-ready self-hostable options; Letta fits only if the whole agent runtime is adopted.
- Mem0's 2026 move to ADD-only extraction effectively pushes contradiction resolution into retrieval/ranking; a personal assistant that needs "current truth" (e.g., partner's name changed, user moved) should still keep explicit supersession/validity metadata.
- The ChatGPT/Mastra pattern (pre-loaded consolidated profile + compressed observations) is a strong fit for voice because it removes per-turn retrieval from the latency path.

### Gaps
- Could not access OpenAI's own technical description of 2026 ChatGPT memory changes (Mem0's X article on "ChatGPT dreaming" returned HTTP 402).
- Claude.ai consumer memory internals not researched in depth.
- No independent pricing verification beyond vendor/aggregator pages; Mnemoverse comparison is written by a competing vendor.
- MemoryOS/Memobase licensing, stars and benchmark numbers not verified.

## Benchmark results (LoCoMo, LongMemEval, DMR, BEAM) and controversies

### Takeaway
Vendor scores are not comparable and often do not reproduce: harness, answer model, judge model and category handling dominate results. LoCoMo has a ~6.4% corrupted answer key and lenient judges; LongMemEval-S fits into a single context window. Treat all headline numbers as marketing until independently run on your own data.

### Cited Findings
- Benchmarks: LoCoMo ~9K tokens over up to 35 sessions; LongMemEval-S 500 questions, ~115K tokens over ~40 sessions, testing extraction, multi-session reasoning, temporal reasoning, knowledge updates, abstention; BEAM up to 10M tokens across 10 abilities — [Mem0 benchmark guide](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)
- LongMemEval original paper: commercial chat assistants and long-context LLMs show sizable accuracy drops on sustained interactions; proposes session decomposition, fact-augmented key expansion and time-aware query expansion — [LongMemEval, arXiv 2410.10813](https://arxiv.org/abs/2410.10813)
- Mem0 self-reported 2026: LoCoMo 92.5%, LongMemEval 94.4% (multi-session 88.0%, knowledge-update 93.6%), BEAM-1M 64.1%, BEAM-10M 48.6% — [Mem0 benchmark guide](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)
- Mem0 LongMemEval reproduced by Maximem (a competitor) at 73.8% — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3); see also [Maximem: claimed vs observed](https://www.maximem.ai/blog/state-of-ai-memory-2026-claimed-vs-observed)
- Zep 2026 claims: 94.7% LoCoMo, 90.2% LongMemEval with gpt-5.4 — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3); Mem0 lists Zep LongMemEval at 71.2% (GPT-4o judge) — [Mem0 benchmark guide](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)
- Mem0-vs-Zep dispute: Zep claimed 84% on LoCoMo; Mem0's CTO filed an issue arguing adversarial category was excluded from the denominator but correct answers kept, giving 58.44% ± 0.20; Zep replied Mem0 misconfigured Zep and re-reported 75.14% ± 0.17 — [Atlan](https://atlan.com/know/zep-vs-mem0/); [Bloo-mind](https://essays.bloo-mind.ai/posts/2026-05-20-mem-eval/)
- LoCoMo flaws: 99 score-corrupting errors in 1,540 questions (6.4%), so ceiling ~93.6%; GPT-4o-mini judge accepted 62.81% of intentionally wrong-but-topical answers; full-context baseline ~73% beat Mem0's original best 68%; LoCoMo-Refined judge reached 86.33% human agreement vs 43.67% — [Bloo-mind "Benchmark Theatre"](https://essays.bloo-mind.ai/posts/2026-05-20-mem-eval/)
- Reproducibility failures: EverMemOS claimed 92.32%, third-party reproduction 38.38%; MemPalace "100%" LoCoMo used top_k=50 over max 32 sessions (retrieving everything) and LongMemEval "perfect" score was recall@5, not QA — [Bloo-mind](https://essays.bloo-mind.ai/posts/2026-05-20-mem-eval/)
- Dynamic benchmarks: MemoryBench (Tsinghua) found no advanced memory system consistently beats RAG baselines; AMemGym (ICLR 2026) shows off-policy vs on-policy rankings differ by up to 3 positions — [Bloo-mind](https://essays.bloo-mind.ai/posts/2026-05-20-mem-eval/)
- LongMemEval leaders (self-reported): OMEGA 95.4%, Mastra OM 94.87%; multi-session is the weakest category for nearly every vendor — [OMEGA leaderboard](https://omegamax.co/benchmarks); [Mastra](https://mastra.ai/research/observational-memory)
- DMR (from MemGPT) is saturated: Zep 94.8% vs MemGPT 93.4% — [Zep paper](https://arxiv.org/abs/2501.13956)

### Inferences
- Model choice (answerer + judge) likely moves scores more than architecture; a plain filesystem/grep or full-context baseline must be part of any internal eval.
- For a personal assistant, build a private eval set from synthetic multi-month user histories covering updates, temporal questions, abstention and prospective tasks rather than trusting LoCoMo.

### Gaps
- No neutral third-party organization runs a standing, harness-controlled leaderboard across vendors (found only vendor or competitor reproductions).
- BEAM independent numbers for non-Mem0 systems not found.

## Memory types, representation, temporal reasoning, contradictions, importance/decay, consolidation

### Takeaway
Best practice converges on a hybrid: a small always-in-context user profile/core memory (semantic), an episodic log of dated observations, a graph or entity index for people/relationships with validity intervals, and background consolidation ("sleep-time"/reflector) that merges, supersedes and prunes. Temporal grounding must happen at write time (store absolute dates alongside the relative phrase).

### Cited Findings
- Generative Agents: memory stream of observations retrieved by a weighted sum of recency (exponential decay), LLM-rated importance (1–10) and relevance (embedding similarity); "reflection" synthesizes higher-level insights when summed importance of recent events crosses a threshold — [Generative Agents, arXiv 2304.03442](https://arxiv.org/abs/2304.03442)
- LangMem frames memory as semantic (facts/profile), episodic (past experiences) and procedural (updated instructions/prompts) — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)
- Bi-temporal KG with edge invalidation (Graphiti) lets the system answer "what was true on date X" vs. other systems that only answer "which version is current" — [Zep paper](https://arxiv.org/abs/2501.13956); [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)
- Mastra observations store three dates (observation, referenced, relative), enabling temporal reasoning; reflector drops no-longer-relevant context — [Mastra](https://mastra.ai/research/observational-memory)
- LongMemEval proposes time-aware query expansion for temporal questions — [LongMemEval](https://arxiv.org/abs/2410.10813)
- Mem0 original: explicit UPDATE/DELETE on conflicting facts; 2026 version: ADD-only plus multi-signal ranking — [Mem0 paper](https://arxiv.org/abs/2504.19413); [Mem0 blog](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)
- A-MEM "memory evolution": new notes trigger updates to linked old notes — [A-MEM](https://arxiv.org/abs/2502.12110)
- Letta sleep-time agent rewrites core memory blocks asynchronously during idle time — [Letta](https://www.letta.com/blog/sleep-time-compute/)
- Mastra's "30x lossless compression" style claims elsewhere caution: MemPalace's compression caused a 12.4-point regression — [Bloo-mind](https://essays.bloo-mind.ai/posts/2026-05-20-mem-eval/)

### Inferences
- "Friday I'll go to the dentist" should be stored as an event record: {raw_text, utterance_timestamp, resolved_date (absolute, in user's timezone), confidence, status: planned → (asked/confirmed) → happened/cancelled}, with a follow-up hook. Relative-date resolution must use the utterance timestamp, not ingestion time (bi-temporal).
- Prefer supersession (mark invalid_at, keep history) over hard delete for contradictions, except when the user explicitly asks to forget.
- Importance + recency decay is useful for ranking, but not for deleting personal facts (a birthday mentioned once is high-value forever); decay should mainly affect moods/transient states.

### Gaps
- No rigorous comparative study found on graph vs vector vs profile-doc specifically for personal (not enterprise) assistants.

## Prospective memory: extracting future events/intentions for proactive follow-ups

### Takeaway
Prospective memory is a distinct, weakly-solved capability: frontier models top out ~65% F1 with generic scaffolds, but a typed, code-managed intention store raises this to ~83% and lets even tiny models work. Design it as a structured state machine, not as retrieval.

### Cited Findings
- PM-Bench (Jul 2026): Virtual-Week paradigm, 81 scored tasks over 7 simulated days with time-based, event-based, cross-day and hidden-state cues; best scaffold (optional heartbeat) 65.1% F1, todo-ledger 62.8%; core failure is precision/recall calibration (early/over-firing vs forgetting); rescheduled tasks and non-clock hidden channels are weak (0–16.7%); no universal best scaffold across models — [PM-Bench, arXiv 2607.12385](https://arxiv.org/html/2607.12385v1)
- Prospective Intention Store (Sep 2026): lifecycle logic in code, language reasoning delegated to model; training-free; DeepSeek-Chat 82.9% Set-F1, Gemma-E2B 66.2% vs 4.2% without — "schema-constrained state tracking rather than open-ended reasoning" — [arXiv 2609.01272](https://arxiv.org/abs/2609.01272)
- TriggerBench: near-ceiling retrospective recall but proactive intervention collapses — [TriggerBench, arXiv 2606.23459](https://arxiv.org/pdf/2606.23459)
- ProMem: extraction as an iterative process where the agent generates probing questions over the dialogue to verify facts and recover missing details — [arXiv 2601.04463](https://arxiv.org/abs/2601.04463)

### Inferences
- Implement a dedicated `intentions` table (type: event/promise/reminder/follow-up; cue: time or event; due_at; owner: user vs assistant; status; source utterance) managed by deterministic code + scheduler (cron/queue), with the LLM only extracting and phrasing. Follow-up ("How did the dentist go?") is scheduled at due_at + offset and also injected into the pre-call context.
- Add a confidence threshold and user-confirmation for low-confidence intentions to control over-firing.

### Gaps
- No production data found on user acceptance/annoyance rates for proactive follow-ups.

## Retrieval best practices for low-latency voice

### Takeaway
Keep memory off the critical path: pre-load a curated profile + upcoming intentions at session start, do writes asynchronously after each turn, and only run targeted search on topic shifts. Per-turn vector search costs ~50–250 ms; full LLM-based memory pipelines can take ~1 s or far more.

### Cited Findings
- Voice latency tolerance: casual conversation <1 s total; tutoring 1–2 s; customer service 2–3 s; pre-loaded context has zero per-turn cost; semantic search adds 50–200 ms; hybrid = preload core + targeted search on topic shift; async writes add 0 ms; per-round writes protect against mid-session drop-off — [Mem0: Memory for voice agents](https://mem0.ai/blog/ai-memory-for-voice-agents)
- Mem0 search p50 0.148 s / p95 0.200 s (paper) — [Mem0 paper PDF](https://arxiv.org/pdf/2504.19413); Zep P95 retrieval <250 ms — [Zep x LiveKit](https://blog.getzep.com/zep-livekit/)
- Mem0's 2026 full pipeline p50 0.88–1.09 s, ~7K tokens/query — [Mem0 blog](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)
- LangMem measured p95 59.82 s — unsuitable for synchronous use — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)
- Stable append-only context prefixes enable prompt caching (4–10x cost reduction) — [Mastra](https://mastra.ai/research/observational-memory)
- ChatGPT pre-loads memory at chat start rather than per question — [memx.app](https://memx.app/blog/chatgpt-reference-chat-history-vs-saved-memories/)

### Inferences
- Recommended budget: 0 ms memory on the turn path for most turns; ≤150 ms for an optional parallel search launched on ASR partials/topic-shift detection; pre-call assembly (profile, last session summary, due/upcoming intentions, relevant people) done when the call starts or by a scheduled pre-warm.

### Gaps
- No independent measured latencies of Graphiti hybrid search on self-hosted hardware found.

## Privacy: user-controlled forgetting, encryption, memory editing UI

### Takeaway
Industry baseline (ChatGPT) is a viewable/editable/deletable list of explicit memories plus a toggle for inferred memory; tool-based systems like Claude's memory tool keep storage client-side so the developer controls encryption and deletion. Few frameworks document encryption-at-rest or verifiable deletion.

### Cited Findings
- ChatGPT: users can view, edit, delete saved memories, turn off saved memories or chat-history reference independently; temporary chats don't use memory — [OpenAI: Memory and new controls](https://openai.com/index/memory-and-new-controls-for-chatgpt/)
- Inferred chat-history memory is not an editable list (toggle only) — a transparency gap — [memx.app](https://memx.app/blog/chatgpt-reference-chat-history-vs-saved-memories/)
- Claude memory tool is client-side storage; developer must sandbox to `/memories` and handle path traversal — [Claude memory tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- Self-hostable Apache-2.0 options (Mem0, Graphiti, Letta, Cognee) allow keeping all memory on user-controlled infrastructure — [Mnemoverse Q3 2026](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)

### Inferences
- For a personal voice assistant: expose memories as human-readable items with source utterance and date, voice commands ("forget that", "what do you know about my sister?"), hard-delete that cascades to embeddings/graph edges/derived summaries, per-user encryption keys, and sensitive-category gating (health, relationships) with opt-in.
- ADD-only or supersession designs complicate "forget": deletion must propagate to consolidated summaries/reflections too.

### Gaps
- Did not find framework-level documentation on encryption-at-rest, crypto-shredding, or deletion propagation for Mem0/Zep/Letta; needs follow-up in their security docs.
