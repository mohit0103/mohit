"""Soft score + subtle UI-style sound design for the 9:16 reel, synthesized from scratch.

    python3 reel_score.py out/reel-cues.json out/reel-score.wav

Warm D-major felt-piano plucks over a pad (tempo from the cue file), a gentle kick and shaker
only where the carousel and grid move, and quiet micro-sounds (picker ticks,
taps, bells) placed from the composition's cue list. No whooshes or booms.
"""

import json
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
rng = np.random.default_rng(5)
spec = json.load(open(sys.argv[1]))
out_file = sys.argv[2]
DUR = spec["duration"] + .2
N = int(DUR * SR)
SEC = spec["sections"]
BEAT = 60 / (spec.get("bpm") or 100)
G0 = spec.get("grid0") or 0.0               # phase of the beat grid
music = np.zeros((2, N))
drums = np.zeros((2, N))
fx = np.zeros((2, N))


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


def place(buf, clip, at, gain=1.0, pan=0.0):
    i = int(round(at * SR))
    if clip.ndim == 1:
        l, r = np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414
        clip = np.vstack([clip * l, clip * r])
    s = max(0, -i)
    j = min(N, i + clip.shape[1])
    if j > max(i, 0):
        buf[:, max(i, 0):j] += clip[:, s:s + j - max(i, 0)] * gain


def reverb(x, sec=2.0, mix=.3, seed=1):
    r = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = lp(r.standard_normal(n), 6000) * np.exp(-t * 6.9 / sec) * (1 - np.exp(-t * 300))
        ir /= np.sqrt((ir ** 2).sum())
        out[ch] = signal.fftconvolve(x[ch], ir)[:x.shape[1]]
    return x * (1 - mix) + out * mix * 2


def steps(a, b, step):
    t = G0 + np.ceil((a - G0) / step - 1e-6) * step    # stay on the one global beat grid
    while t < b - 1e-6:
        yield t
        t += step


# ───────────────────────── music ─────────────────────────
CH = [[50, 57, 61, 64, 66, 69], [47, 54, 57, 62, 66, 69], [43, 50, 54, 59, 62, 66], [45, 52, 57, 61, 64, 66]]   # Dmaj7 Bm7 Gmaj7 A6
BAR = 4 * BEAT


def chord_at(t):
    return CH[int((t - G0) // BAR) % 4]


def felt(f, d=1.6, amp=.08):
    """Soft felt-piano-like note: mellow partials, gentle decay."""
    t = tt(d)
    v = sum(np.sin(2 * np.pi * f * h * t + h) * np.exp(-t * (1.6 + h * 1.4)) / h ** 1.6 for h in range(1, 6))
    thump = lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 60) * .04
    return (v + thump) * env(len(t), .008, .4, 1.5) * amp


def pad(chord, at, d, amp=.018, cutoff=1400):
    for k, n in enumerate(chord[1:]):
        t = tt(d + 1.0)
        v = sum(signal.sawtooth(2 * np.pi * hz(n) * (1 + x / 100) * t + rng.uniform(0, 6)) for x in (-.07, .08))
        v = lp(v, cutoff, 2) * env(len(t), .8, 1.0, 1.5) * amp
        place(music, v, at, pan=-.6 + k * .3)


for t in steps(0, DUR - .5, BAR):
    full = SEC["full"][0] <= t < SEC["full"][1]
    pad(chord_at(t), t, BAR, .022 if full else .016, 1900 if full else 1300)

# piano arpeggio in eighths, thinned out in the quiet sections
ARP = [1, 3, 2, 4, 3, 5, 4, 2]
for i, t in enumerate(steps(SEC["intro"][1] - BEAT, DUR - 1.2, BEAT / 2)):
    quiet = SEC["portrait"][0] <= t < SEC["portrait"][1] or SEC["end"][0] <= t
    if quiet and i % 2:
        continue
    c = chord_at(t)
    place(music, felt(hz(c[ARP[i % 8]] + 12), amp=.06 if quiet else .07), t, pan=.35 * np.sin(i * .8))
# bass on each bar
for t in steps(0, DUR - 1, BAR):
    tb = tt(BAR + .5)                                   # notes overlap so the bass never drops out between bars
    place(music, np.sin(2 * np.pi * hz(chord_at(t)[0] - 12) * tb) * env(len(tb), .12, .6, 1.2) * .06, t)


# ───────────────────────── gentle groove ─────────────────────────
def kick(g=1.0):
    t = tt(.35)
    f = 48 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10) * g


