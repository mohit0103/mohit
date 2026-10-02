"""Turn a short YAML script into a vertical (9:16) fact video:
emoji-driven motion graphics, word-by-word captions, a natural voice-over,
sound effects and a soft music bed.

    python make_video.py scripts/pigeon-head-bob.yaml            -> output/pigeon-head-bob.mp4
    python make_video.py scripts/pigeon-head-bob.yaml --preview  -> also saves a contact sheet of frames

See README.md for the script format.
"""

import argparse
import math
import os
import random
import re
import subprocess
import sys
import wave

import numpy as np
import skia
import yaml

import sfx
import tts
from fx import BOLD, DISPLAY, SERIF, C, H, W, back_out, clamp, ease_in, ease_out, font, paint
from scenes import VISUALS

FPS = 30
HERE = os.path.dirname(os.path.abspath(__file__))

THEMES = {
	'ink': dict(bg=(14, 15, 20), bg2=(30, 22, 40), grid=(255, 255, 255, 12), text=(244, 238, 226), dim=(150, 146, 140), accent=(255, 84, 70), accent2=(60, 210, 196), gold=(255, 196, 70)),
	'night': dict(bg=(8, 12, 30), bg2=(30, 16, 60), grid=(120, 160, 255, 16), text=(232, 238, 255), dim=(130, 140, 175), accent=(255, 90, 140), accent2=(90, 170, 255), gold=(255, 205, 80)),
	'paper': dict(bg=(244, 237, 222), bg2=(230, 218, 196), grid=(0, 0, 0, 14), text=(26, 24, 22), dim=(115, 108, 98), accent=(225, 58, 42), accent2=(16, 140, 130), gold=(205, 140, 20)),
}


# ---------------------------------------------------------------- background


