"""Catchy pop score + polished, key-tuned sound design for the 9:16 reel.

    python3 reel_score.py out/reel-cues.json out/reel-score.wav
    STEMS=1 python3 reel_score.py ...          # also writes music/drums/fx stems

Everything is synthesized here (no samples, no licensed audio) and locked to the
composition's beat grid (bpm + grid0 from the cue file), so the music moves with
the picture: carousel steps, the Google reveal and the portrait land on beats.

Arrangement (D major, I–vi–IV–V, 100 bpm):
  intro      filtered hook teaser over a pad
  carousel   groove A: kick, snaps on 2 & 4, swung shakers, off-beat bass, hook
  full-bleed breakdown: drums out, pad opens, hook echoes, a short snare build
  grid       drop: full groove returns
  google     peak: open hats, claps, a bell counter-melody an octave up
  portrait   half-time, hook on bells
  end        hook resolves on D, final chord rings out under the button click
UI sounds are tactile and tuned to the key; their panning follows the motion.
"""

import json
import os
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
rng = np.random.default_rng(7)
spec = json.load(open(sys.argv[1]))
out_file = sys.argv[2]
DUR = spec["duration"] + .2
N = int(DUR * SR)
SEC = spec["sections"]
BEAT = 60 / (spec.get("bpm") or 100)
G0 = spec.get("grid0") or 0.0
BAR = 4 * BEAT
E8 = BEAT / 2
music = np.zeros((2, N))
drums = np.zeros((2, N))
fx = np.zeros((2, N))
side = np.zeros(N)                     # side-chain trigger (kick envelope)


# ───────────────────────── helpers ─────────────────────────
def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(n, a, r, c=2.0):
    e = np.ones(n)
    ai, ri = min(n, int(a * SR)), min(n, int(r * SR))
    if ai:
        e[:ai] = np.linspace(0, 1, ai) ** c
    if ri:
        e[n - ri:] *= np.linspace(1, 0, ri) ** c
    return e


def lp(x, fc, o=2):
    b, a = signal.butter(o, min(fc, SR / 2 - 200) / (SR / 2))
    return signal.lfilter(b, a, x)


