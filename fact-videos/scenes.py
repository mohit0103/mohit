"""Scene visuals. Each takes (canvas, theme, visual_dict, t_in_scene, scene_duration).

Visuals are emoji/graphic-first; on-screen text is kept to short labels because
the captions already carry the words.
"""

import math
import random

import numpy as np
import skia

from fx import (BOLD, DISPLAY, SERIF, C, H, W, back_out, clamp, count_text, draw_emoji, ease_in_out, ease_out, elastic_out,
                fit_font, font, glow, lerp, paint, pill, text_c)

TOP, BOTTOM = 400, 1330
CY = (TOP + BOTTOM) / 2


def _num(x, default=0.0):
	try:
		return float(str(x).replace(',', ''))
	except (TypeError, ValueError):
		return default


def _label(c, th, s, cx, y, size=46, alpha=1.0, color=None, max_w=860):
	if not s:
		return
	f = fit_font(BOLD, s, max_w, size)
	text_c(c, s, cx, y, f, paint(C(color or th['text']), alpha))


def _burst(c, th, cx, cy, t, n=14, r0=150, length=120, seed=1):
	"""Radial speed lines that shoot out once."""
	k = ease_out(t / 0.5)
	if k <= 0 or k >= 1:
		return
	rng = random.Random(seed)
	for i in range(n):
		a = i / n * 2 * math.pi + rng.random() * 0.2
		r1 = r0 + k * 220
		r2 = r1 + length * (1 - k)
		c.drawLine(cx + math.cos(a) * r1, cy + math.sin(a) * r1, cx + math.cos(a) * r2, cy + math.sin(a) * r2, paint(C(th['accent'] if i % 2 else th['gold']), 1 - k, stroke=8))


def _rings(c, th, cx, cy, t, start=0.0, count=3):
	for i in range(count):
		k = ease_out((t - start - i * 0.12) / 0.8)
		if 0 < k < 1:
			c.drawCircle(cx, cy, 120 + 380 * k, paint(C(th['accent']), (1 - k) * 0.8, stroke=10 * (1 - k) + 2))


def _sparkles(c, th, cx, cy, t, radius=330, n=10, seed=4):
	rng = random.Random(seed)
	for i in range(n):
		a = rng.random() * 2 * math.pi
		d = radius * (0.6 + 0.5 * rng.random())
		ph = rng.random() * 6
		s = 0.5 + 0.5 * math.sin(t * 3 + ph)
		x, y = cx + math.cos(a + t * 0.15) * d, cy + math.sin(a + t * 0.15) * d
		r = 6 + 10 * s
		p = paint(C(th['gold']), 0.3 + 0.6 * s)
		path = skia.Path()
		path.moveTo(x, y - r * 2)
		path.quadTo(x, y, x + r * 2, y)
		path.quadTo(x, y, x, y + r * 2)
		path.quadTo(x, y, x - r * 2, y)
		path.quadTo(x, y, x, y - r * 2)
		c.drawPath(path, p)


# ---------------------------------------------------------------- hook


def hook(c, th, v, t, dur):
	"""Big emoji slams in with an impact; one punchy word or number underneath."""
	e = v.get('emoji', '🤯')
	k = clamp(t / 0.35)
	scale = lerp(3.2, 1.0, ease_out(k)) if k < 1 else 1 + 0.03 * math.sin((t - 0.35) * 3)
	size = 430 * scale
	cy = CY - 70 + math.sin(t * 2.2) * 10
	glow(c, W / 2, cy, 260, C(th['accent']), 0.35 * ease_out(t / 0.4))
	_rings(c, th, W / 2, cy, t, 0.3)
	_burst(c, th, W / 2, cy, t - 0.3, seed=7)
	draw_emoji(c, e, W / 2, cy, size, alpha=ease_out(t / 0.15), rot=math.sin(t * 2) * 4, shadow_y=cy + 250)
	text = v.get('text')
	if text:
		kt = back_out((t - 0.45) / 0.35)
		if kt > 0:
			f = fit_font(DISPLAY, text.upper(), 900, 150)
			tw = f.measureText(text.upper())
			y = cy + 380
			c.save()
			c.translate(W / 2, y - 50)
			c.scale(kt, kt)
			c.rotate(-3)
			c.drawRRect(skia.RRect.MakeRectXY(skia.Rect(-tw / 2 - 34, -95, tw / 2 + 34, 70), 22, 22), paint(C(th['accent'])))
			text_c(c, text.upper(), 0, 50, f, paint(skia.ColorWHITE))
			c.restore()


