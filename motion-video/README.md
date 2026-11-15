# Memories motion video

A 33-second, 1920×1080, 30 fps motion-graphics piece in the style of an Apple-UI travel-vlog intro.
Every frame is drawn by code: HTML/CSS scenes, driven frame by frame by a timeline, captured by headless
Chromium and encoded with ffmpeg. The sound design is synthesized and locked to the same timeline.

## The sequence
| Time | Shot |
|---|---|
| 0.0 – 2.6 | Crash zoom out of a gooey red date dot. The calendar header types in and the dot hops day to day, stretching as it moves, then whip-pans to the date with a lens bulge. |
| 3.3 – 4.6 | The dot puffs up, the photo bleeds through a red tint, and it morphs into a 3D-tilted rounded photo card. |
| 4.7 – 9.0 | A dark "Most visited places" panel slides in. The row highlight springs between places, a whip-pan reveals the place card, and the title, buttons and avatar build in ("Save" → "Saved"). |
| 9.0 – 14.5 | Hero place card: the photo cuts to the clip, zoom pushes, a yellow marker swipes behind the title, then the card shrinks into a grid tile. |
| 14.5 – 23.0 | A clip grid draws its lines in and tiles pop in. A blue map pin flies in with a smear, whip-pans to a dark cell and becomes the "o" in **SUNSET r●ck**. A lens push and a whip lead into letterbox. |
| 23.0 – 27.5 | The pin slides through the word, then a whip into a speed tunnel with motion streaks. The pin fills with a photo. |
| 27.5 – 29.3 | The stripe rolls and tilts into a 3D road, and the pin lies down as a puck. |
| 29.0 – 32.7 | The road shrinks into a social post. The caption types out with the camera following, and the destination glows. |

## Make it yours
Everything you'd change is in **`config.json`**: date, place names, card text, the big title word, post name and
caption, which photo goes where, and the music.

- **Use video clips instead of photos:** put a clip path (`.mp4`, `.mov`, `.webm`) in any media slot. Add
  `#seconds` to start part-way in, e.g. `"clips/beach.mp4#2.5"`. `prep.py` turns clips into frame sequences
  so they play in sync with the animation. Photos get a slow push and handheld drift so they feel like footage.
- **Title word:** `title.word` + `title.pinLetter` (the index of the letter the pin replaces, normally an "o").
- **Music:** `music` (path from repo root, or `""` for SFX only), `musicStart`, `musicVolume`.

## Build
Needs Python 3 with Pillow and NumPy, Node with Playwright (Chromium), and ffmpeg.
```
cd motion-video
./make.sh                      # -> output/memories.mp4
node render.js --stills 3.6,21.3,28.5   # PNG stills in .cache/stills/ for quick checks
```
To scrub the animation live, run `python3 prep.py` and then open `index.html` in Chrome (started with
`--allow-file-access-from-files`). It has a play button and a timeline slider.

## Files
- `index.html`: scene markup and styles, plus the SVG filter for motion blur and lens distortion.
- `motion.js`: the timeline. It holds every scene, camera, easing and cue, and each frame is a pure function of time.
- `render.js`: captures frames with Playwright and pipes them to ffmpeg. It also exports the sound cues.
- `audio.py`: synthesized SFX (whooshes, pops, typing, riser, impacts, a ding) mixed with the music bed.
- `prep.py`: resizes photos, extracts clip frames, and writes `.cache/data.js`.
