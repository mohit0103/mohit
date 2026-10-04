# Intro film: Mohit Bhaisare / third_eyef1.7

A ~51-second, 1920×1080, **60 fps** motion-design trailer built from the design
system of [mohit-bhaisare.vercel.app](https://mohit-bhaisare.vercel.app):
warm paper `#fbfaf7`, ink `#211f1c`, amber `#ad6e52`, Fraunces display serif,
Inter, Geist Mono and the Mrs Saint Delafield signature script.

Rendered films:

* **`out/reel.mp4`**: 9:16 vertical reel (1080×1920, 60 fps, 11.4 s) for Reels/Shorts.
* `out/intro.mp4`: 16:9 long-form intro (1920×1080, 60 fps, 50.7 s).

## The reel (`reel.html` + `reel_score.py`)

A soft, Apple-style piece on a light canvas. Every photo is a rounded card, a
*shared element* that morphs between layouts instead of cutting, with spring
easing (≈3% overshoot), soft shadows, inner parallax and blur-in words set in
Inter Display.

| time | scene |
|---|---|
| 0–1.4s | *third_eyef1.7* sharpens out of a blur, then settles into the eyebrow |
| 1.4–6s | **Selected work** carousel: cards spring in, glide on the beat with inner parallax, captions slide and blur, the active dot stretches into a pill |
| 6–8s | The last card expands to full bleed: *Chasing the last light.* |
| 8–10.6s | It shrinks back into the first tile of a masonry grid; tiles spring in, the grid scrolls under a frosted header, the mood-chip highlight glides |
| 10.6–13.6s | **Google × photo**: the featured tile glides into the card, the G draws on, the carousel swipes through the featured shots, 300K+ counter |
| 13.6–15.8s | The card's corners round off into a circle around his portrait; the ring draws, the name sets |
| 15.8–18.4s | The circle shrinks into an avatar above *third_eyef1.7*, the URL and a *Follow* button that gets pressed |

The composition is authored on a relaxed 18.4 s timeline, and a piecewise time
warp (`KN` in `reel.html`) plays each section 1.5–1.8× faster, giving 11.4 s.
Carousel steps land on 90 bpm half-beats, and sound cues and sections are remapped
through the same warp. Change the knots to change the pace without touching
any animation.

The score is a warm D-major felt-piano and pad bed (100 bpm) with a gentle
kick and shaker only while things move. The sound design is micro-sounds only:
picker ticks for each carousel step, soft taps, bells, pebble pops as tiles land,
four bell notes as the G draws, and a button click.

```bash
node render.js --page reel.html      # -> out/reel.mp4 (~7 min on 4 cores)
```

## The 16:9 intro: story (figures → photos)

| time | scene |
|---|---|
| 0–4.7s | Viewfinder HUD draws in, a lens housing and **F-stop ring (1.7 → 16)** form, seven aperture blades close, then the **iris opens** onto the sunset and the lens grows to fill the frame |
| 4.7–9s | "Photographs remember *little things*", the site's own line, over a slow push into the sun |
| 9–19.4s | The frame collapses onto the sun → it becomes a flat **amber disk** that sets behind a drawn **horizon line** → the sky floods blue → a pale disk rises and match-cuts **exactly** onto the real moon (*the blue hour*) → the horizon line slits open onto the real sea horizon (*the amber horizon*) → light-leak to paper |
| 19.4–23.6s | *Selected Work*: a gliding filmstrip with velocity skew, clip reveals and inner parallax |
| 23.6–29.6s | *Explore by mood*: Twilight · Night & Astro · Nature · Street · Culture, cut on the beat |
| 29.6–35.6s | Recognition: Google Pixel / Google India features, outlined marquees, a **300K+** odometer |
| 35.6–41.6s | The iris opens again: we pull out of **his camera lens** to reveal the portrait, the name sets, and the signature writes itself |
| 41.6–44s | 8-cut trailer montage on half-beats |
| 44–50.7s | "Let's create something *worth remembering*." → the aperture closes → signature |

The rhythmic sections sit on a 100 bpm grid so the cuts land on the music.

## How it works

* `index.html` is the composition. Every frame is a **pure function of time**
  (`window.seek(t)`), with no CSS animations or timers, so renders are deterministic.
  Open it in a browser to preview in real time, or add `?t=12.5` to freeze a frame.
* `render.js` drives headless Chromium at **120 sub-frames/s** and ffmpeg
  averages each pair, so every 60 fps frame gets a 180° shutter (natural motion
  blur on fast moves, sharp on holds). Work is split across parallel browsers.
* `score.py` synthesizes an original score (ambient D-major bed → 100 bpm
  groove) and sound design (shutter clicks, whooshes, booms, risers, odometer
  ticks), placed from cue times the composition exports. No licensed audio is
  used. It's mastered to -14 LUFS.

```bash
pip install numpy scipy
node render.js                       # full film -> out/intro.mp4 (~15 min on 4 cores)
node render.js --stills 3,12.5,40    # PNG stills
node render.js --from 9 --to 19 --out out/clip.mp4
```

Requires Node with `playwright`, Chromium (`CHROMIUM_PATH`), ffmpeg, and Python 3.