def hp(x, fc, o=2):
    b, a = signal.butter(o, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, o=2):
    b, a = signal.butter(o, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def place(buf, clip, at, gain=1.0, pan=0.0):
    i = int(round(at * SR))
    if clip.ndim == 1:
        pan = np.clip(pan, -1, 1)
        l, r = np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414
        clip = np.vstack([clip * l, clip * r])
    s = max(0, -i)
    j = min(N, i + clip.shape[1])
    if j > max(i, 0):
        buf[:, max(i, 0):j] += clip[:, s:s + j - max(i, 0)] * gain


def grid(a, b, step, phase=0.0):
    """Times on the one global grid in [a, b)."""
    t = G0 + phase + np.ceil((a - G0 - phase) / step - 1e-6) * step
    while t < b - 1e-6:
        yield round(t, 6)
        t += step


def reverb(x, sec=2.0, mix=.3, seed=1, pre=.012):
    r = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = lp(r.standard_normal(n), 7000) * np.exp(-t * 6.9 / sec) * (1 - np.exp(-t * 250))
        ir = np.concatenate([np.zeros(int(pre * SR)), ir])
        ir /= np.sqrt((ir ** 2).sum())
        out[ch] = signal.fftconvolve(x[ch], ir)[:x.shape[1]]
    return x * (1 - mix) + out * mix * 1.8


def pingpong(x, delay, fb=.38, taps=5, tone=4500):
    """Stereo ping-pong echo (the 'expensive' sheen on the lead)."""
    out = x.copy()
    d = int(delay * SR)
    src = lp(x.mean(0), tone)
    for k in range(1, taps + 1):
        ch = (k + 1) % 2
        g = fb ** k
        if d * k < x.shape[1]:
            out[ch, d * k:] += src[:x.shape[1] - d * k] * g
    return out


def section(t):
    for k, (a, b) in SEC.items():
        if a <= t < b:
            return k
    return "end"


# key moments, snapped to beats where the picture changes
def snap(t):
    return G0 + round((t - G0) / BEAT) * BEAT


BREAK = snap(SEC["full"][0] - .2)       # breakdown starts on the beat before the expand
DROP = snap(SEC["grid"][0] + .2)        # drop on the beat right after the grid appears
PEAK = SEC["google"][0]                  # on the grid already
HALF = SEC["portrait"][0]                # on the grid already
OUTRO = snap(SEC["end"][0] - .2)


def energy(t):
    """0 intro · 1 groove · .15 breakdown · 1.15 drop/peak · .5 half-time · outro fades."""
    if t < SEC["carousel"][0] - .25:
        return 0
    if t < BREAK:
        return 1
    if t < DROP:
        return .15
    if t < HALF:
        return 1.15 if t >= PEAK else 1.05
    if t < OUTRO:
        return .5
    return .3


# ───────────────────────── harmony + hook ─────────────────────────
#            bass   pad voicing
CHORDS = [(38, [62, 66, 69, 73]),       # Dmaj7
          (35, [62, 66, 69, 71]),       # Bm(add11 colour)
          (31, [62, 66, 67, 71]),       # Gmaj7
          (33, [61, 64, 69, 73])]       # A
FINAL = (38, [62, 66, 69, 74])            # plain D major to end on


def chord_at(t):
    bar = np.floor((t - G0) / BAR)
    if G0 + bar * BAR >= OUTRO + BAR / 2:                # the last bar resolves home to D
        return FINAL
    return CHORDS[int(bar) % 4]


# 2-bar hook in eighths (None = rest); bars alternate A/B, B resolves
HOOK_A = [78, None, 81, 78, 83, None, 81, None,  78, None, 76, 74, 76, None, None, None]
HOOK_B = [78, None, 81, 78, 86, None, 83, 81,  83, None, 81, 78, 81, None, 78, None]
HOOK_END = [78, None, 81, 78, 83, None, 81, None,  78, None, 76, None, 74, None, None, None]
COUNTER = [90, None, None, 93, None, None, 90, None,  88, None, None, 86, None, None, 85, None]   # bell line at the peak


def pluck(f, d=.55, bright=1.0):
    """Marimba / pluck lead: fundamental + inharmonic partials with fast decay, soft square body."""
    t = tt(d)
    v = np.sin(2 * np.pi * f * t) * np.exp(-t * 7)
    v += .35 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 26 * bright)
    v += .12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 60)
    sq = lp(signal.square(2 * np.pi * f * t) * np.exp(-t * 9), 2600 * bright) * .18
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 900) * .05
    return (v + sq + click) * env(len(t), .002, .08, 1)


def bell(f, d=1.6):
    t = tt(d)
    return sum(np.sin(2 * np.pi * f * m * t) * np.exp(-t * (2.6 + m * 1.5)) / m ** 1.3 for m in (1, 2.0, 3.0, 4.07)) * .2


def supersaw(n, d, cutoff, amp):
    t = tt(d)
    v = sum(signal.sawtooth(2 * np.pi * hz(n) * (1 + c / 100) * t + rng.uniform(0, 6)) for c in (-.18, -.06, .07, .19))
    return lp(v, cutoff, 2) * env(len(t), .03, .25, 1.5) * amp


def bass_note(n, d):
    t = tt(d)
    f = hz(n)
    v = np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t) + .1 * signal.sawtooth(2 * np.pi * f * t)
    return lp(v, 900) * env(len(t), .004, .07, 1) * np.exp(-t * 3)


lead = np.zeros((2, N))
pads = np.zeros((2, N))
bass = np.zeros((2, N))

# pads: one chord per bar, filter opens with the energy
for t0 in grid(-BAR, DUR, BAR):
    b, voicing = chord_at(t0 + .01)
    e = energy(max(t0, 0) + .1)
    cutoff = 900 if e < .1 else (1500 if e < .6 else 2600)
    amp = .016 if e < .1 else .02
    if BREAK <= t0 + .1 < DROP:
        cutoff, amp = 3200, .026                       # breakdown: the pad opens up and carries
    for j, n in enumerate(voicing):
        place(pads, supersaw(n, BAR + .25, cutoff, amp), t0, pan=-.7 + j * .47)

# bass: bouncy off-beat eighths with an octave hop, root on the downbeat
for i, t in enumerate(grid(0, DUR - .3, E8)):
    e = energy(t)
    if e < .4 and not (HALF <= t < OUTRO):
        continue
    beat_pos = int(round((t - G0) / E8)) % 8
    root = chord_at(t + .001)[0] + 12
    if HALF <= t < OUTRO:                                # half-time: just long roots
        if beat_pos in (0, 4):
            place(bass, bass_note(root, .9), t, .55)
        continue
    if beat_pos == 0:
        place(bass, bass_note(root, .26), t, .6)
    elif beat_pos % 2 == 1:
        place(bass, bass_note(root + (12 if beat_pos in (3, 7) else 0), .2), t, .5)

