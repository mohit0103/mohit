# Fact videos

Makes 30-40 second vertical (1080×1920) "interesting fact" videos, and can post one to you every day
based on what India is searching for.

**Every video has**
- A **strong hook**. Scripts are written by AI with hook rules (a curiosity gap, a specific number, no "Did you know"), then improved in a second pass.
- **Motion graphics with lots of visuals**: 3D emoji (Microsoft Fluent Emoji, MIT licence), versus battles, bar races, pictograms ("3 in 10"),
  count-up stats, timelines, size comparisons, cause → effect flows, animated charts. Plus camera zooms, an impact shake on the hook,
  and moving colour glows.
- **Natural voice** with captions timed word by word to the speech, and key words popping in a box.
- **Sound design**: an impact on the hook, a whoosh on each transition, pops, a riser, and soft background music that gets quieter under the voice.

## Voice quality (best first; it picks the best one you have keys for)
| Engine | Quality | Needs |
|---|---|---|
| ElevenLabs | most human | `ELEVENLABS_API_KEY` secret (free ~10k chars/month ≈ 1 video/day) |
| Gemini TTS | very expressive, Indian-English accent | `GOOGLE_API_KEY` (same key as the script writer) |
| Edge | good, free, no key | nothing |
| Piper | offline backup | nothing |

## Setup (phone is fine)
In the repo on GitHub, go to **Settings → Secrets and variables → Actions** and add:
- `GOOGLE_API_KEY`: free at https://aistudio.google.com/apikey. This is the only one you need.
- Optional: `ELEVENLABS_API_KEY` for the best voice.
- Optional, to get the video straight in Telegram: `TELEGRAM_BOT_TOKEN` (make a bot with @BotFather) and `TELEGRAM_CHAT_ID`
  (message your bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id`).
- Optional **Variables** (same page, Variables tab): `CHANNEL` (your channel name), `VOICE`, `TTS_ENGINE`.

## Daily video
**Daily Trending Video** runs every morning (~7:15 IST). It reads Google Trends for India, picks the trend with the best
fact angle (it skips tragedies, politics and gossip), checks facts with web search, writes the script and renders the video.
You get it as a **GitHub issue** assigned to you, which the GitHub app sends to your phone as a notification. The issue has the download link, a preview, a caption,
hashtags and sources. You also get it on **Telegram** if you set that up.
You can also start it any time from **Actions → Daily Trending Video → Run workflow**.

## Video on any topic
**Actions → Make Fact Video → Run workflow**: type a topic, or leave it empty to render a script file.

## Script format
```yaml
channel: factloop
kicker: the octopus
theme: ink                 # ink | night | paper
voice: en-US-AndrewMultilingualNeural   # optional
pronounce: {ISRO: Isro}    # fix how words are said; captions keep the original spelling
music: auto                # auto (soft synth bed), a file path, or false
scenes:
  - say: This animal has three hearts, and it still gets tired from swimming.
    highlight: [three, hearts]
    visual: {type: hook, emoji: "🐙", text: "3 hearts"}
```
The visual types and their fields are listed in `write_script.py` (`VISUAL_GUIDE`). See `scripts/octopus-three-hearts.yaml` for a full example.

## On a computer
```
pip install -r requirements.txt     # Linux also needs: apt install ffmpeg libegl1
python write_script.py --trending   # or: python write_script.py "why cats purr"
python make_video.py scripts/octopus-three-hearts.yaml --preview
```
