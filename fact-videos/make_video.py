"""Turn a short YAML script into a vertical (9:16) fact video with
motion graphics, word-by-word captions and a narrated voice-over.

    python make_video.py scripts/pigeon-head-bob.yaml            -> output/pigeon-head-bob.mp4
    python make_video.py scripts/pigeon-head-bob.yaml --preview  -> also saves a few PNG frames

See README.md for the script format.
"""

import argparse
import math
import os
import random
import re
import subprocess
import sys

import numpy as np
import skia
import yaml

import tts

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, 'fonts')

THEMES = {
	'ink': dict(bg=(16, 18, 22), grid=(255, 255, 255, 14), text=(242, 234, 216), dim=(150, 146, 136), accent=(255, 92, 72), accent2=(70, 212, 200), gold=(232, 184, 82)),
	'paper': dict(bg=(240, 233, 218), grid=(0, 0, 0, 16), text=(28, 26, 24), dim=(120, 112, 100), accent=(222, 60, 44), accent2=(20, 140, 132), gold=(196, 140, 30)),
	'night': dict(bg=(10, 14, 32), grid=(120, 160, 255, 18), text=(230, 236, 255), dim=(130, 140, 175), accent=(255, 196, 60), accent2=(110, 160, 255), gold=(255, 120, 170)),
}


def C(rgb, a=255):
	return skia.Color(rgb[0], rgb[1], rgb[2], rgb[3] if len(rgb) == 4 else a)


def font(name, size):
	return skia.Font(skia.Typeface.MakeFromFile(os.path.join(FONT_DIR, name)), size)


DISPLAY = 'Anton-Regular.ttf'
SERIF = 'PlayfairDisplay-Italic.ttf'
BOLD = 'Inter-ExtraBold.ttf'


# ---------- easing ----------


def clamp(x, a=0.0, b=1.0):
	return max(a, min(b, x))


def ease_out(t):
	t = clamp(t)
	return 1 - (1 - t) ** 3


def ease_in_out(t):
	t = clamp(t)
	return 4 * t**3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def back_out(t):
	t = clamp(t)
	c = 1.9
	return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def paint(color, alpha=1.0, stroke=0, cap=skia.Paint.kRound_Cap):
	p = skia.Paint(AntiAlias=True, Color=color)
	p.setAlphaf(clamp(alpha) * (skia.Color4f(color).fA))
	if stroke:
		p.setStyle(skia.Paint.kStroke_Style)
		p.setStrokeWidth(stroke)
		p.setStrokeCap(cap)
		p.setStrokeJoin(skia.Paint.kRound_Join)
	return p


def text_center(canvas, s, cx, y, f, p):
	canvas.drawString(s, cx - f.measureText(s) / 2, y, f, p)


def wrap(s, f, max_w):
	lines, cur = [], ''
	for w in s.split():
		t = (cur + ' ' + w).strip()
		if f.measureText(t) > max_w and cur:
			lines.append(cur)
			cur = w
		else:
			cur = t
	if cur:
		lines.append(cur)
	return lines


# ---------- background layers ----------