# hook: 2-bar phrases on the grid; teaser in the intro is filtered, peak adds the bell counter-line
phrase_starts = list(grid(0, DUR, 2 * BAR))
for p, t0 in enumerate(phrase_starts):
    for k in range(16):
        t = t0 + k * E8
        if t < 0 or t > DUR - .4:
            continue
        sec = section(t)
        if t >= OUTRO:
            mel = HOOK_END
        else:
            mel = HOOK_B if p % 2 else HOOK_A
        n = mel[k]
        if n is None:
            continue
        if t < SEC["carousel"][0] - .3:                  # intro teaser: soft and dark
            place(lead, pluck(hz(n), .5, .45), t, .22, .1)
        elif BREAK <= t < DROP:                          # breakdown: hook on bells only
            place(lead, bell(hz(n + 12), 1.2), t, .32, .15 * np.sin(k))
        elif HALF <= t < OUTRO:
            place(lead, bell(hz(n + 12), 1.4), t, .3, .15 * np.sin(k))
        else:
            place(lead, pluck(hz(n), .55), t, .42, .12)
        if mel is HOOK_END and k == 12 and t >= OUTRO:  # the last note: let it ring
            place(lead, bell(hz(n + 12), 2.4), t, .3, 0)
        if PEAK <= t < HALF and COUNTER[k] is not None:
            place(lead, bell(hz(COUNTER[k]), 1.0), t, .2, -.35)

lead = pingpong(lead, BEAT * .75, .34, 5)                # dotted-eighth echo


# ───────────────────────── drums ─────────────────────────
def kick(g=1.0):
    t = tt(.4)
    f = 52 + 95 * np.exp(-t * 38)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    knock = bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t * 320) * .12
    return np.tanh((body + knock) * 1.4) * env(len(t), .001, .05, 1) * g


def snapclap(g=1.0):
    t = tt(.28)
    e = np.zeros(len(t))
    for o in (0, .009, .018):
        i = int(o * SR)
        e[i:] += np.exp(-t[:len(t) - i] * 75)
    body = bp(rng.standard_normal(len(t)), 900, 4200) * (e + np.exp(-t * 16) * .35)
    return body * g


def shaker(g=1.0):
    t = tt(.07)
    return hp(rng.standard_normal(len(t)), 6500) * env(len(t), .006, .05, 1.3) * g


def ohat(g=1.0):
    t = tt(.32)
    x = hp(rng.standard_normal(len(t)), 7500) + hp(sum(signal.square(2 * np.pi * f * t) for f in (3150, 4870, 6720)) * .08, 7000)
    return x * np.exp(-t * 10) * g


def snare(g=1.0):
    t = tt(.2)
    return (np.sin(2 * np.pi * 200 * t) * np.exp(-t * 35) * .5 + bp(rng.standard_normal(len(t)), 1800, 6000) * np.exp(-t * 24)) * g


SWING = .06 * E8                                          # light swing on the off 16ths
for t in grid(0, DUR - .3, BEAT):
    e = energy(t)
    bp_ = int(round((t - G0) / BEAT)) % 4
    if HALF <= t < OUTRO:
        if bp_ == 0:
            place(drums, kick(.5), t); side[int(t * SR):int(t * SR) + 10] = 1
        if bp_ == 2:
            place(drums, snapclap(.32), t, -.05)
        continue
    if e >= .9:
        place(drums, kick(.62 if e > 1.1 else .56), t)
        side[int(t * SR):int(t * SR) + 10] = 1
        if bp_ in (1, 3):
            place(drums, snapclap(.42 if e > 1.1 else .36), t, -.05)
        if e > 1.1:
            place(drums, ohat(.12), t + E8, .25)
for i, t in enumerate(grid(0, DUR - .3, E8 / 2)):
    e = energy(t)
    if e < .9 and not (HALF <= t < OUTRO):
        continue
    off = i % 2
    g = (.05 if off else .085) * (.6 if HALF <= t < OUTRO else 1)
    place(drums, shaker(g), t + (SWING if off else 0), .35)
