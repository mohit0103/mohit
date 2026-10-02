"""Draws the factloop logo concepts (1080x1080 PNGs) plus a circle-crop preview."""
import math
import os
import sys

import numpy as np
import skia

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from fx import font  # noqa: E402

OUT = os.path.dirname(os.path.abspath(__file__))
S = 1080
INK, RED, PAPER = skia.Color(17, 17, 19), skia.Color(228, 55, 44), skia.Color(238, 232, 220)


def stroke(color, w):
	return skia.Paint(AntiAlias=True, Color=color, Style=skia.Paint.kStroke_Style, StrokeWidth=w, StrokeCap=skia.Paint.kRound_Cap, StrokeJoin=skia.Paint.kRound_Join)


def fill(color):
	return skia.Paint(AntiAlias=True, Color=color)


def arrow_head(c, x, y, ang, size, color):
	p = skia.Path()
	p.moveTo(x + math.cos(ang) * size, y + math.sin(ang) * size)
	p.lineTo(x + math.cos(ang + 2.45) * size, y + math.sin(ang + 2.45) * size)
	p.lineTo(x + math.cos(ang - 2.45) * size, y + math.sin(ang - 2.45) * size)
	p.close()
	c.drawPath(p, fill(color))


def grain(c, alpha=10, seed=1):
	n = np.random.default_rng(seed).integers(0, 255, (S, S), dtype=np.uint8)
	img = skia.Image.fromarray(np.dstack([n, n, n, np.full_like(n, alpha)]), colorType=skia.kRGBA_8888_ColorType)
	c.drawImage(img, 0, 0)


def concept_loop_f(c):
	"""A lowercase f whose top hook keeps going round into a loop arrow; red crossbar."""
	c.clear(INK)
	cx = 540
	w = 104
	# stem
	c.drawLine(cx - 70, 900, cx - 70, 470, stroke(PAPER, w))
	# loop: circle around the top, starting at the stem top and travelling clockwise ~300deg
	r = 170
	ox, oy = cx - 70 + r, 470
	path = skia.Path()
	path.addArc(skia.Rect(ox - r, oy - r, ox + r, oy + r), 180, 290)
	c.drawPath(path, stroke(PAPER, w))
	end = math.radians(180 + 290)
	ex, ey = ox + math.cos(end) * r, oy + math.sin(end) * r
	arrow_head(c, ex, ey, end + math.pi / 2, 110, PAPER)
	# crossbar
	c.drawLine(cx - 230, 610, cx + 120, 610, stroke(RED, w))
	grain(c)


def concept_stamp(c):
	"""FACT / LOOP stacked in a slammed rubber-stamp, the O of LOOP replaced by a loop arrow."""
	c.clear(RED)
	c.save()
	c.translate(540, 540)
	c.rotate(-8)
	f = font('Anton-Regular.ttf', 300)
	t1 = 'FACT'
	c.drawString(t1, -f.measureText(t1) / 2, -40, f, fill(INK))
	# LOOP with ring arrows for the two Os
	lw = f.measureText('L')
	pw = f.measureText('P')
	ring = 118
	total = lw + pw + ring * 2 * 2 + 40
	x = -total / 2
	y = 300
	c.drawString('L', x, y, f, fill(INK))
	x += lw + 10
	for i in range(2):
		ccx, ccy = x + ring, y - 108
		p = skia.Path()
		p.addArc(skia.Rect(ccx - ring + 22, ccy - ring + 22, ccx + ring - 22, ccy + ring - 22), -60 + i * 180, 290)
		c.drawPath(p, stroke(INK, 44))
		a = math.radians(-60 + i * 180 + 290)
		arrow_head(c, ccx + math.cos(a) * (ring - 22), ccy + math.sin(a) * (ring - 22), a + math.pi / 2, 50, INK)
		x += ring * 2 + 10
	c.drawString('P', x, y, f, fill(INK))
	box = skia.Rect(-430, -330, 430, 360)
	c.drawRect(box, stroke(INK, 22))
	c.restore()
	grain(c, 14, 2)


def concept_bang(c):
	"""An exclamation mark: the bar is a bold slab, the dot is a loop arrow. Fact = surprise, loop = rewatch."""
	c.clear(INK)
	# bar (slightly tapered slab)
	bar = skia.Path()
	bar.moveTo(470, 170)
	bar.lineTo(610, 170)
	bar.lineTo(585, 640)
	bar.lineTo(495, 640)
	bar.close()
	c.drawPath(bar, fill(PAPER))
	# dot = loop arrow
	cx, cy, r = 540, 805, 92
	p = skia.Path()
	p.addArc(skia.Rect(cx - r, cy - r, cx + r, cy + r), -70, 300)
	c.drawPath(p, stroke(RED, 54))
	a = math.radians(-70 + 300)
	arrow_head(c, cx + math.cos(a) * r, cy + math.sin(a) * r, a + math.pi / 2, 62, RED)
	grain(c)


