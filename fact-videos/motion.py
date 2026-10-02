"""Editorial motion-design layers.

A scene is a background ('paper' | 'ink' | 'red') plus a list of layers. Each layer
starts when a chosen word is spoken (`at: "word"`) plus an optional `delay`, so the
graphics hit on the narration. Layer types:

  photo      real image: frame print | full | circle | strip, treatment duotone | bw | color
  headline   kinetic type that slides up out of a mask; `accent` words in red, `marker` word highlighted
  kicker     small mono label with a red tick (e.g. "OSLO · 1948")
  stamp      rubber stamp that slams down (thud + shake)
  counter    odometer-style rolling number with a label
  chips      row of pills popping in; `cross: true` strikes them out one by one
  quote      big quotation with words revealing and a highlighter sweep
  icon       vector line icon that draws itself on, with a ring
  redact     a line of text where words get blacked out
  lower_third name + role bar
  split      two sides (icon or photo + label) with a VS divider
  bars       horizontal bars with counting values
  list       items with draw-on icons
  ghost      huge outlined background word drifting slowly
"""

import math
import random

import numpy as np
import skia

import media
from fx import C, H, W, back_out, clamp, ease_in, ease_in_out, ease_out, font, paint

DISPLAY = 'Anton-Regular.ttf'
SERIF = 'PlayfairDisplay-Black.ttf'
ITALIC = 'PlayfairDisplay-Italic.ttf'
MONO = 'IBMPlexMono-Medium.ttf'
BEBAS = 'BebasNeue-Regular.ttf'
SANS = 'Inter-Bold.ttf'

PAL = dict(paper=(238, 232, 220), ink=(17, 17, 19), red=(228, 55, 44), yellow=(255, 212, 60), mute=(128, 120, 110), white=(250, 248, 244))


def colors(bg):
	if bg == 'paper':
		return dict(bg=PAL['paper'], fg=PAL['ink'], accent=PAL['red'], mute=PAL['mute'], hl=PAL['yellow'])
	if bg == 'red':
		return dict(bg=PAL['red'], fg=PAL['white'], accent=PAL['ink'], mute=(255, 205, 195), hl=PAL['yellow'])
	return dict(bg=PAL['ink'], fg=PAL['white'], accent=PAL['red'], mute=(150, 146, 140), hl=PAL['yellow'])


_fallback = None


def draw_text(c, s, x, y, f, p):
	"""drawString with a per-character fallback font for symbols like ₹ that a font lacks."""
	global _fallback
	if all(f.unicharToGlyph(ord(ch)) for ch in s if not ch.isspace()):
		c.drawString(s, x, y, f, p)
		return f.measureText(s)
	if _fallback is None:
		_fallback = skia.Typeface.MakeFromName('DejaVu Sans', skia.FontStyle.Bold())
	x0 = x
	for ch in s:
		ff = f if f.unicharToGlyph(ord(ch)) or ch.isspace() else skia.Font(_fallback, f.getSize() * 0.8)
		c.drawString(ch, x, y, ff, p)
		x += ff.measureText(ch)
	return x - x0


def measure(s, f):
	if all(f.unicharToGlyph(ord(ch)) for ch in s if not ch.isspace()):
		return f.measureText(s)
	return sum(f.measureText(ch) if f.unicharToGlyph(ord(ch)) or ch.isspace() else f.getSize() * 0.6 for ch in s)


def tracked(c, s, x, y, f, p, track=0.12, center=False):
	"""Letter-spaced text (for small mono/caps labels)."""
	sp = f.getSize() * track
	w = sum(f.measureText(ch) for ch in s) + sp * (len(s) - 1)
	if center:
		x -= w / 2
	for ch in s:
		c.drawString(ch, x, y, f, p)
		x += f.measureText(ch) + sp
	return w


def fit(name, s, max_w, size):
	f = font(name, size)
	w = measure(s, f)
	return font(name, size * max_w / w) if w > max_w else f


