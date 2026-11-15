/* "What do you mean?" — a love story for Lubhna, cut to the chorus.
 * Everything is authored in BEATS (n). Frame time T = n * BEAT. Each frame is a pure function of n,
 * so render.js can capture any frame in any order. Lyric timings (L) are measured from the song
 * section that starts at config.musicStart. */
(() => {
const C = window.CONFIG, M = window.MEDIA;
const FPS = 30;
const BEAT = 60 / ((C.beat && C.beat.bpm) || 123.06);
const END_N = 78;
const DUR = END_N * BEAT;
const OFF = 120; // frame margin (see #frame)
const $ = (id) => document.getElementById(id);

/* lyric hits, in beats from the start of the edit (word onsets snapped to the 16th-note grid) */
const L = {
	m1: [['What', 4.75], ['do', 6.0], ['you', 6.5], ['mean?', 7.5]], m1end: 8.0,
	yes: 16.5, no: 20.5,
	m2: [['What', 21.75], ['do', 22.25], ['you', 22.75], ['mean?', 23.25]], m2end: 23.75,
	dont: 30.5, tell: 34.5, go: 36.5,
	m3: [['What', 37.5], ['do', 37.75], ['you', 38.5], ['mean?', 38.75]], m3end: 39.5,
	time: 50.25,
	m4: [['What', 53.25], ['do', 53.5], ['you', 54.25], ['mean?', 54.75]], m4end: 55.25,
	m5: [['Oh,', 58.75], ['what', 59.0], ['do', 61.25], ['you', 62.0], ['mean?', 62.5]], m5end: 63.0,
	mind: [65.5, 66.0, 66.75, 68.0], fin: [69.0, 69.25, 70.0, 70.5],
};

/* ------------------------------------------------------------------ helpers */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
	lin: (t) => t,
	inQ: (t) => t * t,
	inC: (t) => t * t * t,
	outC: (t) => 1 - (1 - t) ** 3,
	ioC: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
	outQ: (t) => 1 - (1 - t) ** 5,
	ioQ: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
	outE: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
	inE: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
	ioE: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
	outB: (t) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
	ioS: (t) => t * t * (3 - 2 * t),
};
// damped spring step response; p in seconds
const spring = (p, z = 0.45, w = 15) => {
	if (p <= 0) return 0;
	const wd = w * Math.sqrt(1 - z * z);
	return 1 - Math.exp(-z * w * p) * (Math.cos(wd * p) + (z * w / wd) * Math.sin(wd * p));
};
const sp = (n, n0, z, w) => spring((n - n0) * BEAT, z, w);
const tw = (t, t0, t1, a, b, e = E.ioC) => (t <= t0 ? a : t >= t1 ? b : lerp(a, b, e((t - t0) / (t1 - t0))));
function K(t, k) {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t < k[i][0]) return lerp(k[i - 1][1], k[i][1], (k[i][2] || E.ioC)((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0])));
	return k[k.length - 1][1];
}
function camAt(t, k) {
	if (t <= k[0][0]) return { r: 0, ...k[0][1] };
	for (let i = 1; i < k.length; i++) {
		if (t < k[i][0]) {
			const p = (k[i][2] || E.ioC)((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
			const a = k[i - 1][1], b = k[i][1];
			return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), s: a.s * Math.pow(b.s / a.s, p), r: lerp(a.r || 0, b.r || 0, p) };
		}
	}
	return { r: 0, ...k[k.length - 1][1] };
}
const camTf = (c, dx = 0, dy = 0) => `translate(${1080 + dx}px,${660 + dy}px) rotate(${c.r || 0}deg) scale(${c.s}) translate(${-c.x}px,${-c.y}px)`;
let seed = 11;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nz = (t, s) => Math.sin(t * 1.31 + s) * 0.5 + Math.sin(t * 2.17 + s * 2.3) * 0.3 + Math.sin(t * 3.71 + s * 0.7) * 0.2;
function el(tag, cls, parent, css) {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (css) Object.assign(e.style, css);
	if (parent) parent.appendChild(e);
	return e;
}
const svgEl = (tag, attrs, parent) => {
	const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const k in attrs) e.setAttribute(k, attrs[k]);
	if (parent) parent.appendChild(e);
	return e;
};
const px = (v) => `${v}px`;
const show = (e, on) => { e.style.display = on ? '' : 'none'; };
// camera shake that decays after an impact at beat n0
const shake = (n, n0, amp, sv) => (n < n0 ? 0 : amp * Math.exp(-(n - n0) * BEAT / 0.07) * Math.sin((n - n0) * BEAT * 70 + sv));

/* ------------------------------------------------------------------ procedural textures */
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c.toDataURL('image/png'); }
const TEX = {
	paper: canvas(512, 512, (g, w, h) => {
		const im = g.createImageData(w, h);
		for (let i = 0; i < w * h; i++) { const v = 200 + rnd() * 55; im.data[i * 4] = v; im.data[i * 4 + 1] = v - 4; im.data[i * 4 + 2] = v - 12; im.data[i * 4 + 3] = 30; }
		g.putImageData(im, 0, 0);
		g.strokeStyle = 'rgba(120,100,70,.10)';
		for (let i = 0; i < 260; i++) { g.lineWidth = 0.6 + rnd(); g.beginPath(); const x = rnd() * w, y = rnd() * h, a = rnd() * 6.28, l = 6 + rnd() * 22; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
	}),
	gobo: canvas(1600, 1000, (g, w, h) => {
		g.filter = 'blur(16px)';
		for (let i = 0; i < 70; i++) {
			const cx = rnd() * w, cy = rnd() * h * 0.9;
			g.fillStyle = `rgba(70,50,25,${0.25 + rnd() * 0.35})`;
			g.save(); g.translate(cx, cy); g.rotate(rnd() * 6.28);
			g.beginPath(); g.ellipse(0, 0, 40 + rnd() * 70, 14 + rnd() * 26, 0, 0, 6.28); g.fill(); g.restore();
		}
		g.filter = 'blur(40px)'; g.fillStyle = 'rgba(70,50,25,.35)';
		g.beginPath(); g.ellipse(w * 0.85, h * 0.2, 260, 160, 0.6, 0, 6.28); g.fill();
	}),
	grunge: canvas(700, 240, (g, w, h) => {
		g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
		g.globalCompositeOperation = 'destination-out';
		for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.7})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rnd() * 2.6, 0, 6.28); g.fill(); }
		for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.4})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 30, 2 + rnd() * 6, rnd() * 3, 0, 6.28); g.fill(); }
	}),
	grain: [0, 1, 2, 3, 4, 5].map(() => canvas(256, 256, (g, w, h) => {
		const im = g.createImageData(w, h);
		for (let i = 0; i < w * h; i++) { const v = 128 + (rnd() - 0.5) * 120; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
		g.putImageData(im, 0, 0);
	})),
};
function deskSurface(world, tint) {
	const d = el('div', 'desk', world, { backgroundImage: `url(${TEX.paper})`, backgroundSize: '512px 512px' });
	if (tint) d.style.backgroundColor = tint;
	return d;
}
function gobo(world, x, y, s, op) {
	const g = el('img', 'gobo', world, { left: px(x), top: px(y), width: px(1600 * s), height: px(1000 * s), opacity: op });
	g.src = TEX.gobo;
	return g;
}

/* ------------------------------------------------------------------ media */
const mediaList = [];
let pending = [];
function media(parent, spec, opt = {}) {
	const info = M[spec];
	const img = el('img', 'media', parent);
	img.decoding = 'sync';
	img.src = info.type === 'image' ? info.src : `${info.dir}/0001.jpg`;
	if (opt.pos) img.style.objectPosition = opt.pos;
	const m = { img, info, t0: opt.t0 || 0, sd: rnd() * 100, kb: opt.kb !== false, frame: 1, amt: opt.amt ?? 1 };
	mediaList.push(m);
	return m;
}
function updateMedia(T) {
	for (const m of mediaList) {
		const lt = T - m.t0;
		if (m.info.type === 'seq') {
			const f = 1 + (Math.max(0, Math.floor(lt * FPS)) % m.info.count);
			if (f !== m.frame) { m.frame = f; m.img.src = `${m.info.dir}/${String(f).padStart(4, '0')}.jpg`; pending.push(m.img.decode().catch(() => {})); }
		} else if (m.kb) {
			const a = m.amt, s = 1.08 - 0.04 * clamp(lt / 8) + 0.01 * a * nz(T * 0.9, m.sd);
			m.img.style.transform = `translate(${(1.2 * a * nz(T * 1.5, m.sd + 3)).toFixed(2)}%,${(1.0 * a * nz(T * 1.3, m.sd + 9)).toFixed(2)}%) scale(${s.toFixed(4)})`;
		}
	}
}
function avatar(box) {
	const a = C.avatar, m = media(box, a.media, { kb: false });
	Object.assign(m.img.style, { objectPosition: `${a.x}% ${a.y}%`, transform: `scale(${a.zoom})`, transformOrigin: `${a.x}% ${a.y}%` });
}

