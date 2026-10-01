# Fact videos

Makes vertical 1080×1920 "interesting fact" videos with:
- **Motion graphics** (titles, count-up stats, animated charts, lists, a motion-trail animation, your own images) over a grid background with film grain
- **Word-by-word captions** that light up as each word is spoken, with key words in a coloured box
- **Voice-over** with natural Edge voices (free) and word timings that match the captions. If Edge isn't reachable, it switches to Piper, an offline voice

## From your phone
1. One-time setup: add a free Gemini key as a repo secret named `GOOGLE_API_KEY`.
   Get the key at https://aistudio.google.com/apikey, then add it under Settings → Secrets and variables → Actions.
2. **Actions → Make Fact Video → Run workflow**, type a topic (e.g. `why octopuses have 3 hearts`).
3. When it finishes (~3 min), open the run. There's a **Download** link in the summary.
   Every video is also saved under **Releases → videos**.

To keep using a script you like, edit or add a `.yaml` file in `scripts/` from the GitHub app,
then run the workflow with the topic left empty and `script` set to `scripts/your-file.yaml`.

## Script format
```yaml
channel: factloop          # your channel name, shown top-left
kicker: pigeon, walking    # italic topic label
tagline: why does the head bob?
theme: ink                 # ink | paper | night
voice: en-US-AndrewNeural  # en-IN-PrabhatNeural, en-IN-NeerjaNeural, en-GB-RyanNeural, ...
rate: "+0%"                # speaking speed
pronounce: {Necker: Nekker}  # fix how words are said; captions keep the original spelling
music: music/bed.mp3       # optional background track (kept quiet under the voice)
scenes:
  - say: Pigeons don't really bob their heads.
    highlight: [don't]
    visual: {type: title, lines: ["Pigeons don't", "bob their heads"], sub: "...not the way you think"}
```
Visual types: `title`, `stat`, `chart` (series shapes: line, steps, curve, wave, or your own `points`),
`list`, `trail` (motion: hold or smooth), `image` (`path:` to a picture in this folder).

## On a computer
```
pip install -r requirements.txt     # Linux also needs: apt install ffmpeg libegl1
python write_script.py "why cats purr"          # optional, needs an API key
python make_video.py scripts/pigeon-head-bob.yaml --preview
```