def wrap(s, f, max_w):
	lines = []
	for para in s.split('\n'):
		cur = ''
		for w in para.split():
			t = (cur + ' ' + w).strip()
			if measure(t, f) > max_w and cur:
				lines.append(cur)
				cur = w
			else:
				cur = t
		lines.append(cur)
	return lines


def norm(w):
	return ''.join(ch for ch in w.lower() if ch.isalnum())


# ---------------------------------------------------------------- shared texture

_noise = {}


def grunge(w, h, seed=3, density=0.16):
	key = (int(w), int(h), seed)
	if key not in _noise:
		rng = np.random.default_rng(seed)
		a = (rng.random((int(h), int(w))) < density).astype(np.uint8) * 255
		# a few larger worn patches
		for _ in range(18):
			cx, cy, r = rng.integers(0, w), rng.integers(0, h), rng.integers(3, 14)
			yy, xx = np.ogrid[:int(h), :int(w)]
			a[(xx - cx) ** 2 + (yy - cy) ** 2 < r * r] = 255
		z = np.zeros_like(a)
		_noise[key] = skia.Image.fromarray(np.dstack([z, z, z, a]), colorType=skia.kRGBA_8888_ColorType)
	return _noise[key]


# ---------------------------------------------------------------- layers

def L_ghost(c, L, t, dur, col):
	s = str(L.get('text', '')).upper()
	f = fit(DISPLAY, s, W * 1.6, L.get('size', 520))
	x = W / 2 - measure(s, f) / 2 + (-40 + 30 * t) * L.get('drift', 1)
	y = L.get('y', 1000)
	k = ease_out(t / 1.2)
	c.drawString(s, x, y, f, paint(C(col['fg']), 0.10 * k, stroke=3))


def _photo_rect(L):
	frame = L.get('frame', 'print')
	y = L.get('y', 820)
	if frame == 'full':
		return skia.Rect(0, 0, W, H)
	if frame == 'circle':
		r = L.get('size', 300)
		return skia.Rect(W / 2 - r, y - r, W / 2 + r, y + r)
	if frame == 'strip':
		h = L.get('h', 640)
		return skia.Rect(0, y - h / 2, W, y + h / 2)
	w, h = L.get('w', 780), L.get('h', 900)
	x = {'left': 60, 'right': W - 60 - w}.get(L.get('align'), (W - w) / 2)
	return skia.Rect(x, y - h / 2, x + w, y + h / 2)


def _cover(c, img, rect, scale, cf, alpha=1.0, focus=0.35):
	s = max(rect.width() / img.width(), rect.height() / img.height()) * scale
	w, h = img.width() * s, img.height() * s
	x = rect.centerX() - w / 2
	y = rect.top() + (rect.height() - h) * focus  # bias toward the top (faces)
	p = skia.Paint(AntiAlias=True)
	p.setAlphaf(alpha)
	if cf:
		p.setColorFilter(cf)
	c.drawImageRect(img, skia.Rect.MakeXYWH(x, y, w, h), skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear), p)


