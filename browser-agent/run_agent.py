"""Run a browser-use agent on a task given in plain English.

Usage:
    python run_agent.py "Find the top story on Hacker News"

Set ONE of these API keys (checked in this order):
    GOOGLE_API_KEY     -> Gemini (has a free tier: https://aistudio.google.com/apikey)
    ANTHROPIC_API_KEY  -> Claude
    OPENAI_API_KEY     -> GPT
"""

import asyncio
import os
import shutil
import sys

from browser_use import Agent, BrowserProfile, BrowserSession, ChatAnthropic, ChatGoogle, ChatOpenAI

OUTPUT_DIR = os.environ.get('OUTPUT_DIR', 'output')


def pick_llm():
	if os.environ.get('GOOGLE_API_KEY'):
		return ChatGoogle(model=os.environ.get('MODEL', 'gemini-flash-latest'))
	if os.environ.get('ANTHROPIC_API_KEY'):
		return ChatAnthropic(model=os.environ.get('MODEL', 'claude-sonnet-5-5'))
	if os.environ.get('OPENAI_API_KEY'):
		return ChatOpenAI(model=os.environ.get('MODEL', 'gpt-4.1-mini'))
	sys.exit('No API key found. Set GOOGLE_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY.')


def find_chrome():
	for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'):
		path = shutil.which(name)
		if path:
			return path
	return None


async def main(task: str):
	os.makedirs(OUTPUT_DIR, exist_ok=True)
	browser = BrowserSession(
		browser_profile=BrowserProfile(headless=True, executable_path=find_chrome(), chromium_sandbox=False)
	)
	agent = Agent(
		task=task,
		llm=pick_llm(),
		browser_session=browser,
		generate_gif=os.path.join(OUTPUT_DIR, 'recording.gif'),
	)
	history = await agent.run(max_steps=int(os.environ.get('MAX_STEPS', '25')))

	result = history.final_result() or '(no final result)'
	report = f'## Task\n{task}\n\n## Result\n{result}\n\n**Success:** {history.is_successful()}\n'
	with open(os.path.join(OUTPUT_DIR, 'result.md'), 'w') as f:
		f.write(report)
	print(report)


if __name__ == '__main__':
	if len(sys.argv) < 2:
		sys.exit('Usage: python run_agent.py "<task>"')
	asyncio.run(main(' '.join(sys.argv[1:])))