# ---------------------------------------------------------------- hero


def hero(c, th, v, t, dur):
	"""Floating emoji with glow, orbiting satellites and sparkles."""
	e = v.get('emoji', '✨')
	k = back_out(t / 0.5)
	cy = CY - 30 + math.sin(t * 2) * 18
	glow(c, W / 2, cy, 280, C(th['accent2']), 0.3 * k)
	_sparkles(c, th, W / 2, cy, t)
	orbit = v.get('orbit') or []
	behind, front = [], []
	for i, oe in enumerate(orbit):
		a = t * 0.9 + i * 2 * math.pi / max(len(orbit), 1)
		x, y = W / 2 + math.cos(a) * 360, cy + math.sin(a) * 120
		ko = back_out((t - 0.3 - i * 0.12) / 0.4)
		(front if math.sin(a) > 0 else behind).append((oe, x, y, 150 * ko * (0.85 + 0.15 * math.sin(a))))
	for oe, x, y, s in behind:
		draw_emoji(c, oe, x, y, s * 0.85, alpha=0.75)
	draw_emoji(c, e, W / 2, cy, 470 * k, rot=math.sin(t * 1.6) * 5, shadow_y=CY + 290)
	for oe, x, y, s in front:
		draw_emoji(c, oe, x, y, s)
	if v.get('label'):
		kl = ease_out((t - 0.5) / 0.4)
		_label(c, th, v['label'].upper(), W / 2, CY + 400 + (1 - kl) * 30, 54, kl, th['gold'])


# ---------------------------------------------------------------- versus


def versus(c, th, v, t, dur):
	left, right = v.get('left', {}), v.get('right', {})
	lv, rv = _num(left.get('value')), _num(right.get('value'))
	mx = max(lv, rv, 1e-9)
	unit = v.get('unit', '')
	for side, d, col in ((left, -1, th['accent2']), (right, 1, th['accent'])):
		k = back_out((t - (0 if d < 0 else 0.25)) / 0.5)
		x = W / 2 + d * 250 + d * (1 - k) * 500
		y = CY - 160 + math.sin(t * 2 + d) * 10
		glow(c, x, y, 150, C(col), 0.3 * clamp(k))
		draw_emoji(c, side.get('emoji'), x, y, 280 * clamp(k, 0, 1.2), shadow_y=y + 170)
		_label(c, th, (side.get('label') or '').upper(), x, y + 230, 44, clamp(k), max_w=420)
		# bar
		val = _num(side.get('value'))
		if val or side.get('value') == 0:
			kb = ease_out((t - 0.7) / 1.0)
			bh = 330 * (val / mx) * kb
			bx = x - 70
			base = BOTTOM - 20
			c.drawRRect(skia.RRect.MakeRectXY(skia.Rect(bx, base - bh, bx + 140, base), 18, 18), paint(C(col)))
			txt = count_text(val, kb, int(side.get('decimals', 0)), side.get('prefix', ''), side.get('suffix', unit))
			text_c(c, txt, x, base - bh - 24, fit_font(DISPLAY, txt, 400, 76), paint(C(th['text']), kb))
	# VS badge
	kv = elastic_out((t - 0.45) / 0.8)
	if kv > 0:
		c.save()
		c.translate(W / 2, CY - 160)
		c.rotate((1 - kv) * 180)
		c.scale(kv, kv)
		c.drawCircle(0, 0, 78, paint(C(th['gold'])))
		text_c(c, 'VS', 0, 26, font(DISPLAY, 80), paint(C(th['bg'])))
		c.restore()


# ---------------------------------------------------------------- bars


