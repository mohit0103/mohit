"""Original score + sound design for the intro film, synthesized from scratch.

    python3 score.py out/cues.json out/score.wav

The music is an ambient D-major bed that turns rhythmic (100 bpm) for the
gallery, recognition and portrait sections. Every sound effect is placed from
the cue list the composition exports, so audio stays frame-locked to picture.
"""

import json
import subprocess
import sys

import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(11)

cues_file, out_file = sys.argv[1], sys.argv[2]
spec = json.load(open(cues_file))
DUR = spec["duration"] + 0.2
N = int(DUR * SR)
music = np.zeros((2, N))
fx = np.zeros((2, N))

BEAT = 0.6
G0 = 19.4                     # matches the composition's grid anchor
times = {}
for c in spec["cues"]:
    times.setdefault(c["type"], []).append(c["at"])
RECOG = G0 + 17 * BEAT
PORTRAIT = G0 + 27 * BEAT
MONTAGE = G0 + 37 * BEAT
END = MONTAGE + 8 * 0.3
CLOSE = END + 3.8


def hz(n):
    """MIDI note -> Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


def adsr(n, a, r, curve=2.0):
    e = np.ones(n)
    ai, ri = min(n, int(a * SR)), min(n, int(r * SR))
    if ai:
        e[:ai] = np.linspace(0, 1, ai) ** curve
    if ri:
        e[n - ri:] *= np.linspace(1, 0, ri) ** curve
    return e


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2))
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp_sweep(x, f0, f1, q=2.0, block=256):
    """Band-pass with a swept centre frequency (block-wise, state carried)."""
    y = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    fcs = np.geomspace(f0, f1, nb)
    zi = np.zeros(2)
    for i, fc in enumerate(fcs):
        w = fc / (SR / 2)
        bw = w / q
        b, a = signal.butter(1, [max(1e-4, w - bw / 2), min(.999, w + bw / 2)], "band")
        seg = x[i * block:(i + 1) * block]
        out, zi = signal.lfilter(b, a, seg, zi=zi)
        y[i * block:i * block + len(seg)] = out
    return y


def place(buf, clip, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    if clip.ndim == 1:
        l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        clip = np.vstack([clip * l * 1.414, clip * r * 1.414])
    j = min(N, i + clip.shape[1])
    s = max(0, -i)
    buf[:, max(i, 0):j] += clip[:, s:j - i] * gain


def reverb(x, seconds=2.8, mix=0.35, seed=1):
    """Stereo convolution reverb with a synthetic exponentially decaying IR."""
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, x.shape[1] + n - 1))
    for ch in range(2):
        ir = r.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        ir = lp(ir, 6500) * (1 - np.exp(-t * 300))
        ir /= np.sqrt((ir ** 2).sum())
        out[ch] = signal.fftconvolve(x[ch], ir)
    wet = out[:, :x.shape[1]]
    return x * (1 - mix) + wet * mix * 2.2


# ───────────────────────── music ─────────────────────────

def pad_note(f, d, bright=1800, amp=0.06):
    t = tt(d)
    v = np.zeros_like(t)
    for det in (-0.11, 0.0, 0.13):
        ph = rng.uniform(0, 2 * np.pi)
        v += signal.sawtooth(2 * np.pi * f * (1 + det / 100 * 3) * t + ph)
    v = lp(v, bright, 2)
    v += 0.6 * np.sin(2 * np.pi * f * t)         # pure fundamental for warmth
    lfo = 1 + 0.12 * np.sin(2 * np.pi * 0.23 * t + rng.uniform(0, 6))
    return v * lfo * adsr(len(t), min(1.4, d * .4), min(1.6, d * .45)) * amp


def chord(notes, at, d, **kw):
    for k, n in enumerate(notes):
        place(music, pad_note(hz(n), d + 1.2, **kw), at, pan=(-0.5 + k / max(1, len(notes) - 1)) * 0.7)


D, Bm, G, A, Em = (
    [50, 57, 62, 66, 69, 76],      # Dmaj9-ish: D A D F# A E
    [47, 54, 62, 66, 69, 73],      # Bm11
    [43, 50, 59, 62, 66, 69],      # Gmaj7
    [45, 52, 61, 64, 69, 71],      # Asus/add9
    [40, 52, 59, 62, 67, 71],      # Em9
)

# intro drone (lens), with a slow filter opening
t = tt(4.9)
drone = (np.sin(2 * np.pi * hz(38) * t) * .5 + signal.sawtooth(2 * np.pi * hz(45) * t) * .2)
drone = lp(drone, 700) * adsr(len(t), 2.5, .8) * .16
place(music, drone, 0.0)
chord([62, 69, 74, 78], 0.6, 4.2, bright=2400, amp=0.022)

# ambient progression 4.7 → 19.4
prog = [(D, 4.6), (Bm, 8.3), (G, 12.0), (Em, 13.7), (A, 15.9)]
for k, (c, at) in enumerate(prog):
    nxt = prog[k + 1][1] if k + 1 < len(prog) else G0
    chord(c, at, nxt - at, bright=1500 + k * 250, amp=0.05)

# rhythmic section on the 100 bpm grid
loop = [D, Bm, G, A]
bar = 4 * BEAT
k = 0
at = G0
while at < MONTAGE - 0.01:
    c = loop[k % 4]
    bright = 2600 if RECOG <= at < PORTRAIT else 1900
    chord(c, at, bar, bright=bright, amp=0.045 if at < PORTRAIT else 0.032)
    # bass
    tb = tt(bar)
    bass = np.sin(2 * np.pi * hz(c[0] - 12) * tb) * adsr(len(tb), .02, .5, 1.5)
    if at >= G0 + 4 * BEAT and at < PORTRAIT:
        place(music, lp(bass + .3 * signal.sawtooth(2 * np.pi * hz(c[0] - 12) * tb), 400) * .16, at)
    k += 1
    at += bar


def pluck(f, d=1.6, amp=0.1):
    t = tt(d)
    v = sum(np.sin(2 * np.pi * f * h * t) * np.exp(-t * (2.5 + h * 1.8)) / h ** 1.2 for h in range(1, 7))
    return v * adsr(len(t), .002, .3, 1) * amp


def kick(amp=1.0):
    t = tt(.55)
    f = 46 + 110 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * .2
    return (body + click) * amp


def shaker(amp=1.0):
    t = tt(.07)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70) * amp


# arpeggio + groove
arp_order = [2, 3, 4, 5, 4, 3, 2, 4]
step = BEAT / 2
i = 0
at = G0
while at < MONTAGE - 0.01:
    sect_bar = int((at - G0) // bar)
    c = loop[sect_bar % 4]
    beat_i = round((at - G0) / step)
    in_portrait = at >= PORTRAIT
    amp = 0.045 if in_portrait else 0.06
    place(music, pluck(hz(c[arp_order[beat_i % 8]] + 12), amp=amp), at, pan=0.35 * np.sin(beat_i * 0.9))
    if not in_portrait:
        if beat_i % 4 == 0:
            place(music, kick(.42 if at < RECOG else .5), at)
        if at > G0 + 2 * BEAT:
            place(music, shaker(.05 if beat_i % 2 else .028), at, pan=.3)
    at += step

# end card: warm resolve
chord(D, END, CLOSE - END + .5, bright=2000, amp=0.05)
for j, n in enumerate([74, 78, 81, 86]):
    place(music, pluck(hz(n), 2.5, .07), END + 1.2 + j * .6, pan=-.3 + j * .2)
chord([38, 50, 57, 62, 66], CLOSE + .7, DUR - CLOSE - .7, bright=900, amp=0.05)

music = reverb(music, 3.2, .42, seed=2)

# ───────────────────────── sound design ─────────────────────────

def whoosh(d=0.6, f0=300, f1=3200):
    t = tt(d)
    x = bp_sweep(rng.standard_normal(len(t)), f0, f1, q=1.6)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2.2
    return x * env * 1.4


def swish(d=0.32):
    return whoosh(d, 900, 6000) * .8


def boom(d=2.6):
    t = tt(d)
    f = 34 + 40 * np.exp(-t * 5)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    noise = lp(rng.standard_normal(len(t)), 260) * np.exp(-t * 4) * .9
    crack = bp_sweep(rng.standard_normal(len(t)), 2400, 500, 1.2) * np.exp(-t * 18) * .5
    return (sub + noise + crack) * adsr(len(t), .004, .6, 1)


def shutter():
    out = np.zeros(int(.25 * SR))
    for off, g, fc in ((0, 1.0, 2500), (.072, .8, 3400)):
        t = tt(.03)
        c = hp(rng.standard_normal(len(t)), fc) * np.exp(-t * 260) * g
        th = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 140) * .5 * g
        i = int(off * SR)
        out[i:i + len(t)] += c + th
    return out * .9


def tick():
    t = tt(.03)
    return (np.sin(2 * np.pi * 2600 * t) * .4 + hp(rng.standard_normal(len(t)), 5000) * .3) * np.exp(-t * 200)


def ping(f=1318.5):
    t = tt(2.2)
    return sum(np.sin(2 * np.pi * f * m * t) * np.exp(-t * (1.8 + m)) / m for m in (1, 2.76, 5.4)) * .25


def shimmer():
    out = np.zeros(int(2.8 * SR))
    for j, n in enumerate([86, 90, 93, 98, 93, 90]):
        t = tt(1.6)
        v = np.sin(2 * np.pi * hz(n) * t) * np.exp(-t * 3) * .08
        i = int(j * .12 * SR)
        out[i:i + len(t)] += v
    return out


def swell(d=1.8):
    t = tt(d)
    x = bp_sweep(rng.standard_normal(len(t)), 200, 1800, 1.0) * .5
    tone = sum(np.sin(2 * np.pi * hz(n) * t) for n in (62, 69, 74)) * .12
    return (x + tone) * (t / d) ** 2.5 * adsr(len(t), 0, .15)


def riser(d=1.2):
    t = tt(d)
    x = bp_sweep(rng.standard_normal(len(t)), 300, 7000, 2.0)
    tone = np.sin(2 * np.pi * np.cumsum(220 + 900 * (t / d) ** 2) / SR) * .25
    return (x + tone) * (t / d) ** 2.4 * 1.1


def reverse_cym(d=0.8):
    t = tt(d)
    x = hp(rng.standard_normal(len(t)), 4500) * np.exp(-t * 5)
    return x[::-1] * .6


def drop(d=1.0):
    t = tt(d)
    f = 520 * np.exp(-t * 2.2) + 60
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.5) * .35


def hit():
    t = tt(.5)
    snare = bp_sweep(rng.standard_normal(len(t)), 3000, 1200, 1.0) * np.exp(-t * 22) * .9
    return kick(1.0)[:len(t)] + snare


def odometer(d=1.4):
    out = np.zeros(int((d + .1) * SR))
    tk = 0.0
    while tk < d:
        p = tk / d
        rate = 26 * (1 - p) ** 1.6 + 4
        i = int(tk * SR)
        c = tick() * .7
        out[i:i + len(c)] += c[:len(out) - i]
        tk += 1 / rate
    return out


SFX = {
    "tick": lambda: tick(), "whoosh": lambda: whoosh(), "swish": lambda: swish(), "boom": lambda: boom(),
    "shutter": lambda: shutter(), "ping": lambda: ping(), "shimmer": lambda: shimmer(), "swell": lambda: swell(),
    "riser": lambda: riser(), "reverse": lambda: reverse_cym(), "drop": lambda: drop(), "hit": lambda: hit(),
    "odometer": lambda: odometer(), "pluck": lambda: pluck(hz(81), 1.4, .12),
}
LEAD = {"whoosh": .3, "swish": .16, "swell": 1.8, "riser": 1.2, "reverse": .8}   # sounds that build *into* the cue
GAIN = {"tick": .35, "whoosh": .35, "swish": .3, "boom": 1.0, "shutter": .7, "ping": .6, "shimmer": .9,
        "swell": .5, "riser": .45, "reverse": .5, "drop": .6, "hit": .7, "odometer": .4, "pluck": .9}
for c in spec["cues"]:
    typ = c["type"]
    clip = SFX[typ]()
    at = c["at"] - LEAD.get(typ, 0)
    pan = float(rng.uniform(-.25, .25)) if typ in ("tick", "swish", "pluck") else 0.0
    place(fx, clip, at, GAIN[typ] * c["gain"], pan)

fx = reverb(fx, 1.8, .22, seed=5)

# duck the music under the big hits
duck = np.ones(N)
for at in times.get("boom", []) + times.get("hit", []):
    i = int(at * SR)
    n = int(.5 * SR)
    j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], 1 - .45 * np.exp(-np.arange(j - i) / SR * 6))
mix = music * duck + fx

# fades
fade_in = int(.05 * SR)
mix[:, :fade_in] *= np.linspace(0, 1, fade_in)
fo = int(1.4 * SR)
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2
mix /= np.abs(mix).max() + 1e-9
mix *= .9

raw = out_file.replace(".wav", "-raw.wav")
from scipy.io import wavfile
wavfile.write(raw, SR, (mix.T * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
                "acompressor=threshold=-16dB:ratio=2:attack=10:release=200,loudnorm=I=-14:TP=-1.0:LRA=14",
                "-ar", str(SR), out_file], check=True)
print("wrote", out_file)