def L_photo(c, L, t, dur, col):
	img = media.photo(L)
	if img is None:
		return
	frame = L.get('frame', 'print')
	r = _photo_rect(L)
	mode = L.get('treatment', 'duotone')
	cf = media.treat(img, mode, col['bg'] if col['bg'] != PAL['paper'] else (30, 26, 24), (250, 240, 225) if mode == 'duotone' else col['fg'])
	push = 1.04 + 0.08 * clamp(t / max(dur, 1))
	if frame == 'full':
		k = ease_in_out(t / 0.7)
		c.save()
		c.clipRect(skia.Rect(0, H * (1 - k), W, H))
		_cover(c, img, r, push, cf, focus=L.get('focus', 0.3))
		# legibility gradient
		g = skia.GradientShader.MakeLinear([skia.Point(0, H * 0.35), skia.Point(0, H)], [C(col['bg'], 0), C(col['bg'], 235)])
		c.drawRect(r, skia.Paint(Shader=g))
		g2 = skia.GradientShader.MakeLinear([skia.Point(0, 0), skia.Point(0, 380)], [C(col['bg'], 200), C(col['bg'], 0)])
		c.drawRect(skia.Rect(0, 0, W, 380), skia.Paint(Shader=g2))
		c.restore()
		if k < 1:
			c.drawRect(skia.Rect(0, H * (1 - k) - 14, W, H * (1 - k)), paint(C(col['accent'])))
	elif frame == 'strip':
		n = 6
		c.save()
		path = skia.Path()
		for i in range(n):
			k = ease_out((t - i * 0.05) / 0.45)
			sw = W / n
			path.addRect(skia.Rect(i * sw, r.top() + r.height() * (1 - k), (i + 1) * sw + 1, r.bottom()))
		c.clipPath(path, skia.ClipOp.kIntersect, True)
		_cover(c, img, r, push, cf)
		c.restore()
	elif frame == 'circle':
		k = back_out(t / 0.5)
		rad = r.width() / 2 * clamp(k, 0, 1.2)
		c.save()
		cp = skia.Path()
		cp.addCircle(r.centerX(), r.centerY(), rad)
		c.clipPath(cp, skia.ClipOp.kIntersect, True)
		_cover(c, img, r, push, cf)
		c.restore()
		ring = skia.Path()
		ring.addArc(skia.Rect(r.left() - 18, r.top() - 18, r.right() + 18, r.bottom() + 18), -90, 359.9 * ease_in_out((t - 0.2) / 0.8))
		c.drawPath(ring, paint(C(col['accent']), stroke=8))
	else:  # print: bordered photo that drops in with a tilt
		k = back_out((t) / 0.6, 1.4)
		tilt = L.get('tilt', -3)
		c.save()
		c.translate(r.centerX(), r.centerY() + (1 - clamp(k, 0, 1)) * 160)
		c.rotate(tilt + (1 - clamp(k, 0, 1)) * 8)
		a = clamp(t / 0.2)
		rr = skia.Rect(-r.width() / 2, -r.height() / 2, r.width() / 2, r.height() / 2)
		c.drawRect(rr.makeOffset(10, 24), paint(skia.Color(0, 0, 0), 0.35 * a, blur=26))
		c.drawRect(rr.makeOutset(18, 18), paint(C(PAL['white']), a))
		c.save()
		c.clipRect(rr)
		# inner wipe reveal
		kw = ease_in_out((t - 0.1) / 0.6)
		c.clipRect(skia.Rect(rr.left(), rr.top(), rr.left() + rr.width() * kw, rr.bottom()))
		_cover(c, img, rr, push, cf, alpha=a, focus=L.get('focus', 0.3))
		c.restore()
		if 0 < kw < 1:
			x = rr.left() + rr.width() * kw
			c.drawRect(skia.Rect(x - 6, rr.top(), x + 6, rr.bottom()), paint(C(col['accent'])))
		if L.get('annotate'):
			ka = ease_in_out((t - L.get('annotate_delay', 1.0)) / 0.6)
			if ka > 0:
				ell = skia.Path()
				ax, ay = rr.width() * 0.0, -rr.height() * 0.18
				ell.addOval(skia.Rect(ax - rr.width() * 0.32, ay - rr.height() * 0.2, ax + rr.width() * 0.32, ay + rr.height() * 0.2))
				c.rotate(-6)
				c.drawPath(media.trim(ell, ka * 1.06), paint(C(PAL['red']), stroke=9))
		c.restore()
	cr = L.get('_credit')
	if cr and frame == 'strip':
		c.drawString(f'PHOTO: {cr}'.upper()[:70], 24, r.bottom() - 18, font(MONO, 18), paint(C(PAL['white']), 0.75 * clamp(t / 0.5)))
	elif cr and frame != 'full':
		f = font(MONO, 20)
		c.drawString(f'PHOTO: {cr}'.upper()[:70], r.left() + 4, r.bottom() + 52, f, paint(C(col['mute']), 0.8 * clamp(t / 0.5)))
	elif cr:
		c.drawString(f'PHOTO: {cr}'.upper()[:70], 60, 1460, font(MONO, 20), paint(C(col['mute']), 0.8))