def bars(c, th, v, t, dur):
	items = v.get('items', [])[:5]
	if not items:
		return
	vals = [_num(i.get('value')) for i in items]
	mx = max(vals + [1e-9])
	n = len(items)
	row = min(170, (BOTTOM - TOP - 40) / n)
	y0 = CY - row * n / 2 + row / 2
	unit = v.get('unit', '')
	best = vals.index(max(vals))
	cols = [th['accent2'], th['gold'], th['accent'], th['accent2'], th['gold']]
	for i, (it, val) in enumerate(zip(items, vals)):
		k = ease_out((t - 0.2 - i * 0.18) / 0.9)
		if k <= 0:
			continue
		y = y0 + i * row
		draw_emoji(c, it.get('emoji'), 130, y, 120 * back_out((t - 0.1 - i * 0.18) / 0.4))
		bw = 640 * (val / mx) * k
		col = th['accent'] if i == best else cols[i % 5]
		c.drawRRect(skia.RRect.MakeRectXY(skia.Rect(220, y - 38, 220 + max(bw, 40), y + 38), 38, 38), paint(C(col), 0.95))
		_label_left(c, (it.get('label') or ''), 240, y - 50, th)
		txt = count_text(val, k, int(it.get('decimals', 0)), it.get('prefix', ''), it.get('suffix', unit))
		f = font(DISPLAY, 60)
		tx = 220 + max(bw, 40) + 20
		if tx + f.measureText(txt) > W - 30:
			tx = 220 + max(bw, 40) - f.measureText(txt) - 24
			c.drawString(txt, tx, y + 22, f, paint(C(th['bg'])))
		else:
			c.drawString(txt, tx, y + 22, f, paint(C(th['text'])))
		if i == best and k >= 1:
			draw_emoji(c, '👑', 220 + bw - 10, y - 70, 90 * back_out((t - 1.3 - i * 0.18) / 0.4), rot=15)


def _label_left(c, s, x, y, th):
	if s:
		f = fit_font(BOLD, s.upper(), 700, 34)
		c.drawString(s.upper(), x, y, f, paint(C(th['dim'])))


# ---------------------------------------------------------------- pictogram


def pictogram(c, th, v, t, dur):
	total = int(_num(v.get('total'), 10))
	total = max(1, min(total, 100))
	hl = int(_num(v.get('highlight'), 1))
	e = v.get('emoji', '🧍')
	cols = min(total, 5) if total <= 25 else 10
	rows = math.ceil(total / cols)
	cell = min(300, 900 / cols, (BOTTOM - TOP - 220) / rows)
	x0 = W / 2 - cell * (cols - 1) / 2
	y0 = CY - 60 - cell * (rows - 1) / 2
	reveal = min(1.2, dur * 0.35)
	for i in range(total):
		k = back_out((t - 0.15 - reveal * i / total) / 0.35)
		r, col = divmod(i, cols)
		x, y = x0 + col * cell, y0 + r * cell
		on = i < hl
		lit = t > 0.3 + reveal + 0.2
		if on and lit:
			glow(c, x, y, cell * 0.45, C(th['accent']), 0.35)
		draw_emoji(c, e, x, y, cell * 0.85 * k, gray=lit and not on)
	txt = v.get('label') or f'{hl} in {total}'
	kl = back_out((t - 0.5 - reveal) / 0.4)
	if kl > 0:
		f = fit_font(DISPLAY, txt.upper(), 900, 110)
		c.save()
		c.translate(W / 2, y0 + rows * cell + 70)
		c.scale(kl, kl)
		text_c(c, txt.upper(), 0, 30, f, paint(C(th['accent'])))
		c.restore()


# ---------------------------------------------------------------- stat


def stat(c, th, v, t, dur):
	value = _num(v.get('value'), 100)
	k = ease_out(t / min(1.6, max(dur * 0.6, 0.5)))
	num = count_text(value, k, int(v.get('decimals', 0)), v.get('prefix', ''), v.get('suffix', ''))
	cx, cy, r = W / 2, CY - 40, 300
	glow(c, cx, cy, r, C(th['accent']), 0.18)
	c.drawCircle(cx, cy, r, paint(C(th['dim']), 0.25, stroke=14))
	arc = skia.Path()
	arc.addArc(skia.Rect(cx - r, cy - r, cx + r, cy + r), -90, 359.9 * k * clamp(_num(v.get('ring'), 1)))
	c.drawPath(arc, paint(C(th['accent']), stroke=24))
	for i in range(60):
		a = i / 60 * 2 * math.pi
		on = i / 60 < k
		c.drawLine(cx + math.cos(a) * (r + 30), cy + math.sin(a) * (r + 30), cx + math.cos(a) * (r + 44), cy + math.sin(a) * (r + 44), paint(C(th['text']), 0.7 if on else 0.15, stroke=4))
	f = fit_font(DISPLAY, num, 520, 210)
	text_c(c, num, cx, cy + 75, f, paint(C(th['text'])))
	if v.get('emoji'):
		ke = back_out((t - 0.3) / 0.4)
		draw_emoji(c, v['emoji'], cx + r * 0.72, cy - r * 0.72, 190 * ke, rot=12)
	if v.get('label'):
		kl = ease_out((t - 0.5) / 0.4)
		_label(c, th, v['label'].upper(), cx, cy + r + 130, 50, kl, th['gold'])