class Backdrop:
	def __init__(self, th, seed=7):
		self.th = th
		rng = random.Random(seed)
		self.dust = [(rng.random() * W, rng.random() * H, rng.uniform(1, 3.2), rng.uniform(4, 18), rng.random() * 6.28) for _ in range(70)]
		nrng = np.random.default_rng(seed)
		self.grain = []
		for _ in range(4):
			n = nrng.integers(0, 255, (H // 2, W // 2), dtype=np.uint8)
			rgba = np.dstack([n, n, n, np.full_like(n, 12)])
			self.grain.append(skia.Image.fromarray(rgba, colorType=skia.kRGBA_8888_ColorType))

	def draw(self, c, t):
		th = self.th
		c.clear(C(th['bg']))
		# vignette
		shader = skia.GradientShader.MakeRadial(skia.Point(W / 2, H * 0.45), H * 0.75, [skia.Color(0, 0, 0, 0), skia.Color(0, 0, 0, 120)])
		c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=shader))
		# grid
		g = paint(C(th['grid']), stroke=1.5)
		step = 90
		for x in range(0, W + 1, step):
			c.drawLine(x, 0, x, H, g)
		for y in range(0, H + 1, step):
			c.drawLine(0, y, W, y, g)
		# drifting dust
		for x, y, r, sp, ph in self.dust:
			yy = (y - t * sp) % H
			xx = x + math.sin(t * 0.5 + ph) * 12
			c.drawCircle(xx, yy, r, paint(C(th['text']), 0.18 + 0.12 * math.sin(t * 2 + ph)))

	def draw_grain(self, c, frame):
		img = self.grain[(frame // 3) % len(self.grain)]
		c.drawImageRect(img, skia.Rect(0, 0, W, H), skia.SamplingOptions())


# ---------- scene visuals (each draws into the stage area) ----------

STAGE_TOP, STAGE_BOTTOM = 470, 1290
STAGE_CY = (STAGE_TOP + STAGE_BOTTOM) / 2


def vis_title(c, th, v, t, dur):
	lines = v.get('lines') or [v.get('text', '')]
	size = v.get('size', 150)
	f = font(DISPLAY, size)
	lh = size * 1.08
	y0 = STAGE_CY - lh * len(lines) / 2 + size * 0.8
	for i, line in enumerate(lines):
		k = ease_out((t - 0.12 * i) / 0.5)
		col = th['accent'] if i in v.get('accent_lines', [len(lines) - 1]) else th['text']
		y = y0 + i * lh + (1 - k) * 60
		text_center(c, line.upper(), W / 2, y, f, paint(C(col), k))
	# underline sweep
	k = ease_in_out((t - 0.4) / 0.6)
	if k > 0:
		y = y0 + (len(lines) - 1) * lh + 50
		c.drawLine(W / 2 - 260 * k, y, W / 2 + 260 * k, y, paint(C(th['accent']), stroke=10))
	if v.get('sub'):
		k = ease_out((t - 0.6) / 0.5)
		text_center(c, v['sub'], W / 2, y0 + (len(lines) - 1) * lh + 140, font(SERIF, 58), paint(C(th['dim']), k))


def vis_stat(c, th, v, t, dur):
	value = float(v.get('value', 100))
	k = ease_out(t / min(1.6, dur * 0.6))
	decimals = int(v.get('decimals', 0))
	num = f"{v.get('prefix', '')}{value * k:,.{decimals}f}{v.get('suffix', '')}"
	cx, cy, r = W / 2, STAGE_CY - 40, 290
	c.drawCircle(cx, cy, r, paint(C(th['dim']), 0.25, stroke=6))
	arc = skia.Path()
	arc.addArc(skia.Rect(cx - r, cy - r, cx + r, cy + r), -90, 360 * k * float(v.get('ring', 1.0)))
	c.drawPath(arc, paint(C(th['accent']), stroke=18))
	f = font(DISPLAY, 200 if len(num) < 6 else 150)
	text_center(c, num, cx, cy + 70, f, paint(C(th['text'])))
	if v.get('label'):
		ka = ease_out((t - 0.5) / 0.5)
		for i, line in enumerate(wrap(v['label'], font(SERIF, 56), 820)):
			text_center(c, line, cx, cy + r + 110 + i * 66, font(SERIF, 56), paint(C(th['dim']), ka))


def vis_chart(c, th, v, t, dur):
	x0, x1, y0, y1 = 150, 940, STAGE_BOTTOM - 120, STAGE_TOP + 80
	axis = paint(C(th['dim']), ease_out(t / 0.3), stroke=4)
	c.drawLine(x0, y0, x1, y0, axis)
	c.drawLine(x0, y0, x0, y1, axis)
	lab = font(BOLD, 34)
	if v.get('x_label'):
		text_center(c, v['x_label'].upper(), (x0 + x1) / 2, y0 + 64, lab, paint(C(th['dim'])))
	if v.get('y_label'):
		c.save()
		c.rotate(-90, x0 - 40, (y0 + y1) / 2)
		text_center(c, v['y_label'].upper(), x0 - 40, (y0 + y1) / 2, lab, paint(C(th['dim'])))
		c.restore()
	series = v.get('series', [])
	colors = [th['accent'], th['accent2'], th['gold']]
	draw_t = clamp(v.get('draw_time', min(3.0, dur * 0.8)), 0.5)
	for si, s in enumerate(series):
		pts = s.get('points') or _shape_points(s.get('shape', 'line'))
		col = C(tuple(s['color'])) if 'color' in s else C(colors[si % 3])
		xs = [x0 + (x1 - x0) * px for px, _ in pts]
		ys = [y0 + (y1 - y0) * py for _, py in pts]
		path = skia.Path()
		path.moveTo(xs[0], ys[0])
		for x, y in zip(xs[1:], ys[1:]):
			path.lineTo(x, y)
		k = ease_in_out((t - 0.3 - 0.25 * si) / draw_t)
		if k <= 0:
			continue
		meas = skia.PathMeasure(path, False)
		seg = skia.Path()
		meas.getSegment(0, meas.getLength() * k, seg, True)
		c.drawPath(seg, paint(col, 0.25, stroke=26))
		c.drawPath(seg, paint(col, stroke=9))
		pos, _ = meas.getPosTan(meas.getLength() * k)
		c.drawCircle(pos.x(), pos.y(), 16, paint(col))
		c.drawCircle(pos.x(), pos.y(), 28 + 6 * math.sin(t * 8), paint(col, 0.5, stroke=4))
		if s.get('label'):
			lf = font(BOLD, 40)
			c.drawString(s['label'], x0 + 30, y1 + 10 + si * 60, lf, paint(col, ease_out(k * 3)))


def _shape_points(shape):
	if shape == 'steps':
		pts, y = [(0, 0)], 0
		for i in range(6):
			x = i / 6
			pts += [(x + 1 / 12, y), (x + 1 / 6, y + 1 / 6)]
			y += 1 / 6
		return pts
	if shape == 'curve':
		return [(i / 40, (i / 40) ** 2.2) for i in range(41)]
	if shape == 'wave':
		return [(i / 60, 0.5 + 0.35 * math.sin(i / 60 * 4 * math.pi)) for i in range(61)]
	return [(0, 0), (1, 1)]


def draw_bird(c, th, x, y, s, alpha, phase):
	"""A simple geometric bird (original design): round body, head, beak, legs."""
	body, head, accent = C(th['text']), C(th['text']), C(th['accent'])
	leg = math.sin(phase) * 18 * s
	c.drawLine(x - 10 * s, y + 70 * s, x - 10 * s + leg, y + 140 * s, paint(accent, alpha, stroke=9 * s))
	c.drawLine(x + 20 * s, y + 70 * s, x + 20 * s - leg, y + 140 * s, paint(accent, alpha, stroke=9 * s))
	c.drawOval(skia.Rect(x - 110 * s, y - 40 * s, x + 80 * s, y + 90 * s), paint(body, alpha * 0.92))
	c.drawOval(skia.Rect(x - 95 * s, y - 10 * s, x + 10 * s, y + 55 * s), paint(C(th['dim']), alpha * 0.7))
	return head, accent


def vis_trail(c, th, v, t, dur):
	"""Multiple-exposure motion study: a subject moving across the stage, leaving ghost copies.
	motion: 'hold' = head holds still then snaps forward (like a walking bird); 'smooth' = glides."""
	motion = v.get('motion', 'hold')
	cycle = float(v.get('cycle', 0.9))
	speed = float(v.get('speed', 150))  # px per second for the body
	cy = STAGE_CY + 40

	def body_x(tt):
		return 140 + (tt * speed) % (W - 120)

	def head_x(tt):
		if motion != 'hold':
			return body_x(tt) + 90
		n, f = divmod(tt, cycle)
		snap = ease_out((f - cycle * 0.75) / (cycle * 0.25))
		return body_x(n * cycle) + 90 + speed * cycle * snap

	ghosts = int(v.get('exposures', 5))
	for gi in range(ghosts, -1, -1):
		tt = max(0.0, t - gi * 0.22)
		a = 1.0 if gi == 0 else 0.10 + 0.06 * (ghosts - gi)
		bx, hx = body_x(tt), head_x(tt)
		if bx < 160 and gi:
			continue
		draw_bird(c, th, bx, cy, 1.0, a, tt * 9)
		neck = paint(C(th['text']), a, stroke=46)
		c.drawLine(bx + 30, cy, hx, cy - 110, neck)
		c.drawCircle(hx, cy - 120, 52, paint(C(th['text']), a))
		beak = skia.Path()
		beak.moveTo(hx + 44, cy - 132)
		beak.lineTo(hx + 105, cy - 112)
		beak.lineTo(hx + 42, cy - 102)
		beak.close()
		c.drawPath(beak, paint(C(th['gold']), a))
		c.drawCircle(hx + 14, cy - 130, 15, paint(C(th['accent']), a))
		c.drawCircle(hx + 16, cy - 131, 6, paint(C(th['bg']), a))
	# target markers where the head holds
	if motion == 'hold' and v.get('targets', True):
		n = int(t // cycle)
		for i in range(max(0, n - 3), n + 1):
			hx = body_x(i * cycle) + 90
			k = ease_out((t - i * cycle) / 0.3)
			r = 54 + 12 * (1 - k)
			mp = paint(C(th['accent']), 0.85 * k, stroke=4)
			c.drawCircle(hx, cy - 120, r, mp)
			for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
				c.drawLine(hx + dx * (r - 14), cy - 120 + dy * (r - 14), hx + dx * (r + 22), cy - 120 + dy * (r + 22), mp)
	# ground line with moving dashes
	gy = cy + 150
	c.drawLine(0, gy, W, gy, paint(C(th['text']), 0.8, stroke=4))
	off = -(t * speed) % 120
	for x in np.arange(-120 + off, W, 120):
		c.drawRect(skia.Rect(x, gy + 10, x + 60, gy + 24), paint(C(th['text']), 0.5))


def vis_list(c, th, v, t, dur):
	items = v.get('items', [])
	f = font(BOLD, 56)
	n = len(items)
	gap = 150
	y = STAGE_CY - gap * (n - 1) / 2
	per = min(0.9, (dur - 0.5) / max(n, 1))
	for i, it in enumerate(items):
		k = back_out((t - 0.2 - i * per) / 0.45)
		if k <= 0:
			continue
		x = 140 - (1 - k) * 80
		c.drawCircle(x, y + i * gap - 18, 44 * k, paint(C(th['accent'])))
		text_center(c, str(i + 1), x, y + i * gap + 2, font(DISPLAY, 56), paint(C(th['bg'])))
		lines = wrap(it, f, 760)
		for li, line in enumerate(lines[:2]):
			c.drawString(line, x + 80, y + i * gap + li * 64 - (len(lines[:2]) - 1) * 32, f, paint(C(th['text']), k))


_img_cache = {}


def vis_image(c, th, v, t, dur):
	path = os.path.join(HERE, v['path']) if not os.path.isabs(v['path']) else v['path']
	if path not in _img_cache:
		_img_cache[path] = skia.Image.open(path)
	img = _img_cache[path]
	box = skia.Rect(90, STAGE_TOP, W - 90, STAGE_BOTTOM - 40)
	scale = max(box.width() / img.width(), box.height() / img.height()) * (1.0 + 0.08 * t / max(dur, 1))
	w, h = img.width() * scale, img.height() * scale
	c.save()
	rr = skia.RRect.MakeRectXY(box, 36, 36)
	c.clipRRect(rr, skia.ClipOp.kIntersect, True)
	p = skia.Paint()
	p.setAlphaf(ease_out(t / 0.5))
	c.drawImageRect(img, skia.Rect.MakeXYWH(box.centerX() - w / 2, box.centerY() - h / 2, w, h), skia.SamplingOptions(skia.FilterMode.kLinear), p)
	c.restore()
	c.drawRRect(rr, paint(C(th['text']), 0.6, stroke=4))


VISUALS = {'title': vis_title, 'stat': vis_stat, 'chart': vis_chart, 'trail': vis_trail, 'list': vis_list, 'image': vis_image}


# ---------- captions ----------


def chunk_words(words, max_words=4, max_chars=22):
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
	return re.sub(r"[^\w']", '', w).lower()


def draw_caption(c, th, chunk, t, end_t, highlights):
	f = font(BOLD, 84)
	space = f.measureText(' ') + 10
	widths = [f.measureText(w) + (28 if norm(w) in highlights else 0) for w, _, _ in chunk]
	total = sum(widths) + space * (len(chunk) - 1)
	lines = [chunk]
	if total > W - 140:  # two lines
		half = (len(chunk) + 1) // 2
		lines = [chunk[:half], chunk[half:]]
	base_y = 1450 - (len(lines) - 1) * 55
	fade = min(ease_out((t - chunk[0][1] + 0.05) / 0.12), 1 - ease_out((t - end_t + 0.08) / 0.1))
	for li, line in enumerate(lines):
		lw = sum(f.measureText(w) + (28 if norm(w) in highlights else 0) for w, _, _ in line) + space * (len(line) - 1)
		x = W / 2 - lw / 2
		y = base_y + li * 110
		for w, s, e in line:
			pad = 14 if norm(w) in highlights else 0
			x += pad
			ww = f.measureText(w)
			spoken = t >= s
			active = s <= t < e + 0.05
			pop = back_out((t - s) / 0.18) if spoken else 0.0
			scale = 0.92 + 0.08 * pop
			c.save()
			c.translate(x + ww / 2, y - 30)
			c.scale(scale, scale)
			c.translate(-(x + ww / 2), -(y - 30))
			if norm(w) in highlights and spoken:
				r = skia.Rect(x - 14, y - 76, x + ww + 14, y + 22)
				c.drawRRect(skia.RRect.MakeRectXY(r, 14, 14), paint(C(th['accent']), fade))
				col = (255, 255, 255)
			else:
				col = th['text']
			# shadow for legibility
			c.drawString(w, x + 4, y + 5, f, paint(skia.Color(0, 0, 0), 0.45 * fade))
			c.drawString(w, x, y, f, paint(C(col), fade * (1.0 if spoken else 0.38)))
			if active and norm(w) not in highlights:
				c.drawLine(x, y + 18, x + ww, y + 18, paint(C(th['accent2']), fade, stroke=7))
			c.restore()
			x += ww + space + pad


# ---------- chrome (header, clock, progress) ----------


def draw_chrome(c, th, meta, t, total, scene_idx, n_scenes):
	c.drawString(meta.get('channel', 'factloop'), 70, 190, font(DISPLAY, 76), paint(C(th['text'])))
	c.drawCircle(70 + font(DISPLAY, 76).measureText(meta.get('channel', 'factloop')) + 20, 180, 9, paint(C(th['accent'])))
	if meta.get('kicker'):
		c.drawString(meta['kicker'], 72, 265, font(SERIF, 54), paint(C(th['text']), 0.9))
	if meta.get('tagline'):
		c.drawString(meta['tagline'], 72, 325, font(SERIF, 40), paint(C(th['dim'])))
	# stopwatch: ticks + sweeping hand + scene progress arc
	cx, cy, r = W - 150, 230, 78
	c.drawCircle(cx, cy, r, paint(C(th['text']), 0.9, stroke=4))
	for i in range(12):
		a = i / 12 * 2 * math.pi
		c.drawLine(cx + math.cos(a) * (r - 14), cy + math.sin(a) * (r - 14), cx + math.cos(a) * (r - 4), cy + math.sin(a) * (r - 4), paint(C(th['text']), 0.7, stroke=3))
	arc = skia.Path()
	arc.addArc(skia.Rect(cx - r - 14, cy - r - 14, cx + r + 14, cy + r + 14), -90, 360 * t / total)
	c.drawPath(arc, paint(C(th['accent']), stroke=6))
	a = t * 2 * math.pi / 2 - math.pi / 2
	c.drawLine(cx, cy, cx + math.cos(a) * (r - 16), cy + math.sin(a) * (r - 16), paint(C(th['accent']), stroke=5))
	c.drawCircle(cx, cy, 8, paint(C(th['text'])))
	# scene dots
	for i in range(n_scenes):
		x = W / 2 - (n_scenes - 1) * 18 + i * 36
		c.drawCircle(x, 1800, 8 if i == scene_idx else 5, paint(C(th['accent'] if i <= scene_idx else th['dim']), 1 if i <= scene_idx else 0.5))


# ---------- main ----------


def build_timeline(script, engine, voice, rate):
	pronounce = {str(k): str(v) for k, v in (script.get('pronounce') or {}).items()}
	audio, scenes, t = [], [], 0.4
	audio.append(np.zeros(int(0.4 * tts.SAMPLE_RATE), dtype=np.int16))
	for i, sc in enumerate(script['scenes']):
		print(f'  voice {i + 1}/{len(script["scenes"])}: {sc["say"][:60]}')
		samples, words = tts.speak(sc['say'].strip(), engine, voice, rate, pronounce)
		dur = len(samples) / tts.SAMPLE_RATE
		pause = float(sc.get('pause', 0.45))
		scenes.append(dict(sc, start=t, end=t + dur + pause, words=[(w, s + t, e + t) for w, s, e in words]))
		audio += [samples, np.zeros(int(pause * tts.SAMPLE_RATE), dtype=np.int16)]
		t += dur + pause
	audio.append(np.zeros(int(0.6 * tts.SAMPLE_RATE), dtype=np.int16))
	scenes[-1]['end'] += 0.6
	return np.concatenate(audio), scenes, t + 0.6


def render(script_path, out_path, engine, voice, rate, preview):
	with open(script_path) as f:
		script = yaml.safe_load(f)
	th = THEMES[script.get('theme', 'ink')]
	print('Generating voice-over...')
	audio, scenes, total = build_timeline(script, engine, voice, rate)
	os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
	wav = out_path + '.voice.wav'
	import wave

	with wave.open(wav, 'wb') as wf:
		wf.setnchannels(1)
		wf.setsampwidth(2)
		wf.setframerate(tts.SAMPLE_RATE)
		wf.writeframes(audio.tobytes())

	for sc in scenes:
		sc['chunks'] = chunk_words(sc['words'])
		sc['hl'] = {norm(h) for h in sc.get('highlight', [])}

	cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', wav]
	music = script.get('music')
	if music:
		cmd += ['-stream_loop', '-1', '-i', os.path.join(HERE, music), '-filter_complex', f"[2:a]volume={script.get('music_volume', 0.12)}[m];[1:a][m]amix=inputs=2:duration=first[a]", '-map', '0:v', '-map', '[a]']
	cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out_path]
	ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)

	surface = skia.Surface(W, H)
	c = surface.getCanvas()
	bg = Backdrop(th)
	n_frames = int(total * FPS)
	preview_at = {int(n_frames * p) for p in (0.08, 0.3, 0.55, 0.8)} if preview else set()
	print(f'Rendering {n_frames} frames ({total:.1f}s)...')
	for fi in range(n_frames):
		t = fi / FPS
		bg.draw(c, t)
		si = next((i for i, s in enumerate(scenes) if s['start'] <= t < s['end']), len(scenes) - 1 if t >= scenes[-1]['start'] else 0)
		sc = scenes[si]
		lt, dur = t - sc['start'], sc['end'] - sc['start']
		# scene transition: slide/fade the stage in and out
		k_in, k_out = ease_out(lt / 0.4), ease_out((sc['end'] - t) / 0.3)
		c.save()
		c.translate(0, (1 - k_in) * 50)
		c.saveLayerAlpha(None, int(255 * min(k_in, k_out if si < len(scenes) - 1 else 1)))
		vis = sc.get('visual') or {'type': 'title', 'text': script.get('title', '')}
		VISUALS[vis.get('type', 'title')](c, th, vis, lt, dur)
		c.restore()
		c.restore()
		for ci, ch in enumerate(sc['chunks']):
			end_t = sc['chunks'][ci + 1][0][1] if ci + 1 < len(sc['chunks']) else sc['end']
			if ch[0][1] - 0.05 <= t < end_t:
				draw_caption(c, th, ch, t, end_t, sc['hl'])
		draw_chrome(c, th, script, t, total, si, len(scenes))
		# progress bar
		c.drawRect(skia.Rect(0, H - 14, W * t / total, H), paint(C(th['accent'])))
		bg.draw_grain(c, fi)
		frame = surface.makeImageSnapshot()
		ff.stdin.write(frame.toarray(colorType=skia.kRGBA_8888_ColorType).tobytes())
		if fi in preview_at:
			frame.save(f'{out_path[:-4]}-frame{fi}.png', skia.kPNG)
		if fi % (FPS * 5) == 0:
			print(f'  {fi}/{n_frames}')
	ff.stdin.close()
	if ff.wait() != 0:
		sys.exit('ffmpeg failed')
	os.unlink(wav)
	print(f'Done: {out_path}')


if __name__ == '__main__':
	ap = argparse.ArgumentParser()
	ap.add_argument('script')
	ap.add_argument('-o', '--out')
	ap.add_argument('--engine', default=os.environ.get('TTS_ENGINE', 'edge'), choices=['edge', 'piper'])
	ap.add_argument('--voice', default=None, help='Edge voice name, e.g. en-US-AndrewNeural, en-IN-PrabhatNeural')
	ap.add_argument('--rate', default=None, help='Speaking speed, e.g. +5%% or -10%%')
	ap.add_argument('--preview', action='store_true', help='Also save a few PNG frames')
	a = ap.parse_args()
	with open(a.script) as f:
		meta = yaml.safe_load(f)
	out = a.out or os.path.join(HERE, 'output', os.path.splitext(os.path.basename(a.script))[0] + '.mp4')
	render(a.script, out, a.engine, a.voice or meta.get('voice', 'en-US-AndrewNeural'), a.rate or meta.get('rate', '+0%'), a.preview)
