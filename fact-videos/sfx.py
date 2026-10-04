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


# ---- subtle cues for the editorial style ----


def swish(d=0.32):
	"""Soft air swish, gentler than whoosh."""
	n = int(d * SR)
	noise = rng.standard_normal(n)
	sweep = 0.02 + 0.12 * np.sin(np.linspace(0, np.pi, n))
	x = _lowpass(noise, sweep) - _lowpass(noise, sweep * 0.2)
	return x * np.sin(np.linspace(0, np.pi, n)) ** 2 * 1.2


def thud():
	"""Rubber-stamp hit: short low knock + paper slap."""
	n = int(0.35 * SR)
	t = np.arange(n) / SR
	knock = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t * 25) + 55) / SR) * np.exp(-t * 18)
	slap = _lowpass(rng.standard_normal(n), 0.35) * np.exp(-t * 70)
	return knock * 0.9 + slap * 0.6


def click(f=2400, d=0.025):
	n = int(d * SR)
	t = np.arange(n) / SR
	return (np.sin(2 * np.pi * f * t) * 0.5 + rng.standard_normal(n) * 0.25) * np.exp(-t * 260)


def ticks(d=1.4, start_rate=22, end_rate=4):
	"""Odometer ticking that slows down as the number settles."""
	out = np.zeros(int(d * SR) + SR // 10)
	tt = 0.0
	while tt < d:
		k = tt / d
		place(out, click(2000 + 600 * rng.random()), tt, 0.7)
		tt += 1 / (start_rate + (end_rate - start_rate) * k)
	return out


def chiptick():
	a = click(1500, 0.04)
	b = click(3000, 0.02)
	a[: len(b)] += b * 0.4
	return a


def typewriter(d=1.2, rate=11):
	out = np.zeros(int(d * SR) + SR // 10)
	tt = 0.0
	while tt < d:
		place(out, click(1100 + 500 * rng.random(), 0.035), tt, 0.8)
		tt += (1 / rate) * (0.7 + 0.6 * rng.random())
	return out


def marker(d=0.35):
	"""Felt-pen stroke."""
	n = int(d * SR)
	x = _lowpass(rng.standard_normal(n), 0.5) - _lowpass(rng.standard_normal(n), 0.08)
	return x * np.sin(np.linspace(0, np.pi, n)) * 0.6


def glitch(d=0.18):
	n = int(d * SR)
	x = np.sign(np.sin(2 * np.pi * np.cumsum(rng.uniform(200, 2000, n)) / SR)) * 0.3
	x *= (rng.random(n) > 0.3)
	return x * np.linspace(1, 0.2, n)


CUES = {
	'swish': swish, 'thud': thud, 'ticks': ticks, 'chiptick': chiptick, 'type': typewriter,
	'pop': lambda: pop(700), 'marker': marker, 'whoosh': lambda: whoosh(0.4), 'glitch': glitch,
}


def ambient_bed(seconds):
	"""Minimal, modern bed: soft sub pulse + airy pad; stays out of the voice's way."""
	n = int(seconds * SR)
	t = np.arange(n) / SR
	bpm = 100
	beat = 60 / bpm
	pad = np.zeros(n)
	notes = [110.0, 130.81, 164.81, 196.0]  # A minor 7 colour
	for i, f in enumerate(notes):
		lfo = 0.5 + 0.5 * np.sin(2 * np.pi * t / (7 + i * 2) + i)
		pad += np.sin(2 * np.pi * f * t) * 0.025 * lfo + np.sin(2 * np.pi * f * 2.003 * t) * 0.01 * lfo
	sub = np.sin(2 * np.pi * 55 * (t % beat)) * np.exp(-(t % beat) * 9) * 0.22
	hat_env = np.exp(-((t + beat / 2) % beat) * 80)
	hat = _lowpass(rng.standard_normal(n), 0.95) * hat_env * 0.02
	fade = np.clip(np.minimum(t / 1.5, (seconds - t) / 2.0), 0, 1)
	return (pad + sub + hat) * fade


def master(in_wav, out_wav, target_lufs=-10.0, true_peak=-1.0):
	"""Loud, clean mastering for phone speakers: compress, then two-pass loudness-normalise to Reels level."""
	import json
	import re
	import subprocess

	pre = ('highpass=f=70,acompressor=threshold=-24dB:ratio=4:attack=3:release=100:makeup=6,'
	       'alimiter=limit=0.5:attack=2:release=40:level=false')  # tame peaks so loudnorm can push level up
	measure = subprocess.run(
		['ffmpeg', '-hide_banner', '-i', in_wav, '-af', f'{pre},loudnorm=I={target_lufs}:TP={true_peak}:LRA=7:print_format=json', '-f', 'null', '-'],
		capture_output=True, text=True).stderr
	m = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', measure, re.S).group(0))
	ln = (f"loudnorm=I={target_lufs}:TP={true_peak}:LRA=7:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
	      f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
	subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', in_wav, '-af', f'{pre},{ln},alimiter=limit=0.89:level=false', '-ar', '48000', out_wav], check=True)


# ---- Pop Bold kit: tight clicks + a punchy beat ----


def snap():
	n = int(0.06 * SR)
	t = np.arange(n) / SR
	x = rng.standard_normal(n) * np.exp(-t * 120)
	return (x - _lowpass(x, 0.3)) * 0.9 + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90) * 0.3


def tick1():
	return click(2600, 0.02) * 0.9


def punch():
	n = int(0.3 * SR)
	t = np.arange(n) / SR
	return np.sin(2 * np.pi * np.cumsum(160 * np.exp(-t * 30) + 50) / SR) * np.exp(-t * 14) + snap()[:n].sum() * 0 + _pad(snap(), n) * 0.5


def _pad(x, n):
	out = np.zeros(n)
	out[: min(n, len(x))] = x[:n]
	return out


def chime():
	n = int(1.2 * SR)
	t = np.arange(n) / SR
	out = np.zeros(n)
	for f, a in ((1318.5, 0.5), (1975.5, 0.3), (2637.0, 0.15)):
		out += np.sin(2 * np.pi * f * t + 2 * np.sin(2 * np.pi * f * 1.4 * t) * np.exp(-t * 8)) * a
	return out * np.exp(-t * 4) * 0.6


def fill_sfx(d=0.6):
	n = int(d * SR)
	t = np.arange(n) / SR
	return np.sin(2 * np.pi * np.cumsum(400 + 900 * (t / d)) / SR) * 0.25 * np.sin(np.pi * t / d)


def soft_swoosh():
	return swish(0.28) * 0.6


CUES.update({'snap': snap, 'tick': tick1, 'punch': punch, 'chime': chime, 'fill': fill_sfx, 'swoosh': soft_swoosh})


def beat(seconds, bpm=104, drops=(), seed=5):
	"""Punchy pop/trap-ish beat: kick, clap, hats, sub-bass and offbeat chord stabs.
	`drops`: times where the full beat slams back in after a one-bar build (kick drop-out + riser)."""
	r = np.random.default_rng(seed)
	n = int(seconds * SR)
	out = np.zeros(n)
	b = 60 / bpm
	bar = 4 * b
	# drum voices
	tk = np.arange(int(0.35 * SR)) / SR
	kick = np.sin(2 * np.pi * np.cumsum(150 * np.exp(-tk * 28) + 46) / SR) * np.exp(-tk * 7)
	kick[: int(0.004 * SR)] += r.standard_normal(int(0.004 * SR)) * 0.4
	tc = np.arange(int(0.22 * SR)) / SR
	cl = r.standard_normal(len(tc))
	clap = (cl - _lowpass(cl, 0.15)) * (np.exp(-tc * 30) + 0.6 * np.exp(-np.maximum(tc - 0.012, 0) * 40) * (tc > 0.012)) * 0.55
	th = np.arange(int(0.05 * SR)) / SR
	hn = r.standard_normal(len(th))
	hat = (hn - _lowpass(hn, 0.6)) * np.exp(-th * 90) * 0.22
	# harmony: A minor - F - C - G
	roots = [55.0, 43.65, 65.41, 49.0]
	chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 261.63, 329.63], [196.0, 246.94, 293.66]]
	drop_bars = {int(d / bar) for d in drops}
	n_bars = int(seconds / bar) + 1
	for bi in range(n_bars):
		t0 = bi * bar
		build = (bi + 1) in drop_bars  # bar before a drop: strip the kick, add a riser
		intro = bi == 0
		for k in range(16):  # 16th grid
			ts = t0 + k * b / 4
			if ts >= seconds:
				break
			if k % 4 == 0 and not build:
				place(out, kick, ts, 0.95 if not intro else 0.5)
			if k in (6,) and not build and not intro:
				place(out, kick, ts, 0.6)  # syncopated extra kick
			if k in (4, 12) and not intro:
				place(out, clap, ts, 0.9)
			if k % 2 == 0 or (build and k % 1 == 0):
				place(out, hat, ts, (0.9 if k % 4 == 2 else 0.55) * (1.2 if build else 1))
		# sub bass on 8ths following the root
		f = roots[bi % 4]
		for k in range(8):
			ts = t0 + k * b / 2
			if build or ts >= seconds:
				continue
			nb = int(b / 2 * 0.9 * SR)
			tt = np.arange(nb) / SR
			note = np.sin(2 * np.pi * f * tt) * np.minimum(1, tt / 0.005) * np.exp(-tt * 3) * 0.35
			place(out, note, ts, 1.0 if not intro else 0.4)
		# offbeat chord stabs (filtered saw-ish)
		for k in (1, 3, 5, 7):
			ts = t0 + k * b / 2
			if ts >= seconds or intro:
				continue
			nb = int(0.18 * SR)
			tt = np.arange(nb) / SR
			st = sum(np.sign(np.sin(2 * np.pi * cf * tt)) * 0.5 + np.sin(2 * np.pi * cf * 2 * tt) * 0.3 for cf in chords[bi % 4])
			st = _lowpass(st * np.exp(-tt * 14), 0.2) * 0.12
			place(out, st, ts, 1.0)
		if build:
			place(out, riser(bar), t0, 0.35)
	for d in drops:
		place(out, impact(), d, 0.35)
	fade = np.clip(np.minimum(np.arange(n) / SR / 0.3, (seconds - np.arange(n) / SR) / 1.0), 0, 1)
	return out * fade