class Backdrop:
	def __init__(self, th, seed=7):
		self.th = th
		rng = random.Random(seed)
		self.dust = [(rng.random() * W, rng.random() * H, rng.uniform(1.5, 3.5), rng.uniform(6, 22), rng.random() * 6.28) for _ in range(60)]
		self.blobs = {}
		# vignette + film grain, pre-rendered once as overlays (drawing them per frame is slow)
		nrng = np.random.default_rng(seed)
		yy, xx = np.mgrid[0:H, 0:W]
		vig = np.clip(np.hypot(xx - W / 2, yy - H * 0.45) / (H * 0.72), 0, 1) ** 2 * 150
		self.grain = []
		for _ in range(4):
			noise = nrng.integers(0, 255, (H, W)) * (11 / 255)  # premultiplied light speckle
			rgb = np.repeat(noise[..., None], 3, axis=2)
			alpha = (vig + 11)[..., None]
			rgba = np.concatenate([rgb, alpha], axis=2).clip(0, 255).astype(np.uint8)
			self.grain.append(skia.Image.fromarray(rgba, colorType=skia.kRGBA_8888_ColorType, alphaType=skia.kPremul_AlphaType))

	def draw(self, c, t, accent):
		th = self.th
		c.clear(C(th['bg']))
		# two slow-moving coloured glows give depth; one takes each scene's accent colour
		for i, (col, a) in enumerate(((accent, 0.22), (th['bg2'], 0.9))):
			x = W * (0.3 + 0.4 * i) + math.sin(t * 0.3 + i * 2) * 160
			y = H * (0.35 + 0.3 * i) + math.cos(t * 0.25 + i) * 200
			c.drawImage(self._blob(col, a), x - 1000, y - 1000)
		g = paint(C(th['grid']), stroke=1.5)
		off = (t * 12) % 90
		for x in range(0, W + 90, 90):
			c.drawLine(x, 0, x, H, g)
		for y in np.arange(-90 + off, H + 90, 90):
			c.drawLine(0, y, W, y, g)
		for x, y, r, sp, ph in self.dust:
			yy = (y - t * sp) % H
			c.drawCircle(x + math.sin(t * 0.5 + ph) * 12, yy, r, paint(C(th['text']), 0.15 + 0.1 * math.sin(t * 2 + ph)))

	def _blob(self, col, a):
		"""Pre-rendered soft glow (blurring a huge circle every frame is slow)."""
		key = (tuple(col), a)
		if key not in self.blobs:
			s = skia.Surface(2000, 2000)
			s.getCanvas().drawCircle(1000, 1000, 620, paint(C(col), a, blur=260))
			self.blobs[key] = s.makeImageSnapshot()
		return self.blobs[key]

	def draw_grain(self, c, frame):
		c.drawImage(self.grain[(frame // 3) % len(self.grain)], 0, 0)


# ---------------------------------------------------------------- captions


def chunk_words(words, max_words=3, max_chars=18):
	chunks, cur = [], []
	for w in words:
		cur.append(w)
		text = ' '.join(x[0] for x in cur)
		if len(cur) >= max_words or len(text) >= max_chars or re.search(r'[,.;:!?—]$', w[0]):
			chunks.append(cur)
			cur = []
	if cur:
		chunks.append(cur)
	return chunks


def norm(w):
	return re.sub(r"[^\w']", '', w.replace('’', "'")).lower()


def draw_caption(c, th, chunk, t, end_t, highlights):
	f = font(BOLD, 92)
	space = f.measureText(' ') + 6
	pads = [16 if norm(w) in highlights else 0 for w, _, _ in chunk]
	lines = [list(range(len(chunk)))]
	total = sum(f.measureText(w) + 2 * p for (w, _, _), p in zip(chunk, pads)) + space * (len(chunk) - 1)
	if total > W - 120:
		half = (len(chunk) + 1) // 2
		lines = [list(range(half)), list(range(half, len(chunk)))]
	base_y = 1530 - (len(lines) - 1) * 60
	fade = min(ease_out((t - chunk[0][1] + 0.06) / 0.1), 1 - ease_out((t - end_t + 0.06) / 0.08))
	outline = paint(skia.Color(0, 0, 0), 0.85 * fade, stroke=14)
	for li, idx in enumerate(lines):
		lw = sum(f.measureText(chunk[i][0]) + 2 * pads[i] for i in idx) + space * (len(idx) - 1)
		x = W / 2 - lw / 2
		y = base_y + li * 118
		for i in idx:
			w, s, e = chunk[i]
			x += pads[i]
			ww = f.measureText(w)
			spoken = t >= s - 0.02
			pop = back_out((t - s) / 0.16) if spoken else 0.0
			sc = 0.9 + 0.1 * pop + (0.06 if s <= t < e else 0)
			hl = norm(w) in highlights and spoken
			c.save()
			c.translate(x + ww / 2, y - 32)
			c.scale(sc, sc)
			c.rotate(-2 if hl else 0)
			c.translate(-(x + ww / 2), -(y - 32))
			if hl:
				r = skia.Rect(x - 16, y - 82, x + ww + 16, y + 22)
				c.drawRRect(skia.RRect.MakeRectXY(r, 16, 16), paint(C(th['accent']), fade))
				c.drawString(w, x, y, f, paint(skia.ColorWHITE, fade))
			else:
				c.drawString(w, x, y, f, outline)
				col = th['gold'] if s <= t < e + 0.05 else th['text']
				c.drawString(w, x, y, f, paint(C(col), fade * (1.0 if spoken else 0.45)))
			c.restore()
			x += ww + space + pads[i]


# ---------------------------------------------------------------- chrome


def draw_chrome(c, th, meta, t, total):
	ch = meta.get('channel', 'factloop')
	f = font(DISPLAY, 56)
	c.drawString(ch, 64, 150, f, paint(C(th['text'])))
	c.drawCircle(64 + f.measureText(ch) + 16, 142, 8, paint(C(th['accent'])))
	if meta.get('kicker'):
		c.drawString(meta['kicker'], 66, 214, font(SERIF, 44), paint(C(th['dim'])))
	cx, cy, r = W - 120, 150, 50
	c.drawCircle(cx, cy, r, paint(C(th['text']), 0.25, stroke=6))
	arc = skia.Path()
	arc.addArc(skia.Rect(cx - r, cy - r, cx + r, cy + r), -90, 359.9 * t / total)
	c.drawPath(arc, paint(C(th['accent']), stroke=8))
	a = t * math.pi - math.pi / 2
	c.drawLine(cx, cy, cx + math.cos(a) * (r - 16), cy + math.sin(a) * (r - 16), paint(C(th['text']), stroke=5))
	c.drawRect(skia.Rect(0, H - 12, W * t / total, H), paint(C(th['accent'])))


# ---------------------------------------------------------------- timeline + audio


def build(script, engine, voice, rate):
	scenes = script['scenes']
	print('Generating voice-over...')
	pron = {str(k): str(v) for k, v in (script.get('pronounce') or {}).items()}
	samples, scene_words = tts.speak([s['say'].strip() for s in scenes], engine, voice, rate, pron)
	lead = 0.5
	speech = len(samples) / tts.SAMPLE_RATE
	out = []
	for i, (sc, words) in enumerate(zip(scenes, scene_words)):
		words = [(w, s + lead, e + lead) for w, s, e in words]
		start = 0.0 if i == 0 else max(words[0][1] - 0.25, out[-1]['words'][-1][2] + 0.05)
		out.append(dict(sc, start=start, words=words))
	total = lead + speech + 1.0
	for i, sc in enumerate(out):
		sc['end'] = out[i + 1]['start'] if i + 1 < len(out) else total
		sc['chunks'] = chunk_words(sc['words'])
		sc['hl'] = {norm(h) for h in sc.get('highlight', [])}
	return samples, lead, out, total


def mix_audio(samples, lead, scenes, total, script, path):
	n = int(total * sfx.SR)
	voice = np.zeros(n)
	v = samples.astype(np.float64) / 32768.0
	s = int(lead * sfx.SR)
	voice[s : s + len(v)] = v[: n - s]
	fx_track = np.zeros(n)
	if script.get('sfx', True):
		sfx.place(fx_track, sfx.impact(), scenes[0]['start'] + 0.3, 0.55)
		for sc in scenes[1:]:
			sfx.place(fx_track, sfx.whoosh(), max(0, sc['start'] - 0.2), 0.22)
			sfx.place(fx_track, sfx.pop(random.choice([520, 660, 780])), sc['start'] + 0.25, 0.25)
		sfx.place(fx_track, sfx.riser(0.8), max(0, scenes[-1]['start'] - 0.8), 0.18)
	music = np.zeros(n)
	if script.get('music', 'auto') == 'auto':
		music = sfx.music_bed(total) * float(script.get('music_volume', 0.35))
	elif script.get('music'):
		raw = tts._decode(os.path.join(HERE, script['music'])).astype(np.float64) / 32768.0
		music = np.tile(raw, int(np.ceil(n / max(len(raw), 1))))[:n] * float(script.get('music_volume', 0.12))
	# duck the music under the voice
	env = np.convolve(np.abs(voice), np.ones(2400) / 2400, mode='same')
	mix = voice + fx_track + music * (1 - 0.6 * np.clip(env * 12, 0, 1))
	mix /= max(1.0, np.abs(mix).max() / 0.95)
	with wave.open(path, 'wb') as wf:
		wf.setnchannels(1)
		wf.setsampwidth(2)
		wf.setframerate(sfx.SR)
		wf.writeframes((mix * 32767).astype(np.int16).tobytes())


# ---------------------------------------------------------------- render


def render(script_path, out_path, engine='auto', voice=None, rate=None, preview=False):
	with open(script_path) as f:
		script = yaml.safe_load(f)
	th = THEMES[script.get('theme', 'ink')]
	samples, lead, scenes, total = build(script, engine, voice or script.get('voice'), rate or script.get('rate', '+5%'))
	os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
	if any(s.get('layers') for s in scenes):  # editorial motion-design style
		import editorial

		return editorial.render(script, samples, lead, scenes, total, out_path, preview)
	wav = out_path + '.mix.wav'
	mix_audio(samples, lead, scenes, total, script, wav)

	cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', wav,
	       '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out_path]
	ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
	surface = skia.Surface(W, H)
	c = surface.getCanvas()
	bg = Backdrop(th)
	accents = [th['accent'], th['accent2'], th['gold']]
	n_frames = int(total * FPS)
	preview_at = {int(n_frames * p) for p in (0.04, 0.18, 0.32, 0.46, 0.6, 0.74, 0.9)} if preview else set()
	shots = []
	print(f'Rendering {n_frames} frames ({total:.1f}s)...')
	for fi in range(n_frames):
		t = fi / FPS
		si = max(i for i, s in enumerate(scenes) if s['start'] <= t or i == 0)
		sc = scenes[si]
		lt, dur = t - sc['start'], sc['end'] - sc['start']
		bg.draw(c, t, accents[si % 3])
		vis = sc.get('visual') or {'type': 'title', 'text': script.get('title', '')}
		# camera: zoom-through between scenes, slow push-in during a scene, shake on the hook impact
		k_in = ease_out(lt / 0.35)
		k_out = ease_in((t - (sc['end'] - 0.25)) / 0.25) if si < len(scenes) - 1 else 0
		zoom = (0.86 + 0.14 * k_in) * (1 + 0.03 * lt / max(dur, 1)) * (1 + 0.25 * k_out)
		shake = 18 * (1 - (lt - 0.3) / 0.45) if vis.get('type') == 'hook' and 0.3 < lt < 0.75 else 0
		c.save()
		c.translate(W / 2 + math.sin(t * 90) * shake, H * 0.45 + math.cos(t * 77) * shake)
		c.scale(zoom, zoom)
		c.translate(-W / 2, -H * 0.45)
		c.saveLayerAlpha(None, int(255 * clamp(k_in * (1 - k_out))))
		VISUALS.get(vis.get('type', 'title'), VISUALS['title'])(c, th, vis, lt, dur)
		c.restore()
		c.restore()
		if vis.get('type') == 'hook' and 0.3 < lt < 0.5:
			c.drawRect(skia.Rect(0, 0, W, H), paint(skia.ColorWHITE, 0.3 * (1 - (lt - 0.3) / 0.2)))
		for ci, ch in enumerate(sc['chunks']):
			end_t = sc['chunks'][ci + 1][0][1] if ci + 1 < len(sc['chunks']) else min(sc['end'], ch[-1][2] + 0.6)
			if ch[0][1] - 0.06 <= t < end_t:
				draw_caption(c, th, ch, t, end_t, sc['hl'])
		draw_chrome(c, th, script, t, total)
		bg.draw_grain(c, fi)
		frame = surface.makeImageSnapshot()
		ff.stdin.write(frame.toarray(colorType=skia.kRGBA_8888_ColorType).tobytes())
		if fi in preview_at:
			shots.append(frame)
		if fi % (FPS * 5) == 0:
			print(f'  {fi}/{n_frames}')
	ff.stdin.close()
	if ff.wait() != 0:
		sys.exit('ffmpeg failed')
	os.unlink(wav)
	if shots:
		sheet = skia.Surface(270 * len(shots), 480)
		for i, im in enumerate(shots):
			sheet.getCanvas().drawImageRect(im, skia.Rect(i * 270, 0, (i + 1) * 270, 480), skia.SamplingOptions(skia.FilterMode.kLinear))
		sheet.makeImageSnapshot().save(f'{out_path[:-4]}-preview.png', skia.kPNG)
	print(f'Done: {out_path}')
	return out_path


if __name__ == '__main__':
	ap = argparse.ArgumentParser()
	ap.add_argument('script')
	ap.add_argument('-o', '--out')
	ap.add_argument('--engine', default=os.environ.get('TTS_ENGINE', 'auto'), choices=['auto', 'elevenlabs', 'gemini', 'edge', 'piper'])
	ap.add_argument('--voice', default=os.environ.get('VOICE') or None, help='Edge voice (en-US-AndrewMultilingualNeural, en-IN-PrabhatNeural...), Gemini voice (Charon, Puck...) or ElevenLabs voice id')
	ap.add_argument('--rate', default=None, help='Speaking speed for Edge/Piper, e.g. +5%%')
	ap.add_argument('--preview', action='store_true', help='Also save a contact sheet of frames')
	a = ap.parse_args()
	out = a.out or os.path.join(HERE, 'output', os.path.splitext(os.path.basename(a.script))[0] + '.mp4')
	render(a.script, out, a.engine, a.voice, a.rate, a.preview)
