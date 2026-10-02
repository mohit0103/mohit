"""Drawing helpers: easing, paints, fonts, text, emoji, glow."""

import math
import os

import skia

import assets

W, H = 1080, 1920
FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')
DISPLAY = 'Anton-Regular.ttf'
SERIF = 'PlayfairDisplay-Italic.ttf'
BOLD = 'Inter-ExtraBold.ttf'

_tf = {}


def font(name, size):
	if name not in _tf:
		_tf[name] = skia.Typeface.MakeFromFile(os.path.join(FONT_DIR, name))
	return skia.Font(_tf[name], size)


def C(rgb, a=255):
	return skia.Color(rgb[0], rgb[1], rgb[2], rgb[3] if len(rgb) == 4 else a)


def clamp(x, a=0.0, b=1.0):
	return max(a, min(b, x))


def ease_out(t):
	t = clamp(t)
	return 1 - (1 - t) ** 3


def ease_in(t):
	t = clamp(t)
	return t**3


def ease_in_out(t):
	t = clamp(t)
	return 4 * t**3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def back_out(t, c=1.9):
	t = clamp(t)
	return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def elastic_out(t):
	t = clamp(t)
	if t in (0, 1):
		return t
	return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi) / 3) + 1


def lerp(a, b, t):
	return a + (b - a) * t


def paint(color, alpha=1.0, stroke=0, blur=0):
	p = skia.Paint(AntiAlias=True, Color=color)
	p.setAlphaf(clamp(alpha) * skia.Color4f(color).fA)
	if stroke:
		p.setStyle(skia.Paint.kStroke_Style)
		p.setStrokeWidth(stroke)
		p.setStrokeCap(skia.Paint.kRound_Cap)
		p.setStrokeJoin(skia.Paint.kRound_Join)
	if blur:
		p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
	return p


def text_w(s, f):
	return f.measureText(s)


def text_c(c, s, cx, y, f, p, outline=None):
	x = cx - f.measureText(s) / 2
	if outline:
		c.drawString(s, x, y, f, outline)
	c.drawString(s, x, y, f, p)


def fit_font(name, s, max_w, size):
	f = font(name, size)
	w = f.measureText(s)
	if w > max_w:
		f = font(name, size * max_w / w)
	return f


def glow(c, x, y, r, color, alpha=0.5):
	c.drawCircle(x, y, r, paint(color, alpha, blur=r * 0.45))


def shadow(c, x, y, w, alpha=0.35):
	c.drawOval(skia.Rect(x - w / 2, y - w * 0.09, x + w / 2, y + w * 0.09), paint(skia.Color(0, 0, 0), alpha, blur=w * 0.06))


GRAY = skia.ColorFilters.Matrix([0.3, 0.59, 0.11, 0, 0, 0.3, 0.59, 0.11, 0, 0, 0.3, 0.59, 0.11, 0, 0, 0, 0, 0, 1, 0])


def draw_emoji(c, e, cx, cy, size, alpha=1.0, rot=0.0, gray=False, accent=None, shadow_y=None):
	"""Draw a 3D emoji centred at (cx, cy). Falls back to a coloured badge."""
	if alpha <= 0 or size <= 1:
		return
	if shadow_y is not None:
		shadow(c, cx, shadow_y, size * 0.8, 0.35 * alpha)
	img = assets.emoji(e) if e else None
	c.save()
	c.translate(cx, cy)
	if rot:
		c.rotate(rot)
	if img is not None:
		p = skia.Paint(AntiAlias=True)
		p.setAlphaf(clamp(alpha))
		if gray:
			p.setColorFilter(GRAY)
			p.setAlphaf(clamp(alpha) * 0.35)
		c.drawImageRect(img, skia.Rect(-size / 2, -size / 2, size / 2, size / 2), skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear), p)
	else:
		col = accent or skia.Color(255, 92, 72)
		c.drawCircle(0, 0, size * 0.42, paint(col, alpha * (0.35 if gray else 1)))
		label = (e or '?')[:2].upper()
		f = font(DISPLAY, size * 0.38)
		text_c(c, label, 0, size * 0.14, f, paint(skia.ColorWHITE, alpha))
	c.restore()


def pill(c, x, y, w, h, color, alpha=1.0):
	c.drawRRect(skia.RRect.MakeRectXY(skia.Rect(x, y, x + w, y + h), h / 2, h / 2), paint(color, alpha))


def count_text(value, k, decimals=0, prefix='', suffix=''):
	v = value * k
	if decimals == 0 and abs(value) >= 1000:
		s = f'{v:,.0f}'
	else:
		s = f'{v:,.{decimals}f}'
	return f'{prefix}{s}{suffix}'
