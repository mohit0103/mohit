# Intro film: Mohit Bhaisare / third_eyef1.7

A ~51-second, 1920×1080, **60 fps** motion-design trailer built from the design
system of [mohit-bhaisare.vercel.app](https://mohit-bhaisare.vercel.app):
warm paper `#fbfaf7`, ink `#211f1c`, amber `#ad6e52`, Fraunces display serif,
Inter, Geist Mono and the Mrs Saint Delafield signature script.

Rendered films:

* **`out/reel.mp4`**: 9:16 vertical trailer (1080×1920, 60 fps, 19.6 s) for Reels/Shorts. Fast cuts, heavy SFX.
* `out/intro.mp4`: 16:9 long-form intro (1920×1080, 60 fps, 50.7 s).

## The reel (`reel.html` + `reel_score.py`)

Cut at 120 bpm on half, quarter and eighth beats. It uses 10 kinds of transitions
(iris snap, whip pans with directional motion blur, zoom-through, strip skyline reveal,
flash cut, diagonal wipe, RGB-split glitch, punch-ins, split-band choreography, and a
camera push into a grid card) with tiny mono captions that decode in.

| time | beat |
|---|---|
| 0–1s | Black. *THIRD_EYEF1.7* decodes, an amber line collapses to a dot, and the iris snaps open |
| 1–5s | 8 shots at half-beat, each with a different transition |
| 5–6s | Break: *chasing the last light* |
| 6–9s | Three split bands slide in and swap, a 2×2 grid of featured work, push into the Pixel shot |
| 9–12s | 8 shots at quarter-beat, then an 8-shot eighth-note strobe on a snare roll |
| 12–14s | Drop to near silence: braam, sub dive, **300K+** counter |
| 14–17s | Pull out of his camera lens to the portrait and name |
| 17–19.6s | Strobe recap, braam, the signature writes, @third_eyef1.7 |

The score is a D-minor trailer pulse (side-chained bass, stabs, claps, hats, snare roll)
with a sound for every cut: panned whooshes, zoom risers, glitch zaps, camera-flash
snaps, booms, braams, sub drops, and typing ticks for every decoding caption.

```bash
node render.js --page reel.html      # -> out/reel.mp4 (~8 min on 4 cores)
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
