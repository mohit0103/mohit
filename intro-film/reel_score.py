"""Trailer score + heavy sound design for the 9:16 reel, synthesized from scratch.

    python3 reel_score.py out/reel-cues.json out/reel-score.wav

120 bpm, D minor. Sections and every SFX hit come from the cue file the
composition exports, so picture and sound stay frame-locked.
"""

import json
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
rng = np.random.default_rng(23)
spec = json.load(open(sys.argv[1]))
out_file = sys.argv[2]
DUR = spec["duration"] + .1
N = int(DUR * SR)
SEC = spec["sections"]
BEAT = .5
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


def sweep(x, f0, f1, q=1.6, block=256, curve=None):
    y = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    k = np.linspace(0, 1, nb) if curve is None else curve(np.linspace(0, 1, nb))
    fcs = f0 * (f1 / f0) ** k
    zi = np.zeros(2)
    for i, fc in enumerate(fcs):
        w = fc / (SR / 2)
        bw = w / q
        b, a = signal.butter(1, [max(1e-4, w - bw / 2), min(.995, w + bw / 2)], "band")
        seg = x[i * block:(i + 1) * block]
        o, zi = signal.lfilter(b, a, seg, zi=zi)
        y[i * block:i * block + len(seg)] = o
    return y


def place(buf, clip, at, gain=1.0, pan=0.0):
    i = int(round(at * SR))
    if clip.ndim == 1:
        if np.ndim(pan) == 0:
            pan = np.full(len(clip), pan)
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
        ir = lp(r.standard_normal(n), 7000) * np.exp(-t * 6.9 / sec) * (1 - np.exp(-t * 400))
        ir /= np.sqrt((ir ** 2).sum())
        out[ch] = signal.fftconvolve(x[ch], ir)[:x.shape[1]]
    return x * (1 - mix) + out * mix * 2


def sat(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


def inside(t, name):
    a, b = SEC[name]
    return a <= t < b


# ───────────────────────── drums ─────────────────────────

def kick(g=1.0, d=.42):
    t = tt(d)
    f = 44 + 150 * np.exp(-t * 38)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 400) * .35
    return sat(body * 1.3 + click, 1.5) * g


def clap(g=1.0):
    t = tt(.35)
    n = sweep(rng.standard_normal(len(t)), 1500, 1100, 1.2)
    e = np.zeros(len(t))
    for o in (0, .011, .022):
        i = int(o * SR)
        e[i:] += np.exp(-(t[:len(t) - i]) * 60)
    tail = np.exp(-t * 14) * .5
    return n * (e + tail) * 1.8 * g


def hat(g=1.0, open_=False):
    t = tt(.3 if open_ else .05)
    x = hp(rng.standard_normal(len(t)), 8000)
    x += hp(sum(signal.square(2 * np.pi * f * t) for f in (3150, 4800, 6700)) * .1, 7000)
    return x * np.exp(-t * (9 if open_ else 90)) * g * .5


def snare(g=1.0):
    t = tt(.25)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    n = sweep(rng.standard_normal(len(t)), 5000, 1800, 1.0) * np.exp(-t * 20)
    return (tone * .6 + n * 1.4) * g


def tom(f=90, g=1.0):
    t = tt(.6)
    ff = f * (1 + .6 * np.exp(-t * 20))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 6) * g


def steps(a, b, step):
    t = a
    while t < b - 1e-6:
        yield t
        t += step


kicks = []
# four on the floor through the montages and bands
for name in ("m1", "bands", "m2"):
    a, b = SEC[name]
    for t in steps(a, b, BEAT):
        place(drums, kick(.9), t)
        kicks.append(t)
    for i, t in enumerate(steps(a, b, BEAT / 4)):
        acc = .55 if i % 4 == 2 else .25
        place(drums, hat(acc), t, pan=.35)
    if name != "m1":
        for t in steps(a + BEAT, b, 2 * BEAT):
            place(drums, clap(.55), t, pan=-.1)
            place(drums, snare(.35), t)
    if name == "m2":
        for t in steps(a + BEAT / 2, b, BEAT):
            place(drums, hat(.3, True), t, pan=-.3)
# snare roll into the drop (11 → 12): eighths, sixteenths, thirty-seconds
a = SEC["m2"][1] - 1.0
for t, st in ((a, .125),):
    tt_ = a
    while tt_ < a + 1.0 - 1e-6:
        p = (tt_ - a)
        stp = .125 if p < .5 else (.0625 if p < .8 else .03125)
        place(drums, snare(.25 + .6 * p), tt_, pan=.1 * np.sin(tt_ * 40))
        tt_ += stp
