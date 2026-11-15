#!/usr/bin/env bash
# Build the whole video: media prep -> frame render -> sound design -> final mp4.
#   ./make.sh                 full render to output/memories.mp4
#   ./make.sh --from 18 --to 24   render only part of the timeline (quick check)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p output .cache
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"

python3 prep.py
node render.js "$@"
python3 audio.py

ffmpeg -v error -y -i .cache/video.mp4 -i .cache/audio.wav \
	-filter_complex "[1:a]loudnorm=I=-14:TP=-1.0:LRA=11[a]" -map 0:v -map "[a]" \
	-c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart output/memories.mp4
echo "done: $(pwd)/output/memories.mp4"
