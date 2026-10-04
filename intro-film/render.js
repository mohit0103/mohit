// Frame-accurate renderer for index.html.
//
// Every frame is a pure function of time (window.seek(t)), so we step through
// the timeline at 120 sub-frames per second, screenshot each one, and let
// ffmpeg average each pair into a 60 fps frame: a 180° shutter, which gives
// real motion blur on fast moves while still frames stay razor sharp.
//
//   node render.js                 full film -> out/intro.mp4
//   node render.js --page reel.html   9:16 reel -> out/reel.mp4
//   node render.js --stills 3,12   PNG stills at those seconds -> out/still-*.png
//   node render.js --from 10 --to 14 --out out/clip.mp4   partial render
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

const PW = process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const FPS = 60, SUB = 2;
const WORKERS = +arg('--workers', 3);
const PAGE = arg('--page', 'index.html');
const NAME = PAGE === 'index.html' ? 'intro' : path.basename(PAGE, '.html');
const URL = 'file://' + path.resolve(__dirname, PAGE) + '?render';
let VW = 1920, VH = 1080;   // replaced by the page's window.STAGE
const launchOpts = { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--force-color-profile=srgb', '--disable-lcd-text', '--hide-scrollbars'] };

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => window.ready);
  const cdp = await page.context().newCDPSession(page);
  return { page, cdp };
}

async function grab({ page, cdp }, t, format = 'jpeg') {
  await page.evaluate(t => window.seek(t), t);
  const { data } = await cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 96 : undefined, clip: { x: 0, y: 0, width: VW, height: VH, scale: 1 }, captureBeyondViewport: false });
  return Buffer.from(data, 'base64');
}

async function stills(times) {
  const browser = await chromium.launch(launchOpts);
  const p = await openPage(browser);
  for (const t of times) {
    const f = path.join(OUT, `${NAME}-still-${String(t).replace('.', '_')}.png`);
    fs.writeFileSync(f, await grab(p, t, 'png'));
    console.log('wrote', f);
  }
  await browser.close();
}

// render output frames [f0, f1) into one segment
async function segment(f0, f1, file, idx) {
  const browser = await chromium.launch(launchOpts);
  const p = await openPage(browser);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `tmix=frames=${SUB},select='not(mod(n+1\\,${SUB}))',setpts=N/(${FPS}*TB)`, '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-g', '120', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const started = Date.now();
  for (let f = f0; f < f1; f++) {
    for (let s = 0; s < SUB; s++) {
      const t = (f + s / SUB) / FPS;
      const buf = await grab(p, t);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    if ((f - f0) % 120 === 0) {
      const done = f - f0, el = (Date.now() - started) / 1000;
      console.log(`[w${idx}] ${done}/${f1 - f0} frames  ${(done / Math.max(el, 1)).toFixed(1)} fps`);
    }
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  await browser.close();
}

async function film() {
  // read duration + sound cues from the composition itself
  const browser = await chromium.launch(launchOpts);
  const p = await openPage(browser);
  const { dur, cues, sections, bpm, score: scoreScript } = await p.page.evaluate(() => ({ dur: window.DURATION, cues: window.CUES, sections: window.SECTIONS || null, bpm: window.BPM || null, score: window.SCORE || 'score.py' }));
  await browser.close();
  const cuesFile = path.join(OUT, `${NAME}-cues.json`);
  fs.writeFileSync(cuesFile, JSON.stringify({ duration: dur, cues, sections, bpm }, null, 1));

  const from = +arg('--from', 0), to = +arg('--to', dur);
  const F0 = Math.round(from * FPS), F1 = Math.round(to * FPS);
  const per = Math.ceil((F1 - F0) / WORKERS);
  console.log(`rendering ${F1 - F0} frames (${((F1 - F0) / FPS).toFixed(2)} s) at ${FPS} fps with ${WORKERS} workers`);
  const segs = [];
  const jobs = [];
  for (let w = 0; w < WORKERS; w++) {
    const a = F0 + w * per, b = Math.min(F1, a + per);
    if (a >= b) break;
    const file = path.join(OUT, `${NAME}-seg-${w}.mp4`);
    segs.push(file);
    jobs.push(segment(a, b, file, w));
  }
  await Promise.all(jobs);
  const list = path.join(OUT, `${NAME}-segments.txt`);
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const video = path.join(OUT, `${NAME}-video-only.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
  segs.forEach(s => fs.unlinkSync(s)); fs.unlinkSync(list);

  const out = path.resolve(arg('--out', path.join(OUT, `${NAME}.mp4`)));
  const score = path.join(OUT, `${NAME}-score.wav`);
  if (!args.includes('--no-audio')) {
    execFileSync('python3', [path.join(__dirname, scoreScript), cuesFile, score], { stdio: 'inherit' });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-ss', String(from), '-t', String(to - from), '-i', score,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out]);
    fs.unlinkSync(video);
  } else fs.renameSync(video, out);
  console.log('wrote', out);
}

(async () => {
  {
    const b = await chromium.launch(launchOpts);
    const pg = await b.newPage();
    await pg.goto(URL, { waitUntil: 'load' });
    const st = await pg.evaluate(() => window.STAGE || { w: 1920, h: 1080 });
    VW = st.w; VH = st.h;
    await b.close();
  }
  if (args.includes('--stills')) await stills(arg('--stills').split(',').map(Number));
  else await film();
})().catch(e => { console.error(e); process.exit(1); });