def L_headline(c, L, t, dur, col):
	text = str(L.get('text', ''))
	style = L.get('font', 'display')
	fname = {'display': DISPLAY, 'serif': SERIF, 'bebas': BEBAS, 'italic': ITALIC}.get(style, DISPLAY)
	upper = style in ('display', 'bebas')
	size = L.get('size', 150 if style != 'serif' else 110)
	f = font(fname, size)
	max_w = L.get('max_w', 920)
	lines = wrap(text.upper() if upper else text, f, max_w)
	# shrink if any single word is too wide
	widest = max((measure(l, f) for l in lines), default=1)
	if widest > max_w:
		f = font(fname, size * max_w / widest)
		size = f.getSize()
	lh = size * (0.98 if upper else 1.12)
	y0 = L.get('y', 820) - lh * (len(lines) - 1) / 2
	accent = {norm(a) for a in L.get('accent', [])}
	color = col['accent'] if L.get('color') == 'accent' else col['fg']
	align = L.get('align', 'center')
	for i, line in enumerate(lines):
		k = ease_out((t - i * 0.09) / 0.55)
		y = y0 + i * lh
		lw = measure(line, f)
		x = {'left': 80, 'right': W - 80 - lw}.get(align, W / 2 - lw / 2)
		c.save()
		c.clipRect(skia.Rect(0, y - size * 1.0, W, y + size * 0.28))
		yy = y + (1 - k) * size * 1.2
		# marker highlight behind a word
		for wi, word in enumerate(line.split()):
			pre = ' '.join(line.split()[:wi])
			wx = x + (measure(pre + ' ', f) if pre else 0)
			ww = measure(word, f)
			if L.get('marker') and norm(word) == norm(L['marker']):
				km = ease_in_out((t - 0.45 - i * 0.09) / 0.4)
				c.drawRect(skia.Rect(wx - 12, yy - size * 0.62, wx - 12 + (ww + 24) * km, yy + size * 0.12), paint(C(col['hl']), 0.95))
			wcol = col['accent'] if norm(word) in accent else color
			if L.get('marker') and norm(word) == norm(L['marker']):
				wcol = PAL['ink']
			draw_text(c, word, wx, yy, f, paint(C(wcol)))
		c.restore()
	if L.get('rule'):
		kr = ease_in_out((t - 0.3) / 0.5)
		yb = y0 + (len(lines) - 1) * lh + size * 0.32
		c.drawRect(skia.Rect(W / 2 - 160 * kr, yb, W / 2 + 160 * kr, yb + 8), paint(C(col['accent'])))


def L_kicker(c, L, t, dur, col):
	s = str(L.get('text', '')).upper()
	f = font(MONO, L.get('size', 34))
	y = L.get('y', 520)
	k = ease_out(t / 0.5)
	wtxt = sum(f.measureText(ch) for ch in s) + f.getSize() * 0.12 * (len(s) - 1)
	x = W / 2 - (wtxt + 44) / 2 if L.get('align', 'center') == 'center' else 80
	c.save()
	c.clipRect(skia.Rect(x - 10, y - 50, x + (wtxt + 60) * k, y + 20))
	c.drawRect(skia.Rect(x, y - 30, x + 22, y - 8), paint(C(col['accent'])))
	tracked(c, s, x + 44, y - 6, f, paint(C(col['fg']), 0.9))
	c.restore()


def L_stamp(c, L, t, dur, col):
	s = str(L.get('text', '')).upper()
	f = fit(DISPLAY, s, 700, L.get('size', 130))
	tw = measure(s, f)
	k = clamp(t / 0.16)
	sc = 2.6 - 1.6 * ease_in(k)
	alpha = clamp(t / 0.08)
	color = C(L.get('color') and tuple(L['color']) or PAL['red'])
	x, y = L.get('x', W / 2), L.get('y', 820)
	c.save()
	c.translate(x, y)
	c.rotate(L.get('rotate', -10))
	c.scale(sc, sc)
	pad = 34
	box = skia.Rect(-tw / 2 - pad, -f.getSize() * 0.62 - pad * 0.6, tw / 2 + pad, f.getSize() * 0.2 + pad * 0.6)
	c.saveLayer()
	c.drawRect(box, paint(color, alpha, stroke=10))
	c.drawRect(box.makeInset(16, 16), paint(color, alpha, stroke=4))
	c.drawString(s, -tw / 2, f.getSize() * 0.12, f, paint(color, alpha))
	g = grunge(box.width(), box.height())
	gp = skia.Paint()
	gp.setBlendMode(skia.BlendMode.kDstOut)
	c.drawImage(g, box.left(), box.top(), skia.SamplingOptions(), gp)
	c.restore()
	c.restore()