def shaker(g=1.0):
    t = tt(.06)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 60) * g


def snap(g=1.0):
    t = tt(.12)
    return lp(hp(rng.standard_normal(len(t)), 1200), 5000) * np.exp(-t * 45) * g


# One continuous groove over the whole piece. Density follows a smooth curve
# instead of starting and stopping per section, so nothing ever jumps.
_K = [(0, 0), (1.2, 0), (1.7, 1), (5.6, 1), (6.1, .3), (7.6, .3), (8.0, 1), (13.4, 1), (13.9, .45), (15.6, .45), (16.4, .12), (DUR, 0)]
def groove(t):
    xs, ys = zip(*_K)
    return float(np.interp(t, xs, ys))


for i, t in enumerate(steps(0, DUR - .4, BEAT)):
    g = groove(t)
    if g <= .01:
        continue
    place(drums, kick((.32 if i % 2 == 0 else .2) * g), t)
    if SEC["google"][0] <= t < SEC["google"][1] and i % 2:     # backbeat lifts the Google section
        place(drums, snap(.16), t, pan=-.15)
for i, t in enumerate(steps(0, DUR - .4, BEAT / 2)):
    g = groove(t)
    if g > .2:
        place(drums, shaker((.05 if i % 2 else .028) * g), t, pan=.3)


# ───────────────────────── micro sound design ─────────────────────────
def tick():                                   # iOS picker detent
    t = tt(.018)
    return (np.sin(2 * np.pi * 2900 * t) * .5 + hp(rng.standard_normal(len(t)), 5000) * .25) * np.exp(-t * 300)


def tap():                                    # soft wooden tock
    t = tt(.18)
    return (np.sin(2 * np.pi * 210 * t) * np.exp(-t * 32) + np.sin(2 * np.pi * 620 * t) * np.exp(-t * 60) * .25) * .8


def bell(f=1760.0, d=1.6):
    t = tt(d)
    return sum(np.sin(2 * np.pi * f * m * t) * np.exp(-t * (3 + m * 1.6)) / m ** 1.3 for m in (1, 2.0, 3.0)) * .16


def pebble():
    t = tt(.06)
    f = rng.uniform(1100, 1900) * (1 + .5 * np.exp(-t * 80))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 70) * .35


def shutter():
    o = np.zeros(int(.14 * SR))
    for off, g in ((0, 1.0), (.055, .7)):
        t = tt(.025)
        c = lp(hp(rng.standard_normal(len(t)), 1500), 6000) * np.exp(-t * 260) * g
        i = int(off * SR)
        o[i:i + len(t)] += c
    return o * .7


def bloom(d=1.6):                             # warm landing: low chord + bell, no hard transient
    t = tt(d)
    low = sum(np.sin(2 * np.pi * hz(n) * t) for n in (38, 45, 50)) * .18
    return low * env(len(t), .02, 1.2, 1.5) * np.exp(-t * 1.2) + bell(hz(86), d) * .8


def sparkle():
    o = np.zeros(int(1.8 * SR))
    for j, n in enumerate([86, 90, 93, 98, 102, 105]):
        b_ = bell(hz(n), 1.0) * (.5 + j * .06)
        i = int(j * .06 * SR)
        o[i:i + len(b_)] += b_
    return o


def detent():                                 # lens-ring click: crisp transient + tiny metallic ring
    t = tt(.05)
    body = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 420)
    ring = np.sin(2 * np.pi * 4100 * t) * np.exp(-t * 140) * .25 + np.sin(2 * np.pi * 2650 * t) * np.exp(-t * 180) * .18
    return (body * .7 + ring) * .9


def grains(d, density, lo, hi, decay):
    """Sparse crackle: tiny filtered impulses, the texture of paper and card."""
    n = int(d * SR)
    x = np.zeros(n)
    k = int(density * d)
    idx = rng.integers(0, n, k)
    x[idx] = rng.uniform(-1, 1, k) * rng.uniform(.3, 1, k)
    b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x) * decay