# ---------------------------------------------------------------- timeline


def timeline(c, th, v, t, dur):
	ev = v.get('events', [])[:5]
	if not ev:
		return
	n = len(ev)
	x = 230
	y0, y1 = TOP + 60, BOTTOM - 60
	step = (y1 - y0) / max(n - 1, 1)
	kline = ease_in_out(t / max(dur * 0.75, 0.8))
	c.drawLine(x, y0, x, y1, paint(C(th['dim']), 0.3, stroke=8))
	c.drawLine(x, y0, x, y0 + (y1 - y0) * kline, paint(C(th['accent']), stroke=8))
	for i, e in enumerate(ev):
		y = y0 + i * step if n > 1 else CY
		reach = (y - y0) / max(y1 - y0, 1)
		k = back_out((kline - reach) * 6) if kline >= reach - 0.001 else 0
		if k <= 0:
			continue
		c.drawCircle(x, y, 22 * k, paint(C(th['accent'])))
		c.drawCircle(x, y, 36 * k, paint(C(th['accent']), 0.4, stroke=4))
		yr = str(e.get('year', ''))
		c.drawString(yr, x - 40 - font(DISPLAY, 64).measureText(yr) - 10, y + 22, font(DISPLAY, 64), paint(C(th['gold']), clamp(k)))
		draw_emoji(c, e.get('emoji'), x + 120, y, 130 * k)
		lab = e.get('label', '')
		if lab:
			f = fit_font(BOLD, lab, 560, 44)
			c.drawString(lab, x + 200, y + 16, f, paint(C(th['text']), clamp(k)))


# ---------------------------------------------------------------- scale


def scale(c, th, v, t, dur):
	items = v.get('items', [])[:4]
	if not items:
		return
	sizes = [_num(i.get('size'), 1) for i in items]
	mx = max(sizes)
	n = len(items)
	base = BOTTOM - 140
	slot = 900 / n
	maxpx = min(520, slot * 1.25)
	for i, (it, s) in enumerate(zip(items, sizes)):
		k = back_out((t - 0.2 - i * 0.35) / 0.6)
		if k <= 0:
			continue
		px = max(60, maxpx * math.sqrt(s / mx)) * k
		x = 90 + slot * (i + 0.5)
		draw_emoji(c, it.get('emoji'), x, base - px / 2, px, shadow_y=base + 8)
		_label(c, th, (it.get('label') or '').upper(), x, base + 80, 38, clamp(k), max_w=slot - 20)
	c.drawLine(60, base + 10, W - 60, base + 10, paint(C(th['dim']), 0.5, stroke=4))


# ---------------------------------------------------------------- flow (cause -> effect)


def flow(c, th, v, t, dur):
	steps = v.get('steps', [])[:4]
	if not steps:
		return
	n = len(steps)
	y0, y1 = TOP + 90, BOTTOM - 110
	gap = (y1 - y0) / max(n - 1, 1)
	per = min(0.9, dur * 0.8 / n)
	for i, s in enumerate(steps):
		y = y0 + i * gap if n > 1 else CY
		k = back_out((t - i * per) / 0.45)
		x = W / 2 + (-1 if i % 2 else 1) * 160
		if i > 0:
			py = y0 + (i - 1) * gap
			px = W / 2 + (-1 if (i - 1) % 2 else 1) * 160
			ka = ease_in_out((t - i * per + 0.35) / 0.4)
			if ka > 0:
				mx_, my_ = (px + x) / 2 + 180 * (1 if i % 2 else -1), (py + y) / 2
				path = skia.Path()
				path.moveTo(px, py + 85)
				path.quadTo(mx_, my_, x, y - 85)
				meas = skia.PathMeasure(path, False)
				seg = skia.Path()
				meas.getSegment(0, meas.getLength() * ka, seg, True)
				c.drawPath(seg, paint(C(th['gold']), stroke=10))
				pos, tan = meas.getPosTan(meas.getLength() * ka)
				ang = math.atan2(tan.y(), tan.x())
				head = skia.Path()
				head.moveTo(pos.x() + math.cos(ang) * 30, pos.y() + math.sin(ang) * 30)
				head.lineTo(pos.x() + math.cos(ang + 2.5) * 30, pos.y() + math.sin(ang + 2.5) * 30)
				head.lineTo(pos.x() + math.cos(ang - 2.5) * 30, pos.y() + math.sin(ang - 2.5) * 30)
				head.close()
				c.drawPath(head, paint(C(th['gold'])))
		if k <= 0:
			continue
		c.drawCircle(x, y, 105 * k, paint(C(th['accent2'] if i < n - 1 else th['accent']), 0.25))
		draw_emoji(c, s.get('emoji'), x, y, 150 * k)
		lab = (s.get('label') or '').upper()
		if lab:
			f = fit_font(BOLD, lab, 380, 40)
			lx = x + (-1 if i % 2 == 0 else 1) * 150
			tw = f.measureText(lab)
			c.drawString(lab, lx - (tw if i % 2 == 0 else 0), y + 14, f, paint(C(th['text']), clamp(k)))