# snare build into the drop: eighths → sixteenths, rising
b0 = DROP - BAR / 2
for i, t in enumerate(grid(b0, DROP, E8 / 2)):
    p = (t - b0) / (DROP - b0)
    if p < .5 and i % 2:
        continue
    place(drums, snare(.08 + .22 * p ** 1.5), t, .1 * np.sin(i))
# the drop itself: kick + clap + crash-like air (short, not a whoosh)
place(drums, kick(.75), DROP)
place(drums, ohat(.25), DROP, .0)


# ───────────────────────── UI sound design (tuned, tactile) ─────────────────────────
KEY = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86]        # D major pentatonic-ish set for tuned UI tones


def detent():
    t = tt(.05)
    body = hp(rng.standard_normal(len(t)), 2600) * np.exp(-t * 450)
    ring = np.sin(2 * np.pi * 4100 * t) * np.exp(-t * 150) * .22 + np.sin(2 * np.pi * 2650 * t) * np.exp(-t * 190) * .16
    return body * .7 + ring


def grains(d, density, lo, hi, shape):
    n = int(d * SR)
    x = np.zeros(n)
    k = int(density * d)
    idx = rng.integers(0, n, k)
    x[idx] = rng.uniform(-1, 1, k) * rng.uniform(.3, 1, k)
    return bp(x, lo, hi) * shape


def slide(d=.2):
    t = tt(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.2
    return grains(d, 2600, 1800, 7000, e) * 2.0 + lp(hp(rng.standard_normal(len(t)), 3000), 8000) * e * .04


def pat():
    t = tt(.12)
    return np.sin(2 * np.pi * 150 * t) * np.exp(-t * 55) * .6 + lp(hp(rng.standard_normal(len(t)), 900), 4500) * np.exp(-t * 90) * .5


def riffle(d=.34, n=11):
    o = np.zeros(int((d + .05) * SR))
    for j in range(n):
        f = grains(.03, 9000, 2500, 9000, np.exp(-tt(.03) * 120)) * 1.6
        i = int(d * (j / n) ** 1.15 * SR)
        o[i:i + len(f)] += f
    return o


def ratchet(d=.6, n=9):
    o = np.zeros(int((d + .06) * SR))
    for j in range(n):
        c = detent() * (.45 + .55 * j / n)
        i = int(d * (1 - (1 - j / n) ** 1.8) * SR)
        o[i:i + len(c)] += c[:len(o) - i]
    return o


def tap():
    t = tt(.18)
    return (np.sin(2 * np.pi * 210 * t) * np.exp(-t * 32) + np.sin(2 * np.pi * 620 * t) * np.exp(-t * 60) * .25) * .8


def pebble(n):
    t = tt(.08)
    f = hz(n) * (1 + .3 * np.exp(-t * 90))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 55) * .35


def bloom(t_at):
    """Warm landing on the current chord: low swell + chord bell, no transient."""
    b, voicing = chord_at(t_at + .01)
    t = tt(1.8)
    low = (np.sin(2 * np.pi * hz(b + 12) * t) + .5 * np.sin(2 * np.pi * hz(b + 19) * t)) * .16
    return low * env(len(t), .03, 1.3, 1.5) * np.exp(-t * 1.1) + sum(bell(hz(n + 12), 1.8) for n in voicing[1:3]) * .45


def sparkle():
    o = np.zeros(int(1.8 * SR))
    for j, n in enumerate([86, 90, 93, 98, 102, 105]):
        b_ = bell(hz(n), 1.0) * (.5 + j * .06)
        i = int(j * .06 * SR)
        o[i:i + len(b_)] += b_
    return o


def shutter():
    o = np.zeros(int(.14 * SR))
    for off, g in ((0, 1.0), (.055, .7)):
        t = tt(.025)
        i = int(off * SR)
        o[i:i + len(t)] += lp(hp(rng.standard_normal(len(t)), 1500), 6000) * np.exp(-t * 260) * g
    return o * .7


def click():
    t = tt(.04)
    return (np.sin(2 * np.pi * 1800 * t) * .6 + hp(rng.standard_normal(len(t)), 4000) * .2) * np.exp(-t * 160)


def counter_ticks(d=.75):
    o = np.zeros(int((d + .05) * SR))
    k = 0.0
    while k < d:
        c = detent() * .5
        i = int(k * SR)
        o[i:i + len(c)] += c[:len(o) - i]
        k += 1 / (26 * (1 - k / d) ** 1.4 + 5)
    return o


