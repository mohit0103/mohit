# Intro film: Mohit Bhaisare / third_eyef1.7

A ~51-second, 1920×1080, **60 fps** motion-design trailer built from the design
system of [mohit-bhaisare.vercel.app](https://mohit-bhaisare.vercel.app):
warm paper `#fbfaf7`, ink `#211f1c`, amber `#ad6e52`, Fraunces display serif,
Inter, Geist Mono and the Mrs Saint Delafield signature script.

Rendered films:

* **`out/reel.mp4`**: 9:16 vertical trailer (1080×1920, 60 fps, 17.2 s) for Reels/Shorts.
* `out/intro.mp4`: 16:9 long-form intro (1920×1080, 60 fps, 50.7 s).

## The reel (`reel.html` + `reel_score.py`)

Every cut is a **match cut**. Each photo is placed by a feature it shares with its
neighbour (a circle, a person, a horizon or a vanishing point), so at the cut both
images line up exactly and the camera move carries straight through. Typography is
Inter Display (optical sizing, tight tracking) in an Apple-keynote style: words
blur into focus.

| time | match |
|---|---|
| 0–1s | *third_eyef1.7* → a white dot that becomes the **iris** |
| 1–4.5s | Circle chain: eye iris → moon → sun → Konark wheel hub → ferris-wheel hub → flower (*See. Moon. Sun. Wheel. Wonder. Bloom.*) |
| 4.5–5.5s | The iris closes on the flower; *Chasing the last light.* |
| 5.5–7.5s | A horizon line opens onto the beach; the beach walker splits into the seated man (same axis); the lake and sea horizons lock at the same height |
| 7.5–9s | Push into the railway's vanishing point → the radial Pixel shot grows out of the same point |
| 9–11.5s | **Google × photo**: the G draws on, the featured frame pulls out of full screen into a card, and the carousel swipes through the featured shots (*Featured on Google Pixel & Google India*, 300K+ counter) |
| 11.5–14.5s | The ferris hub becomes **his camera lens** and pulls out to the portrait and name |
| 14.5–17.2s | Eighth-note recap, *third_eyef1.7* |

`window.checkCoverage()` in the page verifies that every photo fills the frame at every frame.

The score is a D-minor trailer pulse (side-chained bass, stabs, claps, hats, snare roll)
with a sound for every cut: shape-match whooshes with glassy tails, airy horizon swells,
vanishing-point zoom risers, card swipes, the G "draw" plucks, booms and braams.

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
