"""Real photos (openly licensed, via Openverse) and vector line icons (Tabler, MIT).

Photos: search Openverse, keep only CC0 / public domain / CC BY / CC BY-SA, optionally let
Gemini look at the candidates and pick the one that really shows the subject, and record
the credit line so it can be shown on screen and in the post caption.
"""

import base64
import json
import math
import os
import re
import urllib.parse
import urllib.request

import numpy as np
import skia

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
UA = {'User-Agent': 'factloop-video-bot/1.0 (personal, non-commercial)'}
TABLER = 'https://cdn.jsdelivr.net/npm/@tabler/icons@3/icons/outline/{}.svg'

CREDITS = []  # filled as photos are used; printed into the post caption


def _get(url, timeout=40, tries=3):
	import time

	for attempt in range(tries):
		try:
			with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
				return r.read()
		except Exception:
			if attempt == tries - 1:
				raise
			time.sleep(2 * (attempt + 1))


def _cached(key, url):
	path = os.path.join(CACHE, key)
	if not os.path.exists(path):
		os.makedirs(os.path.dirname(path), exist_ok=True)
		data = _get(url)
		with open(path, 'wb') as f:
			f.write(data)
	return path


# ---------------------------------------------------------------- photos


def _search(query, n=8):
	q = urllib.parse.urlencode({'q': query, 'license': 'pdm,cc0,by,by-sa', 'page_size': n, 'mature': 'false'})
	data = json.loads(_get(f'https://api.openverse.org/v1/images/?{q}'))
	return [r for r in data.get('results', []) if (r.get('width') or 0) >= 500]


