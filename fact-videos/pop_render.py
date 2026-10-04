"""Pop Bold renderer: YAML script + reel JS (scene functions) -> animated HTML page -> MP4.

Same idea as HyperFrames: the video is a web page animated with GSAP; headless Chromium
captures every frame and FFmpeg encodes them with the mixed, mastered audio.

    python pop_render.py scripts/free-will.yaml            -> output/free-will.mp4
    python pop_render.py scripts/free-will.yaml --preview  -> also a contact sheet of frames
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np
import yaml

import sfx
import tts

HERE = os.path.dirname(os.path.abspath(__file__))
POP = os.path.join(HERE, 'pop')
FPS = 30
CHROME = os.environ.get('CHROME_PATH', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')


def norm(w):
	return re.sub(r"[^\w']", '', str(w).replace('’', "'")).lower()


def chunk_words(words, hl, max_words=3, max_chars=16):
	chunks, cur = [], []
	for w in words:
		cur.append(w)
		text = ' '.join(x[0] for x in cur)
		if len(cur) >= max_words or len(text) >= max_chars or re.search(r'[,.;:!?]$', w[0]):
			chunks.append(cur)
			cur = []
	if cur:
		chunks.append(cur)
	out = []
	for i, ch in enumerate(chunks):
		end = chunks[i + 1][0][1] - 0.02 if i + 1 < len(chunks) else ch[-1][2] + 0.5
		out.append({'start': ch[0][1] - 0.05, 'end': end, 'words': [[w, s, e, norm(w) in hl] for w, s, e in ch]})
	return out


def build(script):
	scenes = script['scenes']
	print('Generating voice-over...')
	pron = {str(k): str(v) for k, v in (script.get('pronounce') or {}).items()}
	samples, scene_words = tts.speak([s['say'].strip() for s in scenes], script.get('engine', 'edge'),
	                                 script.get('voice', 'en-US-AvaMultilingualNeural'), script.get('rate', '+6%'), pron)
	lead = 0.45
	speech = len(samples) / tts.SAMPLE_RATE
	out, chunks = [], []
	for i, (sc, words) in enumerate(zip(scenes, scene_words)):
		words = [(w, s + lead, e + lead) for w, s, e in words]
		start = 0.0 if i == 0 else max(words[0][1] - 0.2, out[-1]['words'][-1][2] + 0.05)
		out.append({'id': sc.get('id', f's{i}'), 'bg': sc.get('bg', '#8a3cff'), 'start': start, 'words': words,
		            'transition': sc.get('transition'), 'stickers': sc.get('stickers', True),
		            'n_stickers': sc.get('n_stickers', 5), 'sticker_colors': sc.get('sticker_colors')})
		hl = {norm(h) for h in sc.get('highlight', [])}
		chunks += chunk_words(words, hl)
	total = lead + speech + 1.3
	for i, s in enumerate(out):
		s['end'] = out[i + 1]['start'] if i + 1 < len(out) else total
	for i, ch in enumerate(chunks):  # never overlap the next chunk
		if i + 1 < len(chunks):
			ch['end'] = min(ch['end'], chunks[i + 1]['start'] - 0.01)
	return samples, lead, out, chunks, total


def write_page(script, scenes, chunks, total, reel_js, workdir):
	data = {'scenes': [{**s, 'words': [[w, round(a, 3), round(b, 3)] for w, a, b in s['words']]} for s in scenes],
	        'chunks': chunks, 'total': total, 'channel': script.get('channel', 'factloop')}
	html = open(os.path.join(POP, 'base.html')).read()
	html = html.replace('__DATA__', json.dumps(data)).replace('__REEL__', open(reel_js).read())
	for f in ('engine.js',):
		shutil.copy(os.path.join(POP, f), workdir)
	shutil.copytree(os.path.join(POP, 'vendor'), os.path.join(workdir, 'vendor'), dirs_exist_ok=True)
	path = os.path.join(workdir, 'index.html')
	with open(path, 'w') as f:
		f.write(html)
	return path


def mix(samples, lead, cues, total, script, scenes, path):
	n = int(total * sfx.SR)
	voice = np.zeros(n)
	v = samples.astype(np.float64) / 32768.0
	s = int(lead * sfx.SR)
	voice[s:s + len(v)] = v[:max(0, n - s)]
	fx = np.zeros(n)
	gain = float(script.get('sfx_volume', 0.32))
	for c in cues:
		f = sfx.CUES.get(c['name'])
		if f:
			sfx.place(fx, f(), c['t'], gain * c.get('gain', 1))
	drops = [scenes[i]['start'] for i in script.get('drops', [])]
	music = sfx.beat(total, bpm=script.get('bpm', 104), drops=drops) * float(script.get('music_volume', 0.32))
	env = np.convolve(np.abs(voice), np.ones(2400) / 2400, mode='same')
	out = voice + fx + music * (1 - 0.45 * np.clip(env * 12, 0, 1))
	out /= max(1.0, np.abs(out).max() / 0.95)
	raw = path + '.raw.wav'
	with wave.open(raw, 'wb') as wf:
		wf.setnchannels(1)
		wf.setsampwidth(2)
		wf.setframerate(sfx.SR)
		wf.writeframes((out * 32767).astype(np.int16).tobytes())
	sfx.master(raw, path, float(script.get('loudness', -10)))
	os.unlink(raw)


def render(script_path, out_path, preview=False):
	from playwright.sync_api import sync_playwright

	script = yaml.safe_load(open(script_path))
	reel_js = os.path.join(os.path.dirname(os.path.abspath(script_path)), script['reel_js'])
	samples, lead, scenes, chunks, total = build(script)
	work = tempfile.mkdtemp(prefix='pop-')
	page_path = write_page(script, scenes, chunks, total, reel_js, work)
	os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
	n_frames = int(total * FPS)
	wav = out_path + '.mix.wav'
	shots = []
	with sync_playwright() as p:
		b = p.chromium.launch(executable_path=CHROME, args=['--font-render-hinting=none', '--disable-lcd-text'])
		pg = b.new_page(viewport={'width': 1080, 'height': 1920})
		errors = []
		pg.on('pageerror', lambda e: errors.append(str(e)))
		pg.goto('file://' + page_path)
		pg.wait_for_function('window.FL !== undefined', timeout=20000)
		pg.evaluate('document.fonts.ready')
		if errors:
			sys.exit('Page error: ' + errors[0])
		cues = pg.evaluate('FL.cues')
		print(f'{len(cues)} sound cues; rendering {n_frames} frames ({total:.1f}s)...')
		mix(samples, lead, cues, total, script, scenes, wav)
		ff = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', str(FPS), '-i', '-', '-i', wav,
		                       '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
		                       '-ar', '48000', '-shortest', '-movflags', '+faststart', out_path], stdin=subprocess.PIPE)
		marks = {int(n_frames * q) for q in np.linspace(0.03, 0.97, 10)} if preview else set()
		for fi in range(n_frames):
			pg.evaluate(f'FL.seek({fi / FPS:.4f})')
			jpg = pg.screenshot(type='jpeg', quality=93)
			ff.stdin.write(jpg)
			if fi in marks:
				shots.append(jpg)
			if fi % (FPS * 5) == 0:
				print(f'  {fi}/{n_frames}')
		ff.stdin.close()
		if ff.wait() != 0:
			sys.exit('ffmpeg failed')
		if errors:
			print('Page errors during render:', errors[:3])
		b.close()
	os.unlink(wav)
	if shots:
		tmp = tempfile.mkdtemp()
		for i, j in enumerate(shots):
			open(os.path.join(tmp, f'{i:02d}.jpg'), 'wb').write(j)
		subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '1', '-i', os.path.join(tmp, '%02d.jpg'),
		                '-vf', 'scale=216:384,tile=10x1', '-frames:v', '1', out_path[:-4] + '-preview.png'], check=True)
	shutil.rmtree(work, ignore_errors=True)
	print(f'Done: {out_path}')


if __name__ == '__main__':
	ap = argparse.ArgumentParser()
	ap.add_argument('script')
	ap.add_argument('-o', '--out')
	ap.add_argument('--preview', action='store_true')
	a = ap.parse_args()
	out = a.out or os.path.join(HERE, 'output', os.path.splitext(os.path.basename(a.script))[0] + '.mp4')
	render(a.script, out, a.preview)
