"""Downloads and caches 3D emoji artwork (Microsoft Fluent Emoji, MIT licence)."""

import json
import os
import re
import urllib.parse
import urllib.request

import skia

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
FLUENT = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/'
EMOJI_DATA = 'https://cdn.jsdelivr.net/npm/emojibase-data@16/en/compact.json'

_labels = None
_images = {}


def _fetch(url, path):
	if not os.path.exists(path):
		os.makedirs(os.path.dirname(path), exist_ok=True)
		urllib.request.urlretrieve(url, path)
	return path


def _label_for(emoji):
	"""Emoji character (or plain name) -> CLDR name, e.g. '🚀' -> 'rocket'."""
	global _labels
	if re.fullmatch(r"[A-Za-z0-9 :'&.,-]+", emoji):
		return emoji.strip().lower()
	if _labels is None:
		with open(_fetch(EMOJI_DATA, os.path.join(CACHE, 'emoji.json'))) as f:
			data = json.load(f)
		_labels = {}
		for d in data:
			_labels[d['unicode'].replace('️', '')] = d['label']
	return _labels.get(emoji.replace('️', ''))


def emoji(e):
	"""Returns a skia.Image for an emoji character/name, or None if unavailable."""
	if e in _images:
		return _images[e]
	img = None
	label = _label_for(e or '')
	if label:
		folder = label[0].upper() + label[1:]
		snake = re.sub(r'[^a-z0-9]+', '_', label.lower()).strip('_')
		for rel in (f'{folder}/3D/{snake}_3d.png', f'{folder}/Default/3D/{snake}_3d_default.png'):
			path = os.path.join(CACHE, 'emoji', snake + ('_d' if 'Default' in rel else '') + '.png')
			try:
				_fetch(FLUENT + urllib.parse.quote(rel), path)
				img = skia.Image.open(path)
				break
			except Exception:
				if os.path.exists(path) and os.path.getsize(path) == 0:
					os.unlink(path)
	if img is None:
		print(f'  (no 3D art for {e!r}, drawing a badge instead)')
	_images[e] = img
	return img
