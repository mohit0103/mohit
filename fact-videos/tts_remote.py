"""Hindi narration via Gemini TTS, run on GitHub Actions (the repo's GOOGLE_API_KEY secret lives there).

Request file (tts-requests/<name>.json):
  {"mode": "samples", "voices": ["Kore", "Puck"], "text": "..."}          -> tts-cache/samples/<voice>.mp3
  {"mode": "script", "script": "scripts/x.yaml", "voice": "Kore"}          -> tts-cache/<name>/speech.wav + words.json

Whatever happens, tts-cache/<name>/DONE or ERROR.txt is written so the result can be read from the repo.
"""

import base64
import difflib
import json
import os
import subprocess
import sys
import time
import traceback
import wave

import numpy as np
import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = os.environ.get('HINDI_STYLE', 'Say this in Hindi like a witty, high-energy Indian reel creator talking to friends: playful, a little sarcastic, with comic timing, a quick pause before each punchline and exaggerated surprise on the twist. Natural everyday Hindi pronunciation, never robotic')
MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']


def gemini(text, voice):
	last = None
	for attempt in range(6):
		model = MODELS[attempt % len(MODELS)]
		try:
			r = tts._post(
				f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
				{'contents': [{'parts': [{'text': f'{STYLE}: {text}'}]}],
				 'generationConfig': {'responseModalities': ['AUDIO'],
				                      'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}},
				{'x-goog-api-key': os.environ['GOOGLE_API_KEY']})
			pcm = base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data'])
			return np.frombuffer(pcm, dtype=np.int16)  # 24 kHz mono
		except Exception as e:  # rate limits / transient 5xx / text-only replies
			last = e
			print(f'  gemini attempt {attempt + 1} ({model}) failed: {e.__class__.__name__}: {str(e)[:160]}')
			time.sleep(8 + attempt * 6)
	raise RuntimeError(f'Gemini TTS failed: {last}')


def write_wav(path, samples):
	with wave.open(path, 'wb') as w:
		w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
		w.writeframes(samples.tobytes())


def whisper_words(samples, lang='hi'):
	from faster_whisper import WhisperModel
	m = WhisperModel('small', device='cpu', compute_type='int8')
	a = samples.astype(np.float32) / 32768.0
	a16 = np.interp(np.arange(0, len(a), 1.5), np.arange(len(a)), a).astype(np.float32)
	segs, _ = m.transcribe(a16, word_timestamps=True, beam_size=5, language=lang)
	return [(w.word.strip(), w.start, w.end) for s in segs for w in s.words if w.word.strip()]


def fuzzy_align(words, tokens):
	"""Monotonic alignment of script words to recogniser tokens that tolerates spelling differences."""
	a = [tts.norm(w) for w in words]
	b = [tts.norm(t[0]) for t in tokens]
	n, m = len(a), len(b)
	GAP = -0.45
	sc = np.zeros((n + 1, m + 1))
	sc[:, 0] = np.arange(n + 1) * GAP
	sc[0, :] = np.arange(m + 1) * GAP
	sim = lambda x, y: 2 * difflib.SequenceMatcher(None, x, y).ratio() - 1
	for i in range(1, n + 1):
		for j in range(1, m + 1):
			sc[i, j] = max(sc[i - 1, j - 1] + sim(a[i - 1], b[j - 1]), sc[i - 1, j] + GAP, sc[i, j - 1] + GAP)
	i, j, pairs = n, m, []
	while i > 0 and j > 0:
		if abs(sc[i, j] - (sc[i - 1, j - 1] + sim(a[i - 1], b[j - 1]))) < 1e-9:
			if sim(a[i - 1], b[j - 1]) > -0.2:
				pairs.append((i - 1, j - 1))
			i -= 1; j -= 1
		elif abs(sc[i, j] - (sc[i - 1, j] + GAP)) < 1e-9:
			i -= 1
		else:
			j -= 1
	return [(words[i], tokens[j][1], tokens[j][2]) for i, j in reversed(pairs)]


def do_samples(req, out):
	os.makedirs(os.path.join(out, 'samples'), exist_ok=True)
	text = req.get('text') or 'भाई सुनो! तुम्हारे चेहरे पर अभी कीड़े रहते हैं। हाँ हाँ, सच में! घबराओ मत, वो बस किराए पर रहते हैं, और किराया भी नहीं देते।'
	for v in req.get('voices', ['Kore', 'Puck', 'Zephyr', 'Aoede', 'Leda', 'Fenrir']):
		try:
			s = gemini(text, v)
			wav = os.path.join(out, 'samples', f'{v}.wav')
			write_wav(wav, s)
			subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-af', 'loudnorm=I=-14', '-c:a', 'libmp3lame', '-b:a', '128k', wav[:-4] + '.mp3'], check=True)
			os.remove(wav)
			print('sample ok', v)
		except Exception as e:
			print('sample failed', v, e)


def do_script(req, name, out):
	script = yaml.safe_load(open(os.path.join(HERE, req['script'])))
	pron = {str(k): str(v) for k, v in (script.get('pronounce') or {}).items()}
	display = [s['say'].strip().split() for s in script['scenes']]
	flat = [tts.spoken_form(w, pron) for ws in display for w in ws]
	spoken = '\n\n'.join(' '.join(tts.spoken_form(w, pron) for w in ws) for ws in display)
	d = os.path.join(out, name)
	os.makedirs(d, exist_ok=True)
	samples = gemini(spoken, req.get('voice', 'Kore'))
	write_wav(os.path.join(d, 'speech.wav'), samples)
	total = len(samples) / 24000
	toks = whisper_words(samples, req.get('lang', 'hi'))
	print(f'{len(toks)} recognised tokens for {len(flat)} script words, {total:.1f}s')
	pairs = fuzzy_align(flat, toks)
	times = tts.align(flat, [(w, s, e) for w, s, e in pairs], total)
	json.dump([[w, round(s, 3), round(e, 3)] for w, (s, e) in zip(flat, times)], open(os.path.join(d, 'words.json'), 'w'), ensure_ascii=False)
	json.dump({'voice': req.get('voice', 'Kore'), 'seconds': total, 'matched': len(pairs), 'words': len(flat), 'recognised': [t[0] for t in toks]}, open(os.path.join(d, 'meta.json'), 'w'), ensure_ascii=False, indent=1)


def main():
	req_path = sys.argv[1]
	name = os.path.splitext(os.path.basename(req_path))[0]
	req = json.load(open(req_path))
	out = os.path.join(HERE, 'tts-cache')
	d = os.path.join(out, name)
	os.makedirs(d, exist_ok=True)
	for f in ('DONE', 'ERROR.txt'):
		if os.path.exists(os.path.join(d, f)):
			os.remove(os.path.join(d, f))
	try:
		if req.get('mode') == 'samples':
			do_samples(req, out)
		else:
			do_script(req, name, out)
		open(os.path.join(d, 'DONE'), 'w').write('ok\n')
	except Exception:
		open(os.path.join(d, 'ERROR.txt'), 'w').write(traceback.format_exc())
		traceback.print_exc()


if __name__ == '__main__':
	main()
