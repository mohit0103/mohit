"""Sound design for the motion video.

Every sound is synthesized (no samples). Cue times come from .cache/cues.json, which render.js
exports from the animation timeline, so sounds stay locked to the picture when timings change.
Writes .cache/audio.wav (48 kHz stereo): SFX plus the music bed from config.json.
"""

import json
import subprocess
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
SR = 48000
rng = np.random.default_rng(11)


def t_(d):
	return np.arange(int(d * SR)) / SR


def lowpass(x, cutoff):
	"""One-pole low-pass; cutoff in Hz, may be an array (sweep)."""
	a = 1 - np.exp(-2 * np.pi * np.broadcast_to(cutoff, x.shape) / SR)
	y = np.empty_like(x)
	acc = 0.0
	for i in range(len(x)):
		acc += a[i] * (x[i] - acc)
		y[i] = acc
	return y


def bandnoise(d, lo, hi):
	n = rng.standard_normal(int(d * SR))
	return lowpass(n, hi) - lowpass(n, lo)


def env(n, a, r, curve=2.0):
	e = np.ones(n)
	ai, ri = int(a * SR), int(r * SR)
	if ai:
		e[:ai] = np.linspace(0, 1, ai) ** 1.5
	if ri:
		e[n - ri:] *= np.linspace(1, 0, ri) ** curve
	return e


def sine_sweep(f0, f1, d, shape=1.0):
	t = t_(d)
	f = f0 + (f1 - f0) * (t / d) ** shape
	return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ---------------------------------------------------------------- sound palette
def whoosh(v=1.0):
	d = 0.42 + 0.18 * v
	n = int(d * SR)
	sweep = np.concatenate([np.geomspace(300, 5200, n // 2), np.geomspace(5200, 400, n - n // 2)])
	x = rng.standard_normal(n)
	x = lowpass(x, sweep) - lowpass(x, sweep * 0.18)
	x *= env(n, d * 0.55, d * 0.45)
	pan = np.linspace(-0.7, 0.7, n)
	return stereo(x * 1.5 * v, pan), -d * 0.55


def pop(v=1.0):
	t = t_(0.14)
	f = 520 * v * (1 + 1.2 * np.exp(-t * 55))
	x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)
	return stereo(x * 0.55), 0


def tick(v=1.0):
	t = t_(0.03)
	x = np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 260) + 0.4 * rng.standard_normal(len(t)) * np.exp(-t * 500)
	return stereo(x * 0.35 * v), 0


def typekey(v=1.0):
	t = t_(0.05)
	body = lowpass(rng.standard_normal(len(t)), 3500) * np.exp(-t * 180)
	clk = np.sin(2 * np.pi * (1700 + 500 * v) * t) * np.exp(-t * 400)
	return stereo((body * 0.9 + clk * 0.4) * 0.32, (v - 0.75) * 0.6), 0


def click(v=1.0):
	t = t_(0.06)
	x = np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 160) + 0.6 * np.sin(2 * np.pi * 1200 * t) * np.exp(-t * 90)
	return stereo(x * 0.35 * v), 0


def thud(v=1.0):
	t = t_(0.35)
	x = np.sin(2 * np.pi * np.cumsum(110 * np.exp(-t * 9) + 45) / SR) * np.exp(-t * 11)
	return stereo(x * 0.8 * v), 0


def bubble(v=1.0):
	t = t_(0.22)
	x = sine_sweep(260, 980, 0.22, 0.6) * np.exp(-t * 14) * np.minimum(1, t * 120)
	return stereo(x * 0.5 * v), 0


def swish(v=1.0):
	d = 0.28
	x = bandnoise(d, 2500, 9000) * env(int(d * SR), 0.05, 0.22)
	return stereo(x * 1.4 * v, np.linspace(0.4, -0.4, int(d * SR))), -0.05


def snap(v=1.0):
	t = t_(0.12)
	x = lowpass(rng.standard_normal(len(t)), 6000) * np.exp(-t * 70) + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 35) * 0.8
	return stereo(x * 0.6 * v), 0


def marker(v=1.0):
	d = 0.34
	n = int(d * SR)
	x = rng.standard_normal(n)
	sweep = np.geomspace(800, 4500, n)
	x = (lowpass(x, sweep) - lowpass(x, sweep * 0.4)) * env(n, 0.03, 0.12)
	return stereo(x * 1.6 * v, np.linspace(-0.5, 0.5, n)), 0


def zip_(v=1.0):
	d = 0.55
	n = int(d * SR)
	x = sine_sweep(380, 1500, d, 0.7) * 0.25 + bandnoise(d, 1200, 6000) * 0.8
	x *= env(n, 0.3, 0.2)
	return stereo(x * v, np.linspace(0.6, -0.1, n)), 0


def impact(v=1.0):
	t = t_(0.9)
	boom = np.sin(2 * np.pi * np.cumsum(95 * np.exp(-t * 7) + 38) / SR) * np.exp(-t * 5)
	crack = lowpass(rng.standard_normal(len(t)), 5000) * np.exp(-t * 35)
	return stereo((boom * 0.9 + crack * 0.45) * v), 0


