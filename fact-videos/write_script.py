"""Write a video script (YAML) with an LLM, either from a topic you give
or from what's trending in India right now.

    python write_script.py "why octopuses have three hearts"
    python write_script.py --trending            # picks today's best trend in India

Uses GOOGLE_API_KEY (Gemini, free tier, with Google Search for fresh facts)
or ANTHROPIC_API_KEY (Claude, with web search), whichever is set.
"""

import argparse
import datetime
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))

VISUAL_GUIDE = """
VISUAL TYPES (pick the one that SHOWS the idea; vary them; never the same type twice in a row):
  hook:      {"type":"hook","emoji":"🤯","text":"1-3 WORDS or a number"}        <- scene 1 ONLY, always
  hero:      {"type":"hero","emoji":"🐙","orbit":["❤️","💙","🌊"],"label":"2-4 words"}   main subject with related emojis orbiting
  versus:    {"type":"versus","left":{"emoji":"🇮🇳","label":"India","value":140},"right":{"emoji":"🇨🇳","label":"China","value":141},"unit":" cr"}  comparisons (values optional)
  bars:      {"type":"bars","items":[{"emoji":"🍚","label":"rice","value":120},...],"unit":" Mt"}   2-5 ranked quantities
  pictogram: {"type":"pictogram","emoji":"🧍","total":10,"highlight":3,"label":"3 in 10"}   proportions / "1 in N"
  stat:      {"type":"stat","value":2500,"prefix":"₹","suffix":"","label":"2-5 words","emoji":"💰"}  one big number (counts up)
  timeline:  {"type":"timeline","events":[{"year":"1983","emoji":"🏆","label":"3-5 words"},...]}  2-5 dated events
  scale:     {"type":"scale","items":[{"emoji":"🐜","label":"ant","size":1},{"emoji":"🐘","label":"elephant","size":40}]}  size comparisons
  flow:      {"type":"flow","steps":[{"emoji":"☀️","label":"heat"},{"emoji":"💧","label":"evaporation"},{"emoji":"🌧️","label":"rain"}]}  cause -> effect, 2-4 steps
  chart:     {"type":"chart","x_label":"time","y_label":"price","series":[{"shape":"curve|line|steps|drop|wave","label":"...","emoji":"📈"}]}  trends
  list:      {"type":"list","items":[{"emoji":"✅","label":"2-5 words"},...]}  2-4 items, use rarely
Emojis must be standard single Unicode emoji characters (they render as 3D art). On-screen labels: max 5 words.
Numbers in visuals must match what is said.
"""

SCRIPT_RULES = """
You write scripts for viral 25-40 second vertical fact videos (Instagram Reels / YouTube Shorts) for an Indian audience.

THE HOOK (scene 1) DECIDES EVERYTHING. It must, in under 12 spoken words:
- create a curiosity gap or pattern-interrupt: a surprising claim, a "wait, what?" contradiction, a specific shocking number, or a direct "you" challenge
- NEVER start with "Did you know", "Today we", "In this video", "Hey guys", or the topic name as a label
- good shapes: "This ___ has ___, and it still ___."  "You've been ___ wrong your whole life."  "₹1 coin costs more than ₹1 to make."  "There's a village in India where ___."
STRUCTURE: hook -> quick context -> 2-3 escalating reveals (each a new surprise, "but here's the twist") -> payoff line that loops back to the hook so the video rewatches well.
STYLE: spoken, punchy, simple English (a 14-year-old understands). Max 16 words per scene, 6-8 scenes, total 70-110 words.
Use Indian context and units where natural (₹, lakh, crore, km). No hashtags or emojis in "say".
ACCURACY: only well-established facts. If unsure of a number, say it approximately ("almost", "about") or drop it. No invented studies or quotes.
"highlight": 1-2 exact words from that scene's "say" to pop in the captions.
"pronounce": map hard names/acronyms in "say" to how a voice should say them (e.g. {"ISRO": "Isro"}), else {}.
"""

OUTPUT_SPEC = """
Return ONLY a JSON object (no prose) like:
{"topic":"...","kicker":"2-3 word lowercase label","pronounce":{},
 "scenes":[{"say":"...","highlight":["..."],"visual":{...}}],
 "post_caption":"1-2 line Instagram caption with a question to drive comments",
 "hashtags":["#facts","..."],
 "sources":["url or source name", "..."]}
"""

TREND_TASK = """
Below are today's Google search trends in India (title, approx searches, and related headlines).
Pick the ONE trend that makes the best *interesting-fact* video: something with a surprising, evergreen,
verifiable angle connected to it (the science, history, money, record or "why" behind the trend).
AVOID: deaths, accidents, crimes, tragedies, disasters, politics/elections, religion/communal topics, gossip about private people,
anything medical advice, betting, and anything where facts are still unclear. If nothing fits, pick a fun evergreen India topic.
Search the web to confirm facts and numbers before writing. Fill "sources".

TRENDS:
{trends}
"""


def post(url, body, headers):
	req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **headers})
	with urllib.request.urlopen(req, timeout=240) as r:
		return json.load(r)