# half-time heartbeat in the portrait
a, b = SEC["portrait"]
for t in steps(a + .5, b - .3, 2 * BEAT):
    place(drums, kick(.55), t)
    place(drums, kick(.35), t + .25)
# tension ticks in the intro / break / recognition
for name in ("intro", "brk", "recog"):
    a, b = SEC[name]
    for i, t in enumerate(steps(a, b, BEAT / 4)):
        place(drums, hat(.18 if i % 4 else .32), t, pan=.5 * (-1) ** i)

# ───────────────────────── music ─────────────────────────
CH = {"Dm": [38, 50, 57, 62, 65, 69], "Bb": [34, 46, 53, 58, 62, 65], "F": [41, 48, 53, 57, 60, 65], "C": [36, 48, 55, 60, 64, 67]}
PROG = ["Dm", "Bb", "F", "C"]
BAR = 4 * BEAT


def saw_voice(f, d, cutoff=2000, amp=.05, a=.005, r=.12, det=(-.08, 0, .09)):
    t = tt(d)
    v = sum(signal.sawtooth(2 * np.pi * f * (1 + x / 100) * t + rng.uniform(0, 6)) for x in det)
    return lp(v, cutoff, 2) * env(len(t), a, r, 1.5) * amp


def pad(chord, at, d, cutoff=1200, amp=.035):
    for k, n in enumerate(chord[1:]):
        place(music, saw_voice(hz(n), d + .8, cutoff, amp, a=.4, r=.8), at, pan=-.6 + k * .3)


