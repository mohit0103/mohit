// Renders index.html frame by frame with headless Chromium and pipes the frames into ffmpeg.
//   node render.js                      -> .cache/video.mp4 (silent) + .cache/cues.json
//   node render.js --from 12 --to 16    -> just that range
//   node render.js --stills 0.5,3.9,22  -> PNG stills in .cache/stills/
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const HERE = __dirname;
const CACHE = path.join(HERE, '.cache');

(async () => {
	const browser = await chromium.launch({ args: ['--disable-web-security', '--allow-file-access-from-files', '--force-color-profile=srgb'] });
	const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
	page.on('pageerror', (e) => console.error('page error:', e.message));
	await page.goto('file://' + path.join(HERE, 'index.html') + '?render');
	await page.evaluate(() => window.READY);
	const info = await page.evaluate(() => ({ cues: window.CUES, dur: window.DURATION, fps: window.FPS, beat: window.BEAT }));
	fs.writeFileSync(path.join(CACHE, 'cues.json'), JSON.stringify(info, null, 1));
	const shot = () => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });

	const stills = opt('stills');
	if (stills) {
		const dir = path.join(CACHE, 'stills');
		fs.mkdirSync(dir, { recursive: true });
		for (const t of stills.split(',').map(Number)) {
			await page.evaluate((t) => window.renderFrame(t), t);
			fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.png`), await shot());
		}
		await browser.close();
		return;
	}

	const fps = info.fps;
	const from = +opt('from', 0), to = +opt('to', info.dur);
	const out = opt('out', path.join(CACHE, 'video.mp4'));
	const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
		'-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
	const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
	const t0 = Date.now();
	for (let n = n0; n < n1; n++) {
		await page.evaluate((t) => window.renderFrame(t), n / fps);
		const buf = await shot();
		if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
		if ((n - n0) % 60 === 0) process.stdout.write(`frame ${n}/${n1}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
	}
	ff.stdin.end();
	await new Promise((r) => ff.on('close', r));
	await browser.close();
	console.log('wrote', out);
})();