# ---------------------------------------------------------------- list (emoji bullets)


def listing(c, th, v, t, dur):
	items = v.get('items', [])[:4]
	n = len(items)
	if not n:
		return
	gap = 200
	y0 = CY - gap * (n - 1) / 2
	per = min(0.9, (dur - 0.5) / n)
	for i, it in enumerate(items):
		if isinstance(it, str):
			it = {'label': it}
		k = back_out((t - 0.15 - i * per) / 0.45)
		if k <= 0:
			continue
		y = y0 + i * gap
		x = 170 - (1 - clamp(k)) * 120
		c.drawRRect(skia.RRect.MakeRectXY(skia.Rect(x - 90, y - 80, W - 70, y + 80), 40, 40), paint(C(th['text']), 0.07 * clamp(k)))
		draw_emoji(c, it.get('emoji') or '✅', x, y, 130 * k)
		f = fit_font(BOLD, it.get('label', ''), 700, 56)
		c.drawString(it.get('label', ''), x + 100, y + 20, f, paint(C(th['text']), clamp(k)))


# ---------------------------------------------------------------- chart


def _shape_points(shape):
	if shape == 'steps':
		pts, y = [(0, 0)], 0
		for i in range(6):
			x = i / 6
			pts += [(x + 1 / 12, y), (x + 1 / 6, y + 1 / 6)]
			y += 1 / 6
		return pts
	if shape == 'curve':
		return [(i / 40, (i / 40) ** 2.4) for i in range(41)]
	if shape == 'drop':
		return [(i / 40, 1 - (i / 40) ** 0.5) for i in range(41)]
	if shape == 'wave':
		return [(i / 60, 0.5 + 0.35 * math.sin(i / 60 * 4 * math.pi)) for i in range(61)]
	return [(0, 0), (1, 1)]


def chart(c, th, v, t, dur):
	x0, x1, y0, y1 = 160, 950, BOTTOM - 120, TOP + 120
	axis = paint(C(th['dim']), ease_out(t / 0.3), stroke=5)
	c.drawLine(x0, y0, x1, y0, axis)
	c.drawLine(x0, y0, x0, y1, axis)
	for gy in range(1, 5):
		yy = y0 + (y1 - y0) * gy / 4
		c.drawLine(x0, yy, x1, yy, paint(C(th['dim']), 0.12, stroke=2))
	lab = font(BOLD, 34)
	if v.get('x_label'):
		text_c(c, v['x_label'].upper(), (x0 + x1) / 2, y0 + 64, lab, paint(C(th['dim'])))
	if v.get('y_label'):
		c.save()
		c.rotate(-90, x0 - 40, (y0 + y1) / 2)
		text_c(c, v['y_label'].upper(), x0 - 40, (y0 + y1) / 2, lab, paint(C(th['dim'])))
		c.restore()
	colors = [th['accent'], th['accent2'], th['gold']]
	draw_t = max(0.5, min(3.0, dur * 0.75))
	for si, s in enumerate(v.get('series', [])):
		pts = s.get('points') or _shape_points(s.get('shape', 'line'))
		col = C(colors[si % 3])
		path = skia.Path()
		for j, (px, py) in enumerate(pts):
			x, y = x0 + (x1 - x0) * px, y0 + (y1 - y0) * py
			path.moveTo(x, y) if j == 0 else path.lineTo(x, y)
		k = ease_in_out((t - 0.3 - 0.25 * si) / draw_t)
		if k <= 0:
			continue
		meas = skia.PathMeasure(path, False)
		seg = skia.Path()
		meas.getSegment(0, meas.getLength() * k, seg, True)
		c.drawPath(seg, paint(col, 0.3, stroke=28, blur=8))
		c.drawPath(seg, paint(col, stroke=10))
		pos, _ = meas.getPosTan(meas.getLength() * k)
		if s.get('emoji'):
			draw_emoji(c, s['emoji'], pos.x(), pos.y() - 10, 110, rot=math.sin(t * 6) * 6)
		else:
			c.drawCircle(pos.x(), pos.y(), 16, paint(col))
		if s.get('label'):
			c.drawString(s['label'].upper(), x0 + 30, y1 - 30 + si * 56, font(BOLD, 40), paint(col, ease_out(k * 3)))