def concept_bang_wordmark(c):
	"""Wide banner version: factloop wordmark with the bang mark (for highlights / thumbnails)."""
	c.clear(PAPER)
	f = font('Anton-Regular.ttf', 230)
	s1, s2 = 'FACT', 'LOOP'
	w1, w2 = f.measureText(s1), f.measureText(s2)
	x = 540 - (w1 + w2 + 20) / 2
	c.drawString(s1, x, 640, f, fill(INK))
	c.drawString(s2, x + w1 + 20, 640, f, fill(RED))
	c.drawRect(skia.Rect(x, 700, x + w1 + w2 + 20, 716), fill(INK))
	t = 'FACTS THAT MAKE YOU REWATCH'
	mf = font('IBMPlexMono-Medium.ttf', 34)
	sp = 6
	tw = sum(mf.measureText(ch) for ch in t) + sp * (len(t) - 1)
	xx = 540 - tw / 2
	for ch in t:
		c.drawString(ch, xx, 790, mf, fill(INK))
		xx += mf.measureText(ch) + sp
	grain(c, 12, 3)


def final_mark(c, bg=INK, bar=PAPER, loop=RED, lean=6):
	"""Final DP: leaning exclamation mark, the dot is a replay loop."""
	c.clear(bg)
	c.save()
	c.translate(540, 540)
	c.rotate(lean)
	c.translate(-540, -560)
	# bar: tapered slab with a slight chamfer
	b = skia.Path()
	b.moveTo(452, 190)
	b.lineTo(628, 190)
	b.lineTo(598, 615)
	b.lineTo(482, 615)
	b.close()
	c.drawPath(b, fill(bar))
	# dot: replay loop, open at the top-right, arrowhead travelling clockwise into the gap
	cx, cy, r, w = 534, 815, 98, 62
	start, sweep = 75, 280  # gap on the right; arrow heads down into it, away from the bar
	p = skia.Path()
	p.addArc(skia.Rect(cx - r, cy - r, cx + r, cy + r), start, sweep)
	sp = stroke(loop, w)
	sp.setStrokeCap(skia.Paint.kButt_Cap)
	c.drawPath(p, sp)
	a = math.radians(start + sweep)
	tx, ty = math.cos(a + math.pi / 2), math.sin(a + math.pi / 2)  # clockwise tangent
	nx, ny = math.cos(a), math.sin(a)  # outward normal
	px, py = cx + nx * r, cy + ny * r
	head = skia.Path()
	hw, hl = 74, 70
	head.moveTo(px + nx * hw - tx * 2, py + ny * hw - ty * 2)
	head.lineTo(px - nx * hw - tx * 2, py - ny * hw - ty * 2)
	head.lineTo(px + tx * hl, py + ty * hl)
	head.close()
	c.drawPath(head, fill(loop))
	c.restore()
	grain(c, 10, 5)


CONCEPTS = {'loop-f': concept_loop_f, 'stamp': concept_stamp, 'bang': concept_bang, 'wordmark': concept_bang_wordmark}


def main():
	sheet = skia.Surface(4 * 540, 2 * 540)
	sc = sheet.getCanvas()
	sc.clear(skia.Color(250, 250, 250))
	for i, (name, fn) in enumerate(CONCEPTS.items()):
		s = skia.Surface(S, S)
		fn(s.getCanvas())
		img = s.makeImageSnapshot()
		img.save(os.path.join(OUT, f'logo-{name}.png'), skia.kPNG)
		# top row: square; bottom row: Instagram circle crop at small size
		sc.drawImageRect(img, skia.Rect(i * 540 + 10, 10, i * 540 + 530, 530), skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear))
		sc.save()
		clip = skia.Path()
		clip.addCircle(i * 540 + 270, 810, 110)
		sc.clipPath(clip, skia.ClipOp.kIntersect, True)
		sc.drawImageRect(img, skia.Rect(i * 540 + 160, 700, i * 540 + 380, 920), skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear))
		sc.restore()
	sheet.makeImageSnapshot().save(os.path.join(OUT, 'concepts.png'), skia.kPNG)
	finals = {'factloop-dp.png': dict(), 'factloop-dp-red.png': dict(bg=RED, bar=INK, loop=PAPER), 'factloop-dp-paper.png': dict(bg=PAPER, bar=INK, loop=RED)}
	prev = skia.Surface(3 * 600, 1200)
	pc = prev.getCanvas()
	pc.clear(skia.Color(255, 255, 255))
	for i, (fname, kw) in enumerate(finals.items()):
		s = skia.Surface(S, S)
		final_mark(s.getCanvas(), **kw)
		img = s.makeImageSnapshot()
		img.save(os.path.join(OUT, fname), skia.kPNG)
		for j, rad in enumerate((260, 60)):
			cy = 300 if j == 0 else 800
			clip = skia.Path()
			clip.addCircle(i * 600 + 300, cy, rad)
			pc.save()
			pc.clipPath(clip, skia.ClipOp.kIntersect, True)
			pc.drawImageRect(img, skia.Rect(i * 600 + 300 - rad, cy - rad, i * 600 + 300 + rad, cy + rad), skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear))
			pc.restore()
		pc.drawString(fname, i * 600 + 150, 1000, font('IBMPlexMono-Medium.ttf', 26), fill(INK))
	prev.makeImageSnapshot().save(os.path.join(OUT, 'dp-preview.png'), skia.kPNG)


if __name__ == '__main__':
	main()
