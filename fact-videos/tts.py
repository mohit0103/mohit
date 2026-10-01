"""Text-to-speech with per-word timings.

The whole narration is spoken in one go (so intonation flows naturally between
scenes), then every script word is matched to a time in the audio.

Engines (TTS_ENGINE / --engine), best first; "auto" picks the first that works:
  elevenlabs - most human, needs ELEVENLABS_API_KEY (free tier ~10k chars/month)
  gemini     - very expressive, uses GOOGLE_API_KEY (free tier, limited requests/day)
  edge       - Microsoft neural voices, free, no key, exact word timings
  piper      - offline fallback, always works
"""

import asyncio
import base64
import difflib
import json
import os
import re
import ssl
import subprocess
import tempfile
import urllib.request
import wave

import numpy as np

SAMPLE_RATE = 24000
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
PIPER_VOICE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx'

STYLE = (
	'Read this like a gripping short-video storyteller: warm, curious and confident, '
	'natural pace with small dramatic pauses, never robotic. Speak with a natural Indian English accent.'
)


def _decode(path_or_bytes, fmt=None) -> np.ndarray:
	args = ['ffmpeg', '-v', 'error']
	if fmt:
		args += ['-f', fmt, '-ar', '24000', '-ac', '1']
	if isinstance(path_or_bytes, bytes):
		args += ['-i', '-']
		inp = path_or_bytes
	else:
		args += ['-i', path_or_bytes]
		inp = None
	raw = subprocess.run(args + ['-f', 's16le', '-ac', '1', '-ar', str(SAMPLE_RATE), '-'], input=inp, check=True, capture_output=True).stdout
	return np.frombuffer(raw, dtype=np.int16)


def norm(w):
	return re.sub(r"[^\w]", '', w.lower().replace('’', "'"))


def spoken_form(word: str, pronounce: dict) -> str:
	pre, core, post = re.match(r'^(\W*)(.*?)(\W*)$', word).groups()
	for k, v in pronounce.items():
		if core.lower() == k.lower():
			return pre + v + post
	return word


def _post(url, body, headers):
	req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **headers})
	with urllib.request.urlopen(req, timeout=180) as r:
		return json.load(r)


# ---------- engines: each returns (samples, [(token, start, end)]) ----------


def _elevenlabs(text, voice):
	key = os.environ['ELEVENLABS_API_KEY']
	voice_id = voice if voice and '-' not in voice and len(voice) > 15 else os.environ.get('ELEVENLABS_VOICE', 'JBFqnCBsd6RMkjVDRZzb')
	r = _post(
		f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128',
		{'text': text, 'model_id': os.environ.get('ELEVENLABS_MODEL', 'eleven_multilingual_v2'), 'voice_settings': {'stability': 0.4, 'similarity_boost': 0.8, 'style': 0.35}},
		{'xi-api-key': key},
	)
	samples = _decode(base64.b64decode(r['audio_base64']))
	a = r['alignment']
	tokens, cur, start = [], '', None
	for ch, s, e in zip(a['characters'], a['character_start_times_seconds'], a['character_end_times_seconds']):
		if ch.isspace():
			if cur:
				tokens.append((cur, start, last))
			cur, start = '', None
		else:
			if start is None:
				start = s
			cur += ch
			last = e
	if cur:
		tokens.append((cur, start, last))
	return samples, tokens


def _gemini(text, voice):
	model = os.environ.get('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts')
	r = _post(
		f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
		{
			'contents': [{'parts': [{'text': f'{STYLE}\n\n{text}'}]}],
			'generationConfig': {
				'responseModalities': ['AUDIO'],
				'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice if voice and '-' not in voice else os.environ.get('GEMINI_VOICE', 'Charon')}}},
			},
		},
		{'x-goog-api-key': os.environ['GOOGLE_API_KEY']},
	)
	pcm = base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data'])
	samples = np.frombuffer(pcm, dtype=np.int16)  # 24 kHz mono s16le
	return samples, _whisper_tokens(samples)


async def _edge_async(text, voice, rate):
	import edge_tts
	import edge_tts.communicate as comm_mod

	if os.environ.get('SSL_CERT_FILE'):  # behind a corporate / sandbox proxy
		comm_mod._SSL_CTX = ssl.create_default_context(cafile=os.environ['SSL_CERT_FILE'])
	comm = edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary')
	audio, tokens = bytearray(), []
	async for chunk in comm.stream():
		if chunk['type'] == 'audio':
			audio.extend(chunk['data'])
		elif chunk['type'] == 'WordBoundary':
			tokens.append((chunk['text'], chunk['offset'] / 1e7, (chunk['offset'] + chunk['duration']) / 1e7))
	return bytes(audio), tokens


