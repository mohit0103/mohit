"""Text-to-speech with per-word timings.

Two engines:
  edge  - Microsoft Edge neural voices (free, needs internet, very natural, exact word timings)
  piper - offline neural voice (runs anywhere, word timings estimated per phrase)

Both return (samples: np.int16 mono @ SAMPLE_RATE, words: [(display_word, start_s, end_s)]).
"""

import asyncio
import os
import re
import subprocess
import tempfile
import urllib.request
import wave

import numpy as np

SAMPLE_RATE = 24000
PIPER_VOICE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx'


def _decode(path: str) -> np.ndarray:
	"""Decode any audio file to mono int16 at SAMPLE_RATE using ffmpeg."""
	raw = subprocess.run(
		['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(SAMPLE_RATE), '-'],
		check=True,
		capture_output=True,
	).stdout
	return np.frombuffer(raw, dtype=np.int16)


def spoken_form(word: str, pronounce: dict[str, str]) -> str:
	"""Swap a display word for how it should be said (keeps surrounding punctuation)."""
	m = re.match(r'^(\W*)(.*?)(\W*)$', word)
	pre, core, post = m.groups()
	for k, v in pronounce.items():
		if core.lower() == k.lower():
			return pre + v + post
	return word


def _spread(words: list[str], start: float, end: float) -> list[tuple[str, float, float]]:
	"""Estimate word timings inside a span, weighting by word length."""
	weights = [len(re.sub(r'\W', '', w)) + 1.5 for w in words]
	total = sum(weights)
	out, t = [], start
	for w, wt in zip(words, weights):
		d = (end - start) * wt / total
		out.append((w, t, t + d))
		t += d
	return out


def _trim_silence(a: np.ndarray, thresh: int = 300) -> tuple[np.ndarray, int]:
	"""Trim leading/trailing near-silence; returns (trimmed, samples_cut_from_start)."""
	idx = np.where(np.abs(a.astype(np.int32)) > thresh)[0]
	if len(idx) == 0:
		return a, 0
	pad = int(0.03 * SAMPLE_RATE)
	s, e = max(0, idx[0] - pad), min(len(a), idx[-1] + pad)
	return a[s:e], s


# ---------- Edge ----------


async def _edge_async(text: str, voice: str, rate: str):
	import edge_tts

	comm = edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary')
	audio, bounds = bytearray(), []
	async for chunk in comm.stream():
		if chunk['type'] == 'audio':
			audio.extend(chunk['data'])
		elif chunk['type'] == 'WordBoundary':
			bounds.append((chunk['offset'] / 1e7, (chunk['offset'] + chunk['duration']) / 1e7))
	return bytes(audio), bounds


def edge_tts(display_words: list[str], pronounce: dict, voice: str, rate: str):
	spoken = ' '.join(spoken_form(w, pronounce) for w in display_words)
	audio, bounds = asyncio.run(_edge_async(spoken, voice, rate))
	with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as f:
		f.write(audio)
	samples = _decode(f.name)
	os.unlink(f.name)
	if len(bounds) == len(display_words):
		words = [(w, s, e) for w, (s, e) in zip(display_words, bounds)]
	elif bounds:
		words = _spread(display_words, bounds[0][0], bounds[-1][1])
	else:
		words = _spread(display_words, 0.05, len(samples) / SAMPLE_RATE - 0.05)
	return samples, words


# ---------- Piper ----------

_piper_voice = None


def _load_piper():
	global _piper_voice
	if _piper_voice is None:
		from piper import PiperVoice

		cache = os.path.join(os.path.dirname(__file__), '.cache')
		os.makedirs(cache, exist_ok=True)
		model = os.path.join(cache, 'voice.onnx')
		if not os.path.exists(model):
			print('Downloading Piper voice (one time)...')
			urllib.request.urlretrieve(PIPER_VOICE_URL, model)
			urllib.request.urlretrieve(PIPER_VOICE_URL + '.json', model + '.json')
		_piper_voice = PiperVoice.load(model)
	return _piper_voice


def piper_tts(display_words: list[str], pronounce: dict, speed: float):
	from piper import SynthesisConfig

	voice = _load_piper()
	cfg = SynthesisConfig(length_scale=1.0 / speed)
	# Split into phrases at punctuation so pauses land in the right place and timing stays tight.
	phrases, cur = [], []
	for w in display_words:
		cur.append(w)
		if re.search(r'[,.;:!?—]$', w):
			phrases.append(cur)
			cur = []
	if cur:
		phrases.append(cur)

	pieces, words, t = [], [], 0.0
	for ph in phrases:
		text = ' '.join(spoken_form(w, pronounce) for w in ph)
		with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
			path = f.name
		with wave.open(path, 'wb') as wf:
			voice.synthesize_wav(text, wf, syn_config=cfg)
		a, _ = _trim_silence(_decode(path))
		os.unlink(path)
		dur = len(a) / SAMPLE_RATE
		words += _spread(ph, t, t + dur)
		gap = 0.22 if re.search(r'[.!?]$', ph[-1]) else 0.12
		pieces += [a, np.zeros(int(gap * SAMPLE_RATE), dtype=np.int16)]
		t += dur + gap
	return np.concatenate(pieces), words


def speak(text: str, engine: str, voice: str, rate: str, pronounce: dict):
	display_words = text.split()
	if engine == 'edge':
		try:
			return edge_tts(display_words, pronounce, voice, rate)
		except Exception as e:  # network blocked, service down, etc.
			print(f'Edge TTS failed ({e.__class__.__name__}: {e}); falling back to Piper.')
	pct = int(rate.strip('%+') or 0) if rate else 0
	return piper_tts(display_words, pronounce, speed=1 + pct / 100)
