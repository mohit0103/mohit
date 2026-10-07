# Voice AI Stack for an Outbound-Calling Personal Assistant (India, English + Hinglish), Oct 2026

Research note: ~20 tool calls. Many pricing figures come from third-party aggregator blogs, not vendor pages; they are flagged where that applies. Model names that look new (Gemini 3.8 Live, gpt-realtime-2.1, Sonic-3.5, Bulbul v3/v4, Saaras v3) show up across several 2026 sources. The Gemini figures were checked on Google's official pricing page. The OpenAI figures were not checked on openai.com.

## 1. Orchestration frameworks (Pipecat, LiveKit Agents, Vocode, TEN)

### Takeaway
Use Pipecat or LiveKit Agents. Vocode is effectively unmaintained. LiveKit has native SIP (inbound and outbound) and its own WebRTC transport. Pipecat is transport-agnostic and has the largest set of provider integrations. Both can use semantic turn detection that supports Hindi.

### Cited Findings
- LiveKit supports inbound and outbound SIP natively and sells its own phone numbers. Pipecat reaches telephony through providers such as Twilio, often via Pipecat Cloud, and commonly uses Daily WebRTC as transport. — [Plivo blog: LiveKit, Pipecat, TEN or Native](https://www.plivo.com/blog/how-to-build-a-voice-ai-agent-livekit-pipecat-ten-or-native/); [Evalgent Pipecat vs LiveKit](https://www.evalgent.com/blog/pipecat-vs-livekit)
- LiveKit's transport is a Go WebRTC SFU that handles NAT traversal, jitter buffers and codecs. Pipecat leaves the choice of transport to you. LiveKit has Python and Node SDKs; Pipecat is Python only. — [techsy.io open-source frameworks 2026](https://techsy.io/en/blog/best-open-source-voice-agent-frameworks)
- TEN Framework runs its audio pipeline in compiled C++ outside the Python GIL, supports extensions in C, Go, Python and JS/TS, and has built-in SIP. It is pitched for sub-300 ms and edge hardware. — [techsy.io](https://techsy.io/en/blog/best-open-source-voice-agent-frameworks); [Plivo blog](https://www.plivo.com/blog/how-to-build-a-voice-ai-agent-livekit-pipecat-ten-or-native/)
- Vocode "stopped shipping as an actively maintained project" and now serves as reference code. It had first-class Twilio and Vonage integrations. — [techsy.io](https://techsy.io/en/blog/best-open-source-voice-agent-frameworks)
- GitHub stars (2026 snapshot): Pipecat about 13.4k, LiveKit Agents about 11.4k, TEN about 10.9k. — [techsy.io](https://techsy.io/en/blog/best-open-source-voice-agent-frameworks) (aggregator figures, not checked live)
- Pipecat Smart Turn v3 is an open-source audio-native end-of-turn model. It has about 8M params (Whisper-Tiny encoder plus a linear head), ships as an 8 MB int8 ONNX file, and runs in about 12 ms on a modern CPU (about 60 ms on a cheap AWS instance) with no GPU. It covers 23 languages, including **Hindi, Marathi and Bengali**. — [Daily: Announcing Smart Turn v3](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/); [HF model card](https://huggingface.co/pipecat-ai/smart-turn-v3)
- Smart Turn v3.1 brought further accuracy gains. — [Daily blog v3.1](https://www.daily.co/blog/improved-accuracy-in-smart-turn-v3-1/)
- A community plugin (`smart-turn-livekit`) lets you use Smart Turn as the end-of-turn model inside LiveKit Agents. — [PyPI smart-turn-livekit](https://pypi.org/project/smart-turn-livekit/0.3.0/); [LiveKit community](https://community.livekit.io/t/livekit-plugin-for-smart-turn-eot-detection-models/2013)
- LiveKit also has its own transcript-based turn-detector model. — [LiveKit turn detector docs](https://docs.livekit.io/agents/logic/turns/turn-detector/) (not fetched; language coverage not checked)

### Inferences
- For a single user, both frameworks are fine. Choose LiveKit if you want one stack for the in-app WebRTC path and SIP outbound, with LiveKit Cloud or self-hosting. Choose Pipecat if you want the widest choice of plug-in providers (Sarvam, Deepgram, Cartesia and others) and Pipecat Cloud with Twilio, Plivo or Exotel websockets.
- Smart Turn's Hindi support matters for Hinglish turn-taking. Silence-based VAD alone tends to cut off Indian speakers during mid-sentence pauses ("matlab... ").

### Gaps
- I did not check which languages LiveKit's own turn detector supports (Hindi?) or its current version.
- I did not verify interruption-handling details (false-barge-in filtering, backchannel handling) in each framework's docs.
- I did not check whether Pipecat has a native Exotel or Plivo serializer; it is believed to, but I did not confirm it.

## 2. Managed platforms (Vapi, Retell, Bland, Synthflow, ElevenLabs Agents, Ultravox, Bolna, Hume EVI)

### Takeaway
Platform fees run about $0.05–0.14/min before STT, LLM, TTS and telephony. All-in costs typically land at $0.09–0.30/min. For one user with modest minutes, any of them is affordable. Vapi (BYOK, $0.05) and Bolna (India-native, Exotel/Plivo integrations) are the most relevant here.

### Cited Findings
- Vapi charges a $0.05/min platform fee for orchestration and hosting. STT, LLM and TTS are passed through at cost, or cost $0 on the Vapi bill if you bring your own keys. Realistic all-in is about $0.07–0.25/min. — [autocalls.ai Retell vs Vapi](https://autocalls.ai/article/retell-ai-vs-vapi); [stackbinary Sept 2026](https://stackbinary.io/insights/voice-ai-pricing-per-minute-2026)
- Retell's headline rate is quoted as $0.07/min ([autocalls.ai](https://autocalls.ai/article/retell-ai-vs-vapi)), but stackbinary (Sept 2026) says $0.055/min for voice infra with STT/TTS separate. These sources **conflict**. All-in is about $0.13–0.31/min. — [stackbinary](https://stackbinary.io/insights/voice-ai-pricing-per-minute-2026)
- Bland is $0.14/min on the Start plan, including STT, LLM, TTS and an inbound number. It raised the price from $0.09 in Dec 2025. — [stackbinary](https://stackbinary.io/insights/voice-ai-pricing-per-minute-2026)
- ElevenLabs Agents: $0.08/min overage beyond the plan's included minutes, which range from 15 (Free) to 12,375 (Business). LLM and telephony are billed separately. — [thunderphone ElevenLabs Agents pricing](https://thunderphone.com/guides/elevenlabs-agents-pricing); [stackbinary](https://stackbinary.io/insights/voice-ai-pricing-per-minute-2026)
- Ultravox: 30 minutes free, then $0.05/min. It is a speech-native model and platform. — [Ultravox pricing](https://www.ultravox.ai/pricing) (via search snippet)
- Hume EVI: per-minute overage of about $0.04–0.06 depending on tier. — [famulor.io](https://www.famulor.io/blog/ai-voice-agent-pricing-2026-what-10-platforms-actually-cost-per-minute) (aggregator)
- Bolna (Indian): standard rate 6¢/min (about ₹5.52). Pilot packs are $500 for 12,000 min (about 4.2¢) or $300 for 6,500 min (about 4.6¢). Provider costs (STT/LLM/TTS/telephony) apply on top unless you use your own SIP via Twilio, Plivo or Exotel. — [Bolna pricing](https://www.bolna.ai/pricing); [dograh blog](https://blog.dograh.com/bolna-ai-pricing-breakdown-and-how-open-source-saves-70/)
- Plivo also sells its own "AI Agent" voice service from $0.05/min. — [cloudtalk Plivo pricing](https://www.cloudtalk.io/blog/plivo-pricing/)

### Inferences
- A managed platform adds about $0.05–0.08/min on top of the components. At personal volume (say 300 min/month) that is only about $15–25/month, so the real trade-off is control (custom memory, Claude as the brain, Hinglish voices) versus build effort.
- Vapi, Retell and ElevenLabs all support custom-LLM endpoints (OpenAI-compatible) and function calling as standard features. I did not re-verify this in each vendor's docs in this pass.

### Gaps
- I did not find a current Synthflow per-minute price.
- I did not check each platform's support for Indian outbound numbers. Most rely on Twilio/Telnyx; Bolna integrates Exotel and Plivo natively.
- I did not verify custom-LLM, memory or webhook features in each vendor's docs.

## 3. Speech-to-speech models vs cascaded pipelines

### Takeaway
Speech-to-speech is now cheap. Gemini Live costs about $0.023/min for audio in plus audio out, and OpenAI gpt-realtime-2.1 about $0.096/min, so S2S is viable. The cascaded route still gives the best control over Indian voices and Hinglish STT/TTS, and lets you use any LLM, including Claude.

### Cited Findings
- **Google official pricing page:** `gemini-3.8-live`, `gemini-3.8-live-extended-thinking` and `gemini-3.1-flash-live-preview` all cost $3/1M audio-in tokens (about $0.005/min) and $12/1M audio-out tokens (about $0.018/min). The older `gemini-2.5-flash-native-audio-preview-12-2025` has the same $3/$12. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **OpenAI** (from a third-party article dated July 2026, not the official page): `gpt-realtime-2.1` costs $32/1M audio-in and $64/1M audio-out, which works out to $0.0192/min listening and $0.0768/min speaking. `gpt-realtime-2.1-mini` costs $10/$20, or $0.006/min and $0.024/min. Cached replay costs $0.40/M and $0.30/M. — [Synthorai](https://synthorai.io/blog/gpt-realtime-api-pricing/) (**verify on openai.com/api/pricing**)
- The "GPT-Live 1" and "Gemini 3.8 Live vs GPT-Live-1" articles appear to describe a consumer feature, not the API. — [Synthorai](https://synthorai.io/blog/gpt-realtime-api-pricing/); [cellcog](https://cellcog.ai/blog/gemini-3-8-live/)

### Inferences
- Live context tokens accumulate over a session, so long calls cost more than the per-minute figures suggest. This is typical; I did not quantify it.
- S2S fixes the voice to the model's built-in voices. Gemini and OpenAI voices do speak Hindi, but an Indian-accent English or Hinglish persona sounds less natural than Sarvam Bulbul (a subjective point; no benchmark found). S2S also locks the "brain" to Gemini or GPT, not Claude.
- Good hybrid: Gemini Live for the in-app conversation path, cascaded for phone if you need Claude or Sarvam voices.

### Gaps
- I found no Artificial Analysis speech-to-speech leaderboard data in this pass.
- I did not verify tool-use reliability or the session-length limits of the Live APIs.

## 4. STT (Hinglish / code-switching)

### Takeaway
Sarvam (Saaras v3 / Saarika) is the strongest documented option for Hinglish, at 11.47% WER on CoSHE-500 versus 12.43% for ElevenLabs Scribe v2. It is also the cheapest, at ₹30/hr. Deepgram Flux is the latency leader for English end-of-turn detection, but I found no Hinglish figures for it.

### Cited Findings
- On the CoSHE-500 conversational Hinglish benchmark, Sarvam Saaras-v3 scored 11.47% WER and ElevenLabs Scribe-v2 12.43%. — [benchmarklist ASR code-switch](https://benchmarklist.com/benchmarks/asr_code_switch_benchmark/) (secondary; original paper not fetched)
- Sarvam STT costs ₹30/hour for real-time, streaming and batch alike (₹45/hr with diarization), about $0.006/min. — [Sarvam API pricing](https://www.sarvam.ai/api-pricing)
- A May 2026 study of Arabic, Persian and German code-switching (not Hindi) found ElevenLabs Scribe v2 the most robust overall, with 13.2% mean WER. — [arXiv 2605.19069](https://arxiv.org/pdf/2605.19069)
- ServiceNow's June 2026 code-switching benchmark (es/fr/de-en only, **no Hinglish**) ranked Scribe V2, Gemini 3 Flash and AssemblyAI Universal 3-Pro strongest. It found errors concentrated in the embedded English spans. — [HF blog ServiceNow](https://huggingface.co/blog/ServiceNow-AI/code-switching)
- Deepgram Flux gives about 260 ms p50 end-of-turn at default settings. Its "eager" end-of-turn signal fires 150–250 ms earlier. — [futureagi June 2026](https://futureagi.com/blog/best-voice-ai-june-2026/) (aggregator)
- Community fine-tunes exist, for example `Trelis/whisper-hinglish-preview`. — [HF](https://huggingface.co/Trelis/whisper-hinglish-preview)

### Inferences
- Primary choice: Sarvam streaming STT. Fallback or A/B: ElevenLabs Scribe v2 realtime or Deepgram (multilingual). Test on your own speech, because the user is a single known speaker.

### Gaps
- I found no published Deepgram Nova-3/Flux, AssemblyAI or Google Chirp 3 WER on Hinglish.
- I did not measure Sarvam streaming latency (time to final transcript).

## 5. TTS (Indian voices)

### Takeaway
Sarvam Bulbul (v3, with v4 reported) offers native Hinglish and Indian-English voices at ₹30 per 10k characters, roughly 10x cheaper than Western TTS. Cartesia Sonic-3.5 is the latency leader (about 40–90 ms TTFA). ElevenLabs has the most expressive voices but costs more.

### Cited Findings
- Sarvam TTS costs ₹3 per 1,000 characters (₹30 per 10k) for both real-time and streaming. — [Sarvam API pricing](https://www.sarvam.ai/api-pricing)
- Bulbul v3 has 25+ voices across 11 languages, including Indian-accent English and Hindi. It handles code-mixed Hinglish text and number normalization natively. — [invideo Bulbul v3 explainer](https://invideo.io/blog/sarvam-bulbul-indian-tts/); [Sarvam TTS page](https://www.sarvam.ai/apis/text-to-speech)
- Sarvam has reportedly shipped Bulbul V4 with "emotional voice" in 11 Indian languages. — [AlphaSignal](https://alphasignal.ai/news/sarvam-ai-ships-bulbul-v4-to-bring-emotional-voice-to-11-indian-languages) (not fetched)
- Cartesia Sonic-3.5: sub-90 ms vendor TTFA across 42 languages, with about 40 ms claimed as fastest in the market (June 2026). — [futureagi](https://futureagi.com/blog/best-voice-ai-june-2026/) (aggregator; claims conflict between 40 and 90 ms)

### Inferences
- At about 150 chars/min of agent speech, Sarvam TTS costs about ₹0.45/min (about $0.005).

### Gaps
- I did not fetch current per-character prices for ElevenLabs, Cartesia, OpenAI TTS or Google TTS, or check their Indian voice catalogs.
- I found no independent latency measurement for Bulbul.

## 6. LLM brain (Claude / GPT / Gemini) and latency

### Takeaway
In a cascaded pipeline the LLM's time to first token dominates. Use a fast tier (Gemini Flash / Flash-Lite, GPT mini-class, Claude Haiku-class) with streaming, and keep prompts cached.

### Cited Findings
- Gemini 3.8 Flash costs $0.75 in / $3.75 out per 1M tokens through Dec 31, 2026, then $1.50 / $7.50. Gemini 3.5 Flash-Lite costs $0.30 / $2.50. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- An example budget allots about 150 ms to the LLM using a "fast model". — [futureagi](https://futureagi.com/blog/best-voice-ai-june-2026/)
- MarkTechPost (Aug 30, 2026) published a TTFT-first benchmark of inference APIs for voice. — [MarkTechPost](https://www.marktechpost.com/2026/08/30/lowest-latency-inference-apis-for-voice-and-realtime-agents-a-time-to-first-token-ttft-first-benchmark/) (not fetched; figures unknown)

### Gaps
- I did not obtain measured TTFT for current Claude models from India. Use the claude-api skill or docs for current Claude model IDs and pricing; I did not cover them here.

## 7. Telephony in India and regulation

### Takeaway
Plivo and Exotel are the cost-effective Indian carriers, with media-streaming websockets. Plivo's official rate is ₹0.38/min outbound to Indian mobiles plus ₹200/month for a number. Twilio costs 2–3x more for India. TRAI's 140/160 series and DLT rules cover commercial communications. For one person calling themselves, a WhatsApp call or an app-based VoIP call sidesteps PSTN entirely.

### Cited Findings
- **Plivo official:** ₹0.38/min outbound to Indian mobile and landline, ₹0.38/min inbound, ₹200/month number rental. KYC is required. — [Plivo India pricing](https://www.plivo.com/voice/pricing/in/)
- A caller.digital blog quotes Plivo at ₹0.80–1.80/min and Exotel at ₹1.50–3.00/min, with Exotel 10–25% above Plivo and Twilio 2–3x Plivo/Exotel for India. This **conflicts** with Plivo's official ₹0.38. — [caller.digital](https://caller.digital/blog/telephony-partner-voice-ai-india-plivo-exotel-ozonetel-knowlarity-twilio-2026)
- Twilio India mobile is about $0.0496/min, or ₹1.20–1.50/min. — [edesy Twilio guide](https://edesy.in/blog/twilio-voice-pricing-guide-2026); [Twilio India pricing](https://www.twilio.com/en-us/voice/pricing/in) (not fetched)
- Plivo, Exotel and Twilio all have mature SIP and websocket media streaming (Plivo: G.711, G.729, Opus). Ozonetel and Knowlarity have limited support. Poor SIP routing adds 150–400 ms. — [caller.digital](https://caller.digital/blog/telephony-partner-voice-ai-india-plivo-exotel-ozonetel-knowlarity-twilio-2026)
- TRAI TCCCPR rules (amendments finalised Feb 2025):
  - The 140 series is exclusively for promotional calls.
  - The 160 series is for service and transactional calls, starting with BFSI (deadline Jan 1, 2026).
  - Commercial voice communications must be registered on DLT.
  - [Acefone 140 series](https://www.acefone.com/blog/140-number-series/); [Acefone 160 series](https://www.acefone.com/blog/all-about-160-number-series/); [Sigma Chambers TCCCPR 2025](https://www.sigmachambers.in/post/2025-tcccpr-amendments-a-renewed-push-by-trai-for-order-in-commercial-communications-1)
- TRAI told Truecaller to stop showing spam labels on calls from the 140 and 1600 series. — [Free Press Journal](https://www.freepressjournal.in/tech/stop-displaying-spam-labels-on-calls-originating-from-140-1600-number-series-trai-directs-truecaller)
- **WhatsApp Business Calling API:**
  - Business-initiated calls are billed per minute in 6-second increments, and only when answered. User-initiated calls are free.
  - India is in the lowest price band, about 1¢/min. One BSP charges ₹0.40/min with a Meta surcharge currently ₹0.
  - [respond.io](https://respond.io/whatsapp-business-calling-api); [richautomate](https://richautomate.in/blog/whatsapp-business-calling-api-india-2026-implementation-guide)

### Inferences
- Calling yourself is unlikely to count as "commercial communication" under TCCCPR, which governs unsolicited commercial and promotional or transactional messages to subscribers. A single user consenting to calls from their own assistant is probably fine on a normal virtual number. This is an inference, not legal advice; I found no TRAI text addressing personal or self-directed automated calls.
- A Plivo/Exotel virtual number (KYC'd) calling your own mobile costs about ₹0.4–1.5/min. Truecaller or carrier spam labelling of automated virtual numbers is a practical risk. Save the number as a contact.
- WhatsApp calling needs a Business account and a BSP, plus opt-in. For one user it may be more setup than it is worth.
- In-app VoIP (VoIP push to wake the app, then CallKit on iOS or ConnectionService on Android, then a LiveKit or Daily WebRTC room) has no PSTN cost, gives the best audio (Opus wideband vs 8 kHz G.711) and the lowest latency. It is the best "phone-call feel" for one user. PSTN remains a fallback for when there is no data connection.

### Gaps
- I found no official TRAI text on personal or self-directed automated calls, or on whether a robocall from a 10-digit virtual number to your own DND-registered number triggers anything.
- I did not fetch Exotel's official per-minute rate.
- I did not verify that Twilio can provide Indian-CLI outbound from Indian numbers (historically restricted).

## 8. End-to-end latency targets and how to get under 800 ms

### Takeaway
Aim for roughly 500–800 ms from the user stopping speaking to the first agent audio. A cascaded pipeline can reach about 540 ms with streaming STT, fast end-of-turn detection, a fast LLM, low-TTFA TTS and good telephony routing.

### Cited Findings
- Latency "cliffs" sit at 300, 500 and 800 ms; above 800 ms "nothing else matters". — [dev.to latency cliffs](https://dev.to/kenimo49/your-voice-agent-has-300ms-before-users-bail-the-three-latency-cliffs-that-kill-voice-ux-416c)
- Example budget: STT about 250 ms (Nova-3), LLM about 150 ms, TTS about 90 ms (Sonic-3.5), orchestration about 50 ms, for a total of about 540 ms. The target is about 800 ms including network. — [futureagi](https://futureagi.com/blog/best-voice-ai-june-2026/)
- The telco-to-AI stream should add less than 80 ms; poor SIP adds 150–400 ms. — [caller.digital](https://caller.digital/blog/telephony-partner-voice-ai-india-plivo-exotel-ozonetel-knowlarity-twilio-2026)
- Smart Turn runs in 12 ms on CPU, so semantic end-of-turn detection costs almost nothing. — [Daily](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/)

### Inferences
- Host the agent in an Indian region (Mumbai) close to Plivo/Exotel media and Sarvam, which serves from India. US-hosted LLM calls add about 200+ ms RTT from India; prefer providers with Mumbai or Asia endpoints, or accept the cost.
- Further latency techniques:
  - Use eager or preemptive generation on a likely end-of-turn.
  - Stream LLM tokens into TTS sentence by sentence.
  - Use filler or backchannel audio.
  - Keep the system prompt short or cached.

### Gaps
- I found no measured India-to-US-region round-trip times for the LLM APIs.

---

### Recommended stack (synthesis, for the report writer)

**Approach:** cascaded pipeline, self-built on **Pipecat** or **LiveKit Agents**, hosted in Mumbai.

| Layer | Primary | Alternative / notes |
|---|---|---|
| End-of-turn detection | Smart Turn v3.x (supports Hindi) | |
| STT | Sarvam streaming (₹30/hr) | ElevenLabs Scribe v2 RT |
| LLM | Fast tier of Claude, Gemini Flash or GPT-mini; streamed, with tools and memory | |
| TTS | Sarvam Bulbul v3/v4 (Hinglish voices) | Cartesia Sonic-3.5 / ElevenLabs for English expressiveness |
| Telephony | Plivo India number (₹0.38/min + ₹200/mo) via websocket media streaming | Exotel |
| In-app path | WebRTC (LiveKit) plus a VoIP push "call" | |

**Estimated component cost:** about ₹1.5–3/min, uncertain.

**Low-effort alternatives:**
- Bolna, which is India-native and uses Exotel/Plivo.
- Vapi with your own API keys (BYOK).
- Gemini 3.8 Live as speech-to-speech, at about $0.023/min of audio, if you accept Gemini as the brain and its built-in voices.