def _edge(text, voice, rate):
	audio, tokens = asyncio.run(_edge_async(text, voice if voice and '-' in voice else 'en-US-AndrewMultilingualNeural', rate))
	return _decode(audio), tokens


_piper = None


def _piper_tts(text, rate):
	global _piper
	from piper import PiperVoice, SynthesisConfig

	if _piper is None:
		model = os.path.join(CACHE, 'voice.onnx')
		if not os.path.exists(model):
			os.makedirs(CACHE, exist_ok=True)
			print('Downloading Piper voice (one time)...')
			urllib.request.urlretrieve(PIPER_VOICE_URL, model)
			urllib.request.urlretrieve(PIPER_VOICE_URL + '.json', model + '.json')
		_piper = PiperVoice.load(model)
	pct = int((rate or '+0%').strip('%+') or 0)
	with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
		path = f.name
	with wave.open(path, 'wb') as wf:
		_piper.synthesize_wav(text, wf, syn_config=SynthesisConfig(length_scale=1 / (1 + pct / 100)))
	samples = _decode(path)
	os.unlink(path)
	try:
		return samples, _whisper_tokens(samples)
	except ImportError:
		return samples, []


_whisper = None


def _whisper_tokens(samples):
	"""Find when each word is spoken using a small speech-recognition model."""
	global _whisper
	from faster_whisper import WhisperModel

	if _whisper is None:
		_whisper = WhisperModel(os.environ.get('WHISPER_MODEL', 'base.en'), device='cpu', compute_type='int8', download_root=os.path.join(CACHE, 'whisper'))
	audio = samples.astype(np.float32) / 32768.0
	audio16 = np.interp(np.arange(0, len(audio), SAMPLE_RATE / 16000), np.arange(len(audio)), audio).astype(np.float32)
	segs, _ = _whisper.transcribe(audio16, word_timestamps=True, beam_size=1, language='en')
	return [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]


# ---------- alignment ----------


def align(script_words, tokens, total):
	"""Give every script word a (start, end) using the engine's/recogniser's timed tokens."""
	n = len(script_words)
	times = [None] * n
	if tokens:
		a = [norm(w) for w in script_words]
		b = [norm(t[0]) for t in tokens]
		for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
			for k in range(blk.size):
				times[blk.a + k] = (tokens[blk.b + k][1], tokens[blk.b + k][2])
	# fill gaps by interpolation between known neighbours
	known = [i for i, t in enumerate(times) if t]
	if not known:
		step = total / max(n, 1)
		return [(i * step, (i + 1) * step) for i in range(n)]
	for i in range(n):
		if times[i]:
			continue
		prev = max((k for k in known if k < i), default=None)
		nxt = min((k for k in known if k > i), default=None)
		t0 = times[prev][1] if prev is not None else 0.0
		t1 = times[nxt][0] if nxt is not None else total
		lo = prev if prev is not None else -1
		hi = nxt if nxt is not None else n
		span = (t1 - t0) / (hi - lo - 1)
		s = t0 + (i - lo - 1) * span
		times[i] = (s, s + span)
	return times


def speak(scene_texts, engine='auto', voice=None, rate='+0%', pronounce=None):
	"""Returns (samples, [[(word, start, end), ...] per scene])."""
	pronounce = pronounce or {}
	display = [t.split() for t in scene_texts]
	spoken = '\n\n'.join(' '.join(spoken_form(w, pronounce) for w in ws) for ws in display)
	flat = [spoken_form(w, pronounce) for ws in display for w in ws]

	order = {'auto': ['elevenlabs', 'gemini', 'edge', 'piper']}.get(engine, [engine, 'edge', 'piper'])
	for eng in order:
		if eng == 'elevenlabs' and not os.environ.get('ELEVENLABS_API_KEY'):
			continue
		if eng == 'gemini' and not os.environ.get('GOOGLE_API_KEY'):
			continue
		try:
			print(f'  voice engine: {eng}')
			if eng == 'elevenlabs':
				samples, tokens = _elevenlabs(spoken, voice)
			elif eng == 'gemini':
				samples, tokens = _gemini(spoken, voice)
			elif eng == 'edge':
				samples, tokens = _edge(spoken, voice, rate)
			else:
				samples, tokens = _piper_tts(spoken, rate)
			break
		except Exception as e:
			print(f'  {eng} failed: {e.__class__.__name__}: {str(e)[:200]}')
	else:
		raise RuntimeError('All voice engines failed')

	total = len(samples) / SAMPLE_RATE
	# Match against what was actually said (pronounce swaps), then map back to display words.
	times = align(flat, tokens, total)
	out, i = [], 0
	for ws in display:
		out.append([(w, *times[i + k]) for k, w in enumerate(ws)])
		i += len(ws)
	return samples, out
