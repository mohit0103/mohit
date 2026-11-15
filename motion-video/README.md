# "What do you mean?" — a motion piece for Lubhna

A 38-second, 1920×1080, 30 fps motion-graphics video cut to the chorus of *What Do You Mean?*. Every scene
answers a lyric, and every cut, flip, stamp and tap lands on the beat. It's drawn entirely in code: HTML/CSS
scenes are rendered frame by frame in headless Chromium, with synthesized sound design locked to the same
timeline.

## The story, beat by beat (123 BPM; the drop is beat 8)
| Beats | Lyric | Shot |
|---|---|---|
| 0–8 | *"What do you mean?"* | A desk flip-calendar flips a page on every beat (then on eighths, then on sixteenths) to **12 July 2024**. A red marker circles the date, a handwritten note says "the day it all started", and the camera punches in on the drop. |
| 8–24 | *"nod your head **yes** / but you wanna say **no**"* | An iris opens on a sunlit table. Polaroids fall in with real shadows and gain handwritten captions (your lines from the birthday site). Rubber stamps hit **YES** and **NO** on the sung words. |
| 24–40 | *"don't want me to **move** / but you tell me to **go**"* | An iPhone with Maps: she texts "don't move 😤" while your pin shakes its head, then "…okay, go 🙄". The route draws, the green **Go** button is pressed on "go", and the camera dives into 3D navigation that ends on her pin. |
| 40–56 | *"Said you're **running out of time**"* | Her photo swells out of the pin into a wall of her photos (tiles pop in on eighth notes, then flip in a wave). A chrome stopwatch drops in and counts the **days of us** since 12.07.2024. |
| 56–64 | *"Oh, what do you mean?"* | **MOST VISITED PLACE: y●u**, with the map pin as the "o". It slams on the downbeat and the pin pulses on every beat. |
| 64–78 | *"**Better make up your mind** / What do you mean?"* | Zoom through the pin into a social post. The caption types word by word with the vocal ("Made up my mind. / It's always you ♡"), a double-tap heart lands on the final "mean?", she replies "always ♡", and it ends on a handwritten card. |

"What do you mean?" recurs as a typographic motif (serif italic, word by word, with a bouncing "?"). It's the
visual hook that ties the scenes together, just as the vocal hook ties the song together.

**Craft details:** paper and grain textures, leaf-shadow light on the desk, layered contact shadows, metal and
glass materials, a 3D phone with a titanium edge and moving glare, frosted-glass UI, a lens bulge on push-ins,
directional motion blur, chromatic aberration and light leaks on transitions, a subtle frame pump on every beat,
film grain, and a vignette.

## Make it yours
Edit **`config.json`**: names, the start date and "as of" date (these drive the calendar and the day counter),
polaroids (photo + caption), the YES and NO stamp targets, the Maps text, the wall photos, the title word, the
post lines and reply, the end card, and the music.
- **Video clips:** any media slot can be a clip (`.mp4`, `.mov`, `.webm`); add `#seconds` to start part-way in.
- **Lyric timings** (`L` in `motion.js`) were measured from the song with word-level transcription, then snapped
  to the 16th-note grid. They belong to the section that starts at `musicStart` (11.888 s, two bars before the hook).

## Build
Needs Python 3 with Pillow, NumPy and SciPy, Node with Playwright (Chromium), and ffmpeg. The song isn't committed:
put it at `music/what-do-you-mean.mp3` (repo root).
```
cd motion-video
./make.sh                                   # -> output/memories.mp4
node render.js --stills 3.6,12.0,18.0       # PNG stills (in seconds) in .cache/stills/
```
For a live scrubber, run `python3 prep.py`, then open `index.html` in Chrome (started with `--allow-file-access-from-files`).

## Files
- `index.html`: the design system, plus the SVG filter for motion blur, lens distortion and chromatic aberration.
- `motion.js`: the six scenes and the lyric motif, all timed in beats. Each frame is a pure function of time.
- `audio.py`: SFX tied to on-screen actions: page flips, marker and pen on paper, polaroid slaps, rubber stamps,
  message pops, a button click with a chime, stopwatch ticks, keyboard keys, and a heart pop. Pitched sounds are
  tuned to the song's key (A♭). Each one is levelled against the music around it, then everything goes through a
  shared reverb and a limiter.
- `render.js`, `prep.py`, `make.sh`: the frame capture, media prep and the full build.
- `fonts/`: Inter, Caveat and Instrument Serif (SIL Open Font License).