# ---------------------------------------------------------------- title (use sparingly)


def title(c, th, v, t, dur):
	lines = v.get('lines') or [v.get('text', '')]
	if v.get('emoji'):
		ke = back_out(t / 0.45)
		draw_emoji(c, v['emoji'], W / 2, TOP + 150 + math.sin(t * 2) * 10, 260 * ke)
	size = 150
	lh = size * 1.06
	y0 = CY + 60 - lh * len(lines) / 2 + size * 0.8 + (80 if v.get('emoji') else 0)
	for i, line in enumerate(lines):
		k = ease_out((t - 0.12 * i) / 0.45)
		col = th['accent'] if i == len(lines) - 1 else th['text']
		f = fit_font(DISPLAY, line.upper(), 920, size)
		text_c(c, line.upper(), W / 2, y0 + i * lh + (1 - k) * 60, f, paint(C(col), k))


# ---------------------------------------------------------------- trail (walking motion study)


def trail(c, th, v, t, dur):
	e = v.get('emoji', '🐦')
	motion = v.get('motion', 'hold')
	cycle, speed = 0.9, 170
	gy = CY + 160

	def x_at(tt):
		if motion != 'hold':
			return 120 + (tt * speed) % (W - 100)
		n, f = divmod(tt, cycle)
		return 120 + ((n * cycle + cycle * ease_out((f - cycle * 0.7) / (cycle * 0.3))) * speed) % (W - 100)

	for gi in range(5, -1, -1):
		tt = max(0.0, t - gi * 0.2)
		draw_emoji(c, e, x_at(tt), gy - 120, 240, alpha=1.0 if gi == 0 else 0.12 + 0.05 * (5 - gi), shadow_y=gy if gi == 0 else None)
	c.drawLine(0, gy + 10, W, gy + 10, paint(C(th['text']), 0.7, stroke=4))
	off = -(t * speed) % 120
	for x in np.arange(-120 + off, W, 120):
		c.drawRect(skia.Rect(x, gy + 22, x + 60, gy + 34), paint(C(th['text']), 0.4))


# ---------------------------------------------------------------- image


_img = {}


def image(c, th, v, t, dur):
	import os

	path = v['path']
	if path not in _img:
		_img[path] = skia.Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), path))
	img = _img[path]
	box = skia.Rect(90, TOP, W - 90, BOTTOM - 40)
	s = max(box.width() / img.width(), box.height() / img.height()) * (1.0 + 0.08 * t / max(dur, 1))
	w, h = img.width() * s, img.height() * s
	c.save()
	rr = skia.RRect.MakeRectXY(box, 36, 36)
	c.clipRRect(rr, skia.ClipOp.kIntersect, True)
	p = skia.Paint()
	p.setAlphaf(ease_out(t / 0.5))
	c.drawImageRect(img, skia.Rect.MakeXYWH(box.centerX() - w / 2, box.centerY() - h / 2, w, h), skia.SamplingOptions(skia.FilterMode.kLinear), p)
	c.restore()
	c.drawRRect(rr, paint(C(th['text']), 0.6, stroke=4))


VISUALS = {
	'hook': hook, 'hero': hero, 'versus': versus, 'bars': bars, 'pictogram': pictogram, 'stat': stat,
	'timeline': timeline, 'scale': scale, 'flow': flow, 'list': listing, 'chart': chart, 'title': title,
	'trail': trail, 'image': image,
}