/* ------------------------------------------------------------------ global fx */
const frame = $('frame'), fxBlur = $('fxblur'), fxDisp = $('fxdisp'), fxR = $('fxr'), fxB = $('fxb');
(function lensMap() {
	const w = 480, h = 270, c = document.createElement('canvas'); c.width = w; c.height = h;
	const g = c.getContext('2d'), im = g.createImageData(w, h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const nx = (x / (w - 1)) * 2 - 1, ny = (y / (h - 1)) * 2 - 1, f = 1 - (nx * nx + ny * ny) / 2, i = (y * w + x) * 4;
		im.data[i] = Math.round(255 * (0.5 + (0.5 * (-nx * f)) / 0.8));
		im.data[i + 1] = Math.round(255 * (0.5 + (0.5 * (-ny * f * 0.85)) / 0.8));
		im.data[i + 2] = 128; im.data[i + 3] = 255;
	}
	g.putImageData(im, 0, 0);
	$('fxmap').setAttribute('href', c.toDataURL());
})();
function setFX(bx, by, lens, ca) {
	bx = Math.min(bx, 60); by = Math.min(by, 60); ca = Math.min(ca, 9);
	if (bx < 0.35 && by < 0.35 && lens < 0.003 && ca < 0.3) { frame.style.filter = 'none'; return; }
	frame.style.filter = 'url(#fx)';
	fxBlur.setAttribute('stdDeviation', `${bx < 0.35 ? 0 : bx.toFixed(2)} ${by < 0.35 ? 0 : by.toFixed(2)}`);
	fxDisp.setAttribute('scale', (lens * 330).toFixed(1));
	fxR.setAttribute('dx', ca.toFixed(2)); fxB.setAttribute('dx', (-ca).toFixed(2));
}

/* ------------------------------------------------------------------ cues for sound design (in beats) */
const CUES = [];
const FIT = []; // layout fixes that need the fonts loaded
const cue = (n, k, v = 1, n0 = null) => CUES.push({ n, n0, k, v });

/* ------------------------------------------------------------------ lyric motif: "What do you mean?" */
const phrases = [];
function phrase(words, end, o) {
	const box = el('div', 'phrase', $('motif'));
	Object.assign(box.style, { left: px(o.x + OFF), top: px(o.y + OFF), fontSize: px(o.size), color: o.color });
	if (o.shadow) box.style.textShadow = o.shadow;
	const items = words.map(([w, t], i) => {
		const wm = el('span', 'wm', box), wi = el('span', 'wi', wm);
		let q = null;
		if (w.endsWith('?')) { wi.textContent = w.slice(0, -1); q = el('span', 'q', wi); q.textContent = '?'; q.style.color = o.accent; }
		else wi.textContent = w;
		if (o.br === i) el('br', '', box);
		else if (i < words.length - 1) box.appendChild(document.createTextNode(' '));
		return { wi, q, t };
	});
	phrases.push({ box, items, end, o });
}
function updPhrases(n) {
	for (const p of phrases) {
		const vis = n >= p.items[0].t - 0.15 && n < p.end + 0.55;
		show(p.box, vis);
		if (!vis) continue;
		p.items.forEach((it) => {
			const k = E.outE(clamp((n - (it.t - 0.05)) / 0.55));
			it.wi.style.transform = `translateY(${((1 - k) * 112).toFixed(2)}%) rotate(${((1 - k) * 8).toFixed(2)}deg)`;
			if (it.q) {
				const s = clamp(sp(n, it.t + 0.1, 0.32, 20), 0, 1.6);
				it.q.style.transform = `translateY(${(1 - Math.min(s, 1)) * -40}px) scale(${s.toFixed(3)}) rotate(${((1 - Math.min(s, 1)) * -25).toFixed(1)}deg)`;
			}
		});
		const x = tw(n, p.end, p.end + 0.5, 0, 1, E.inC);
		p.box.style.opacity = 1 - x;
		p.box.style.filter = x > 0.01 ? `blur(${(x * 14).toFixed(1)}px)` : 'none';
		p.box.style.transform = `translate(${p.o.center ? '-50%' : '0'}, ${(-x * 50).toFixed(1)}px)`;
	}
}