def L_counter(c, L, t, dur, col):
	value = float(L.get('value', 0))
	dec = int(L.get('decimals', 0))
	final = f'{value:.{dec}f}' if L.get('plain') else f'{value:,.{dec}f}'
	pre, suf = str(L.get('prefix', '')), str(L.get('suffix', ''))
	f = font(DISPLAY, L.get('size', 260))
	y = L.get('y', 860)
	digit_w = f.measureText('0')
	total_w = measure(pre, f) + sum(f.measureText(ch) for ch in final) + measure(suf, font(DISPLAY, f.getSize() * 0.45))
	x = W / 2 - total_w / 2
	k = ease_out((t) / L.get('roll', 1.6))
	fg = paint(C(col['fg']))
	if pre:
		x += draw_text(c, pre, x, y, f, paint(C(col['fg']), clamp(t / 0.3)))
	digits = [ch for ch in final if ch.isdigit()]
	di = 0
	asc = f.getSize() * 0.74
	for ch in final:
		if ch.isdigit():
			target = int(ch)
			spins = (len(digits) - di)  # left digits spin more
			pos = (target + 10 * spins) * k
			cw = f.measureText(ch)
			c.save()
			c.clipRect(skia.Rect(x - 10, y - asc - 6, x + cw + 10, y + 14))
			base = int(math.floor(pos))
			frac = pos - base
			for j, off in ((base, 0), (base + 1, 1)):
				yy = y - (frac - off) * asc * 1.25
				g = str(j % 10)
				c.drawString(g, x + (cw - f.measureText(g)) / 2, yy, f, fg)
			c.restore()
			x += cw
			di += 1
		else:
			c.drawString(ch, x, y, f, paint(C(col['fg']), k))
			x += f.measureText(ch)
	if suf:
		sf = font(DISPLAY, f.getSize() * 0.45)
		draw_text(c, suf, x + 10, y, sf, paint(C(col['accent']), ease_out((t - 0.8) / 0.4)))
	if L.get('label'):
		kl = ease_out((t - 0.5) / 0.5)
		lf = font(MONO, 34)
		tracked(c, str(L['label']).upper(), W / 2, y + 90, lf, paint(C(col['mute']), kl), center=True)
		c.drawRect(skia.Rect(W / 2 - 220 * kl, y + 30, W / 2 + 220 * kl, y + 36), paint(C(col['accent'])))


def L_chips(c, L, t, dur, col):
	items = [str(i) for i in L.get('items', [])][:8]
	if not items:
		return
	f = font(BEBAS, L.get('size', 76))
	pad_x, h = 30, f.getSize() * 1.1
	widths = [f.measureText(s) + pad_x * 2 for s in items]
	gap = 22
	rows, cur, cw = [], [], 0
	for i, w in enumerate(widths):
		if cur and cw + w > 940:
			rows.append(cur)
			cur, cw = [], 0
		cur.append(i)
		cw += w + gap
	rows.append(cur)
	y0 = L.get('y', 860) - (len(rows) - 1) * (h + gap) / 2
	stagger = L.get('stagger', 0.16)
	hi = L.get('highlight', -1)
	for ri, row in enumerate(rows):
		rw = sum(widths[i] for i in row) + gap * (len(row) - 1)
		x = W / 2 - rw / 2
		y = y0 + ri * (h + gap)
		for i in row:
			k = back_out((t - i * stagger) / 0.35)
			if k > 0:
				c.save()
				c.translate(x + widths[i] / 2, y)
				c.scale(clamp(k, 0, 1.2), clamp(k, 0, 1.2))
				box = skia.Rect(-widths[i] / 2, -h / 2, widths[i] / 2, h / 2)
				on = i == hi or (hi == -1 and i == len(items) - 1 and L.get('last_accent'))
				c.drawRRect(skia.RRect.MakeRectXY(box, h / 2, h / 2), paint(C(col['accent'] if on else col['fg']), 1 if on else 0.92))
				c.drawString(items[i], -f.measureText(items[i]) / 2, f.getSize() * 0.36, f, paint(C(col['bg'])))
				if L.get('cross'):
					kx = ease_in_out((t - len(items) * stagger - 0.2 - i * 0.12) / 0.25)
					if kx > 0:
						c.drawLine(box.left() + 8, 6, box.left() + 8 + (box.width() - 16) * kx, -6, paint(C(PAL['red']), stroke=9))
				c.restore()
			x += widths[i] + gap


