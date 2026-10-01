# Browser Agent (browser-use), run from your phone

This runs [browser-use](https://github.com/browser-use/browser-use) on GitHub's servers,
so you can start it from your phone. You don't need a computer.

## One-time setup
1. Get a free Gemini API key at https://aistudio.google.com/apikey
   (or use an Anthropic or OpenAI key instead).
2. In this repo on GitHub, go to **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `GOOGLE_API_KEY` (or `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`)
   - Value: your key

## Run a task
1. Go to **Actions → Browser Agent → Run workflow**. You can do this in the GitHub mobile app or in a mobile browser in "Desktop site" mode.
2. Type a task, e.g. `Go to amazon.in and find the cheapest 1TB SSD with 4+ stars`.
3. Open the finished run. The answer is shown in the run summary, and a GIF
   recording of the browser is in the **browser-agent-output** artifact.

Optional repo variable/secret: set `MODEL` to change the model.
