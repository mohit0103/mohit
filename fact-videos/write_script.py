"""Write a video script (YAML) from a topic using an LLM.

    python write_script.py "why cats purr" -o scripts/cats-purr.yaml

Uses GOOGLE_API_KEY (Gemini, free tier) or ANTHROPIC_API_KEY, whichever is set.
"""

import argparse
import json
import os
import re
import sys
import urllib.request

import yaml

PROMPT = """You write scripts for 20-35 second vertical "interesting fact" videos.
Topic: {topic}

Rules:
- 5 to 7 scenes. Each scene has one short spoken line ("say"), max ~18 words, plain conversational English.
- Open with a surprising hook. End with a satisfying one-line payoff.
- Facts must be accurate and well established. No made-up numbers or studies.
- "highlight": 1-3 key words from that scene's "say" (exact words as written) to emphasise in captions.
- Pick a "visual" per scene from these types only:
  title: {{"type":"title","lines":["2-3 WORDS","2-3 WORDS"],"sub":"optional short italic line"}}
  stat:  {{"type":"stat","value":NUMBER,"prefix":"","suffix":" unit","label":"short explanation","decimals":0}}
  chart: {{"type":"chart","x_label":"...","y_label":"...","series":[{{"shape":"line|steps|curve|wave","label":"..."}}]}}
  list:  {{"type":"list","items":["short item","short item","short item"]}}
  trail: {{"type":"trail","motion":"hold|smooth","exposures":5}}   (only for walking/moving-creature topics)
- "pronounce": map any hard names or acronyms in "say" to a phonetic spelling, else {{}}.

Return ONLY JSON:
{{"kicker":"2-3 word lowercase topic label","tagline":"short lowercase question","pronounce":{{}},
  "scenes":[{{"say":"...","highlight":["..."],"visual":{{...}}}}]}}"""


def post(url, body, headers):
	req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **headers})
	with urllib.request.urlopen(req, timeout=120) as r:
		return json.load(r)


def ask(prompt):
	if os.environ.get('GOOGLE_API_KEY'):
		model = os.environ.get('SCRIPT_MODEL', 'gemini-flash-latest')
		r = post(
			f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
			{'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'responseMimeType': 'application/json'}},
			{'x-goog-api-key': os.environ['GOOGLE_API_KEY']},
		)
		return r['candidates'][0]['content']['parts'][0]['text']
	if os.environ.get('ANTHROPIC_API_KEY'):
		r = post(
			'https://api.anthropic.com/v1/messages',
			{'model': os.environ.get('SCRIPT_MODEL', 'claude-sonnet-5-5'), 'max_tokens': 4000, 'messages': [{'role': 'user', 'content': prompt}]},
			{'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01'},
		)
		return r['content'][0]['text']
	sys.exit('Set GOOGLE_API_KEY or ANTHROPIC_API_KEY to write scripts from a topic.')


def main():
	ap = argparse.ArgumentParser()
	ap.add_argument('topic')
	ap.add_argument('-o', '--out')
	ap.add_argument('--channel', default=os.environ.get('CHANNEL', 'factloop'))
	ap.add_argument('--theme', default='ink')
	a = ap.parse_args()

	raw = ask(PROMPT.format(topic=a.topic))
	data = json.loads(re.search(r'\{.*\}', raw, re.S).group(0))
	script = {'channel': a.channel, 'kicker': data.get('kicker', ''), 'tagline': data.get('tagline', ''), 'theme': a.theme, 'pronounce': data.get('pronounce') or {}, 'scenes': data['scenes']}
	slug = re.sub(r'[^a-z0-9]+', '-', a.topic.lower()).strip('-')[:40]
	out = a.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts', slug + '.yaml')
	with open(out, 'w') as f:
		yaml.safe_dump(script, f, sort_keys=False, allow_unicode=True, width=120)
	print(out)


if __name__ == '__main__':
	main()
