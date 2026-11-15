"""Prepare media for the motion video.

Reads config.json, makes small upright copies of every photo, turns every video clip into a
frame sequence (so the browser renderer can step through it frame by frame), and writes
.cache/data.js, which index.html loads.
"""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CACHE = HERE / ".cache"
VIDEO_EXT = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}
FPS = 30
CLIP_SECONDS = 9


def media_paths(cfg):
	yield cfg["morph"]
	yield cfg["card"]["clip"]
	yield cfg["title"]["hero"]
	yield cfg["pinClip"]
	yield cfg["avatar"]["media"]
	for p in cfg["places"]:
		yield p["media"]
	yield from cfg["grid"]


def prep_one(spec):
	path, _, start = spec.partition("#")
	src = ROOT / path
	if not src.exists():
		sys.exit(f"Missing media file: {path}")
	key = hashlib.sha1(spec.encode()).hexdigest()[:12]
	if src.suffix.lower() in VIDEO_EXT:
		out = CACHE / "seq" / key
		if not (out / "done").exists():
			out.mkdir(parents=True, exist_ok=True)
			cmd = ["ffmpeg", "-v", "error", "-y"]
			if start:
				cmd += ["-ss", start]
			cmd += ["-i", str(src), "-t", str(CLIP_SECONDS), "-vf", f"fps={FPS},scale='min(1280,iw)':-2",
				"-q:v", "3", str(out / "%04d.jpg")]
			subprocess.run(cmd, check=True)
			(out / "done").write_text("ok")
		count = len(list(out.glob("*.jpg")))
		return {"type": "seq", "dir": f".cache/seq/{key}", "count": count}
	out = CACHE / "img" / f"{key}.jpg"
	if not out.exists():
		out.parent.mkdir(parents=True, exist_ok=True)
		im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
		im.thumbnail((1500, 1500), Image.LANCZOS)
		im.save(out, quality=92)
	w, h = Image.open(out).size
	return {"type": "image", "src": f".cache/img/{key}.jpg", "w": w, "h": h}


def main():
	cfg = json.loads((HERE / "config.json").read_text())
	media = {spec: prep_one(spec) for spec in dict.fromkeys(media_paths(cfg))}
	CACHE.mkdir(exist_ok=True)
	(CACHE / "data.js").write_text(
		"window.CONFIG = " + json.dumps(cfg) + ";\nwindow.MEDIA = " + json.dumps(media) + ";\n")
	print(f"prepared {len(media)} media items")


if __name__ == "__main__":
	main()