def L_quote(c, L, t, dur, col):
	text = str(L.get('text', ''))
	f = font(SERIF, L.get('size', 84))
	lines = wrap(text, f, 880)
	lh = f.getSize() * 1.18
	y0 = L.get('y', 820) - lh * (len(lines) - 1) / 2
	kq = back_out(t / 0.5)
	qf = font(SERIF, 420)
	c.save()
	c.translate(120, y0 - lh * 0.9)
	c.scale(kq, kq)
	c.drawString('“', -60, 200, qf, paint(C(col['accent']), 0.9 * clamp(kq)))
	c.restore()
	hl = {norm(h) for h in L.get('highlight', [])}
	words_total = sum(len(l.split()) for l in lines)
	per = min(0.12, 1.4 / max(words_total, 1))
	wi = 0
	for li, line in enumerate(lines):
		x = W / 2 - measure(line, f) / 2
		y = y0 + li * lh
		for word in line.split():
			k = ease_out((t - 0.25 - wi * per) / 0.3)
			ww = measure(word, f)
			if norm(word) in hl:
				km = ease_in_out((t - 0.4 - words_total * per) / 0.4)
				c.drawRect(skia.Rect(x - 8, y - f.getSize() * 0.66, x - 8 + (ww + 16) * km, y + f.getSize() * 0.16), paint(C(col['hl'])))
			c.save()
			c.translate(0, (1 - k) * 24)
			draw_text(c, word, x, y, f, paint(C(PAL['ink'] if norm(word) in hl and t > 0.4 + words_total * per else col['fg']), k))
			c.restore()
			x += ww + measure(' ', f)
			wi += 1
	if L.get('by'):
		kb = ease_out((t - 0.4 - words_total * per) / 0.5)
		by = '— ' + str(L['by'])
		yb = y0 + len(lines) * lh + 30
		tracked(c, by.upper(), W / 2, yb, font(MONO, 30), paint(C(col['mute']), kb), center=True)


def _icon(c, name, cx, cy, size, k, color, stroke=1.6):
	paths = media.icon(name)
	if not paths:
		return False
	c.save()
	c.translate(cx - size / 2, cy - size / 2)
	c.scale(size / 24, size / 24)
	p = paint(color, stroke=stroke)
	n = len(paths)
	for i, pth in enumerate(paths):
		kk = clamp((k * (n + 1) - i * 0.6) / 1.6)
		if kk > 0:
			c.drawPath(media.trim(pth, kk), p)
	c.restore()
	return True