def ask(prompt, search=False):
	if os.environ.get('GOOGLE_API_KEY'):
		model = os.environ.get('SCRIPT_MODEL', 'gemini-2.5-flash')
		body = {'contents': [{'parts': [{'text': prompt}]}]}
		if search:
			body['tools'] = [{'google_search': {}}]
		else:
			body['generationConfig'] = {'responseMimeType': 'application/json'}
		r = post(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', body, {'x-goog-api-key': os.environ['GOOGLE_API_KEY']})
		parts = r['candidates'][0]['content']['parts']
		return ''.join(p.get('text', '') for p in parts)
	if os.environ.get('ANTHROPIC_API_KEY'):
		body = {'model': os.environ.get('SCRIPT_MODEL', 'claude-sonnet-5-5'), 'max_tokens': 6000, 'messages': [{'role': 'user', 'content': prompt}]}
		if search:
			body['tools'] = [{'type': 'web_search_20250305', 'name': 'web_search', 'max_uses': 5}]
		r = post('https://api.anthropic.com/v1/messages', body, {'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01'})
		return ''.join(b.get('text', '') for b in r['content'] if b.get('type') == 'text')
	sys.exit('Set GOOGLE_API_KEY or ANTHROPIC_API_KEY to write scripts.')


def india_trends(limit=20):
	"""Today's Google Trends for India, with related news headlines."""
	ns = {'ht': 'https://trends.google.com/trending/rss'}
	with urllib.request.urlopen('https://trends.google.com/trending/rss?geo=IN', timeout=30) as r:
		root = ET.fromstring(r.read())
	out = []
	for item in root.iter('item'):
		news = [n.findtext('ht:news_item_title', '', ns) for n in item.findall('ht:news_item', ns)]
		out.append(f"- {item.findtext('title')} ({item.findtext('ht:approx_traffic', '', ns)} searches): " + ' | '.join(n for n in news if n)[:300])
	return '\n'.join(out[:limit])


def parse_json(raw):
	raw = re.sub(r'^```(?:json)?|```$', '', raw.strip(), flags=re.M)
	m = re.search(r'\{.*\}', raw, re.S)
	if not m:
		raise ValueError('No JSON in model reply:\n' + raw[:500])
	return json.loads(m.group(0))


def critique(data):
	"""Second pass: sharpen the hook and check the script against the rules."""
	prompt = (
		SCRIPT_RULES + VISUAL_GUIDE
		+ '\nHere is a draft script. Improve it: make the hook more scroll-stopping, cut filler words, make sure each scene '
		'has a different, fitting visual that SHOWS the idea, and that numbers in visuals match the narration. '
		'Keep facts and sources unchanged unless one is wrong.\n\nDRAFT:\n' + json.dumps(data, ensure_ascii=False) + OUTPUT_SPEC
	)
	try:
		better = parse_json(ask(prompt))
		if better.get('scenes'):
			return better
	except Exception as e:
		print(f'(critique pass skipped: {e})')
	return data


def validate(data):
	scenes = [s for s in data.get('scenes', []) if s.get('say')]
	if len(scenes) < 3:
		raise ValueError('Script has too few scenes')
	for i, s in enumerate(scenes):
		v = s.get('visual') or {}
		if i == 0 and v.get('type') != 'hook':
			s['visual'] = {'type': 'hook', 'emoji': v.get('emoji', '🤯'), 'text': v.get('text', '')}
		s['highlight'] = [h for h in s.get('highlight', []) if h.lower() in s['say'].lower()][:2]
	data['scenes'] = scenes
	return data


def write(topic=None, trending=False, channel='factloop', theme='ink', out=None):
	if trending:
		try:
			trends = india_trends()
		except Exception as e:
			print(f'Could not fetch trends ({e}); using an evergreen topic.')
			trends = '(unavailable - pick a fun evergreen India topic)'
		prompt = SCRIPT_RULES + VISUAL_GUIDE + TREND_TASK.format(trends=trends) + OUTPUT_SPEC
	else:
		prompt = SCRIPT_RULES + VISUAL_GUIDE + f'\nTOPIC: {topic}\nCheck facts with search if available.' + OUTPUT_SPEC
	data = validate(critique(parse_json(ask(prompt, search=True))))
	script = {
		'channel': channel,
		'kicker': data.get('kicker', ''),
		'theme': theme,
		'pronounce': data.get('pronounce') or {},
		'scenes': data['scenes'],
		'post_caption': data.get('post_caption', ''),
		'hashtags': data.get('hashtags', []),
		'sources': data.get('sources', []),
		'topic': data.get('topic', topic or ''),
	}
	slug = re.sub(r'[^a-z0-9]+', '-', (script['topic'] or 'video').lower()).strip('-')[:40]
	if not out:
		folder = os.path.join(HERE, 'scripts', 'daily' if trending else '')
		os.makedirs(folder, exist_ok=True)
		prefix = datetime.date.today().isoformat() + '-' if trending else ''
		out = os.path.join(folder, prefix + slug + '.yaml')
	with open(out, 'w') as f:
		yaml.safe_dump(script, f, sort_keys=False, allow_unicode=True, width=120)
	return out


if __name__ == '__main__':
	ap = argparse.ArgumentParser()
	ap.add_argument('topic', nargs='?')
	ap.add_argument('--trending', action='store_true', help="Pick from today's Google Trends in India")
	ap.add_argument('-o', '--out')
	ap.add_argument('--channel', default=os.environ.get('CHANNEL', 'factloop'))
	ap.add_argument('--theme', default=os.environ.get('THEME', 'ink'))
	a = ap.parse_args()
	if not a.topic and not a.trending:
		ap.error('give a topic or --trending')
	print(write(a.topic, a.trending, a.channel, a.theme, a.out))