step_i = 0
for c in spec["cues"]:
    ty, at, g = c["type"], c["at"], c["gain"]
    if ty == "detent":
        place(fx, detent(), at, .26 * g, .15)
        # tuned 'tink' on each carousel step: walks up the chord as the cards advance
        b_, voicing = chord_at(at + .01)
        place(fx, bell(hz(voicing[step_i % 4] + 24), .7), at, .12 * g, .2)
        step_i += 1
    elif ty == "slide":
        s = slide()
        place(fx, s, at - .04, .3 * g, np.linspace(.45, -.45, len(s)))     # follows the cards moving right → left
    elif ty == "pat":
        place(fx, pat(), at, .34 * g, float(rng.uniform(-.35, .35)))
    elif ty == "riffle":
        r = riffle()
        place(fx, r, at, .36 * g, np.linspace(-.5, .5, len(r)))             # the hand fans out left → right
    elif ty == "ratchet":
        place(fx, ratchet(), at - .62, .26 * g)
    elif ty == "bloom":
        place(fx, bloom(at), at, .5 * g)
    elif ty == "tap":
        place(fx, tap(), at, .24 * g)
    elif ty == "bell":
        b_, voicing = chord_at(at + .01)
        place(fx, bell(hz(voicing[int(rng.integers(0, 4))] + 24), 1.4), at, .22 * g, float(rng.uniform(-.25, .25)))
    elif ty == "pebble":
        place(fx, pebble(KEY[int(rng.integers(4, len(KEY)))] + 12), at, .22 * g, float(rng.uniform(-.6, .6)))
    elif ty == "gdraw":
        for j, n in enumerate([74, 78, 81, 86]):
            place(fx, bell(hz(n + 12), 1.4), at + j * .11, .26 * g, -.45 + j * .3)
    elif ty == "sparkle":
        place(fx, sparkle(), at, .3 * g)
    elif ty == "counter":
        place(fx, counter_ticks(), at, .26 * g)
    elif ty == "shutter":
        place(fx, shutter(), at, .32 * g)
    elif ty == "click":
        place(fx, click(), at, .4 * g)
        place(fx, bell(hz(86), 1.4), at + .04, .2 * g)


# ───────────────────────── mix + master ─────────────────────────
# side-chain pump on pads and bass from the kick (gentle, 0.18 s recovery)
kenv = signal.lfilter([1], [1, -np.exp(-1 / (.09 * SR))], side)
kenv = np.clip(kenv / (kenv.max() + 1e-9), 0, 1)
pump = 1 - .38 * kenv
pads *= pump
bass *= 1 - .25 * kenv

pads = reverb(pads, 2.6, .35, 2)
lead = reverb(lead, 2.0, .24, 3)
drums = reverb(drums, .8, .08, 4)
fx = reverb(fx, 1.5, .22, 5)
music = pads + lead * 1.0 + bass * .9

if os.environ.get("STEMS"):
    for name, st in (("music", music), ("drums", drums), ("fx", fx)):
        wavfile.write(out_file.replace(".wav", f"-{name}.wav"), SR, (np.clip(st.T * 6, -1, 1) * 32767).astype(np.int16))

mix = music + drums + fx
# bus glue: gentle soft-clip saturation, then fades
mix = np.tanh(mix * 1.6) / 1.6
fi, fo = int(.25 * SR), int(1.0 * SR)
mix[:, :fi] *= np.linspace(0, 1, fi) ** 2
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2
mix /= np.abs(mix).max() + 1e-9
raw = out_file.replace(".wav", "-raw.wav")
wavfile.write(raw, SR, (mix.T * .9 * 32767).astype(np.int16))
# glue compression + two-pass linear loudness to -14 LUFS (one fixed gain, no pumping)
pre = out_file.replace(".wav", "-glue.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
                "acompressor=threshold=-18dB:ratio=2:attack=25:release=180:knee=6,alimiter=limit=0.92:attack=4:release=60", pre], check=True)
probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.2:LRA=9:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
m = json.loads(probe[probe.rindex("{"):probe.rindex("}") + 1])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", pre, "-af",
                f"loudnorm=I=-14:TP=-1.2:LRA=9:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
                f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
                "-ar", str(SR), out_file], check=True)
os.remove(pre)
print("wrote", out_file)