def chord_at(t):
    return CH[PROG[int(((t - 1.0) // BAR)) % 4]]


# pads everywhere except the hard silence after the drop
for t in steps(0, DUR - BAR, BAR):
    if SEC["recog"][0] <= t < SEC["recog"][0] + .2:
        continue
    pad(chord_at(t), t, BAR, 900 if t < SEC["m1"][0] or inside(t, "brk") else 1500, .03)

# octave-pulse bass (8ths) + chord stabs (16ths, gated)
for name in ("m1", "bands", "m2"):
    a, b = SEC[name]
    for i, t in enumerate(steps(a, b, BEAT / 2)):
        root = chord_at(t)[0]
        n = root if i % 2 == 0 else root + 12
        place(music, saw_voice(hz(n), .22, 700, .11, r=.08), t)
    for i, t in enumerate(steps(a, b, BEAT / 4)):
        if i % 16 in (0, 3, 6, 10, 12, 14):
            c = chord_at(t)
            for k, n in enumerate(c[2:]):
                place(music, saw_voice(hz(n + 12), .12, 3200 if name == "m2" else 2400, .03, r=.05), t, pan=-.4 + k * .27)

# portrait: soft pluck arpeggio
def pluck(f, d=1.0, amp=.06):
    t = tt(d)
    v = sum(np.sin(2 * np.pi * f * h * t) * np.exp(-t * (3 + h * 2)) / h ** 1.2 for h in range(1, 6))
    return v * env(len(t), .002, .2, 1) * amp


a, b = SEC["portrait"]
for i, t in enumerate(steps(a + .1, b - .2, BEAT / 4)):
    c = chord_at(t)
    place(music, pluck(hz(c[2 + (i % 4)] + 12)), t, pan=.4 * np.sin(i))

# ───────────────────────── sound design ─────────────────────────

def whoosh(d=.45, f0=250, f1=4000, g=1.0):
    t = tt(d)
    x = sweep(rng.standard_normal(len(t)), f0, f1, 1.4)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2.5
    return x * e * 2.2 * g


def pan_sweep(n, a=-.8, b=.8):
    return np.linspace(a, b, n)


def boom(d=2.2, g=1.0):
    t = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(30 + 55 * np.exp(-t * 6)) / SR) * np.exp(-t * 1.8)
    body = lp(rng.standard_normal(len(t)), 300) * np.exp(-t * 5)
    crack = sweep(rng.standard_normal(len(t)), 3000, 400, 1.0) * np.exp(-t * 16) * .6
    return sat(sub * 1.2 + body + crack, 1.4) * env(len(t), .002, .5, 1) * g


def braam(d=1.8):
    t = tt(d)
    v = np.zeros(len(t))
    for n, g in ((26, 1.0), (38, .8), (45, .5), (50, .35)):
        for det in (-.15, .12):
            v += signal.sawtooth(2 * np.pi * hz(n) * (1 + det / 100) * t) * g
    cutoff = 200 + 1600 * np.exp(-t * 2.2)
    out = np.zeros_like(v)
    blk = 512
    zi = np.zeros(2)
    for i in range(0, len(v), blk):
        b, a = signal.butter(2, cutoff[i] / (SR / 2))
        o, zi = signal.lfilter(b, a, v[i:i + blk], zi=zi * 1)
        out[i:i + blk] = o
    return sat(out * .5, 2.2) * env(len(t), .01, .8, 1.5) * .9


def shutter():
    o = np.zeros(int(.2 * SR))
    for off, g, fc in ((0, 1.0, 2400), (.06, .8, 3600)):
        t = tt(.035)
        c = hp(rng.standard_normal(len(t)), fc) * np.exp(-t * 240) * g + np.sin(2 * np.pi * 160 * t) * np.exp(-t * 120) * .6 * g
        i = int(off * SR)
        o[i:i + len(t)] += c
    return o


def tick(f=2400):
    t = tt(.025)
    return (np.sin(2 * np.pi * f * t) * .5 + hp(rng.standard_normal(len(t)), 6000) * .4) * np.exp(-t * 220)


def type_burst(d=.4, rate=38):
    o = np.zeros(int((d + .05) * SR))
    k = 0.0
    while k < d:
        c = tick(rng.uniform(1800, 4200)) * rng.uniform(.4, 1)
        i = int(k * SR)
        o[i:i + len(c)] += c[:len(o) - i]
        k += 1 / rate * rng.uniform(.6, 1.4)
    return o


def glitch(d=.22):
    t = tt(d)
    o = np.zeros(len(t))
    k = 0
    while k < len(t):
        n = int(rng.uniform(.008, .03) * SR)
        kind = rng.integers(3)
        seg = t[:min(n, len(t) - k)]
        if kind == 0:
            s = signal.square(2 * np.pi * rng.uniform(200, 2000) * seg) * .5
        elif kind == 1:
            s = np.round(rng.standard_normal(len(seg)) * 3) / 3
        else:
            s = np.sin(2 * np.pi * rng.uniform(3000, 8000) * seg) * .6
        o[k:k + len(seg)] = s
        k += n + int(rng.uniform(0, .01) * SR)
    return hp(o, 300) * .8


def flash_snap():
    t = tt(.5)
    whine = np.sin(2 * np.pi * np.cumsum(2500 + 5000 * (t / .5)) / SR) * .08
    whine = whine[::-1] * np.linspace(0, 1, len(t)) ** 3          # charging whine rising into the snap
    snap = np.zeros(int(.6 * SR))
    st = tt(.6)
    snap += hp(rng.standard_normal(len(st)), 2000) * np.exp(-st * 50) * .9
    snap += kick(1.0, .6)[:len(st)] * .8
    out = np.zeros(int(1.1 * SR))
    out[:len(t)] += whine
    out[len(t) - 1:len(t) - 1 + len(snap)] += snap
    return out, .5


def hit():
    n = int(.45 * SR)
    o = kick(1.0, .45)[:n].copy()
    sn = snare(.7)
    o[:len(sn)] += sn
    o += tom(70, .5)[:n]
    return sat(o, 1.3)


def strobe(g=1.0):
    t = tt(.18)
    metal = sum(np.sin(2 * np.pi * f * t) for f in (1720, 2630, 3910)) * np.exp(-t * 40) * .15
    return (kick(.8, .18) + metal + hp(rng.standard_normal(len(t)), 5000) * np.exp(-t * 60) * .4) * g


def riser(d=1.0):
    t = tt(d)
    x = sweep(rng.standard_normal(len(t)), 300, 9000, 2.0)
    tone = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 3 * (t / d) ** 2)) / SR) for f in (220, 331)) * .15
    return (x + tone) * (t / d) ** 2.6 * 1.3


def reverse(d=.7):
    t = tt(d)
    return (hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 5))[::-1] * .7


def drop(d=1.6):
    t = tt(d)
    return np.sin(2 * np.pi * np.cumsum(45 * np.exp(-t * 1.2) + 18) / SR) * env(len(t), .005, .6) * 1.1


def zoom(d=.32):
    t = tt(d)
    x = sweep(rng.standard_normal(len(t)), 400, 7000, 1.6, curve=lambda k: k ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(300 + 2500 * (t / d) ** 3) / SR) * .25
    return (x * 1.6 + tone) * (t / d) ** 2


