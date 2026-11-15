"""Sound design + music for the motion video.

The music is a trimmed section of the song in config.json. It starts on the last kick before the
pre-chorus, so the chorus drop lands on beat 32, when the clip grid appears. The SFX are synthesized
and kept deliberately restrained. Each one is placed from .cache/cues.json, which render.js exports
from the animation timeline, so it lands on the motion it belongs to. Whooshes build from the moment a
move starts and peak on its landing. Everything goes through a shared reverb, gentle EQ and a limiter,
then sits under the music.

Writes .cache/audio.wav (48 kHz stereo).
"""

import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy import signal

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
SR = 48000
rng = np.random.default_rng(5)


# ---------------------------------------------------------------- dsp helpers
def tt(d):
	return np.arange(int(round(d * SR))) / SR


def noise(n, pink=True):
	x = rng.standard_normal(n)
	if pink:  # Paul Kellet's economy pink filter
		b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
		a = [1, -2.494956002, 2.017265875, -0.522189400]
		x = signal.lfilter(b, a, x) * 4
	return x


def sos(x, kind, f, order=2):
	return signal.sosfilt(signal.butter(order, f, btype=kind, fs=SR, output="sos"), x)


def sweep_bp(x, fc, q=1.2, block=128):
	"""Band-pass whose centre frequency follows the array fc (time-varying RBJ biquad)."""
	y = np.empty_like(x)
	zi = np.zeros(2)
	for s in range(0, len(x), block):
		f = float(np.clip(fc[min(s + block // 2, len(fc) - 1)], 40, SR * 0.45))
		w = 2 * np.pi * f / SR
		al = np.sin(w) / (2 * q)
		b = np.array([al, 0, -al])
		a = np.array([1 + al, -2 * np.cos(w), 1 - al])
		y[s:s + block], zi = signal.lfilter(b / a[0], a / a[0], x[s:s + block], zi=zi)
	return y


def sweep_hp(x, fc, block=128):
	y = np.empty_like(x)
	zi = np.zeros(2)
	for s in range(0, len(x), block):
		f = float(np.clip(fc[min(s + block // 2, len(fc) - 1)], 20, SR * 0.45))
		b, a = signal.butter(2, f, btype="high", fs=SR)
		y[s:s + block], zi = signal.lfilter(b, a, x[s:s + block], zi=zi)
	return y


def fade(x, a=0.002, r=0.01):
	n = len(x)
	e = np.ones(n)
	ai, ri = max(1, int(a * SR)), max(1, int(r * SR))
	e[:ai] = np.linspace(0, 1, ai)
	e[n - ri:] *= np.linspace(1, 0, ri)
	return x * e


def pan(x, p):
	p = np.clip(np.broadcast_to(p, x.shape), -1, 1)
	th = (p + 1) * np.pi / 4
	return np.stack([x * np.cos(th), x * np.sin(th)], 1)


def norm(x, peak):
	m = np.max(np.abs(x)) + 1e-12
	return x * (peak / m)


def tone(f, d, decay, attack=0.002):
	t = tt(d)
	return np.sin(2 * np.pi * f * t) * np.exp(-t * decay) * np.minimum(1, t / attack)


# ---------------------------------------------------------------- the palette (each returns stereo, start offset, reverb send)
def whoosh(c):
	"""Air whoosh that builds from the start of a move and peaks on its landing."""
	v = c["v"]
	build = max(0.12, min(0.9, c["t"] - c["t0"])) if c.get("t0") is not None else 0.3
	tail = 0.18 + 0.25 * v
	d = build + tail
	n = int(d * SR)
	t = np.arange(n) / SR
	pk = build
	rise = np.clip(t / pk, 0, 1)
	env = np.where(t < pk, rise ** 2.6, np.exp(-(t - pk) / (0.06 + 0.07 * v)))
	fc = np.where(t < pk, 350 * (9 ** rise), 3150 * np.exp(-(t - pk) * 5))
	air = sweep_bp(noise(n), fc, q=0.9)
	body = sos(noise(n), "band", [90, 420]) * np.where(t < pk, rise ** 4, np.exp(-(t - pk) / 0.05))
	x = norm(air, 1) + norm(body, 1) * 0.35 * v
	x = sos(x, "high", 70)
	direction = 1 if (int(c["t"] * 10) % 2) else -1
	p = np.clip((t - pk) / 0.25, -1, 1) * 0.55 * direction
	return pan(norm(x * env, 0.30 + 0.32 * v), p), -pk, 0.18


def open_(c):
	n = int(0.9 * SR)
	t = np.arange(n) / SR
	x = sweep_bp(noise(n), 4200 * np.exp(-t * 3.2) + 250, q=0.8) * np.exp(-t / 0.22)
	return pan(norm(fade(x, 0.004, 0.2), 0.32), 0), 0, 0.25


def blip(c):
	"""Soft rounded blip for the dot hops and pin landings; pitched up a step each time (E major pentatonic)."""
	scale = [659.3, 740.0, 830.6, 987.8, 1108.7, 1318.5]
	f = scale[int(c["v"]) % len(scale)]
	t = tt(0.16)
	fr = f * (1 + 0.35 * np.exp(-t * 90))
	x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 26) * np.minimum(1, t / 0.003)
	x += 0.25 * np.sin(4 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 60)
	return pan(norm(x, 0.16), (c["v"] - 2) * 0.12), -0.004, 0.3


def tap(c):
	"""Glassy UI tap."""
	t = tt(0.09)
	x = tone(2350, 0.09, 85) + 0.5 * tone(3520, 0.09, 140) + 0.4 * tone(1180, 0.09, 60)
	x += sos(noise(len(t), False), "high", 5000) * np.exp(-t * 900) * 0.6
	return pan(norm(x, 0.11 * (0.6 + 0.5 * c["v"])), 0.1), 0, 0.28


def morph(c):
	"""Liquid swell as the date dot puffs up and fills with the photo."""
	d = 0.55
	t = tt(d)
	f = 220 + 520 * (1 - np.exp(-t * 7))
	x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.02) * np.exp(-t * 6)
	air = sweep_bp(noise(len(t)), 800 + 3200 * t / d, q=1.5) * np.sin(np.pi * t / d) * 0.6
	return pan(norm(x * 0.7 + norm(air, 1) * 0.3, 0.2), 0), 0, 0.35


def save(c):
	"""Two-note confirm for Save -> Saved."""
	a = tone(1318.5, 0.25, 22)
	b = tone(1975.5, 0.3, 18)
	x = np.zeros(int(0.4 * SR))
	x[: len(a)] += a
	o = int(0.075 * SR)
	x[o:o + len(b)] += b * 0.8
	return pan(norm(x, 0.12), 0.15), 0, 0.35


def marker(c):
	"""Highlighter stroke: short filtered scrape that sweeps left to right."""
	d = 0.3
	t = tt(d)
	x = sweep_bp(noise(len(t), False), 2200 + 3500 * t / d, q=2.5) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * t))
	x *= np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7
	return pan(norm(x, 0.08), np.linspace(-0.5, 0.5, len(t))), 0, 0.15


def riser(c):
	"""Filtered noise + tonal swell into the drop, cut clean on the downbeat."""
	d = c["t"] - c["t0"]
	n = int(d * SR)
	t = np.arange(n) / SR
	r = t / d
	x = sweep_hp(noise(n), 300 * (30 ** r))
	sw = sum(np.sin(2 * np.pi * np.cumsum(f0 * (2 ** (r * 1.0))) / SR) for f0 in (329.6, 493.9, 659.3)) / 3
	x = norm(x, 1) * 0.7 + sw * 0.3
	x *= r ** 2.4
	x = fade(x, 0.01, 0.006)
	return pan(norm(x, 0.2), np.sin(t * 9) * 0.25 * r), -d, 0.25


def drop(c):
	"""Sub boom + soft transient on the chorus drop."""
	t = tt(1.4)
	sub = np.sin(2 * np.pi * np.cumsum(46 + 40 * np.exp(-t * 14)) / SR) * np.exp(-t * 2.6) * np.minimum(1, t / 0.004)
	hit = sos(noise(len(t)), "band", [180, 2500]) * np.exp(-t * 28)
	x = sub + norm(hit, 1) * 0.35
	return pan(norm(x, 0.5), 0), 0, 0.15


def slam(c):
	"""Title letters land: tight thump + snap."""
	t = tt(0.6)
	th = np.sin(2 * np.pi * np.cumsum(55 + 70 * np.exp(-t * 30)) / SR) * np.exp(-t * 9)
	sn = sos(noise(len(t)), "band", [900, 5000]) * np.exp(-t * 45)
	return pan(norm(th + norm(sn, 1) * 0.45, 0.32), 0), 0, 0.3


def hit(c):
	"""Cinematic hit when the title fills the letterboxed frame."""
	t = tt(1.6)
	sub = np.sin(2 * np.pi * np.cumsum(42 + 50 * np.exp(-t * 18)) / SR) * np.exp(-t * 3.2)
	body = sos(noise(len(t)), "band", [120, 1200]) * np.exp(-t * 10)
	air = sos(noise(len(t)), "high", 4000) * np.exp(-t * 6) * 0.3
	return pan(norm(sub + norm(body, 1) * 0.5 + norm(air, 1) * 0.2, 0.42), 0), 0, 0.3


def shimmer(c):
	out = np.zeros(int(1.4 * SR))
	for i, f in enumerate([1318.5, 1661.2, 1975.5, 2489.0]):
		x = tone(f, 1.0, 4.5)
		s = int(i * 0.06 * SR)
		out[s:s + len(x)] += x * (0.9 - i * 0.12)
	return pan(norm(out, 0.06), 0.2), 0, 0.5


def typekey(c):
	t = tt(0.04)
	x = sos(noise(len(t), False), "band", [1800, 7000]) * np.exp(-t * 320)
	x += tone(260 + 60 * c["v"], 0.04, 140) * 0.5
	return pan(norm(x, 0.045 + 0.02 * c["v"]), (c["v"] - 0.5) * 0.4), 0, 0.12


def shine(c):
	"""Soft chime as the destination name glows."""
	t = tt(2.2)
	x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in [(1318.5, 0.6, 2.2), (1975.5, 0.35, 3), (2637.0, 0.2, 4.5), (3951, 0.08, 7)])
	x *= np.minimum(1, t / 0.004)
	sp = sweep_bp(noise(len(t)), 6000 + 2000 * np.sin(t * 3), q=3) * np.exp(-t * 3) * 0.15
	return pan(norm(x + sp, 0.14), 0), 0, 0.55


def wind(c):
	d = 2.4
	t = tt(d)
	x = sweep_bp(noise(len(t)), 900 + 500 * np.sin(t * 2.3), q=0.7)
	x *= np.sin(np.pi * t / d) ** 1.5
	return pan(norm(x, 0.07), np.sin(t * 1.7) * 0.4), 0, 0.1


def end(c):
	t = tt(2.5)
	sub = np.sin(2 * np.pi * np.cumsum(38 + 45 * np.exp(-t * 12)) / SR) * np.exp(-t * 1.8)
	air = sos(noise(len(t)), "band", [300, 3000]) * np.exp(-t * 9)
	return pan(norm(sub + norm(air, 1) * 0.3, 0.45), 0), 0, 0.6


SOUNDS = {"whoosh": whoosh, "open": open_, "blip": blip, "tap": tap, "morph": morph, "save": save, "marker": marker,
	"riser": riser, "drop": drop, "slam": slam, "hit": hit, "shimmer": shimmer, "type": typekey, "shine": shine,
	"wind": wind, "end": end}


# ---------------------------------------------------------------- mix
def reverb_ir(d=1.8):
	t = tt(d)
	ir = np.stack([noise(len(t), False), noise(len(t), False)], 1) * np.exp(-t / 0.42)[:, None]
	ir = np.stack([sos(ir[:, i], "band", [300, 7000]) for i in range(2)], 1)
	ir[: int(0.012 * SR)] = 0  # pre-delay
	return ir / np.sqrt(np.sum(ir ** 2) / 2)


def convolve(x, ir):
	n = len(x) + len(ir)
	N = 1 << (n - 1).bit_length()
	return np.stack([np.fft.irfft(np.fft.rfft(x[:, i], N) * np.fft.rfft(ir[:, i], N), N)[: len(x)] for i in range(2)], 1)


def place(bus, snd, t):
	s = int(round(t * SR))
	if s < 0:
		snd, s = snd[-s:], 0
	e = min(len(bus), s + len(snd))
	if e > s:
		bus[s:e] += snd[: e - s]


def limiter(x, ceil=0.95, release=0.08):
	g = np.minimum(1, ceil / (np.max(np.abs(x), 1) + 1e-9))
	# smooth gain: instant attack, exponential release
	a = np.exp(-1 / (release * SR))
	gs = signal.lfilter([1 - a], [1, -a], g)
	gs = np.minimum(g, gs)
	return x * gs[:, None]


def load_music(path, start, dur):
	raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start:.4f}", "-i", str(path), "-t", f"{dur:.4f}", "-f", "f32le",
		"-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
	return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


# how far each sound's peak sits relative to the music around it (dB). Keeps every effect tucked
# under the song, whether it's the quiet pre-chorus or the full chorus.
REL = {"whoosh": 2, "open": 0, "blip": -1, "tap": -5, "morph": 0, "save": -2, "marker": -5, "riser": 1, "drop": 4,
	"slam": 2, "hit": 4, "shimmer": -3, "type": -11, "shine": 1, "wind": -7, "end": 0}
FLOOR = -20  # reference level (dBFS rms) used when the music is silent


def db(v):
	return 20 * np.log10(v + 1e-9)


def main():
	info = json.loads((CACHE / "cues.json").read_text())
	cfg = json.loads((HERE / "config.json").read_text())
	dur = info["dur"]
	beat = info.get("beat") or 60 / cfg.get("beat", {}).get("bpm", 123.06)
	n = int(dur * SR)

	music = np.zeros((n, 2))
	if cfg.get("music"):
		end_t = 68 * beat  # hard cut on the downbeat with the picture
		m = load_music(HERE.parent / cfg["music"], cfg.get("musicStart", 0), end_t + 0.05)[: n]
		e = np.ones(len(m))
		fi = int(0.006 * SR)
		e[:fi] = np.linspace(0, 1, fi)
		cut = int(end_t * SR)
		fo = int(0.03 * SR)
		e[cut - fo:cut] *= np.linspace(1, 0, fo)
		e[cut:] = 0
		m *= e[:, None]
		# level the bed to the chorus loudness so the quiet pre-chorus stays quiet relative to the drop
		ref = np.sqrt(np.mean(m[int(32 * beat * SR):cut] ** 2)) + 1e-9
		m *= 0.22 / ref * cfg.get("musicVolume", 1.0)
		music[: len(m)] = m

	dry = np.zeros((n, 2))
	wet = np.zeros((n, 2))
	for c in info["cues"]:
		snd, lead, send = SOUNDS[c["k"]](c)
		a = int(c["t"] * SR)
		w = music[max(0, a - int(0.4 * SR)):a + int(0.4 * SR)]
		local = max(db(np.sqrt(np.mean(w ** 2))) if len(w) else FLOOR, FLOOR)
		snd = snd * 10 ** ((local + REL[c["k"]] - db(np.max(np.abs(snd)))) / 20)
		place(dry, snd, c["t"] + lead)
		place(wet, snd * send, c["t"] + lead)
	sfx = dry + convolve(wet, reverb_ir()) * 0.5
	sfx = np.stack([sos(sfx[:, i], "high", 30) for i in range(2)], 1)

	mix = limiter(music + sfx)
	pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
	with wave.open(str(CACHE / "audio.wav"), "wb") as w:
		w.setnchannels(2)
		w.setsampwidth(2)
		w.setframerate(SR)
		w.writeframes(pcm.tobytes())
	print(f"audio: {len(info['cues'])} cues, {dur:.2f}s")


if __name__ == "__main__":
	main()