/* ================================================================== SCENE 1 — flip calendar (beats 0–8) */
const S1 = (() => {
	const root = $('L1'), w = $('w1');
	deskSurface(w);
	el('div', '', w, { position: 'absolute', left: px(-520), top: px(420), width: px(1040), height: px(160), borderRadius: '50%',
		background: 'radial-gradient(closest-side, rgba(40,25,10,.45), rgba(40,25,10,0))', filter: 'blur(8px)' });
	const cal = el('div', 'p3d', w); cal.id = 'calRoot';
	el('div', 'cal-back', cal, { transform: 'translateZ(-12px)' });
	el('div', 'stack', cal, { transform: 'translateZ(-6px)' });
	const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
	const wds = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
	const [Y, Mo, D] = C.since.split('-').map(Number);
	const FL = [0, 1, 2, 3, 4, 4.5, 5, 5.5, 6, 6.25, 6.5]; // a page flips on every beat, then eighths, then sixteenths
	const first = D - FL.length;
	const pages = [];
	for (let i = 0; i <= FL.length + 1; i++) {
		const dt = new Date(Y, Mo - 1, first + i);
		const pg = el('div', 'page p3d', cal, { transform: `translateZ(${(FL.length + 2 - i) * 0.6}px)` });
		const f = el('div', 'face front', pg, { backgroundImage: `url(${TEX.paper}), linear-gradient(#ffffff, #f7f4ee 70%, #efeae1)` });
		const band = el('div', 'band', f); band.textContent = `${months[dt.getMonth()]} ${dt.getFullYear()}`;
		el('div', 'hole', f, { left: px(214) }); el('div', 'hole', f, { left: px(474) });
		el('div', 'day', f).textContent = dt.getDate();
		el('div', 'wd', f).textContent = wds[dt.getDay()];
		const cast = el('div', 'cast', f), shade = el('div', 'shade', f);
		const b = el('div', 'face back', pg, { backgroundImage: `url(${TEX.paper}), linear-gradient(#f1ede6, #e6e0d6)` });
		const bshade = el('div', 'shade', b);
		pages.push({ pg, cast, shade, bshade, f });
	}
	[214, 474].forEach((x) => el('div', 'ring', cal, { left: px(x + 2), transform: 'translateZ(14px)' }));
	// hand-drawn marker circle + note on the target page
	const tgt = pages[FL.length];
	const msvg = svgEl('svg', { width: 720, height: 816, viewBox: '0 0 720 816' }, tgt.f);
	Object.assign(msvg.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible' });
	let dpath = '';
	for (let i = 0; i <= 120; i++) {
		const th = -0.35 * Math.PI + (i / 120) * 2.45 * Math.PI;
		const r = 1 + 0.035 * Math.sin(3 * th + 1) + 0.025 * Math.sin(5 * th) + 0.05 * (i / 120);
		dpath += (i ? 'L' : 'M') + (360 + Math.cos(th) * 262 * r).toFixed(1) + ' ' + (408 + Math.sin(th) * 196 * r).toFixed(1);
	}
	const mk = svgEl('path', { d: dpath, fill: 'none', stroke: '#d7261c', 'stroke-width': 15, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.92 }, msvg);
	const mlen = mk.getTotalLength();
	mk.setAttribute('stroke-dasharray', `${mlen} ${mlen}`);
	const note = el('div', 'note', tgt.f, { left: px(80), top: px(708), width: px(560), textAlign: 'center', transform: 'rotate(-3deg)' });
	note.textContent = C.calendarNote;

	const cam = [
		[0, { x: -360, y: 30, s: 0.88 }],
		[7.0, { x: -300, y: 30, s: 0.98 }, E.ioS],
		[7.75, { x: -250, y: 22, s: 1.1 }, E.ioC],
		[8.0, { x: 0, y: 8, s: 2.5 }, E.inE],
		[8.75, { x: 0, y: 8, s: 5.2 }, E.inC],
	];
	FL.forEach((f, i) => cue(f, 'flip', i < 4 ? 1 : 0.8));
	cue(6.95, 'marker'); cue(7.2, 'pen', 0.6); cue(8, 'iris', 1, 7.6); cue(8, 'drop');

	function update(n) {
		const vis = n < 8.75; show(root, vis); if (!vis) return null;
		const c = camAt(n, cam);
		w.style.transform = camTf(c);
		const ry = K(n, [[0, 24], [7.0, 12], [7.75, 6], [8, 0]]), rx = K(n, [[0, 9], [8, 2]]);
		cal.style.transform = `perspective(2000px) rotateY(${ry}deg) rotateX(${rx}deg)`;
		pages.forEach((p, i) => {
			if (i >= FL.length) { p.cast.style.opacity = 0; return; }
			const f = FL[i], d = i < 4 ? 0.62 : i < 9 ? 0.44 : 0.3;
			const a = tw(n, f, f + d, 0, 250, E.ioC);
			show(p.pg, a < 249);
			p.pg.style.transform = `translateZ(${(FL.length + 2 - i) * 0.6}px) rotateX(${a}deg)`;
			p.shade.style.opacity = a < 90 ? Math.sin((a * Math.PI) / 180) * 0.55 : 0;
			p.bshade.style.opacity = a > 90 ? Math.max(0, Math.sin((a * Math.PI) / 180)) * 0.5 : 0;
			const nxt = pages[i + 1];
			if (n >= f - 0.01 && n < f + d) nxt.cast.style.opacity = a < 130 ? Math.sin((Math.min(a, 90) * Math.PI) / 180) * 0.85 * (1 - clamp((a - 90) / 40)) : 0;
			else if (n >= f + d) nxt.cast.style.opacity = 0;
		});
		mk.setAttribute('stroke-dashoffset', (mlen * (1 - tw(n, 6.95, 7.5, 0, 1, E.ioC))).toFixed(1));
		note.style.clipPath = `inset(-20px ${(100 - tw(n, 7.2, 7.8, 0, 100, E.lin)).toFixed(1)}% -20px 0)`;
		return { cam: c, lens: K(n, [[0, 0.12], [7.75, 0.25], [8, 1], [8.75, 1]]) };
	}
	return { update };
})();

/* ================================================================== SCENE 2 — polaroids on the table (beats 8–24) */
const S2 = (() => {
	const root = $('L2'), w = $('w2');
	deskSurface(w, '#e7dfd1');
	const P = [
		{ x: -430, y: -170, r: -5, land: 7.9 }, { x: 420, y: -210, r: 4, land: 10 },
		{ x: -400, y: 350, r: 3, land: 12 }, { x: 430, y: 330, r: -4, land: 14 },
	];
	P.forEach((p, i) => {
		const cfg = C.polaroids[i];
		p.el = el('div', 'pol', w);
		const ph = el('div', 'ph', p.el);
		media(ph, cfg.media, { pos: cfg.pos || '50% 40%', amt: 0.5 });
		el('div', 'gloss', p.el);
		el('div', '', p.el, { position: 'absolute', inset: 0, backgroundImage: `url(${TEX.paper})`, mixBlendMode: 'multiply', opacity: 0.6, pointerEvents: 'none' });
		p.cap = el('div', 'cap', p.el, { whiteSpace: 'nowrap' }); p.cap.textContent = cfg.caption;
		FIT.push(() => { const wd = p.cap.scrollWidth; if (wd > 472) p.cap.style.fontSize = px(Math.floor(47 * 472 / wd)); });
		if (i % 2 === 0) el('div', 'tape', p.el, { transform: `rotate(${i ? 3 : -4}deg)` });
		p.capT = p.land + 0.45;
		if (i > 0) cue(p.land, 'land');
		cue(p.capT, 'pen', 0.5);
	});
	const stamp = (pi, text, color, n0, rot) => {
		const s = el('div', 'stamp', P[pi].el, { color, left: px(60), top: px(170), transform: `rotate(${rot}deg)`,
			WebkitMaskImage: `url(${TEX.grunge})`, maskImage: `url(${TEX.grunge})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' });
		s.textContent = text;
		cue(n0, 'stamp');
		return { s, n0, rot };
	};
	const stamps = [stamp(C.stampYes, 'YES', '#1f9a52', L.yes, -13), stamp(C.stampNo, 'NO', '#d42a20', L.no, 11)];
	const gb = gobo(w, -1300, -900, 1.7, 0.42); // leaf-shadow light falling across the table

	const cam = [
		[8, { x: -430, y: -150, s: 1.32 }],
		[9.55, { x: -390, y: -160, s: 1.28 }, E.ioS],
		[10.05, { x: 330, y: -190, s: 1.2 }, E.ioQ],
		[11.55, { x: 300, y: -180, s: 1.17 }, E.ioS],
		[12.05, { x: -330, y: 300, s: 1.12 }, E.ioQ],
		[13.55, { x: -300, y: 290, s: 1.1 }, E.ioS],
		[14.05, { x: 360, y: 300, s: 1.05 }, E.ioQ],
		[14.9, { x: 340, y: 290, s: 1.03 }, E.ioS],
		[15.9, { x: 0, y: 80, s: 0.78 }, E.ioC],
		[16.25, { x: -40, y: 60, s: 0.8 }, E.ioS],
		[16.5, { x: -150, y: 0, s: 0.86 }, E.outE],
		[19.9, { x: 0, y: 90, s: 0.8 }, E.ioC],
		[20.25, { x: 40, y: 110, s: 0.81 }, E.ioS],
		[20.5, { x: 160, y: 170, s: 0.87 }, E.outE],
		[21.6, { x: 0, y: 70, s: 0.74 }, E.ioC],
		[23.5, { x: 20, y: 70, s: 0.72 }, E.ioS],
		[24.15, { x: 2300, y: 70, s: 0.72 }, E.inE],
	];
	cue(10.05, 'whoosh', 0.35, 9.6); cue(12.05, 'whoosh', 0.35, 11.6); cue(14.05, 'whoosh', 0.35, 13.6); cue(15.9, 'whoosh', 0.45, 14.95);
	cue(24, 'whoosh', 1, 23.5);

	function update(n) {
		const vis = n >= 8 && n < 24.2; show(root, vis); if (!vis) return null;
		root.style.clipPath = n < 8.75 ? `circle(${tw(n, 8, 8.7, 520, 1700, E.outE).toFixed(1)}px at 1080px 650px)` : 'none';
		const c = camAt(n, cam);
		let sx = 0, sy = 0;
		stamps.forEach((st, i) => { sx += shake(n, st.n0, 9, i); sy += shake(n, st.n0, 7, i + 2); });
		P.forEach((p, i) => { if (i) { sx += shake(n, p.land, 4, i * 3); sy += shake(n, p.land, 3, i); } });
		w.style.transform = camTf(c, sx, sy);
		gb.style.transform = `translate(${(30 * nz(n * BEAT * 0.4, 1)).toFixed(1)}px, ${(20 * nz(n * BEAT * 0.35, 4)).toFixed(1)}px) rotate(${(1.5 * nz(n * BEAT * 0.3, 7)).toFixed(2)}deg)`;
		P.forEach((p) => {
			const pr = clamp((n - (p.land - 0.85)) / 0.85);
			show(p.el, n >= p.land - 0.85);
			const h = (1 - pr) ** 1.5;
			const k = E.outC(pr);
			const bounce = n > p.land ? 0.018 * Math.exp(-(n - p.land) * BEAT / 0.08) * Math.sin((n - p.land) * BEAT * 40) : 0;
			const s = 1 + 0.55 * h - bounce;
			p.el.style.transform = `translate(${p.x - 260 + 380 * (1 - k)}px, ${p.y - 318 - 620 * (1 - k)}px) rotate(${p.r + 22 * (1 - k)}deg) scale(${s.toFixed(4)})`;
			p.el.style.boxShadow = `0 ${(2 + 60 * h).toFixed(1)}px ${(5 + 80 * h).toFixed(1)}px rgba(45,30,12,${(0.34 - 0.16 * h).toFixed(3)}), 0 ${(1 + 14 * h).toFixed(1)}px ${(2 + 20 * h).toFixed(1)}px rgba(45,30,12,.25)`;
			p.cap.style.clipPath = `inset(-20px ${(100 - tw(n, p.capT, p.capT + 1.1, 0, 100, E.lin)).toFixed(1)}% -20px 0)`;
		});
		stamps.forEach((st) => {
			const k = clamp((n - (st.n0 - 0.2)) / 0.2);
			show(st.s, n >= st.n0 - 0.2);
			const sc = n < st.n0 ? lerp(2.1, 1, E.inQ(k)) : 1 + 0.04 * Math.exp(-(n - st.n0) * BEAT / 0.05);
			st.s.style.transform = `rotate(${st.rot}deg) scale(${sc.toFixed(3)})`;
			st.s.style.opacity = n < st.n0 ? 0.25 * k : 0.86;
		});
		return { cam: c, lens: K(n, [[8, 0.7], [8.8, 0.14], [23.5, 0.14], [24.1, 0.5]]) };
	}
	return { update };
})();

/* ================================================================== phone (shared) */
function makePhone(parent, dark) {
	const root = el('div', 'phone p3d', parent);
	el('div', 'edge', root, { left: px(-2), transform: 'rotateY(-90deg)', transformOrigin: '0 50%' });
	el('div', 'edge', root, { left: px(428), transform: 'rotateY(90deg)', transformOrigin: '100% 50%' });
	const ti = el('div', 'ti', root);
	el('div', 'btn', root, { left: px(-5), top: px(170), height: px(34) });
	el('div', 'btn', root, { left: px(-5), top: px(232), height: px(66) });
	el('div', 'btn', root, { left: px(-5), top: px(310), height: px(66) });
	el('div', 'btn', root, { left: px(442), top: px(260), height: px(104) });
	el('div', 'bez', root);
	const scr = el('div', 'scr', root);
	el('div', 'island', scr);
	const sb = el('div', 'sb', scr, { color: dark ? '#fff' : '#000' });
	sb.innerHTML = `<span>9:41</span><span style="display:flex;gap:7px;align-items:center">
		<svg width="20" height="13" viewBox="0 0 20 13"><rect x="0" y="9" width="3.5" height="4" rx="1" fill="currentColor"/><rect x="5.5" y="6" width="3.5" height="7" rx="1" fill="currentColor"/><rect x="11" y="3" width="3.5" height="10" rx="1" fill="currentColor"/><rect x="16.5" y="0" width="3.5" height="13" rx="1" fill="currentColor"/></svg>
		<svg width="26" height="13" viewBox="0 0 26 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor"/><rect x="24" y="4.5" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".45"/></svg></span>`;
	const glare = el('div', 'glare', scr);
	return { root, scr, glare, ti };
}
function phoneLight(ph, ry, rx) {
	const a = 115 + ry * 2.2, o = 0.1 + Math.abs(ry) * 0.006;
	ph.glare.style.background = `linear-gradient(${a}deg, rgba(255,255,255,${o.toFixed(3)}) 0%, rgba(255,255,255,${(o * 0.35).toFixed(3)}) 24%, rgba(255,255,255,0) 42%)`;
	ph.ti.style.filter = `brightness(${(1 + ry * 0.008 - rx * 0.004).toFixed(3)})`;
}
function bokeh(world, cols) {
	const out = [];
	for (let i = 0; i < 14; i++) {
		const r = 60 + rnd() * 180;
		const b = el('div', '', world, { position: 'absolute', left: px((rnd() - 0.5) * 3600 - r), top: px((rnd() - 0.5) * 2000 - r), width: px(2 * r), height: px(2 * r),
			borderRadius: '50%', background: cols[i % cols.length], filter: `blur(${18 + rnd() * 26}px)`, opacity: 0.35 + rnd() * 0.4 });
		out.push({ b, sd: rnd() * 50, z: 0.3 + rnd() * 0.7 });
	}
	return out;
}
function updBokeh(list, n, c) {
	list.forEach((k) => { k.b.style.transform = `translate(${(c.x * (1 - k.z) + 40 * nz(n * BEAT * 0.3, k.sd)).toFixed(1)}px, ${(c.y * (1 - k.z) + 30 * nz(n * BEAT * 0.25, k.sd + 5)).toFixed(1)}px)`; });
}

/* ================================================================== SCENE 3 — maps: "don't move… go" (beats 24–40) */
const S3 = (() => {
	const root = $('L3'), w = $('w3');
	el('div', 'desk', w, { background: 'radial-gradient(circle at 50% 45%, #f4efe7, #e4dccf 60%, #d9cfbf)' });
	const bk = bokeh(w, ['#ffcf9e', '#ffb3c1', '#bcd4ff', '#fff1c9']);
	el('div', '', w, { position: 'absolute', left: px(-300), top: px(400), width: px(600), height: px(140), borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(40,25,10,.4), rgba(40,25,10,0))', filter: 'blur(14px)' });
	const ph = makePhone(w, false);
	ph.root.style.left = px(-222); ph.root.style.top = px(-452);
	const scr = ph.scr;
	// ---- map
	const mc = el('div', 'mapcam', scr);
	const MAPW = 1700, MAPH = 2100;
	const plane = el('div', 'mapplane', mc, { width: px(MAPW), height: px(MAPH) });
	const svg = svgEl('svg', { width: MAPW, height: MAPH, viewBox: `0 0 ${MAPW} ${MAPH}` }, plane);
	Object.assign(svg.style, { position: 'absolute', left: 0, top: 0 });
	svgEl('rect', { x: 0, y: 0, width: MAPW, height: MAPH, fill: '#f1ece2' }, svg);
	for (let i = 0; i < 520; i++) svgEl('rect', { x: rnd() * MAPW, y: rnd() * MAPH, width: 40 + rnd() * 60, height: 30 + rnd() * 50, rx: 6, fill: rnd() < 0.5 ? '#e8e2d6' : '#ebe5da' }, svg);
	[[1180, 1620, 210, 150], [280, 760, 170, 230], [1420, 760, 160, 120], [650, 300, 140, 110]].forEach(([x, y, rx, ry]) => svgEl('ellipse', { cx: x, cy: y, rx, ry, fill: '#cfe6c1' }, svg));
	svgEl('path', { d: 'M-50 1950 C 400 1880, 600 1500, 1000 1450 S 1500 1180, 1800 1100', fill: 'none', stroke: '#acd3f1', 'stroke-width': 110, 'stroke-linecap': 'round' }, svg);
	const road = (d, wd, fill, cas) => { svgEl('path', { d, fill: 'none', stroke: cas, 'stroke-width': wd + 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg); svgEl('path', { d, fill: 'none', stroke: fill, 'stroke-width': wd, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg); };
	for (let i = 0; i < 14; i++) { const y = rnd() * MAPH; road(`M0 ${y} Q ${MAPW / 2} ${y + (rnd() - 0.5) * 300} ${MAPW} ${y + (rnd() - 0.5) * 200}`, 10, '#ffffff', '#e0dacd'); }
	for (let i = 0; i < 10; i++) { const x = rnd() * MAPW; road(`M${x} 0 Q ${x + (rnd() - 0.5) * 300} ${MAPH / 2} ${x + (rnd() - 0.5) * 200} ${MAPH}`, 10, '#ffffff', '#e0dacd'); }
	road('M-20 980 L 1720 280', 26, '#ffe08a', '#e9c463');
	[420, 760, 1260].forEach((x) => road(`M${x} -20 L ${x} ${MAPH + 20}`, 22, '#ffffff', '#d8d1c3'));
	[420, 1080, 1400].forEach((y) => road(`M-20 ${y} L ${MAPW + 20} ${y}`, 22, '#ffffff', '#d8d1c3'));
	[['Rose Ave', 440, 980, 0], ['Lake Rd', 980, 1392, 0], ['Hilltop Park', 1100, 1630, 0], ['Old Tree Ln', 772, 600, 90]].forEach(([t, x, y, r]) => {
		const tx = svgEl('text', { x, y, 'font-family': 'Inter', 'font-size': 22, 'font-weight': 600, fill: '#9a948a', transform: `rotate(${r} ${x} ${y})` }, svg); tx.textContent = t; });
	const R = [[420, 1700], [420, 1400], [760, 1400], [760, 1080], [1260, 1080], [1260, 430]];
	const rd = 'M' + R.map((p) => p.join(' ')).join(' L ');
	const rcas = svgEl('path', { d: rd, fill: 'none', stroke: '#ffffff', 'stroke-width': 30, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.95 }, svg);
	const route = svgEl('path', { d: rd, fill: 'none', stroke: '#0a84ff', 'stroke-width': 20, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
	const rlen = route.getTotalLength();
	[route, rcas].forEach((p) => p.setAttribute('stroke-dasharray', `${rlen} ${rlen}`));
	const ptAt = (u) => { const p = route.getPointAtLength(clamp(u) * rlen); return [p.x, p.y]; };
	const headAt = (u) => { // smoothed heading (deg) looking ahead along the route
		let hx = 0, hy = 0;
		for (let k = 0; k < 8; k++) { const a = ptAt(u + k * 0.012), b = ptAt(u + k * 0.012 + 0.01); hx += b[0] - a[0]; hy += b[1] - a[1]; }
		return (Math.atan2(hy, hx) * 180) / Math.PI;
	};
	// pins (billboards inside the plane)
	const me = el('div', 'mpin', plane, { left: px(R[0][0]), top: px(R[0][1]) });
	const meIn = el('div', '', me, { position: 'absolute', left: '-36px', top: '-36px', width: '72px', height: '72px', borderRadius: '50%', border: '5px solid #fff',
		boxShadow: '0 6px 14px rgba(0,0,0,.3)', overflow: 'hidden', background: '#ffcc00' });
	avatar(meIn);
	const meLbl = el('div', 'mlabel', me, { left: '-24px', top: '42px' }); meLbl.textContent = 'You';
	const puck = el('div', '', me, { position: 'absolute', left: '-34px', top: '-34px', width: '68px', height: '68px', borderRadius: '50%', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,.3)' });
	puck.innerHTML = '<svg width="68" height="68" viewBox="0 0 68 68"><circle cx="34" cy="34" r="26" fill="#0a84ff"/><path d="M34 18 L45 46 L34 40 L23 46 Z" fill="#fff"/></svg>';
	const her = el('div', 'mpin', plane, { left: px(R[R.length - 1][0]), top: px(R[R.length - 1][1]) });
	const herPulse = el('div', '', her, { position: 'absolute', left: '-60px', top: '-60px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,55,95,.25)' });
	const herIn = el('div', '', her, { position: 'absolute', left: '-44px', top: '-44px', width: '88px', height: '88px', borderRadius: '50%', border: '5px solid #fff', boxShadow: '0 8px 18px rgba(0,0,0,.3)', overflow: 'hidden' });
	media(herIn, C.herPin, { pos: '50% 30%', kb: false });
	const herBadge = el('div', '', her, { position: 'absolute', left: '22px', top: '-50px', width: '34px', height: '34px', borderRadius: '50%', background: '#ff375f', border: '3px solid #fff', boxShadow: '0 3px 8px rgba(0,0,0,.25)' });
	herBadge.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M14 22s-7-4.4-7-9.2A3.9 3.9 0 0 1 14 10.6a3.9 3.9 0 0 1 7 2.2C21 17.6 14 22 14 22z" fill="#fff"/></svg>';
	const herLbl = el('div', 'mlabel', her, { left: '-46px', top: '50px' }); herLbl.textContent = C.her;
	const arrive = el('div', '', root, { position: 'absolute', left: px(1080 - 330), top: px(660 - 330), width: '660px', height: '660px', borderRadius: '50%', overflow: 'hidden',
		border: '18px solid #fff', boxShadow: '0 30px 80px rgba(0,0,0,.35)', zIndex: 5 });
	media(arrive, C.herPin, { pos: '50% 30%', kb: false });
	// UI chrome
	const search = el('div', 'search glass', scr);
	search.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="#8a8a8f" stroke-width="2.2"/><path d="M13 13l5 5" stroke="#8a8a8f" stroke-width="2.4" stroke-linecap="round"/></svg>Search Maps';
	const sheet = el('div', 'sheet glass', scr);
	sheet.innerHTML = `<div class="grab"></div><div class="t1">${C.her}<svg width="26" height="26" viewBox="0 0 28 28"><path d="M14 23s-8-5-8-10.5A4.4 4.4 0 0 1 14 10a4.4 4.4 0 0 1 8 2.5C22 18 14 23 14 23z" fill="#ff375f"/></svg></div>
		<div class="t2">${C.maps.subtitle}</div><div class="chips"><span class="chip">Rating 5.0</span><span class="chip">${C.maps.eta}</span><span class="chip">Saved</span></div>`;
	const go = el('div', 'gobtn', sheet);
	go.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30"><path d="M6 17l2-6c.4-1.2 1.5-2 2.8-2h8.4c1.3 0 2.4.8 2.8 2l2 6v6h-3v-2H9v2H6z" fill="#fff"/><circle cx="10" cy="18" r="1.6" fill="#28b350"/><circle cx="20" cy="18" r="1.6" fill="#28b350"/></svg>${C.maps.go}`;
	const ripple = el('div', '', go, { position: 'absolute', left: '50%', top: '50%', width: '40px', height: '40px', margin: '-20px 0 0 -20px', borderRadius: '50%', background: 'rgba(255,255,255,.55)' });
	const touch = el('div', 'touch', scr, { left: '200px', top: px(860 - 34 - 33) });
	const banner = el('div', '', scr, { position: 'absolute', left: '12px', right: '12px', top: '58px', height: '96px', borderRadius: '22px', background: 'rgba(28,115,62,.94)', zIndex: 35,
		color: '#fff', display: 'flex', alignItems: 'center', gap: '14px', padding: '0 18px', boxShadow: '0 8px 20px rgba(0,0,0,.2)' });
	banner.innerHTML = `<svg width="44" height="44" viewBox="0 0 44 44"><path d="M22 6l10 14h-6v18h-8V20h-6z" fill="#fff"/></svg><div><div style="font:700 27px Inter">0 km</div><div style="font:600 18px Inter;opacity:.85">Straight to ${C.her}</div></div>`;
	// her texts beside the phone
	const bubbles = [];
	const bubble = (text, n0, y) => {
		const g = el('div', '', w, { position: 'absolute', left: px(-1180), top: px(y), display: 'flex', alignItems: 'flex-end', gap: '14px' });
		const a = el('div', '', g, { width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flex: 'none', boxShadow: '0 4px 10px rgba(0,0,0,.15)' });
		media(a, C.herPin, { pos: '50% 30%', kb: false });
		const b = el('div', '', g, { position: 'relative', background: '#e9e9eb', color: '#111', font: '500 46px Inter', padding: '20px 32px', borderRadius: '40px', whiteSpace: 'nowrap', transformOrigin: '0 100%',
			boxShadow: '0 1px 0 rgba(255,255,255,.8) inset, 0 10px 24px rgba(40,25,10,.12)' });
		const tx = el('span', '', b); tx.textContent = text;
		const dots = el('span', '', b, { position: 'absolute', left: '32px', top: '20px', display: 'flex', gap: '10px', alignItems: 'center', height: '56px' });
		const dd = [0, 1, 2].map(() => el('i', '', dots, { width: '14px', height: '14px', borderRadius: '50%', background: '#9b9ba1', display: 'block' }));
		bubbles.push({ g, b, tx, dots, dd, n0 });
		cue(n0, 'msg');
	};
	bubble("don't move 😤", L.dont, -260);
	bubble('…okay, go 🙄', L.tell, -60);

	cue(26.5, 'pin'); cue(29.2, 'sheet'); cue(33, 'route', 1, 33); cue(L.go, 'button'); cue(40, 'iris', 1, 39.2); cue(37.2, 'whoosh', 0.6, 36.7);
	const camK = [
		[23.55, { x: -2400, y: 0, s: 1.08 }],
		[24.35, { x: -400, y: 0, s: 1.08 }, E.outE],
		[29.0, { x: -380, y: 0, s: 1.1 }, E.ioS],
		[36.0, { x: -350, y: 10, s: 1.13 }, E.ioS],
		[36.75, { x: -60, y: 60, s: 1.25 }, E.ioC],
		[38.6, { x: 0, y: 130, s: 4.9 }, E.ioE],
		[39.6, { x: 0, y: 130, s: 6.2 }, E.lin],
		[40.6, { x: 0, y: 130, s: 16 }, E.inC],
	];

	function update(n) {
		const vis = n >= 23.55 && n < 40.6; show(root, vis); if (!vis) return null;
		const c = camAt(n, camK);
		w.style.transform = camTf(c);
		updBokeh(bk, n, c);
		const idle = clamp((36.5 - n) / 1);
		const ry = K(n, [[23.55, -38], [24.6, -16, E.outC], [32, -9, E.ioS], [36.4, -4], [37.3, 0, E.ioC]]) + 1.5 * nz(n * BEAT * 0.6, 2) * idle;
		const rx = K(n, [[23.55, 10], [24.6, 6], [36.4, 3], [37.3, 0]]) + 1.0 * nz(n * BEAT * 0.5, 6) * idle;
		ph.root.style.transform = `perspective(2400px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) translateY(${(8 * nz(n * BEAT * 0.7, 1) * idle).toFixed(1)}px)`;
		phoneLight(ph, ry, rx);
		// map camera: near you -> overview -> navigation
		const u = tw(n, 37.0, 39.7, 0, 1, E.ioS);
		const navK = tw(n, 36.7, 37.6, 0, 1, E.ioC);
		const ov = [840, 1065], meP = R[0];
		let fx = K(n, [[24, meP[0]], [29.2, meP[0]], [30.8, ov[0], E.ioC]]), fy = K(n, [[24, meP[1] - 120], [29.2, meP[1] - 120], [30.8, ov[1], E.ioC]]);
		let z = K(n, [[24, 0.8], [29.2, 0.82], [30.8, 0.28, E.ioC], [36.7, 0.285]]);
		const pt = ptAt(u);
		fx = lerp(fx, pt[0], navK); fy = lerp(fy, pt[1], navK);
		z = lerp(z, K(n, [[37, 0.9], [40, 1.35]]), navK);
		const tilt = 58 * navK, rot = navK > 0 ? -(headAt(u) + 90) * navK : 0;
		const sy = lerp(340, 560, navK);
		const ovK = tw(n, 29.2, 30.8, 0, 1) * (1 - navK), pinS = 1 - 0.28 * ovK;
		plane.style.transform = `translate(200px,${sy}px) rotateX(${tilt.toFixed(2)}deg) rotate(${rot.toFixed(2)}deg) scale(${z.toFixed(4)}) translate(${-fx}px,${-fy}px)`;
		const bb = `rotate(${(-rot).toFixed(2)}deg) rotateX(${(-tilt).toFixed(2)}deg) scale(${(1 / z).toFixed(4)})`;
		// you: shaking "no" while she says don't move
		const wob = n > 28.75 && n < 33 ? 11 * Math.sin((n - 28.75) * Math.PI * 2) * clamp((33 - n) / 0.5) * clamp((n - 28.75) / 0.3) : 0;
		me.style.left = px(lerp(meP[0], pt[0], navK)); me.style.top = px(lerp(meP[1], pt[1], navK));
		me.style.transform = navK > 0.5 ? `rotate(${(headAt(u) + 90).toFixed(2)}deg) scale(${(1 / z).toFixed(4)})` : `${bb} scale(${pinS.toFixed(3)}) rotate(${wob.toFixed(2)}deg)`;
		meIn.style.opacity = meLbl.style.opacity = 1 - clamp(navK * 2);
		puck.style.opacity = clamp(navK * 2 - 1);
		const herIn0 = clamp(sp(n, 26.5, 0.4, 16), 0, 1.4);
		her.style.transform = `${bb} scale(${(herIn0 * pinS).toFixed(3)})`;
		// arriving: her photo swells out of the pin and fills the frame
		const ar = tw(n, 39.3, 39.95, 0, 1, E.inC);
		show(arrive, n >= 39.3);
		arrive.style.transform = `scale(${lerp(0.25, 3.2, ar).toFixed(4)})`;
		arrive.style.opacity = clamp((n - 39.3) / 0.12);
		herLbl.style.opacity = herBadge.style.opacity = 1 - tw(n, 39.2, 39.6, 0, 1);
		me.style.zIndex = 1; her.style.zIndex = 2;
		const pul = ((n - 26.5) % 1 + 1) % 1;
		herPulse.style.transform = `scale(${(0.6 + pul * 1.2).toFixed(3)})`; herPulse.style.opacity = (n > 26.5 ? (1 - pul) * 0.9 : 0).toFixed(3);
		// route draws on "but you tell me to go"
		const rk = tw(n, 33.0, 35.6, 0, 1, E.ioC);
		route.setAttribute('stroke-dashoffset', (rlen * (1 - rk)).toFixed(1)); rcas.setAttribute('stroke-dashoffset', (rlen * (1 - rk)).toFixed(1));
		// sheet, go button, touch, nav banner
		const shk = clamp(sp(n, 29.2, 0.6, 14), 0, 1.1) - tw(n, 36.75, 37.25, 0, 1.2, E.inC);
		sheet.style.transform = `translateY(${((1 - shk) * 320).toFixed(1)}px)`;
		search.style.opacity = 1 - navK;
		const press = n >= L.go - 0.05 ? Math.exp(-(n - (L.go - 0.05)) * BEAT / 0.09) : 0;
		go.style.transform = `scale(${(1 - 0.06 * press).toFixed(4)})`;
		go.style.filter = `brightness(${(1 - 0.12 * press).toFixed(3)})`;
		const rp = clamp((n - L.go) / 0.9);
		ripple.style.transform = `scale(${(rp * 9).toFixed(3)})`; ripple.style.opacity = n >= L.go ? (1 - rp) * 0.7 : 0;
		touch.style.opacity = K(n, [[L.go - 0.6, 0], [L.go - 0.35, 1], [L.go + 0.3, 1], [L.go + 0.6, 0]]);
		touch.style.transform = `scale(${(n < L.go ? 1 : 0.82 + 0.18 * clamp((n - L.go) / 0.3)).toFixed(3)})`;
		banner.style.transform = `translateY(${(-140 * (1 - clamp(sp(n, 36.9, 0.6, 14), 0, 1.1))).toFixed(1)}px)`;
		// texts
		bubbles.forEach((b) => {
			const t0 = b.n0 - 1.0;
			show(b.g, n >= t0);
			const typing = n < b.n0;
			const s = clamp(sp(n, t0, 0.5, 18), 0, 1.2);
			const s2 = n >= b.n0 ? 0.92 + 0.08 * clamp(sp(n, b.n0, 0.45, 20), 0, 1.3) : 1;
			b.b.style.transform = `scale(${(s * s2).toFixed(3)})`;
			b.tx.style.visibility = typing ? 'hidden' : 'visible';
			b.dots.style.display = typing ? 'flex' : 'none';
			b.dd.forEach((d, i) => { d.style.transform = `translateY(${(-8 * Math.max(0, Math.sin((n * 2 - i * 0.3) * Math.PI))).toFixed(1)}px)`; });
			b.g.style.opacity = 1 - tw(n, 36.6, 37.1, 0, 1);
		});
		return { cam: c, lens: K(n, [[23.55, 0.5], [24.4, 0.1], [36.75, 0.1], [38.6, 0.55], [40.6, 0.8]]) };
	}
	return { update };
})();

/* ================================================================== SCENE 4 — wall of her + "running out of time" (beats 40–56) */
const S4 = (() => {
	const root = $('L4'), w = $('w4');
	el('div', 'desk', w, { background: '#f5f2ec' });
	const W = 400, H = 260;
	const blurBox = el('div', '', w, { position: 'absolute', left: 0, top: 0 });
	const lines = [];
	for (let c = -6; c <= 6; c++) lines.push({ e: el('div', 'gl', blurBox, { left: px((c + 0.5) * W - 1), top: px(-5 * H), width: '2px', height: px(10 * H) }), v: 1, t: 40 + rnd() * 2.5, o: rnd() });
	for (let r = -4; r <= 4; r++) lines.push({ e: el('div', 'gl', blurBox, { left: px(-7 * W), top: px((r + 0.5) * H - 1), width: px(14 * W), height: '2px' }), v: 0, t: 40 + rnd() * 2.5, o: rnd() });
	const tiles = [];
	let k = 0;
	for (let r = -3; r <= 3; r++) for (let c = -5; c <= 5; c++) {
		if ((c * 7 + r * 13 + 50) % 5 === 0 && !(c === 0 && r === 0)) continue; // a few gaps
		if (Math.abs(c) + Math.abs(r) > 7) continue;
		const t = c === 0 && r === 0 ? 39.8 : 40.25 + 0.25 * Math.round(Math.hypot(c * 1.2, r * 1.6));
		const e = el('div', 'tile', blurBox, { left: px(c * W - W / 2 + 3), top: px(r * H - H / 2 + 3), width: px(W - 6), height: px(H - 6) });
		const f = el('div', 'f', e), b = el('div', 'f b', e);
		media(f, c === 0 && r === 0 ? C.herPin : C.wall[k % C.wall.length], { pos: '50% 30%', t0: t * BEAT });
		media(b, C.wall[(k + 9) % C.wall.length], { pos: '50% 30%', t0: t * BEAT });
		[f, b].forEach((x) => { el('div', 'rec', x).innerHTML = '<i></i>Rec'; el('div', 'lights', x).innerHTML = '<i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>'; });
		const fl = 44.5 + 0.5 * Math.floor((c + r + 8) / 2.5);
		tiles.push({ e, t, fl: fl < 48 ? fl : null });
		k++;
	}
	[40.5, 41, 41.5, 42].forEach((t) => cue(t, 'tick', 0.5));
	[44.5, 45, 45.5, 46, 46.5, 47].forEach((t) => cue(t, 'flick', 0.6));
	// stopwatch (screen space, in front)
	const swWrap = el('div', '', root, { position: 'absolute', left: px(1300 + OFF), top: px(600 + OFF), width: 0, height: 0 });
	const sw = el('div', 'sw', swWrap);
	el('div', 'stem', sw); const crown = el('div', 'crown', sw);
	el('div', 'ring', sw); el('div', 'dial', sw);
	const ticks = svgEl('svg', { width: 636, height: 636, viewBox: '-318 -318 636 636' }, sw);
	Object.assign(ticks.style, { position: 'absolute', left: '-318px', top: '-318px' });
	for (let i = 0; i < 60; i++) {
		const a = (i / 60) * Math.PI * 2, tl = i % 5 === 0 ? 30 : 14, r0 = 290;
		svgEl('line', { x1: Math.sin(a) * r0, y1: -Math.cos(a) * r0, x2: Math.sin(a) * (r0 - tl), y2: -Math.cos(a) * (r0 - tl), stroke: i % 5 === 0 ? '#222' : '#777', 'stroke-width': i % 5 === 0 ? 5 : 2.2, 'stroke-linecap': 'round' }, ticks);
		if (i % 5 === 0) { const t = svgEl('text', { x: Math.sin(a) * 222, y: -Math.cos(a) * 222 + 11, 'text-anchor': 'middle', 'font-family': 'Inter', 'font-size': 30, 'font-weight': 600, fill: '#2a2a2a' }, ticks); t.textContent = i === 0 ? 60 : i; }
	}
	el('div', 'lbl', sw, { top: '-140px', font: '700 22px Inter', letterSpacing: '8px', color: '#8e8e93' }).textContent = 'DAYS OF US';
	const cnt = el('div', 'lbl', sw, { top: '-104px', font: '800 128px/1 Inter', color: '#1b1a19', letterSpacing: '-4px', fontVariantNumeric: 'tabular-nums' });
	const [Y, Mo, D] = C.since.split('-');
	el('div', 'lbl', sw, { top: '62px', font: '700 50px Caveat', color: '#d7261c' }).textContent = `since ${D}.${Mo}.${Y}`;
	const hand = el('div', 'hand', sw); el('div', 'cap', sw); el('div', 'glassd', sw);
	const days = Math.round((new Date(C.asOf) - new Date(C.since)) / 86400000);
	cue(49.75, 'whoosh', 0.5, 49.0); cue(50.25, 'land', 1.2); cue(50.25, 'count', 1, 53.5); cue(55, 'click'); cue(56, 'whoosh', 1, 55.3);

	const camK = [
		[39.8, { x: 0, y: 0, s: 1.25 }],
		[44, { x: 60, y: -30, s: 0.92 }, E.ioS],
		[49.5, { x: 140, y: -50, s: 0.8 }, E.ioS],
		[55.3, { x: 180, y: -60, s: 0.86 }, E.ioS],
		[56.05, { x: 2600, y: -60, s: 0.86 }, E.inE],
	];
	function update(n) {
		const vis = n >= 39.8 && n < 56.05; show(root, vis); if (!vis) return null;
		root.style.clipPath = n < 40.7 ? `circle(${tw(n, 39.8, 40.7, 60, 1700, E.outE).toFixed(1)}px at 1080px 660px)` : 'none';
		const c = camAt(n, camK);
		w.style.transform = camTf(c);
		blurBox.style.filter = n > 49.3 ? `blur(${tw(n, 49.3, 50.3, 0, 9).toFixed(1)}px) brightness(${tw(n, 49.3, 50.3, 1, 0.93).toFixed(3)})` : 'none';
		lines.forEach((l) => {
			const kk = tw(n, l.t, l.t + 1.6, 0, 1, E.outC);
			l.e.style.transformOrigin = l.v ? `50% ${l.o * 100}%` : `${l.o * 100}% 50%`;
			l.e.style.transform = l.v ? `scaleY(${kk})` : `scaleX(${kk})`;
		});
		tiles.forEach((t) => {
			show(t.e, n >= t.t);
			const kk = clamp((n - t.t) / 0.4);
			const fa = t.fl ? tw(n, t.fl, t.fl + 0.6, 0, 180, E.ioC) : 0;
			t.e.style.transform = `perspective(1400px) scale(${lerp(0.7, 1, E.outB(kk)).toFixed(4)}) rotateY(${fa.toFixed(2)}deg)`;
			t.e.style.opacity = clamp(kk * 2.5);
		});
		// stopwatch
		const inK = clamp(sp(n, 49.75, 0.42, 13), 0, 1.3);
		show(swWrap, n >= 49.4);
		const out = tw(n, 55.3, 56.05, 0, 1, E.inE);
		swWrap.style.transform = `translate(${(-2400 * out).toFixed(1)}px, ${((1 - Math.min(inK, 1)) * -1000).toFixed(1)}px) scale(${(0.82 * (1.25 - 0.25 * Math.min(inK, 1))).toFixed(4)}) rotate(${((1 - Math.min(inK, 1)) * 12).toFixed(2)}deg)`;
		cnt.textContent = Math.round(days * tw(n, L.time, 53.6, 0, 1, E.outC));
		hand.style.transform = `rotate(${(1440 * E.ioC(clamp((n - 50.0) / 4.4))).toFixed(2)}deg)`;
		const cp = n >= 55 ? Math.exp(-(n - 55) * BEAT / 0.08) : 0;
		crown.style.transform = `translateY(${(14 * cp).toFixed(1)}px)`;
		return { cam: { x: c.x + (2400 * out) / 0.86, y: c.y, s: c.s }, lens: K(n, [[39.8, 0.8], [40.7, 0.18], [55.3, 0.18], [56, 0.5]]) };
	}
	return { update };
})();

/* ================================================================== SCENE 5 — "most visited place: y●u" (beats 56–64) */
const S5 = (() => {
	const root = $('L5'), w = $('w5');
	el('div', 'desk', w, { background: 'radial-gradient(circle at 50% 50%, #1d1d24, #0c0c0f 70%)' });
	for (let c = -6; c <= 6; c++) el('div', 'gl', w, { left: px(c * 300), top: px(-1400), width: '1px', height: px(2800), background: 'rgba(255,255,255,.05)' });
	for (let r = -5; r <= 5; r++) el('div', 'gl', w, { left: px(-2000), top: px(r * 300), width: px(4000), height: '1px', background: 'rgba(255,255,255,.05)' });
	const stripe = el('div', '', w, { position: 'absolute', left: px(-2200), top: px(-70), width: px(4400), height: px(220), background: 'linear-gradient(#5aa4ff, #3f8ff5)', transformOrigin: '0 50%',
		boxShadow: '0 20px 60px rgba(30,110,255,.35)' });
	const kick = el('div', 'kick', w, { fontSize: '62px' }); kick.textContent = C.title.kicker;
	const word = C.title.word, pi = C.title.pinLetter;
	const pre = el('div', 'tword', w), post = el('div', 'tword', w);
	pre.textContent = word.slice(0, pi); post.textContent = word.slice(pi + 1);
	const PD = 236;
	const pin = el('div', 'pin', w);
	el('div', 'disc', pin, { left: px(-PD / 2), top: px(-PD / 2), width: px(PD), height: px(PD) });
	el('div', 'core', pin, { left: px(-PD / 2 + 24), top: px(-PD / 2 + 24), width: px(PD - 48), height: px(PD - 48) });
	const arr = svgEl('svg', { width: 70, height: 86, viewBox: '0 0 8 10' }, pin);
	Object.assign(arr.style, { left: px(PD / 2 + 10), top: px(-43) });
	arr.innerHTML = '<path d="M1 1 L7 5 L1 9 Z" fill="#fff" stroke="#0b63f0" stroke-width="1.4" stroke-linejoin="round"/>';
	let Lay = null;
	function layout() {
		const gap = 10, wa = pre.offsetWidth, wb = post.offsetWidth, total = wa + gap + PD + gap + wb, x0 = -total / 2, fh = pre.offsetHeight, y = 40;
		Object.assign(pre.style, { left: px(x0), top: px(y - fh * 0.56) });
		Object.assign(post.style, { left: px(x0 + wa + gap + PD + gap), top: px(y - fh * 0.56) });
		Object.assign(kick.style, { left: px(x0 + 10), top: px(y - fh * 0.56 - 96) });
		pin.style.left = px(x0 + wa + gap + PD / 2); pin.style.top = px(y);
		Lay = { px: x0 + wa + gap + PD / 2, py: y };
	}
	cue(56, 'hit'); cue(56.2, 'swish', 0.6); cue(64, 'iris', 1, 62.9);
	function update(n) {
		const vis = n >= 56 && n < 64.45; show(root, vis); if (!vis) return null;
		if (!Lay) layout();
		const c = camAt(n, [
			[56, { x: 0, y: 0, s: 1.18 }],
			[56.6, { x: 0, y: 0, s: 1.0 }, E.outE],
			[62.75, { x: Lay.px * 0.4, y: 10, s: 1.12 }, E.ioS],
			[64.0, { x: Lay.px, y: Lay.py, s: 11 }, E.ioE],
			[64.45, { x: Lay.px, y: Lay.py, s: 16 }],
		]);
		w.style.transform = camTf(c, shake(n, 56, 14, 1), shake(n, 56, 10, 3));
		stripe.style.transform = `scaleX(${tw(n, 56.05, 56.5, 0, 1, E.outQ).toFixed(4)})`;
		[pre, post].forEach((e, i) => {
			const a = 55.95 + i * 0.06, kk = clamp((n - a) / 0.35);
			e.style.opacity = clamp(kk * 3);
			e.style.transform = `scale(${lerp(1.45, 1, E.outE(kk)).toFixed(4)})`;
			e.style.filter = kk < 1 ? `blur(${((1 - E.outE(kk)) * 14).toFixed(1)}px)` : 'none';
		});
		kick.style.opacity = tw(n, 56.25, 56.6, 0, 1);
		kick.style.transform = `skewX(-10deg) translateX(${tw(n, 56.25, 56.9, -40, 0, E.outQ).toFixed(1)}px)`;
		const pk = clamp(sp(n, 56.1, 0.38, 16), 0, 1.4);
		const fr = n - Math.floor(n), bp = n > 57 ? 0.06 * Math.exp(-fr * BEAT / 0.1) : 0;
		pin.style.transform = `scale(${(pk * (1 + bp)).toFixed(4)})`;
		return { cam: c, lens: K(n, [[56, 0.6], [56.6, 0.35], [62.75, 0.4], [64, 0.9]]) };
	}
	return { update };
})();

/* ================================================================== SCENE 6 — the post: "made up my mind" (beats 64–78) */
const S6 = (() => {
	const root = $('L6'), w = $('w6');
	el('div', 'desk', w, { background: 'radial-gradient(circle at 50% 40%, #2a1b2e, #140d18 60%, #0a070c)' });
	const bk = bokeh(w, ['#ff5c8a', '#ff9a6b', '#b46bff', '#ff3d6e']);
	const ph = makePhone(w, true);
	ph.root.style.left = px(-222); ph.root.style.top = px(-452);
	const post = el('div', 'post', ph.scr);
	const hd = el('div', 'hd', post);
	const r2 = el('div', 'ring2', hd); avatar(el('div', '', r2));
	const nm = el('div', '', hd, { display: 'flex', flexDirection: 'column', gap: '2px' });
	nm.innerHTML = `<div style="display:flex;align-items:center;gap:6px">${C.handle}<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.5-.7 2.9 1.2 2.7-2.2 2 .1 3-2.9.6-1.6 2.6-2.8-1.1-2.8 1.1-1.6-2.6-2.9-.6.1-3-2.2-2 1.2-2.7-.7-2.9 2.6-1.5 1-2.8 3 .2z" fill="#0a84ff"/><path d="M7.5 12.2l3 3 6-6.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span style="color:#8e8e93;font-weight:500">•</span><span style="color:#0a84ff">Follow</span></div><div style="font:500 14px Inter;color:#cfcfd4">♫ What Do You Mean?</div>`;
	const im = el('div', 'img', post);
	media(im, C.post.image, { pos: '50% 42%', amt: 0.4 });
	const big = el('div', 'bigheart', post);
	big.innerHTML = '<svg width="200" height="200" viewBox="-100 -100 200 200" style="position:absolute;left:-100px;top:-100px;overflow:visible"><path d="M0 70 C -40 40 -88 12 -88 -26 A 44 44 0 0 1 0 -44 A 44 44 0 0 1 88 -26 C 88 12 40 40 0 70 Z" fill="#fff" style="filter:drop-shadow(0 8px 24px rgba(0,0,0,.35))"/></svg>';
	const sparks = [];
	for (let i = 0; i < 10; i++) {
		const s = el('div', '', big, { position: 'absolute', left: '-12px', top: '-12px', width: '24px', height: '24px' });
		s.innerHTML = '<svg width="24" height="24" viewBox="-12 -12 24 24"><path d="M0 9 C -5 5 -11 2 -11 -3 A 5.5 5.5 0 0 1 0 -5.5 A 5.5 5.5 0 0 1 11 -3 C 11 2 5 5 0 9 Z" fill="#ff3d6e"/></svg>';
		sparks.push({ s, a: (i / 10) * Math.PI * 2 + rnd() * 0.4, d: 150 + rnd() * 90, r: rnd() * 60 - 30 });
	}
	const acts = el('div', 'acts', post);
	acts.innerHTML = `<svg viewBox="0 0 24 24" class="hrt"><path d="M12 20.5s-8.5-5.2-8.5-11A4.8 4.8 0 0 1 12 6.8a4.8 4.8 0 0 1 8.5 2.7c0 5.8-8.5 11-8.5 11z" fill="none" stroke="#f5f5f5" stroke-width="1.9" stroke-linejoin="round"/></svg>
		<svg viewBox="0 0 24 24"><path d="M20.5 12a8.5 8.5 0 1 1-3.3-6.7A8.4 8.4 0 0 1 20.5 12c0 1.5-.4 3-1.1 4.2l1.1 4.3-4.3-1.1" fill="none" stroke="#f5f5f5" stroke-width="1.9" stroke-linejoin="round"/></svg>
		<svg viewBox="0 0 24 24"><path d="M21.5 3 3 10.2l7 2.6m11.5-9.8-6.8 18-4.7-8.2m11.5-9.8L10 12.8" fill="none" stroke="#f5f5f5" stroke-width="1.9" stroke-linejoin="round"/></svg>
		<span style="flex:1"></span><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V3.5h14z" fill="none" stroke="#f5f5f5" stroke-width="1.9" stroke-linejoin="round"/></svg>`;
	const hrt = acts.querySelector('.hrt path');
	const likes = el('div', 'likes', post);
	const cap = el('div', 'cap', post);
	el('b', '', cap).textContent = C.handle + ' ';
	const words = [];
	const addWords = (list, times) => list.forEach((wd, i) => {
		const chars = [...wd].map((ch) => { const s = el('span', 'c', cap); s.textContent = ch; return s; });
		cap.appendChild(document.createTextNode(' '));
		words.push({ chars, t: times[i] });
	});
	addWords(C.post.line1, L.mind);
	el('br', '', cap);
	addWords(C.post.line2, L.fin);
	const caret = el('span', 'caret', cap);
	const cmt = el('div', 'cmt', post);
	const ca = el('div', '', cmt, { width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flex: 'none' });
	media(ca, C.herPin, { pos: '50% 30%', kb: false });
	el('span', '', cmt).innerHTML = `<b>${C.her.toLowerCase()}</b>&nbsp; ${C.post.reply}`;
	el('div', 'ago', post).textContent = '2 days ago';
	words.forEach((wd) => wd.chars.forEach((_, i) => cue(wd.t + i * 0.07, 'key', ((i * 7) % 5) / 5)));
	cue(70.5, 'heart'); cue(71.5, 'msg', 0.7); cue(73.4, 'pen', 0.7);

	const camK = [
		[63.6, { x: 0, y: 0, s: 1.25 }],
		[64.5, { x: 0, y: 0, s: 0.98 }, E.outE],
		[65.4, { x: 30, y: 270, s: 1.72 }, E.ioC],
		[68.6, { x: 40, y: 284, s: 1.8 }, E.ioS],
		[70.1, { x: 0, y: 90, s: 1.1 }, E.ioC],
		[72.0, { x: 0, y: 70, s: 1.04 }, E.ioS],
		[75.5, { x: 0, y: 20, s: 0.86 }, E.ioS],
	];
	function update(n) {
		const vis = n >= 63.6; show(root, vis); if (!vis) return null;
		root.style.clipPath = n < 64.5 ? `circle(${tw(n, 63.6, 64.5, 80, 1700, E.outE).toFixed(1)}px at 1080px 660px)` : 'none';
		const c = camAt(n, camK);
		w.style.transform = camTf(c);
		updBokeh(bk, n, c);
		const ry = K(n, [[63.6, 22], [64.6, 8, E.outC], [65.4, 0], [72, 0], [75.5, -10]]) + 1.2 * nz(n * BEAT * 0.6, 3);
		const rx = K(n, [[63.6, -8], [64.6, 2], [72, 0], [75.5, 6]]) + 0.8 * nz(n * BEAT * 0.5, 8);
		ph.root.style.transform = `perspective(2400px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;
		phoneLight(ph, ry, rx);
		// typing synced to the sung words
		words.forEach((wd) => wd.chars.forEach((ch, i) => { ch.className = n >= wd.t + i * 0.07 ? 'c on' : 'c'; }));
		caret.style.display = n > L.mind[0] - 0.3 && n < 71.2 ? '' : 'none';
		caret.style.opacity = Math.floor(n * 2) % 2 === 0 || n < 70.8 ? 1 : 0;
		// double-tap heart on the last "mean?"
		const hk = clamp(sp(n, 70.5, 0.35, 20), 0, 1.5), hout = tw(n, 71.6, 72.1, 0, 1, E.inC);
		show(big, n >= 70.5 && n < 72.2);
		big.style.transform = `scale(${(hk * (1 - hout * 0.4)).toFixed(3)})`; big.style.opacity = 1 - hout;
		sparks.forEach((s) => {
			const kk = E.outC(clamp((n - 70.55) / 1.2));
			s.s.style.transform = `translate(${(Math.cos(s.a) * s.d * kk).toFixed(1)}px, ${(Math.sin(s.a) * s.d * kk - 40 * kk).toFixed(1)}px) rotate(${s.r}deg) scale(${(1.2 - kk * 0.6).toFixed(3)})`;
			s.s.style.opacity = n < 70.55 ? 0 : 1 - clamp((n - 71.1) / 0.6);
		});
		const liked = n >= 70.55;
		hrt.setAttribute('fill', liked ? '#ff3040' : 'none'); hrt.setAttribute('stroke', liked ? '#ff3040' : '#f5f5f5');
		acts.firstElementChild.style.transform = `scale(${liked ? (1 + 0.35 * Math.exp(-(n - 70.55) * BEAT / 0.12)).toFixed(3) : 1})`;
		const ck = clamp(sp(n, 71.5, 0.5, 16), 0, 1.2);
		cmt.style.opacity = clamp((n - 71.5) / 0.3);
		cmt.style.transform = `translateY(${((1 - Math.min(ck, 1)) * 16).toFixed(1)}px)`;
		likes.textContent = `Liked by ${C.her.toLowerCase()} and ${(C.post.likes + (liked ? 1 : 0)).toLocaleString('en-US')} others`;
		return { cam: c, lens: K(n, [[63.6, 0.6], [64.5, 0.1]]) };
	}
	return { update };
})();

/* ================================================================== lyric motif placements */
phrase(L.m1, L.m1end, { x: 100, y: 300, size: 172, color: '#1b1a19', accent: '#d7261c', br: 1 });
phrase(L.m2, L.m2end, { x: 960, y: 400, size: 190, color: '#ffffff', accent: '#ffd23f', center: true, shadow: '0 6px 40px rgba(40,20,0,.55), 0 2px 6px rgba(0,0,0,.3)' });
phrase(L.m3, L.m3end, { x: 960, y: 360, size: 190, color: '#ffffff', accent: '#0a84ff', center: true, shadow: '0 6px 40px rgba(0,30,80,.55), 0 2px 6px rgba(0,0,0,.35)' });
phrase(L.m4, L.m4end, { x: 110, y: 300, size: 170, color: '#1b1a19', accent: '#d7261c', br: 1, shadow: '0 0 30px rgba(255,255,255,.8)' });
phrase(L.m5, L.m5end, { x: 960, y: 70, size: 128, color: '#ffffff', accent: '#5aa4ff', center: true });

/* ================================================================== compositor */
const leak = $('leak'), grain = $('grain'), black = $('black'), endc = $('endcard');
$('endh').textContent = C.endCard; $('ends').textContent = C.endSub;
const LEAKS = [8, 24, 40, 56, 64];
function probeAt(n) {
	const r = [S1.update(n), S2.update(n), S3.update(n), S4.update(n), S5.update(n), S6.update(n)];
	for (let i = r.length - 1; i >= 0; i--) if (r[i]) return r[i];
	return null;
}
function blurBetween(a, b) {
	if (!a || !b || !a.cam || !b.cam) return [0, 0];
	const z = Math.abs(Math.log(b.cam.s / a.cam.s)) * 960;
	return [(Math.abs(b.cam.x - a.cam.x) * b.cam.s + z * 0.5) / 2.2, (Math.abs(b.cam.y - a.cam.y) * b.cam.s + z * 0.5) / 2.2];
}
function update(T) {
	pending = [];
	const n = T / BEAT;
	const prev = probeAt((T - 0.5 / FPS) / BEAT);
	const cur = probeAt(n);
	const [bx, by] = blurBetween(prev, cur);
	const lens = cur && cur.lens != null ? cur.lens : 0;
	const ca = Math.min(8, (bx + by) * 0.12) + LEAKS.reduce((s, l) => s + 4 * Math.exp(-Math.abs(n - l) * BEAT / 0.12), 0);
	setFX(bx, by, lens, ca);
	updateMedia(T);
	updPhrases(n);
	// light leaks on the big transitions
	let lk = 0, li = 0;
	LEAKS.forEach((l, i) => { const v = Math.exp(-((((n - l) * BEAT) / 0.22) ** 2)); if (v > lk) { lk = v; li = i; } });
	leak.style.opacity = (lk * 0.75).toFixed(3);
	if (lk > 0.01) leak.style.background = `radial-gradient(900px 700px at ${30 + li * 13 + (n - LEAKS[li]) * 40}% ${40 + (li % 2) * 20}%, rgba(255,150,70,.9), rgba(255,90,120,.45) 45%, rgba(255,90,120,0) 75%)`;
	// film grain: a new pattern every frame
	const fi = Math.round(T * FPS);
	grain.style.backgroundImage = `url(${TEX.grain[fi % 6]})`;
	grain.style.backgroundPosition = `${(fi * 97) % 256}px ${(fi * 61) % 256}px`;
	// beat pump: the frame kicks with every beat (harder on each bar's downbeat)
	const k = Math.floor(n + 1e-6), ph = (n - k) * BEAT;
	const pump = k >= 8 && k < 72 ? (k % 4 === 0 ? 0.011 : 0.005) * Math.exp(-ph / 0.1) : 0;
	frame.style.transform = pump > 0.0004 ? `scale(${(1 + pump).toFixed(5)})` : 'none';
	// ending
	black.style.opacity = tw(n, 72.6, 73.4, 0, 1, E.ioC);
	endc.style.opacity = n > 73 ? 1 : 0;
	$('endh').style.clipPath = `inset(-40px ${(100 - tw(n, 73.4, 75.0, 0, 100, E.lin)).toFixed(1)}% -40px 0)`;
	$('ends').style.opacity = tw(n, 75.0, 75.8, 0, 1);
	$('ends').style.transform = `translateY(${tw(n, 75.0, 76, 12, 0, E.outC).toFixed(1)}px)`;
	endc.style.transform = `scale(${tw(n, 73, 78, 1, 1.04, E.lin).toFixed(4)})`;
}

window.CUES = CUES.map((c) => ({ t: +(c.n * BEAT).toFixed(4), t0: c.n0 == null ? null : +(c.n0 * BEAT).toFixed(4), k: c.k, v: c.v })).sort((a, b) => a.t - b.t);
window.BEAT = BEAT;
window.DURATION = DUR;
window.FPS = FPS;
window.renderFrame = async (T) => { update(T); await Promise.all(pending); };
window.READY = (async () => {
	await Promise.all(['400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter', '900 20px Inter', '500 40px Caveat', '700 40px Caveat',
		'italic 40px Serif', '40px Serif', '30px Anton'].map((f) => document.fonts.load(f)));
	await document.fonts.ready;
	await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
	FIT.forEach((f) => f());
	update(0);
	return true;
})();

if (!/render/.test(location.search)) {
	document.body.classList.add('dev');
	const sc = $('scrub'), lb = $('tlabel'), bt = $('play');
	sc.max = DUR;
	const q = new URLSearchParams(location.search).get('t');
	let playing = false, t0 = 0, s0 = 0;
	const go = (t) => { sc.value = t; lb.textContent = `${(+t).toFixed(2)}s  beat ${(t / BEAT).toFixed(2)}`; update(+t); };
	sc.oninput = () => go(sc.value);
	bt.onclick = () => { playing = !playing; t0 = performance.now(); s0 = +sc.value; bt.textContent = playing ? 'pause' : 'play'; if (playing) loop(); };
	const loop = () => { if (!playing) return; let t = s0 + (performance.now() - t0) / 1000; if (t > DUR) { t = 0; t0 = performance.now(); s0 = 0; } go(t); requestAnimationFrame(loop); };
	window.READY.then(() => go(q || 0));
}
})();