def L_icon(c, L, t, dur, col):
	y, size = L.get('y', 800), L.get('size', 380)
	x = L.get('x', W / 2)
	k = ease_in_out(t / L.get('draw', 1.0))
	if L.get('ring', True):
		kr = ease_in_out((t - 0.1) / 0.9)
		ring = skia.Path()
		ring.addArc(skia.Rect(x - size * 0.78, y - size * 0.78, x + size * 0.78, y + size * 0.78), -90, 359.9 * kr)
		c.drawPath(ring, paint(C(col['accent']), stroke=6))
		c.drawCircle(x, y, size * 0.78, paint(C(col['fg']), 0.05 * kr))
	# burst once the icon completes
	kb = ease_out((t - 0.9) / 0.5)
	if 0 < kb < 1:
		for i in range(10):
			a = i / 10 * 2 * math.pi
			r1, r2 = size * (0.85 + 0.25 * kb), size * (0.85 + 0.25 * kb) + 40 * (1 - kb)
			c.drawLine(x + math.cos(a) * r1, y + math.sin(a) * r1, x + math.cos(a) * r2, y + math.sin(a) * r2, paint(C(col['accent']), 1 - kb, stroke=6))
	_icon(c, L.get('name', 'sparkles'), x, y, size, k, C(col['fg']), stroke=L.get('stroke', 1.5))
	if L.get('label'):
		kl = ease_out((t - 0.6) / 0.5)
		tracked(c, str(L['label']).upper(), x, y + size * 0.78 + 90, font(MONO, 36), paint(C(col['fg']), kl), center=True)


def L_redact(c, L, t, dur, col):
	text = str(L.get('text', ''))
	f = font(SERIF, L.get('size', 78))
	lines = wrap(text, f, 900)
	lh = f.getSize() * 1.25
	y0 = L.get('y', 820) - lh * (len(lines) - 1) / 2
	hide = {norm(h) for h in L.get('hide', [])}
	words_total = sum(len(l.split()) for l in lines)
	wi = 0
	for li, line in enumerate(lines):
		x = W / 2 - measure(line, f) / 2
		y = y0 + li * lh
		for word in line.split():
			ww = measure(word, f)
			k = clamp((t - wi * 0.06) / 0.05)
			draw_text(c, word, x, y, f, paint(C(col['fg']), k))
			if norm(word) in hide:
				kb = ease_in_out((t - words_total * 0.06 - 0.3) / 0.35)
				if kb > 0:
					c.drawRect(skia.Rect(x - 6, y - f.getSize() * 0.74, x - 6 + (ww + 12) * kb, y + f.getSize() * 0.2), paint(C(PAL['ink'] if col['bg'] != PAL['ink'] else PAL['red'])))
			x += ww + measure(' ', f)
			wi += 1


def L_lower_third(c, L, t, dur, col):
	y = L.get('y', 1290)
	k = ease_out(t / 0.5)
	name = str(L.get('name', '')).upper()
	nf = fit(DISPLAY, name, 760, 92)
	nw = measure(name, nf)
	x = 80
	c.drawRect(skia.Rect(x, y - 100, x + 14, y - 100 + 150 * k), paint(C(col['accent'])))
	c.save()
	c.clipRect(skia.Rect(x + 30, y - 120, x + 60 + (nw + 40) * k, y + 10))
	c.drawString(name, x + 40 - (1 - k) * 60, y - 16, nf, paint(C(col['fg'])))
	c.restore()
	if L.get('role'):
		kr = ease_out((t - 0.3) / 0.5)
		tracked(c, str(L['role']).upper(), x + 42, y + 36, font(MONO, 30), paint(C(col['mute']), kr))


def L_split(c, L, t, dur, col):
	y = L.get('y', 800)
	kd = ease_in_out(t / 0.6)
	c.drawLine(W / 2, y - 420 * kd, W / 2, y + 420 * kd, paint(C(col['fg']), 0.4, stroke=4))
	for side, sx, delay in ((L.get('left', {}), W * 0.27, 0.1), (L.get('right', {}), W * 0.73, 0.35)):
		k = ease_out((t - delay) / 0.5)
		if k <= 0:
			continue
		c.save()
		c.translate((1 - k) * (-80 if sx < W / 2 else 80), 0)
		if side.get('icon'):
			_icon(c, side['icon'], sx, y - 80, 250, ease_in_out((t - delay) / 0.9), C(side.get('accent') and col['accent'] or col['fg']), stroke=1.4)
		elif side.get('query') or side.get('path') or side.get('openverse'):
			img = media.photo(side)
			if img is not None:
				r = skia.Rect(sx - 200, y - 330, sx + 200, y + 170)
				c.save()
				c.clipRect(r)
				_cover(c, img, r, 1.05 + 0.05 * clamp(t / max(dur, 1)), media.treat(img, side.get('treatment', 'duotone'), (30, 26, 24), (250, 240, 225)), alpha=k)
				c.restore()
		label = str(side.get('label', '')).upper()
		lf = fit(DISPLAY, label, 420, 84)
		c.drawString(label, sx - measure(label, lf) / 2, y + 290, lf, paint(C(col['accent'] if side.get('accent') else col['fg']), k))
		if side.get('sub'):
			tracked(c, str(side['sub']).upper(), sx, y + 350, font(MONO, 28), paint(C(col['mute']), k), center=True)
		c.restore()
	kv = back_out((t - 0.5) / 0.4)
	if kv > 0:
		c.save()
		c.translate(W / 2, y + 40)
		c.scale(kv, kv)
		c.drawCircle(0, 0, 64, paint(C(col['accent'])))
		c.drawString('VS', -font(DISPLAY, 64).measureText('VS') / 2, 23, font(DISPLAY, 64), paint(C(PAL['white'])))
		c.restore()