def riser(v=1.0):
	d = 1.0
	t = t_(d)
	x = lowpass(rng.standard_normal(len(t)), np.geomspace(300, 9000, len(t))) * 0.8 + sine_sweep(180, 900, d, 2) * 0.12
	return stereo(x * (t / d) ** 2.2 * v), 0


def slide(v=1.0):
	d = 0.7
	n = int(d * SR)
	x = bandnoise(d, 600, 3000) * env(n, 0.25, 0.4)
	return stereo(x * 0.9 * v, np.linspace(-0.3, 0.5, n)), 0


def shimmer(v=1.0):
	out = np.zeros(int(1.4 * SR))
	for i, f in enumerate([1568, 2093, 2637, 3136]):
		t = t_(1.0)
		s = int(i * 0.07 * SR)
		out[s:s + len(t)] += np.sin(2 * np.pi * f * t) * np.exp(-t * 5) * 0.16
	return stereo(out * v), 0


def swoosh(v=1.0):
	d = 0.9
	n = int(d * SR)
	sweep = np.geomspace(2500, 220, n)
	x = rng.standard_normal(n)
	x = (lowpass(x, sweep) - lowpass(x, sweep * 0.2)) * env(n, 0.2, 0.5)
	return stereo(x * 1.7 * v, np.linspace(0.5, -0.5, n)), -0.15


def ding(v=1.0):
	t = t_(1.8)
	x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in [(1320, 0.5, 2.5), (2640, 0.25, 4), (3960, 0.12, 6), (1980, 0.18, 3)])
	return stereo(x * 0.45 * v), 0


def open_(v=1.0):
	d = 0.5
	n = int(d * SR)
	x = rng.standard_normal(n)
	sweep = np.geomspace(6000, 300, n)
	x = (lowpass(x, sweep) - lowpass(x, sweep * 0.2)) * env(n, 0.01, 0.4)
	return stereo(x * 1.1 + 0 * x), 0


def end(v=1.0):
	t = t_(1.2)
	x = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t * 4) + 35) / SR) * np.exp(-t * 4)
	return stereo(x * 0.7 * v), 0


def stereo(x, pan=0.0):
	pan = np.broadcast_to(pan, x.shape)
	l = x * np.sqrt((1 - pan) / 2) * 1.414
	r = x * np.sqrt((1 + pan) / 2) * 1.414
	return np.stack([l, r], 1)


SOUNDS = {"whoosh": whoosh, "pop": pop, "tick": tick, "type": typekey, "click": click, "thud": thud, "bubble": bubble,
	"swish": swish, "snap": snap, "marker": marker, "zip": zip_, "impact": impact, "riser": riser, "slide": slide,
	"shimmer": shimmer, "swoosh": swoosh, "ding": ding, "open": open_, "end": end}


def place(bus, snd, t):
	s = int(t * SR)
	if s < 0:
		snd, s = snd[-s:], 0
	e = min(len(bus), s + len(snd))
	if e > s:
		bus[s:e] += snd[: e - s]


def load_music(path, start, dur):
	raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-i", str(path), "-t", str(dur), "-f", "f32le",
		"-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
	return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def main():
	info = json.loads((CACHE / "cues.json").read_text())
	cfg = json.loads((HERE / "config.json").read_text())
	dur = info["dur"]
	n = int(dur * SR)
	sfx = np.zeros((n, 2))
	for c in info["cues"]:
		snd, lead = SOUNDS[c["k"]](c["v"])
		place(sfx, snd, c["t"] + lead)
	# a rushing-air bed under the speed tunnel
	d = 2.6
	wind = bandnoise(d, 250, 2200) * env(int(d * SR), 0.25, 0.9) * 0.55
	place(sfx, stereo(wind, np.sin(np.linspace(0, 6, len(wind))) * 0.3), 25.0)

	mix = sfx * 0.9
	if cfg.get("music"):
		m = load_music(HERE.parent / cfg["music"], cfg.get("musicStart", 0), dur)
		m = m[:n]
		e = np.ones(len(m))
		fi, fo = int(0.25 * SR), int(0.7 * SR)
		e[:fi] = np.linspace(0, 1, fi)
		cut = int(32.62 * SR)
		e[cut:] = 0
		e[cut - fo:cut] *= np.linspace(1, 0.25, fo)
		m *= e[:, None] * cfg.get("musicVolume", 0.55)
		# normalise the bed to a steady level before mixing
		rms = np.sqrt(np.mean(m[: cut] ** 2)) + 1e-9
		m *= 0.09 / rms
		mix[: len(m)] += m
	peak = np.max(np.abs(mix))
	if peak > 0.97:
		mix *= 0.97 / peak
	pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
	with wave.open(str(CACHE / "audio.wav"), "wb") as w:
		w.setnchannels(2)
		w.setsampwidth(2)
		w.setframerate(SR)
		w.writeframes(pcm.tobytes())
	print(f"audio: {len(info['cues'])} cues, {dur}s")


if __name__ == "__main__":
	main()
