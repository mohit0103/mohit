"""Renderer for the editorial motion-design style (scenes with `layers`).

Per scene: background (paper / ink / red) -> layers timed to spoken words -> camera drift.
Between scenes: a designed transition (slats, push, iris, wipe, zoom, glitch) with a soft whoosh.
On top: clean word-by-word captions, a thin progress bar and the channel mark.
"""

import math
import os
import random
import subprocess
import sys
import wave

import numpy as np
import skia

import media
import sfx
from fx import C, H, W, back_out, clamp, ease_in, ease_in_out, ease_out, font, paint
from motion import BEBAS, LAYERS, LAYER_SFX, MONO, PAL, SANS, colors, measure, norm, tracked

FPS = 30
TRANSITIONS = ['slats', 'push', 'iris', 'wipe', 'zoom', 'glitch']
T_OUT, T_IN = 0.22, 0.28  # transition window around each cut


# ---------------------------------------------------------------- backgrounds


class Backgrounds:
	def __init__(self):
		rng = np.random.default_rng(11)
		self.tex = {}
		yy, xx = np.mgrid[0:H, 0:W]
		vig = np.clip(np.hypot(xx - W / 2, yy - H * 0.45) / (H * 0.75), 0, 1) ** 2
		for name in ('paper', 'ink', 'red', 'aura'):
			base = np.array(colors(name)['bg'], dtype=np.float32)
			fib = rng.normal(0, 1, (H // 4, W // 4)).astype(np.float32)
			fib = np.kron(fib, np.ones((4, 4), dtype=np.float32))[:H, :W]  # soft fibres
			fine = rng.normal(0, 1, (H, W)).astype(np.float32)
			amt = 5 if name == 'paper' else 4
			if name == 'aura':  # warm gold glow rising from the bottom
				glow = np.clip(1 - np.hypot(xx - W / 2, yy - H * 0.95) / (H * 0.7), 0, 1) ** 2
				base = base[None, None, :] + glow[..., None] * np.array([70, 48, 10], dtype=np.float32)
			img = (base if base.ndim == 3 else base[None, None, :]) + (fib * amt * 0.6 + fine * amt)[..., None]
			img *= (1 - vig * (0.12 if name == 'paper' else 0.45))[..., None]
			rgba = np.dstack([img.clip(0, 255), np.full((H, W), 255, np.float32)]).astype(np.uint8)
			self.tex[name] = skia.Image.fromarray(rgba, colorType=skia.kRGBA_8888_ColorType)
		self.grain = []
		for _ in range(3):
			n = rng.integers(0, 255, (H // 2, W // 2), dtype=np.uint8)
			self.grain.append(skia.Image.fromarray(np.dstack([n, n, n, np.full_like(n, 9)]), colorType=skia.kRGBA_8888_ColorType))

	def draw(self, c, name):
		c.drawImage(self.tex.get(name, self.tex['ink']), 0, 0)

	def draw_grain(self, c, frame):
		c.drawImageRect(self.grain[(frame // 2) % 3], skia.Rect(0, 0, W, H), skia.SamplingOptions())


# ---------------------------------------------------------------- timing


def resolve_layers(scene):
	"""Give every layer an absolute start time from its `at` word (+ delay)."""
	words = scene['words']
	for i, L in enumerate(scene.get('layers', [])):
		start = scene['start'] + (0.15 if i else 0.05)
		at = L.get('at')
		if at:
			target = [norm(x) for x in str(at).split()]
			ws = [norm(w) for w, _, _ in words]
			for j in range(len(ws) - len(target) + 1):
				if ws[j:j + len(target)] == target or (len(target) == 1 and ws[j].startswith(target[0]) and len(target[0]) >= 3):
					start = words[j][1] - 0.08
					break
		L['_start'] = max(scene['start'], start + float(L.get('delay', 0)))


def scene_at(scenes, t):
	return max(i for i, s in enumerate(scenes) if s['start'] <= t or i == 0)


# ---------------------------------------------------------------- drawing


def draw_scene(c, bgs, sc, t, show_ghost=True):
	col = colors(sc.get('bg', 'ink'))
	bgs.draw(c, sc.get('bg', 'ink'))
	lt = t - sc['start']
	dur = sc['end'] - sc['start']
	# camera: slow push-in + gentle drift; shake after stamps
	cam = 1.0 + 0.035 * clamp(lt / max(dur, 1))
	dx = math.sin(lt * 0.6 + sc['_i']) * 6
	shake = 0.0
	for L in sc.get('layers', []):
		if L.get('type') == 'stamp':
			st = t - L['_start'] - 0.16
			if 0 < st < 0.35:
				shake = max(shake, 14 * (1 - st / 0.35))
	c.save()
	c.translate(W / 2 + dx + math.sin(t * 95) * shake, H * 0.45 + math.cos(t * 83) * shake)
	c.scale(cam, cam)
	c.translate(-W / 2, -H * 0.45)
	for L in sorted(sc.get('layers', []), key=lambda L: 0 if L.get('type') in ('ghost',) else (1 if L.get('type') == 'photo' and L.get('frame') == 'full' else 2)):
		lt_l = t - L['_start']
		if lt_l < 0:
			continue
		fn = LAYERS.get(L.get('type'))
		if fn:
			fn(c, L, lt_l, sc['end'] - L['_start'], col)
	c.restore()


def draw_transition(c, kind, A, B, k, col_next, t):
	"""A = outgoing frame, B = incoming frame, k in [0,1]."""
	samp = skia.SamplingOptions(skia.FilterMode.kLinear)
	if kind == 'push':
		e = ease_in_out(k)
		c.drawImage(A, 0, -H * e * 0.35, samp)
		c.save()
		c.translate(0, H * (1 - e))
		c.drawImage(B, 0, 0, samp)
		c.restore()
		c.drawRect(skia.Rect(0, H * (1 - e) - 10, W, H * (1 - e)), paint(C(PAL['red'])))
	elif kind == 'iris':
		c.drawImage(A, 0, 0)
		e = ease_in_out(k)
		r = math.hypot(W, H) * 0.6 * e
		path = skia.Path()
		path.addCircle(W / 2, H * 0.45, r)
		c.save()
		c.clipPath(path, skia.ClipOp.kIntersect, True)
		c.drawImage(B, 0, 0)
		c.restore()
		c.drawCircle(W / 2, H * 0.45, r, paint(C(PAL['red']), 1 - e, stroke=18))
	elif kind == 'wipe':
		e = ease_in_out(k)
		c.drawImage(A, 0, 0)
		path = skia.Path()
		x = -500 + (W + 1000) * e
		path.moveTo(x - 400, 0)
		path.lineTo(x + 400, 0)
		path.lineTo(x - 400 + 0, H)
		path.lineTo(x - 1200, H)
		path.close()
		clip = skia.Path()
		clip.moveTo(-2000, 0)
		clip.lineTo(x + 400, 0)
		clip.lineTo(x - 400, H)
		clip.lineTo(-2000, H)
		clip.close()
		c.save()
		c.clipPath(clip, skia.ClipOp.kIntersect, True)
		c.drawImage(B, 0, 0)
		c.restore()
		band = skia.Path()
		band.moveTo(x + 400, 0)
		band.lineTo(x + 470, 0)
		band.lineTo(x - 330, H)
		band.lineTo(x - 400, H)
		band.close()
		c.drawPath(band, paint(C(PAL['red'])))
	elif kind == 'zoom':
		e = ease_in_out(k)
		c.save()
		c.translate(W / 2, H * 0.45)
		c.scale(1 + 0.5 * e, 1 + 0.5 * e)
		c.translate(-W / 2, -H * 0.45)
		p = skia.Paint()
		p.setAlphaf(1 - e)
		c.drawImage(B, 0, 0)  # base: incoming
		c.restore()
		c.save()
		c.translate(W / 2, H * 0.45)
		s = 1 + 0.6 * e
		c.scale(s, s)
		c.translate(-W / 2, -H * 0.45)
		c.drawImage(A, 0, 0, samp, p)
		c.restore()
	elif kind == 'glitch':
		c.drawImage(B if k > 0.5 else A, 0, 0)
		rng = random.Random(int(t * 1000))
		src = B if k > 0.5 else A
		for _ in range(9):
			y = rng.uniform(0, H)
			h = rng.uniform(20, 140)
			off = rng.uniform(-90, 90) * (1 - abs(k - 0.5) * 2)
			c.save()
			c.clipRect(skia.Rect(0, y, W, y + h))
			c.drawImage(src, off, 0)
			c.restore()
		tint = paint(C(PAL['red']), 0.25 * (1 - abs(k - 0.5) * 2))
		c.drawRect(skia.Rect(0, 0, W, H), tint)
	else:  # slats: coloured bars sweep down covering A, then off revealing B
		n = 5
		sw = W / n
		cols_ = [PAL['red'], PAL['ink'], PAL['paper'], PAL['red'], PAL['ink']]
		c.drawImage(A if k < 0.5 else B, 0, 0)
		for i in range(n):
			kk = clamp((k - i * 0.04) / 0.8)
			if kk < 0.5:
				top, bot = 0, H * ease_in_out(kk * 2)
			else:
				top, bot = H * ease_in_out((kk - 0.5) * 2), H
			if kk > 0:
				c.drawRect(skia.Rect(i * sw - 1, top, (i + 1) * sw + 1, bot), paint(C(cols_[i])))


def draw_caption(c, sc, t):
	"""Clean caption: words appear as spoken; highlight words in accent colour; current word underlined."""
	col = colors(sc.get('bg', 'ink'))
	on_photo = any(L.get('type') == 'photo' and L.get('frame') == 'full' for L in sc.get('layers', []))
	fg = PAL['white'] if on_photo or col['bg'] != PAL['paper'] else PAL['ink']
	hl = {norm(h) for h in sc.get('highlight', [])}
	for ci, ch in enumerate(sc['chunks']):
		end_t = sc['chunks'][ci + 1][0][1] if ci + 1 < len(sc['chunks']) else min(sc['end'] - 0.05, ch[-1][2] + 0.5)
		if not (ch[0][1] - 0.05 <= t < end_t):
			continue
		f = font(SANS, 70)
		space = f.measureText(' ')
		words = [w for w, _, _ in ch]
		total = sum(measure(w, f) for w in words) + space * (len(words) - 1)
		x = W / 2 - total / 2
		y = 1640
		out = 1 - ease_out((t - end_t + 0.1) / 0.1)
		for w, s, e in ch:
			ww = measure(w, f)
			if t >= s - 0.03:
				k = ease_out((t - s + 0.03) / 0.14)
				hlw = norm(w) in hl
				color = (PAL['yellow'] if fg == PAL['white'] else PAL['red']) if hlw else fg
				c.save()
				c.translate(0, (1 - k) * 18)
				if fg == PAL['white']:
					c.drawString(w, x + 3, y + 4, f, paint(skia.Color(0, 0, 0), 0.55 * k * out, blur=4))
				c.drawString(w, x, y, f, paint(C(color), k * out))
				if s <= t < e + 0.06:
					c.drawRect(skia.Rect(x, y + 16, x + ww, y + 24), paint(C(PAL['red'] if fg == PAL['ink'] else PAL['yellow']), out))
				c.restore()
			x += ww + space


def draw_chrome(c, script, sc, t, total):
	col = colors(sc.get('bg', 'ink'))
	fg = col['fg']
	ch = str(script.get('channel', 'factloop')).upper()
	f = font(BEBAS, 54)
	c.drawRect(skia.Rect(64, 116, 84, 136), paint(C(col['accent'] if col['bg'] != PAL['red'] else PAL['ink'])))
	c.drawString(ch, 98, 140, f, paint(C(fg)))
	if script.get('kicker'):
		tracked(c, str(script['kicker']).upper(), W - 64 - measure(str(script['kicker']).upper(), font(MONO, 26)) * 1.12, 136, font(MONO, 26), paint(C(fg), 0.7))
	c.drawRect(skia.Rect(0, 0, W * t / total, 8), paint(C(col['accent'] if col['bg'] != PAL['red'] else PAL['yellow'])))


# ---------------------------------------------------------------- audio


def mix(samples, lead, scenes, total, script, path):
	n = int(total * sfx.SR)
	voice = np.zeros(n)
	v = samples.astype(np.float64) / 32768.0
	s = int(lead * sfx.SR)
	voice[s:s + len(v)] = v[:max(0, n - s)]
	fx = np.zeros(n)
	if script.get('sfx', True):
		for sc in scenes[1:]:
			sfx.place(fx, sfx.CUES['glitch' if sc['_transition'] == 'glitch' else 'whoosh'](), max(0, sc['start'] - 0.25), 0.09)
		for sc in scenes:
			for L in sc.get('layers', []):
				cue = LAYER_SFX.get(L.get('type'))
				if cue and not (L.get('type') == 'photo' and L.get('_skip')):
					name, gain = cue
					sfx.place(fx, sfx.CUES[name](), L['_start'] + (0.14 if name == 'thud' else 0.0), gain)
	bed = np.zeros(n)
	if script.get('music', 'auto') == 'auto':
		bed = sfx.ambient_bed(total) * float(script.get('music_volume', 0.5))
	elif script.get('music'):
		import tts
		raw = tts._decode(os.path.join(os.path.dirname(os.path.abspath(__file__)), script['music'])).astype(np.float64) / 32768.0
		bed = np.tile(raw, int(np.ceil(n / max(len(raw), 1))))[:n] * float(script.get('music_volume', 0.12))
	env = np.convolve(np.abs(voice), np.ones(2400) / 2400, mode='same')
	out = voice + fx + bed * (1 - 0.55 * np.clip(env * 12, 0, 1))
	out /= max(1.0, np.abs(out).max() / 0.95)
	with wave.open(path, 'wb') as wf:
		wf.setnchannels(1)
		wf.setsampwidth(2)
		wf.setframerate(sfx.SR)
		wf.writeframes((out * 32767).astype(np.int16).tobytes())


# ---------------------------------------------------------------- main


def render(script, samples, lead, scenes, total, out_path, preview=False):
	for i, sc in enumerate(scenes):
		sc['_i'] = i
		sc['_transition'] = sc.get('transition') or TRANSITIONS[(i - 1) % len(TRANSITIONS)]
		resolve_layers(sc)
	print('Fetching photos and icons...')
	for sc in scenes:
		for L in sc.get('layers', []):
			if L.get('type') == 'photo':
				L['_skip'] = media.photo(L) is None
			if L.get('type') == 'split':
				for side in (L.get('left', {}), L.get('right', {})):
					if side.get('query') or side.get('path') or side.get('openverse'):
						media.photo(side)
			if L.get('type') == 'icon':
				media.icon(L.get('name', 'sparkles'))

	wav = out_path + '.mix.wav'
	mix(samples, lead, scenes, total, script, wav)
	cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', wav,
	       '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out_path]
	ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
	main = skia.Surface(W, H)
	sa, sb = skia.Surface(W, H), skia.Surface(W, H)
	c = main.getCanvas()
	bgs = Backgrounds()
	n_frames = int(total * FPS)
	shots = []
	preview_at = {int(n_frames * p) for p in np.linspace(0.04, 0.95, 8)} if preview else set()
	print(f'Rendering {n_frames} frames ({total:.1f}s)...')
	for fi in range(n_frames):
		t = fi / FPS
		si = scene_at(scenes, t)
		sc = scenes[si]
		# are we inside a transition window?
		trans = None
		if si + 1 < len(scenes) and t >= scenes[si + 1]['start'] - T_OUT:
			trans = (si, si + 1)
		elif si > 0 and t < sc['start'] + T_IN:
			trans = (si - 1, si)
		if trans:
			a, b = scenes[trans[0]], scenes[trans[1]]
			cut = b['start']
			k = clamp((t - (cut - T_OUT)) / (T_OUT + T_IN))
			draw_scene(sa.getCanvas(), bgs, a, min(t, a['end'] + 0.3))
			draw_scene(sb.getCanvas(), bgs, b, max(t, b['start']))
			draw_transition(c, b['_transition'], sa.makeImageSnapshot(), sb.makeImageSnapshot(), k, colors(b.get('bg', 'ink')), t)
			sc = b if t >= cut else a
		else:
			draw_scene(c, bgs, sc, t)
		draw_caption(c, sc, t)
		draw_chrome(c, script, sc, t, total)
		bgs.draw_grain(c, fi)
		frame = main.makeImageSnapshot()
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
	if media.CREDITS:
		with open(f'{out_path[:-4]}-credits.txt', 'w') as f:
			f.write('\n'.join(dict.fromkeys(media.CREDITS)))
	print(f'Done: {out_path}')
	return out_path