def slide(d=.2):                              # card gliding over paper: grainy friction, no air
    t = tt(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.2
    tex = grains(d, 2600, 1800, 7000, e) * 2.2
    hush = lp(hp(rng.standard_normal(len(t)), 3000), 8000) * e * .05
    return tex + hush


def pat():                                    # card landing on a felt table
    t = tt(.12)
    thud = np.sin(2 * np.pi * 150 * t) * np.exp(-t * 55) * .6
    paper = lp(hp(rng.standard_normal(len(t)), 900), 4500) * np.exp(-t * 90) * .5
    return thud + paper


def riffle(d=.34, n=11):                      # flicking through the edges of a stack
    o = np.zeros(int((d + .05) * SR))
    for j in range(n):
        f = grains(.03, 9000, 2500, 9000, np.exp(-tt(.03) * 120)) * 1.6
        i = int(d * (j / n) ** 1.15 * SR)
        o[i:i + len(f)] += f
    return o


def ratchet(d=.6, n=9):                       # focus ring turning faster into the moment
    o = np.zeros(int((d + .06) * SR))
    for j in range(n):
        tj = d * (1 - (1 - j / n) ** 1.8)
        c = detent() * (.45 + .55 * j / n)
        i = int(tj * SR)
        o[i:i + len(c)] += c[:len(o) - i]
    return o


def click():
    t = tt(.04)
    return (np.sin(2 * np.pi * 1800 * t) * .6 + hp(rng.standard_normal(len(t)), 4000) * .2) * np.exp(-t * 160)


def counter(d=.75):
    o = np.zeros(int((d + .05) * SR))
    k = 0.0
    while k < d:
        c = tick() * .6
        i = int(k * SR)
        o[i:i + len(c)] += c[:len(o) - i]
        k += 1 / (26 * (1 - k / d) ** 1.4 + 5)
    return o


for c in spec["cues"]:
    ty, at, g = c["type"], c["at"], c["gain"]
    pan = float(rng.uniform(-.25, .25))
    if ty == "tick":
        place(fx, tick(), at, .32 * g, pan)
    elif ty == "tap":
        place(fx, tap(), at, .3 * g)
    elif ty == "bell":
        place(fx, bell(hz(rng.choice([86, 88, 90, 93]))), at, .3 * g, pan)
    elif ty == "pebble":
        place(fx, pebble(), at, .25 * g, float(rng.uniform(-.6, .6)))
    elif ty == "gdraw":
        for j, n in enumerate([74, 78, 81, 86]):
            place(fx, bell(hz(n + 12), 1.4), at + j * .11, .28 * g, -.45 + j * .3)
    elif ty == "counter":
        place(fx, counter(), at, .3 * g)
    elif ty == "shutter":
        place(fx, shutter(), at, .35 * g)
    elif ty == "detent":
        place(fx, detent(), at, .3 * g, pan)
    elif ty == "slide":
        place(fx, slide(), at - .04, .32 * g, pan)
    elif ty == "pat":
        place(fx, pat(), at, .38 * g, float(rng.uniform(-.35, .35)))
    elif ty == "riffle":
        place(fx, riffle(), at, .4 * g)
    elif ty == "ratchet":
        place(fx, ratchet(), at - .62, .32 * g)
    elif ty == "bloom":
        place(fx, bloom(), at, .55 * g)
    elif ty == "sparkle":
        place(fx, sparkle(), at, .35 * g, float(rng.uniform(-.2, .2)))
    elif ty == "click":
        place(fx, click(), at, .4 * g)
        place(fx, bell(hz(93), 1.2), at + .05, .22 * g)

music = reverb(music, 2.8, .38, 2)
drums = reverb(drums, .9, .1, 3)
fx = reverb(fx, 1.6, .28, 4)

mix = music + drums * .9 + fx
fi, fo = int(.3 * SR), int(1.2 * SR)
mix[:, :fi] *= np.linspace(0, 1, fi) ** 2
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2
mix /= np.abs(mix).max() + 1e-9
raw = out_file.replace(".wav", "-raw.wav")
wavfile.write(raw, SR, (mix.T * .9 * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
                "acompressor=threshold=-20dB:ratio=1.8:attack=20:release=250,loudnorm=I=-15:TP=-1.5:LRA=11",
                "-ar", str(SR), out_file], check=True)
print("wrote", out_file)