def _vision_pick(query, cands):
	"""Ask Gemini which candidate actually shows `query` (real photo, no heavy text/watermark)."""
	key = os.environ.get('GOOGLE_API_KEY')
	if not key or len(cands) < 2:
		return 0
	parts = [{'text': f'Which image best and most clearly shows: "{query}"? Prefer a real photograph of the actual subject '
	          '(not a statue, mural, poster, meme or collage unless asked), clean, no big text or watermark. '
	          'Answer with only the image number (0-based), or -1 if none fit.'}]
	for i, c in enumerate(cands):
		parts += [{'text': f'Image {i}:'}, {'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(_get(c['thumbnail'])).decode()}}]
	try:
		body = json.dumps({'contents': [{'parts': parts}]}).encode()
		req = urllib.request.Request(
			f"https://generativelanguage.googleapis.com/v1beta/models/{os.environ.get('SCRIPT_MODEL', 'gemini-2.5-flash')}:generateContent",
			data=body, headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
		with urllib.request.urlopen(req, timeout=90) as r:
			txt = json.load(r)['candidates'][0]['content']['parts'][0]['text']
		return int(re.search(r'-?\d+', txt).group(0))
	except Exception as e:
		print(f'  (vision pick skipped: {e})')
		return 0


_photos = {}
_credit_of = {}


def photo(spec):
	"""spec: {'path': local file} or {'query': 'search words'} or {'openverse': id}. Returns skia.Image or None."""
	key = json.dumps({k: spec.get(k) for k in ('path', 'query', 'openverse')}, sort_keys=True)
	if key in _photos:
		if key in _credit_of:
			spec['_credit'] = _credit_of[key]
		return _photos[key]
	img = None
	try:
		if spec.get('path'):
			img = skia.Image.open(os.path.join(HERE, spec['path']))
			if spec.get('credit'):
				CREDITS.append(spec['credit'])
		else:
			if spec.get('openverse'):
				meta = _cached(f"photos/{spec['openverse']}.json", f"https://api.openverse.org/v1/images/{spec['openverse']}/")
				r = json.load(open(meta))
				cands = [r]
				pick = 0
			else:
				cands = _search(spec['query'])[:6]
				pick = _vision_pick(spec['query'], cands) if cands else -1
			if 0 <= pick < len(cands):
				r = cands[pick]
				path = _cached(f"photos/{r['id']}.jpg", f"https://api.openverse.org/v1/images/{r['id']}/thumb/?full_size=true")
				img = skia.Image.open(path)
				lic = r['license'].upper().replace('PDM', 'Public domain').replace('CC0', 'CC0')
				lic = lic if lic.startswith(('Public', 'CC0')) else f"CC {lic} {r.get('license_version', '')}".strip()
				credit = f"{r.get('creator') or 'Unknown'} · {lic}"
				CREDITS.append(f"{r.get('title', '')[:60]} by {credit} ({r.get('foreign_landing_url', '')})")
				spec['_credit'] = _credit_of[key] = credit
				print(f"  photo for {spec.get('query', spec.get('openverse'))!r}: {r.get('title', '')[:50]} [{lic}]")
			else:
				print(f"  (no suitable photo for {spec.get('query')!r})")
	except Exception as e:
		print(f'  (photo failed for {spec}: {e})')
	_photos[key] = img
	return img


def treat(img, mode, dark, light):
	"""Return a colour filter: 'duotone' maps shadows->dark, highlights->light; 'bw'; or None for colour."""
	if mode == 'color' or img is None:
		return None
	if mode == 'bw':
		return skia.ColorFilters.Matrix([0.33, 0.5, 0.17, 0, 0] * 3 + [0, 0, 0, 1, 0])
	d, l = [c / 255 for c in dark], [c / 255 for c in light]
	m = []
	for i in range(3):
		k = l[i] - d[i]
		m += [0.3 * k, 0.59 * k, 0.11 * k, 0, d[i]]
	m += [0, 0, 0, 1, 0]
	return skia.ColorFilters.Matrix(m)


# ---------------------------------------------------------------- icons (SVG -> skia.Path)

_TOK = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?')


def parse_path(d):
	p = skia.Path()
	toks = _TOK.findall(d)
	i, cmd = 0, None
	x = y = sx = sy = 0.0
	lc = None  # last control point for S/T

	def num():
		nonlocal i
		v = float(toks[i])
		i += 1
		return v

	while i < len(toks):
		if re.fullmatch(r'[A-Za-z]', toks[i]):
			cmd = toks[i]
			i += 1
			if cmd in 'Zz':
				p.close()
				x, y = sx, sy
				lc = None
				continue
		rel = cmd.islower()
		c = cmd.upper()
		ox, oy = (x, y) if rel else (0, 0)
		if c == 'M':
			x, y = ox + num(), oy + num()
			p.moveTo(x, y)
			sx, sy = x, y
			cmd = 'l' if rel else 'L'
			lc = None
		elif c == 'L':
			x, y = ox + num(), oy + num()
			p.lineTo(x, y)
			lc = None
		elif c == 'H':
			x = (x if rel else 0) + num()
			p.lineTo(x, y)
			lc = None
		elif c == 'V':
			y = (y if rel else 0) + num()
			p.lineTo(x, y)
			lc = None
		elif c == 'C':
			x1, y1, x2, y2, ex, ey = ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()
			p.cubicTo(x1, y1, x2, y2, ex, ey)
			lc, x, y = (x2, y2, 'C'), ex, ey
		elif c == 'S':
			x1, y1 = (2 * x - lc[0], 2 * y - lc[1]) if lc and lc[2] == 'C' else (x, y)
			x2, y2, ex, ey = ox + num(), oy + num(), ox + num(), oy + num()
			p.cubicTo(x1, y1, x2, y2, ex, ey)
			lc, x, y = (x2, y2, 'C'), ex, ey
		elif c == 'Q':
			x1, y1, ex, ey = ox + num(), oy + num(), ox + num(), oy + num()
			p.quadTo(x1, y1, ex, ey)
			lc, x, y = (x1, y1, 'Q'), ex, ey
		elif c == 'T':
			x1, y1 = (2 * x - lc[0], 2 * y - lc[1]) if lc and lc[2] == 'Q' else (x, y)
			ex, ey = ox + num(), oy + num()
			p.quadTo(x1, y1, ex, ey)
			lc, x, y = (x1, y1, 'Q'), ex, ey
		elif c == 'A':
			rx, ry, rot, large, sweep = num(), num(), num(), num(), num()
			ex, ey = ox + num(), oy + num()
			p.arcTo(rx, ry, rot, skia.Path.kLarge_ArcSize if large else skia.Path.kSmall_ArcSize,
			        skia.PathDirection.kCW if sweep else skia.PathDirection.kCCW, ex, ey)
			x, y = ex, ey
			lc = None
	return p


_icons = {}


def icon(name):
	"""Tabler outline icon -> list of skia.Path in a 24x24 box, or None."""
	if name in _icons:
		return _icons[name]
	paths = None
	try:
		safe = re.sub(r'[^a-z0-9-]', '', name.lower())
		svg = open(_cached(f'icons/{safe}.svg', TABLER.format(safe))).read()
		paths = []
		for m in re.finditer(r'<(path|circle|rect|line|polyline|ellipse)\b([^>]*)/?>', svg):
			tag, attrs = m.group(1), dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(2)))
			if attrs.get('stroke') == 'none':
				continue
			f = lambda k: float(attrs.get(k, 0))
			if tag == 'path':
				paths.append(parse_path(attrs['d']))
			elif tag == 'circle':
				p = skia.Path()
				p.addCircle(f('cx'), f('cy'), f('r'))
				paths.append(p)
			elif tag == 'ellipse':
				p = skia.Path()
				p.addOval(skia.Rect(f('cx') - f('rx'), f('cy') - f('ry'), f('cx') + f('rx'), f('cy') + f('ry')))
				paths.append(p)
			elif tag == 'rect':
				p = skia.Path()
				p.addRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(f('x'), f('y'), f('width'), f('height')), f('rx'), f('rx')))
				paths.append(p)
			elif tag == 'line':
				p = skia.Path()
				p.moveTo(f('x1'), f('y1'))
				p.lineTo(f('x2'), f('y2'))
				paths.append(p)
			elif tag == 'polyline':
				pts = [float(v) for v in re.findall(r'-?[\d.]+', attrs['points'])]
				p = skia.Path()
				p.moveTo(pts[0], pts[1])
				for j in range(2, len(pts), 2):
					p.lineTo(pts[j], pts[j + 1])
				paths.append(p)
	except Exception as e:
		print(f'  (icon {name!r} unavailable: {e})')
		paths = None
	_icons[name] = paths or None
	return _icons[name]


def trim(path, k):
	"""Portion [0, k] of a path's length (for draw-on animation)."""
	if k >= 1:
		return path
	out = skia.Path()
	meas = skia.PathMeasure(path, False)
	while True:
		L = meas.getLength()
		if L > 0:
			meas.getSegment(0, L * max(0.0, k), out, True)
		if not meas.nextContour():
			break
	return out