def counter(d=.7):
    o = np.zeros(int((d + .05) * SR))
    k = 0.0
    while k < d:
        p = k / d
        c = tick(3000) * .8
        i = int(k * SR)
        o[i:i + len(c)] += c[:len(o) - i]
        k += 1 / (40 * (1 - p) ** 1.5 + 5)
    return o


def pop():
    t = tt(.12)
    f = 900 * (1 + 1.2 * np.exp(-t * 70))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35) * .5


for c in spec["cues"]:
    ty, at, g = c["type"], c["at"], c["gain"]
    if ty == "whoosh":
        w = whoosh(.42)
        place(fx, w, at - .24, .55 * g, pan_sweep(len(w), *(rng.choice([-1, 1]) * np.array([-.8, .8]))))
    elif ty == "swish":
        w = whoosh(.26, 900, 7000)
        place(fx, w, at - .14, .45 * g, pan_sweep(len(w), .7, -.7))
    elif ty == "zoom":
        z = zoom()
        place(fx, z, at - .3, .55 * g)
        place(fx, boom(.8, .5), at, .5 * g)
    elif ty == "stripes":
        for k in range(6):
            place(fx, tick(1500 + 300 * k), at - .08 + k * .04, .5 * g, -.7 + k * .28)
        w = whoosh(.3, 600, 5000)
        place(fx, w, at - .1, .35 * g)
    elif ty == "flash":
        f, lead = flash_snap()
        place(fx, f, at - lead, .65 * g)
    elif ty == "glitch":
        place(fx, glitch(), at - .06, .4 * g, float(rng.uniform(-.4, .4)))
        place(fx, kick(.8), at, .5 * g)
    elif ty == "hit":
        place(fx, hit(), at, .45 * g)
    elif ty == "strobe":
        place(fx, strobe(), at, .45 * g, float(rng.uniform(-.3, .3)))
    elif ty == "tick":
        place(fx, tick(), at, .35 * g)
    elif ty == "shutter":
        place(fx, shutter(), at, .7 * g)
    elif ty == "boom":
        place(fx, boom(), at, .75 * g)
    elif ty == "braam":
        place(fx, braam(), at, .7 * g)
    elif ty == "drop":
        place(fx, drop(), at, .7 * g)
    elif ty == "riser":
        d = min(1.0, at)
        place(fx, riser(d), at - d, .4 * g)
    elif ty == "reverse":
        place(fx, reverse(), at - .7, .55 * g)
    elif ty == "type":
        place(fx, type_burst(), at, .3 * g, float(rng.uniform(-.3, .3)))
    elif ty == "counter":
        place(fx, counter(), at, .4 * g)
    elif ty == "pop":
        place(fx, pop(), at, .6 * g, float(rng.uniform(-.5, .5)))

music = reverb(music, 2.4, .35, 2)
drums = reverb(drums, 1.0, .12, 3)
fx = reverb(fx, 1.6, .2, 4)

# side-chain: music pumps against every kick; everything ducks under booms/braams
pump = np.ones(N)
for k in kicks:
    i = int(k * SR)
    n = int(.3 * SR)
    j = min(N, i + n)
    pump[i:j] = np.minimum(pump[i:j], 1 - .55 * np.exp(-np.arange(j - i) / SR * 14))
duck = np.ones(N)
for c in spec["cues"]:
    if c["type"] in ("boom", "braam", "flash", "drop"):
        i = int(c["at"] * SR)
        j = min(N, i + int(.6 * SR))
        duck[i:j] = np.minimum(duck[i:j], 1 - .4 * np.exp(-np.arange(j - i) / SR * 5))
# hard silence of the music bed after the drop (recognition opens on near-nothing)
a = SEC["recog"][0]
gate = np.ones(N)
i0 = int(a * SR)
i1 = int((a + .9) * SR)
gate[i0:i1] = np.linspace(.15, 1, i1 - i0) ** 2

mix = (music * pump * gate + drums * gate * 1.0) * duck + fx
mix[:, -int(.6 * SR):] *= np.linspace(1, 0, int(.6 * SR)) ** 2
mix /= np.abs(mix).max() + 1e-9
raw = out_file.replace(".wav", "-raw.wav")
wavfile.write(raw, SR, (mix.T * .9 * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
                "acompressor=threshold=-14dB:ratio=3:attack=5:release=120,alimiter=limit=0.89,loudnorm=I=-11:TP=-1.0:LRA=9",
                "-ar", str(SR), out_file], check=True)
print("wrote", out_file)