def L_bars(c, L, t, dur, col):
	items = L.get('items', [])[:5]
	if not items:
		return
	vals = [float(i.get('value', 0)) for i in items]
	mx = max(vals + [1e-9])
	y0 = L.get('y', 820) - 150 * (len(items) - 1) / 2
	for i, (it, v) in enumerate(zip(items, vals)):
		k = ease_out((t - 0.15 * i) / 1.0)
		y = y0 + i * 150
		tracked(c, str(it.get('label', '')).upper(), 80, y - 40, font(MONO, 30), paint(C(col['fg']), clamp(k * 3)))
		bw = 700 * (v / mx) * k
		on = v == max(vals)
		c.drawRect(skia.Rect(80, y - 18, 80 + max(bw, 4), y + 42), paint(C(col['accent'] if on else col['fg']), 1 if on else 0.85))
		val = f"{it.get('prefix', '')}{v * k:,.{int(it.get('decimals', 0))}f}{it.get('suffix', L.get('unit', ''))}"
		draw_text(c, val, 80 + max(bw, 4) + 20, y + 36, font(BEBAS, 72), paint(C(col['fg']), clamp(k * 3)))


def L_list(c, L, t, dur, col):
	items = L.get('items', [])[:4]
	y0 = L.get('y', 820) - 170 * (len(items) - 1) / 2
	for i, it in enumerate(items):
		if isinstance(it, str):
			it = {'text': it}
		k = ease_out((t - i * 0.5) / 0.5)
		if k <= 0:
			continue
		y = y0 + i * 170
		if not _icon(c, it.get('icon', 'check'), 150, y - 20, 90, ease_in_out((t - i * 0.5) / 0.6), C(col['accent']), stroke=2):
			c.drawCircle(150, y - 20, 18, paint(C(col['accent'])))
		f = fit(SANS, str(it.get('text', '')), 740, 58)
		c.save()
		c.clipRect(skia.Rect(230, y - 80, W, y + 30))
		c.drawString(str(it.get('text', '')), 230, y + (1 - k) * 70, f, paint(C(col['fg'])))
		c.restore()


LAYERS = {
	'ghost': L_ghost, 'photo': L_photo, 'headline': L_headline, 'kicker': L_kicker, 'stamp': L_stamp,
	'counter': L_counter, 'chips': L_chips, 'quote': L_quote, 'icon': L_icon, 'redact': L_redact,
	'lower_third': L_lower_third, 'split': L_split, 'bars': L_bars, 'list': L_list,
}

# SFX cue per layer type (name, gain); see sfx.py
LAYER_SFX = {
	'photo': ('swish', 0.10), 'stamp': ('thud', 0.45), 'counter': ('ticks', 0.10), 'chips': ('chiptick', 0.10),
	'quote': ('type', 0.06), 'icon': ('pop', 0.10), 'headline': ('swish', 0.05), 'redact': ('marker', 0.10),
	'split': ('swish', 0.08), 'bars': ('ticks', 0.06), 'lower_third': ('swish', 0.05),
}
