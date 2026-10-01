"""Small synthesized sound effects and a soft music bed (no copyrighted audio)."""

import numpy as np

SR = 24000
rng = np.random.default_rng(3)


def _env(n, attack, release):
	e = np.ones(n)
	a, r = int(attack * SR), int(release * SR)
	e[:a] = np.linspace(0, 1, a) if a else 1
	e[n - r :] *= np.linspace(1, 0, r) ** 2 if r else 1
	return e


def _lowpass(x, alpha):
	"""One-pole low-pass; alpha can be an array (sweeping filter)."""
	y = np.empty_like(x)
	acc = 0.0
	alpha = np.broadcast_to(alpha, x.shape)
	for i in range(len(x)):
		acc += alpha[i] * (x[i] - acc)
		y[i] = acc
	return y


def whoosh(d=0.45):
	n = int(d * SR)
	noise = rng.standard_normal(n)
	sweep = np.concatenate([np.linspace(0.02, 0.35, n // 2), np.linspace(0.35, 0.02, n - n // 2)])
	x = _lowpass(noise, sweep) - _lowpass(noise, sweep * 0.15)
	return x * _env(n, d * 0.45, d * 0.5) * 1.6


def pop(f=660):
	n = int(0.12 * SR)
	t = np.arange(n) / SR
	freq = f * (1 + 1.5 * np.exp(-t * 60))
	return np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 32) * 0.5


def impact():
	n = int(0.7 * SR)
	t = np.arange(n) / SR
	boom = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 6) + 38) / SR) * np.exp(-t * 6)
	crack = _lowpass(rng.standard_normal(n), 0.25) * np.exp(-t * 40)
	return boom * 0.9 + crack * 0.5


def riser(d=0.9):
	n = int(d * SR)
	t = np.arange(n) / SR
	x = _lowpass(rng.standard_normal(n), np.linspace(0.01, 0.3, n))
	tone = np.sin(2 * np.pi * np.cumsum(200 + 600 * (t / d) ** 2) / SR) * 0.15
	return (x * 0.8 + tone) * (t / d) ** 2


def music_bed(seconds, bpm=96):
	"""Soft minor-key pad with a gentle pulse; sits quietly under the voice."""
	n = int(seconds * SR)
	t = np.arange(n) / SR
	chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]]
	bar = 4 * 60 / bpm
	out = np.zeros(n)
	for ci in range(int(seconds / bar) + 1):
		s, e = int(ci * bar * SR), min(n, int((ci + 1) * bar * SR + 0.3 * SR))
		if s >= n:
			break
		tt = t[s:e] - t[s]
		env = np.minimum(1, tt / 0.4) * np.exp(-tt * 0.25)
		for f in chords[ci % 4]:
			for det in (-0.6, 0.6):
				out[s:e] += np.sin(2 * np.pi * (f + det) * tt) * env * 0.05
		out[s:e] += np.sin(2 * np.pi * chords[ci % 4][0] / 2 * tt) * env * 0.08
	beat = 60 / bpm
	k = np.exp(-((t % beat)) * 18) * np.sin(2 * np.pi * 55 * (t % beat)) * 0.25
	hat = _lowpass(rng.standard_normal(n), 0.9) * np.exp(-(((t + beat / 2) % beat)) * 60) * 0.03
	out += k + hat
	fade = np.minimum(1, np.minimum(t / 1.0, (seconds - t) / 1.5))
	return out * np.clip(fade, 0, 1)


def place(track, clip, at, gain=1.0):
	s = int(at * SR)
	if s >= len(track):
		return
	e = min(len(track), s + len(clip))
	track[s:e] += clip[: e - s] * gain
