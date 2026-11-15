/* Memories motion video: every frame is a pure function of time T (seconds).
 * render.js calls window.renderFrame(T) and screenshots the page. Open index.html directly for a scrubber. */
(() => {
const C = window.CONFIG, M = window.MEDIA;
const FPS = 30, DUR_TAU = 33.5;
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ helpers */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
	lin: (t) => t,
	inC: (t) => t * t * t,
	outC: (t) => 1 - (1 - t) ** 3,
	ioC: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
	outQ: (t) => 1 - (1 - t) ** 5,
	ioQ: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
	outE: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
	inE: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
	ioE: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
	outB: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
	ioS: (t) => t * t * (3 - 2 * t),
};
// damped spring step response; p = seconds since start
const spring = (p, z = 0.45, w = 15) => (p <= 0 ? 0 : 1 - Math.exp(-z * w * p) * (Math.cos(w * Math.sqrt(1 - z * z) * p) + (z / Math.sqrt(1 - z * z)) * Math.sin(w * Math.sqrt(1 - z * z) * p)));
const tw = (t, t0, t1, a, b, e = E.ioC) => (t <= t0 ? a : t >= t1 ? b : lerp(a, b, e((t - t0) / (t1 - t0))));
// keyframes [[t, v, easeIntoThisKey], ...]
function K(t, k) {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) {
		if (t < k[i][0]) return lerp(k[i - 1][1], k[i][1], (k[i][2] || E.ioC)((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0])));
	}
	return k[k.length - 1][1];
}
// camera keyframes [[t, {x,y,s,r}, ease]] ; zoom interpolated in log space
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
const OFF = 120; // frame margin (see #frame)
const camTf = (c) => `translate(1080px,660px) rotate(${c.r || 0}deg) scale(${c.s}) translate(${-c.x}px,${-c.y}px)`;
let seed = 7;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/* ------------------------------------------------------------------ beat sync
 * The animation is authored on its own clock (tau). A piecewise-linear warp maps it onto the song's
 * beat grid, so every cut, whip and hop lands on a beat. ANCH = [tau, beat]. Beat 32 is the drop. */
const BEAT = 60 / ((C.beat && C.beat.bpm) || 123.06);
const ANCH = [[0, 0], [2.62, 6], [3.3, 7], [5.38, 11], [6.55, 14], [7.0, 15], [7.95, 17], [9.0, 19], [9.85, 21],
	[12.95, 28], [13.55, 29], [14.15, 31], [14.55, 32], [18.75, 40], [19.38, 41], [19.95, 42], [20.82, 44], [22.55, 47],
	[23.05, 48], [24.1, 50], [24.9, 52], [26.2, 54], [26.95, 56], [27.45, 57], [28.85, 60], [29.38, 61], [31.95, 66], [32.62, 68]];
function warp(x, from, to) {
	const L = ANCH.length;
	const f = (i) => (from ? ANCH[i][0] : ANCH[i][1] * BEAT), g = (i) => (from ? ANCH[i][1] * BEAT : ANCH[i][0]);
	if (x <= f(0)) return g(0) + (x - f(0));
	for (let i = 1; i < L; i++) if (x < f(i)) return lerp(g(i - 1), g(i), (x - f(i - 1)) / (f(i) - f(i - 1)));
	return g(L - 1) + (x - f(L - 1));
}
const tauToT = (tau) => warp(tau, true), Ttotau = (T) => warp(T, false);
const b = (n) => Ttotau(n * BEAT); // animation time of beat n
const DUR = tauToT(DUR_TAU);
const nz = (t, s) => Math.sin(t * 1.31 + s) * 0.5 + Math.sin(t * 2.17 + s * 2.3) * 0.3 + Math.sin(t * 3.71 + s * 0.7) * 0.2;
function el(tag, cls, parent, css) {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (css) Object.assign(e.style, css);
	if (parent) parent.appendChild(e);
	return e;
}
const px = (v) => `${v}px`;
const show = (e, on) => { e.style.display = on ? '' : 'none'; };
const setT = (e, tf) => { e.style.transform = tf; };

/* ------------------------------------------------------------------ media (photos or clips) */
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
			if (f !== m.frame) {
				m.frame = f;
				m.img.src = `${m.info.dir}/${String(f).padStart(4, '0')}.jpg`;
				pending.push(m.img.decode().catch(() => {}));
			}
		} else if (m.kb) {
			// slow push + handheld drift so stills feel like footage
			const a = m.amt;
			const s = 1.1 - 0.05 * clamp(lt / 8) + 0.012 * a * nz(T * 0.9, m.sd);
			const x = 1.6 * a * nz(T * 1.7, m.sd + 3), y = 1.3 * a * nz(T * 1.5, m.sd + 9);
			m.img.style.transform = `translate(${x.toFixed(2)}%,${y.toFixed(2)}%) scale(${s.toFixed(4)})`;
		}
	}
}

/* ------------------------------------------------------------------ global fx: motion blur + lens */
const frame = $('frame'), fxBlur = $('fxblur'), fxDisp = $('fxdisp');
const LENS_PX = 330;
(function lensMap() {
	const w = 480, h = 270, c = document.createElement('canvas');
	c.width = w; c.height = h;
	const g = c.getContext('2d'), im = g.createImageData(w, h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const nx = (x / (w - 1)) * 2 - 1, ny = (y / (h - 1)) * 2 - 1;
		const f = 1 - (nx * nx + ny * ny) / 2;
		const i = (y * w + x) * 4;
		im.data[i] = Math.round(255 * (0.5 + (0.5 * (-nx * f)) / 0.8));
		im.data[i + 1] = Math.round(255 * (0.5 + (0.5 * (-ny * f * 0.85)) / 0.8));
		im.data[i + 2] = 128; im.data[i + 3] = 255;
	}
	g.putImageData(im, 0, 0);
	$('fxmap').setAttribute('href', c.toDataURL());
})();
function setFX(bx, by, lens) {
	bx = Math.min(bx, 70); by = Math.min(by, 70);
	if (bx < 0.35 && by < 0.35 && lens < 0.003) { frame.style.filter = 'none'; return; }
	frame.style.filter = 'url(#fx)';
	fxBlur.setAttribute('stdDeviation', `${bx < 0.35 ? 0 : bx.toFixed(2)} ${by < 0.35 ? 0 : by.toFixed(2)}`);
	fxDisp.setAttribute('scale', (lens * LENS_PX).toFixed(1));
}

/* ------------------------------------------------------------------ cues (exported for sound design) */
const CUES = [];
const cue = (t, k, v = 1, t0 = null) => CUES.push({ tau: t, t0tau: t0, k, v });

/* ================================================================== SCENE 1 — calendar */
const S1 = (() => {
	const CW = 210, CH = 170;
	const root = $('cal'), w = $('calw');
	const { year, month, day } = C.date;
	const first = new Date(year, month - 1, 1).getDay();
	const dim = new Date(year, month, 0).getDate();
	const pdim = new Date(year, month - 1, 0).getDate();
	const rows = Math.ceil((first + dim) / 7);
	const tIdx = first + day - 1;
	const center = (i) => ({ x: (i % 7) * CW + CW / 2, y: Math.floor(i / 7) * CH + CH / 2 });

	// lines
	for (let r = 0; r <= rows; r++) el('div', 'hline', w, { left: px(-700), top: px(r * CH - 1), width: px(7 * CW + 1400), height: '2px' });
	for (let c = 0; c <= 7; c++) el('div', 'vline', w, { left: px(c * CW - 1), top: px(-150), width: '2px', height: px(rows * CH + 600) });
	el('div', 'hline', w, { left: px(-700), top: px(-150), width: px(7 * CW + 1400), height: '2px' });
	// header + weekday labels
	const head = el('div', 'head', w, { left: px(30), top: px(-232) });
	const hMain = el('span', '', head); hMain.textContent = C.date.label + ' ';
	const hWd = el('span', 'wd', head); hWd.textContent = C.date.weekday;
	const wdl = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, c) => {
		const e = el('div', 'wdl', w, { left: px(c * CW), top: px(-104) }); e.textContent = d;
		if (c >= 2 && c <= 4) e.style.fontStyle = c === 2 ? 'italic' : '';
		return e;
	});
	// decorations relative to the target day (gives the sticker-calendar look)
	const deco = {
		'-11': { dot: '#8bd36d' }, '-10': { dot: '#f2a25a' }, '-7': { bg: '#f7efa6', rot: 5 }, '-5': { bg: '#a9e3f6', rot: -3 },
		'-4': { dot: '#9aa5f0' }, '-3': { bg: '#b9bdf5', rot: -7 }, '-2': { dot: '#ff4f8a' }, '-1': { it: 1 },
		'2': { dot: '#e04be0' }, '4': { bg: '#a9e3f6', rot: 4 }, '5': { dot: '#9aa5f0' }, '6': { bg: '#b9bdf5', rot: -6 },
		'7': { dot: '#ff3b5c' }, '8': { it: 1 }, '9': { bg: '#f9d3a6', rot: 8, it: 1 }, '11': { bg: '#bdeebc', rot: -4 },
		'12': { bg: '#f7efa6', rot: 3 }, '13': { bg: '#a9e3f6', rot: -5 }, '15': { dot: '#8bd36d' },
	};
	const cells = [];
	for (let i = 0; i < rows * 7; i++) {
		const inM = i >= first && i < first + dim;
		const n = inM ? i - first + 1 : i < first ? pdim - first + 1 + i : i - first - dim + 1;
		const p = center(i);
		const e = el('div', 'num', w, { left: px(p.x), top: px(p.y - 6) });
		const d = deco[String(i - tIdx)];
		if (d && d.bg) el('i', 'bg', e, { background: d.bg, transform: `rotate(${d.rot}deg)` });
		const s = el('span', '', e); s.textContent = n;
		if (d && d.it) e.classList.add('it');
		if (d && d.dot) el('i', 'mark', w, { left: px(p.x), top: px(p.y + 38), background: d.dot });
		cells.push({ e, s, p, base: inM ? [21, 21, 21] : [196, 196, 196] });
	}

	// red dot path: start 5 days before the target, hop three days, then whip to the target
	const iStart = Math.max(0, tIdx - 5);
	const stops = [iStart, Math.max(0, tIdx - 4), Math.max(0, tIdx - 3), Math.max(0, tIdx - 2), tIdx];
	const hops = [[b(3) - 0.24, b(3)], [b(4) - 0.24, b(4)], [b(5) - 0.2, b(5)], [b(5) + 0.04, 2.62]];
	const P = stops.map(center);
	function dotPos(t) {
		let x = P[0].x, y = P[0].y;
		hops.forEach(([a, b], i) => {
			const e = i === 3 ? E.ioQ : E.ioC;
			const k = clamp((t - a) / (b - a));
			if (k > 0) { x = lerp(P[i].x, P[i + 1].x, e(k)); y = lerp(P[i].y, P[i + 1].y, e(k)); }
		});
		return { x, y };
	}
	const R = 48;
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.id = 'blobsvg'; svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('fill', '#ff1616');
	svg.appendChild(path);
	w.insertBefore(svg, w.firstChild.nextSibling);
	// the dot must sit under the numbers: move it right after the lines
	w.insertBefore(svg, cells[0].e);

	// morph card (dot -> photo)
	const tp = center(tIdx);
	const morph = el('div', '', w); morph.id = 'morph';
	const mph = el('div', 'mbox', morph, { inset: '0' });
	const mm = media(mph, C.morph, { pos: '50% 40%', amt: 0.6 });
	const tint = el('div', 'tint', morph);
	const shine = el('div', 'shine', morph);
	const mnum = el('div', 'n', morph); mnum.textContent = day;

	const cam = [
		[0, { x: P[0].x, y: P[0].y, s: 3.7 }],
		[0.72, { x: 520, y: 172, s: 1.26 }, E.outE],
		[b(5), { x: 640, y: 182, s: 1.32 }, E.lin],
		[2.62, { x: tp.x, y: tp.y, s: 2.08 }, E.ioQ],
		[3.3, { x: tp.x + 6, y: tp.y + 2, s: 2.14 }, E.lin],
		[4.7, { x: tp.x + 18, y: tp.y + 8, s: 2.22 }, E.ioS],
		[5.4, { x: tp.x + 18 + 420 / 2.26, y: tp.y + 8, s: 2.26 }, E.outQ],
		[6.55, { x: tp.x + 18 + 470 / 2.3, y: tp.y + 8, s: 2.3 }, E.lin],
		[7.0, { x: tp.x + 18 + 1800 / 2.3, y: tp.y + 8, s: 2.3 }, E.ioQ],
	];
	const lens = [[1.98, 0], [2.62, 1, E.ioC], [4.75, 1], [5.4, 0.5], [6.55, 0.5], [7.0, 0.4]];

	// cues
	cue(0, 'open'); hops.slice(0, 3).forEach(([, a], i) => cue(a, 'blip', i)); cue(2.62, 'whoosh', 0.8, hops[3][0]); cue(2.64, 'tap', 0.6);
	cue(3.3, 'morph');

	function update(T) {
		const vis = T < 7.1; show(root, vis); if (!vis) return null;
		const c = camAt(T, cam);
		setT(w, camTf(c));
		// header
		head.style.opacity = tw(T, 0.3, 0.6, 0, 1);
		head.style.transform = `translateY(${tw(T, 0.3, 0.75, 26, 0, E.outC)}px)`;
		hWd.style.opacity = tw(T, 0.75, 1.05, 0, 1);
		// dot
		const d = dotPos(T), d2 = dotPos(T - 1 / 60);
		const vx = (d.x - d2.x) * 60, vy = (d.y - d2.y) * 60, sp = Math.hypot(vx, vy);
		let wob = 0.18 * Math.exp(-3.4 * T);
		hops.forEach(([, b]) => { if (T > b) wob += 0.07 * Math.exp(-8 * (T - b)); });
		const st = Math.min(0.55, sp / 2400), ang = Math.atan2(vy, vx);
		const blobOn = T < 3.3;
		path.style.display = blobOn ? '' : 'none';
		if (blobOn) {
			const N = 96, ca = Math.cos(ang), sa = Math.sin(ang);
			let dd = '';
			for (let i = 0; i < N; i++) {
				const th = (i / N) * Math.PI * 2;
				let r = R * (1 + wob * (0.55 * Math.sin(3 * th + 5 * T) + 0.3 * Math.sin(5 * th - 7 * T + 1) + 0.25 * Math.sin(2 * th + 3 * T + 2)));
				let lx = Math.cos(th) * r, ly = Math.sin(th) * r;
				// gooey stretch along the motion: longer, thinner, with a heavier trailing side
				const along = lx * ca + ly * sa, perp = -lx * sa + ly * ca;
				const a2 = along * (1 + st) - (along < 0 ? st * 0.35 * Math.abs(along) : 0);
				const p2 = perp / Math.sqrt(1 + st);
				lx = a2 * ca - p2 * sa; ly = a2 * sa + p2 * ca;
				dd += (i ? 'L' : 'M') + (d.x + lx).toFixed(2) + ' ' + (d.y + ly).toFixed(2);
			}
			path.setAttribute('d', dd + 'Z');
		}
		// numbers: white when under the dot, faded once passed
		const leave = hops.map((h) => h[0]);
		cells.forEach((cl, i) => {
			const k = clamp(1 - (Math.hypot(cl.p.x - d.x, cl.p.y - d.y) - 12) / 44) * (blobOn ? 1 : 0);
			const b = cl.base;
			cl.s.style.color = `rgb(${lerp(b[0], 255, k) | 0},${lerp(b[1], 255, k) | 0},${lerp(b[2], 255, k) | 0})`;
			let op = 1;
			const si = stops.indexOf(i);
			if (si >= 0 && si < 4) op = tw(T, leave[si] + 0.12, leave[si] + 0.45, 1, 0.32);
			if (i === tIdx) op = T < 3.3 ? 1 : 0;
			cl.e.style.opacity = op;
		});
		// morph
		const mOn = T >= 3.3; show(morph, mOn);
		if (mOn) {
			const g = spring(T - 3.52, 0.5, 11);
			const sz = 2 * R + (290 - 2 * R) * clamp(g, 0, 1.2);
			const rad = lerp(R, 34, clamp((T - 3.5) / 0.4));
			const puff = 1 + 0.1 * Math.sin(clamp((T - 3.3) / 0.28) * Math.PI);
			const ry = tw(T, 3.55, 4.1, 0, -17, E.outC) + 2.5 * nz(T * 0.8, 2) * clamp((T - 4.1) / 0.5);
			const rx = tw(T, 3.55, 4.1, 0, 7, E.outC) + 1.5 * nz(T * 0.7, 5) * clamp((T - 4.1) / 0.5);
			Object.assign(morph.style, {
				left: px(tp.x - sz / 2), top: px(tp.y - sz / 2), width: px(sz), height: px(sz), borderRadius: px(rad),
				transform: `perspective(900px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${puff})`,
				boxShadow: `0 ${tw(T, 3.3, 3.9, 4, 22)}px ${tw(T, 3.3, 3.9, 8, 44)}px rgba(60,0,0,${tw(T, 3.3, 4.1, 0.15, 0.32)})`,
			});
			mph.style.opacity = K(T, [[3.42, 0], [3.65, 1]]);
			tint.style.opacity = K(T, [[3.42, 1], [3.72, 0.6], [4.08, 0]]);
			shine.style.opacity = K(T, [[3.3, 0.9], [3.75, 0.8], [4.1, 0]]);
			mnum.style.opacity = K(T, [[3.58, 1], [3.78, 0]]);
			mnum.style.transform = `scale(${tw(T, 3.58, 3.78, 1, 1.35)})`;
		}
		return { cam: c, lens: K(T, lens) };
	}
	return { update };
})();

/* ================================================================== SCENE 2/3 — list panel + place card */
const S2 = (() => {
	const root = $('scene2'), panel = $('panel'), card = $('card');
	const ttl = el('div', 'ttl', panel, { top: px(150 + OFF) }); ttl.textContent = C.panelTitle;
	const ROW0 = 205, RH = 170;
	const hl = el('div', 'hl', panel);
	const rows = C.places.map((p, i) => {
		const r = el('div', 'row', panel, { top: px(ROW0 + OFF + i * RH) });
		const th = el('div', 'th', r); media(th, p.media, { amt: 0.4 });
		el('div', 'nm', r).textContent = p.name;
		el('div', 'ds', r).textContent = p.dist;
		if (i < C.places.length - 1) el('div', 'sep', r);
		return r;
	});
	// card
	const im = el('div', 'img', card);
	const cA = el('div', 'mbox', im, { inset: '0' }); media(cA, C.places[2].media, { pos: '50% 38%' });
	const cB = el('div', 'mbox', im, { inset: '0' }); media(cB, C.places[1].media, { pos: '50% 45%' });
	const cC = el('div', 'mbox', im, { inset: '0' }); media(cC, C.card.clip, { pos: '50% 30%', t0: 9.85, amt: 1.4 });
	const pill = el('div', 'pill', im);
	pill.innerHTML = '<svg viewBox="0 0 18 22"><path d="M2 1h14v20l-7-5-7 5z" fill="currentColor"/></svg><span>Save</span>';
	const pillIc = pill.querySelector('svg'), pillTx = pill.querySelector('span');
	const det = el('div', 'det', card);
	const tt = el('div', 'tt', det);
	const mk = el('i', 'mk', tt);
	const words = C.card.title.split(' ').map((wd, i, a) => { const s = el('span', 'w', tt); s.textContent = wd + (i < a.length - 1 ? ' ' : ''); return s; });
	const sub = el('div', 'sub', det); sub.textContent = C.card.subtitle;
	const dst = el('div', 'dst', det); dst.textContent = C.card.dist;
	const btns = el('div', 'btns', det);
	btns.innerHTML = `
		<div class="btn"><svg viewBox="0 0 24 24"><path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="#fff"/></svg>Directions</div>
		<div class="btn"><svg viewBox="0 0 24 24"><path d="M4 7h3l2-3h6l2 3h3v13H4z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="#fff" stroke-width="2.2"/></svg>Things to do</div>
		<svg class="pinic" viewBox="0 0 40 40"><path d="M20 4c-6 0-10.5 4.6-10.5 10.4C9.5 22 20 33 20 33s10.5-11 10.5-18.6C30.5 8.6 26 4 20 4z" fill="none" stroke="#1c1c1e" stroke-width="2.6"/><circle cx="20" cy="14.5" r="4" fill="none" stroke="#1c1c1e" stroke-width="2.6"/><ellipse cx="20" cy="35" rx="9" ry="2.6" fill="none" stroke="#1c1c1e" stroke-width="2"/></svg>`;
	const btnEls = [...btns.children];
	const av = el('div', 'av', det);
	avatar(av);

	const tileS = (384 * 1.15) / 880;
	// image-centre position (screen) and scale of the card
	const cx = [[6.55, 2700], [7.0, 1380, E.ioQ], [8.5, 1350, E.lin], [9.0, 960, E.ioQ], [13.3, 960], [13.5, 905, E.outC], [13.95, 960, E.ioC], [14.15, 960], [14.55, 960, E.ioE]];
	const cy = [[7.6, 540], [8.2, 452, E.ioC], [12.3, 452], [12.95, 205, E.ioQ], [13.3, 214], [13.55, 300, E.outC], [13.95, 420, E.ioC], [14.15, 420], [14.55, 540, E.ioE]];
	const cs = [[6.55, 1.0], [8.5, 1.02, E.lin], [9.0, 1.04, E.ioQ], [9.85, 1.06, E.lin], [10.45, 1.2, E.outE], [12.3, 1.24, E.lin], [12.95, 1.44, E.ioQ], [13.3, 1.45], [13.55, 1.33, E.outC], [13.95, 1.3, E.ioC], [14.15, 1.3], [14.55, tileS, E.ioE]];
	const panelX = [[4.72, 1930], [5.38, 1040, E.outQ], [6.55, 1010, E.lin], [7.0, -150, E.ioQ], [8.5, -175, E.lin], [9.0, -1100, E.inC]];
	const hlRow = [[5.3, 3], [6.72, 3], [7.0, 2, E.ioC], [7.85, 2], [8.15, 1, E.outB]];

	cue(5.38, 'whoosh', 0.6, 4.72); cue(7.0, 'whoosh', 1, 6.55); cue(7.95, 'save'); cue(9.0, 'whoosh', 0.5, 8.5);
	cue(9.84, 'tap', 0.8); cue(12.95, 'whoosh', 0.45, 12.3); cue(12.85, 'marker'); cue(13.55, 'whoosh', 0.6, 13.3);
	cue(14.55, 'riser', 1, b(28)); cue(14.55, 'drop');

	function state(T) { return { x: K(T, cx), y: K(T, cy), s: K(T, cs) }; }
	function update(T) {
		const vis = T >= 4.6 && T < 14.62; show(root, vis); if (!vis) return null;
		const pX = K(T, panelX);
		show(panel, T < 9.05);
		panel.style.transform = `translateX(${pX + OFF}px)`;
		rows.forEach((r, i) => {
			const a = 4.98 + i * 0.07;
			r.style.opacity = tw(T, a, a + 0.25, 0, 1);
			r.style.transform = `translateY(${tw(T, a, a + 0.4, 46, 0, E.outQ)}px)`;
		});
		ttl.style.opacity = tw(T, 4.95, 5.2, 0, 1);
		hl.style.top = px(ROW0 + OFF + 10 + K(T, hlRow) * RH);
		hl.style.opacity = tw(T, 5.25, 5.5, 0, 1);

		const st = state(T);
		show(card, T >= 6.55);
		card.style.transform = `translate(${st.x - 440 * st.s + OFF}px,${st.y - 270 * st.s + OFF}px) scale(${st.s})`;
		cB.style.opacity = tw(T, 7.9, 8.12, 0, 1);
		cB.style.transform = `scale(${tw(T, 7.9, 8.4, 1.12, 1, E.outC)})`;
		cC.style.opacity = tw(T, 9.8, 9.93, 0, 1);
		cC.style.transform = `scale(${tw(T, 9.8, 10.3, 1.18, 1, E.outE)})`;
		const saved = T >= 7.95;
		pillTx.textContent = saved ? 'Saved' : 'Save';
		pillIc.style.color = saved ? '#ffd60a' : '#fff';
		pill.style.transform = `scale(${1 + 0.18 * Math.sin(clamp((T - 7.95) / 0.25) * Math.PI)})`;
		// details
		const dOut = tw(T, 14.15, 14.38, 1, 0);
		words.forEach((wd, i) => {
			const a = 7.75 + i * 0.17;
			wd.style.opacity = tw(T, a, a + 0.18, 0, 1);
			wd.style.filter = `blur(${tw(T, a, a + 0.22, 8, 0)}px)`;
			wd.style.transform = `translateY(${tw(T, a, a + 0.3, 18, 0, E.outC)}px)`;
		});
		det.style.opacity = dOut;
		sub.style.opacity = dst.style.opacity = tw(T, 7.9, 8.15, 0, 1);
		btnEls.forEach((b, i) => {
			const a = 7.95 + i * 0.06;
			b.style.opacity = tw(T, a, a + 0.2, 0, 1);
			b.style.transform = `translateY(${tw(T, a, a + 0.35, 24, 0, E.outQ)}px)`;
		});
		av.style.transform = `scale(${clamp(spring(T - 8.1, 0.4, 16), 0, 2)})`;
		mk.style.transform = `scaleX(${tw(T, 12.85, 13.18, 0, 1, E.outC)})`;
		im.style.borderRadius = px(lerp(28, 6, tw(T, 14.15, 14.5, 0, 1)));
		const pr = T < 6.6 ? { x: pX * 0.55, y: 0, s: 1 } : { x: st.x, y: st.y, s: st.s };
		return { scr: pr, lens: T < 7.0 ? null : 0 };
	}
	return { update };
})();

function avatar(box) {
	const a = C.avatar;
	const m = media(box, a.media, { kb: false });
	Object.assign(m.img.style, { objectPosition: `${a.x}% ${a.y}%`, transform: `scale(${a.zoom})`, transformOrigin: `${a.x}% ${a.y}%` });
}

/* ================================================================== pin (map location marker) */
function makePin(parent, D) {
	const p = el('div', 'pin', parent);
	const disc = el('div', 'disc', p, { left: px(-D / 2), top: px(-D / 2), width: px(D), height: px(D) });
	const ring = D * 0.1;
	const core = el('div', 'core', p, { left: px(-D / 2 + ring), top: px(-D / 2 + ring), width: px(D - 2 * ring), height: px(D - 2 * ring) });
	const ph = el('div', 'ph', core, { opacity: 0 });
	const tint = el('div', 'tint', core, { opacity: 0 });
	const svgNS = 'http://www.w3.org/2000/svg';
	const arr = document.createElementNS(svgNS, 'svg');
	arr.setAttribute('class', 'arrow');
	const A = D * 0.34;
	Object.assign(arr.style, { left: px(D / 2 + D * 0.06), top: px(-A / 2), width: px(A * 0.8), height: px(A) });
	arr.setAttribute('viewBox', '0 0 8 10');
	arr.innerHTML = '<path d="M1 1 L7 5 L1 9 Z" fill="#fff" stroke="#1a6dff" stroke-width="1.6" stroke-linejoin="round"/>';
	const arrWrap = el('div', '', p, { position: 'absolute', left: 0, top: 0 });
	arrWrap.appendChild(arr);
	return { p, disc, core, ph, tint, arrWrap, D };
}

/* ================================================================== SCENE 4/5 — clip grid, title */
const S4 = (() => {
	const W = 384, H = 236;
	const root = $('grid'), w = $('gridw');
	// lines (draw on)
	const lines = [];
	for (let c = -7; c <= 9; c++) {
		const e = el('div', 'gl', w, { left: px((c + 0.5) * W - 1), top: px(-6 * H), width: '2px', height: px(12 * H) });
		lines.push({ e, v: 1, t: 14.6 + rnd() * 2.2, o: rnd() });
	}
	for (let r = -6; r <= 5; r++) {
		const e = el('div', 'gl', w, { left: px(-8 * W), top: px((r + 0.5) * H - 1), width: px(18 * W), height: '2px' });
		lines.push({ e, v: 0, t: 14.6 + rnd() * 2.2, o: rnd() });
	}
	// tiles [col,row,appearT]
	const T0 = [[0, 0, 0],
		[1, -1, 16.3], [-1, -1, 16.75], [-1, 0, 16.8], [2, 1, 16.9], [0, -2, 17.05], [2, -1, 17.2],
		[-2, 1, 17.25], [0, 1, 17.3], [3, 0, 17.4], [-2, -1, 17.45], [2, -2, 17.5], [3, 1, 17.55], [-1, 2, 17.6],
		[1, 2, 17.62], [4, -1, 17.7], [1, -3, 17.75], [3, -3, 17.8], [5, -3, 17.85],
		[2, -3, 18.0], [4, -3, 18.0], [5, -1, 18.1], [3, 2, 17.8], [-3, -2, 17.8], [-2, 2, 17.9],
		[6, -3, 18.2], [5, 0, 18.2]];
	const tiles = [];
	let gi = 0;
	const addTile = (c, r, t, spec, opt = {}) => {
		const e = el('div', 'tile', w, { left: px(c * W - W / 2), top: px(r * H - H / 2), width: px(W), height: px(H) });
		media(e, spec, { pos: opt.pos || '50% 30%', t0: t });
		const rec = el('div', 'rec', e); rec.innerHTML = '<i></i>Rec';
		const li = el('div', 'lights', e); li.innerHTML = '<i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>';
		tiles.push({ e, t });
		return e;
	};
	T0.forEach(([c, r, t], i) => addTile(c, r, t, i === 0 ? C.card.clip : C.grid[gi++ % C.grid.length]));
	// hero clip next to the title cell
	const TC = { c: 4, r: -2 };
	addTile(TC.c - 1, TC.r, 18.0, C.title.hero, { pos: '50% 40%' });
	tiles.forEach((tl, i) => {
		if (i === 0 || tl.t >= 18) return;
		// first four land one per beat, the rest cascade in threes on eighth notes
		tl.t = i <= 4 ? b(32 + i) : b(36 + 0.5 * Math.ceil((i - 4) / 3));
		if (i <= 4) cue(tl.t, 'tap', 0.5 + i * 0.1);
	});

	// title cell
	const tcx = TC.c * W, tcy = TC.r * H;
	const cell = el('div', '', w, { left: px(tcx - W / 2), top: px(tcy - H / 2), width: px(W), height: px(H) });
	cell.id = 'titlecell';
	const stripeY = 22, SH = 92, PD = 80;
	const stripe = el('div', '', w, { left: px(tcx - W / 2 - 92), top: px(tcy + stripeY - SH / 2), height: px(SH), width: px(W + 92) });
	stripe.id = 'tstripe';
	const word = C.title.word, pi = C.title.pinLetter;
	const pre = el('div', 'tword', w), post = el('div', 'tword', w);
	pre.textContent = word.slice(0, pi); post.textContent = word.slice(pi + 1);
	const kick = el('div', '', w); kick.id = 'tkick'; kick.textContent = C.title.kicker;
	const pin = makePin(w, PD);
	media(pin.ph, C.pinClip, { pos: '50% 35%' });

	// layout once fonts are ready
	let L = null;
	function layout() {
		const gap = 6, wa = pre.offsetWidth, wb = post.offsetWidth;
		const total = wa + gap + PD + gap + wb;
		const x0 = tcx - total / 2 + 8;
		const fh = pre.offsetHeight;
		L = { oX: x0 + wa + gap + PD / 2, endX: x0 + total, x0, y: tcy + stripeY };
		Object.assign(pre.style, { left: px(x0), top: px(L.y - fh * 0.56) });
		Object.assign(post.style, { left: px(x0 + wa + gap + PD + gap), top: px(L.y - fh * 0.56) });
		Object.assign(kick.style, { left: px(x0 + 6), top: px(L.y - fh * 0.56 - 38) });
	}

	const cam = () => [
		[14.45, { x: 0, y: 0, s: 1.15 }],
		[16.2, { x: 0.1 * W, y: -0.05 * H, s: 1.0 }, E.ioS],
		[17.6, { x: 0.35 * W, y: -0.15 * H, s: 0.8 }, E.ioS],
		[18.3, { x: 0.6 * W, y: -0.08 * H, s: 0.83 }, E.ioS],
		[19.38, { x: 0.82 * W, y: -0.02 * H, s: 0.9 }, E.ioS],
		[19.95, { x: 3.5 * W, y: -1.72 * H, s: 1.05 }, E.ioQ],
		[21.45, { x: 3.62 * W, y: tcy + stripeY - 10, s: 1.22 }, E.ioS],
		[22.55, { x: 3.55 * W, y: tcy + stripeY, s: 1.95 }, E.ioC],
		[23.05, { x: tcx + 6, y: tcy + stripeY, s: 3.6 }, E.ioQ],
		[24.05, { x: tcx + 14, y: tcy + stripeY, s: 3.72 }, E.lin],
		[24.9, { x: L.endX + 40, y: tcy + stripeY, s: 3.8 }, E.ioC],
		[25.4, { x: L.endX + 40 + 1100, y: tcy + stripeY, s: 3.8 }, E.inC],
	];
	let CAM = null;
	const lens = [[21.3, 0], [22.5, 0.65, E.ioC], [23.05, 1.0], [25.4, 1]];
	function pinPos(T) {
		if (T < 18.2) return { x: 1.9 * W, y: 2.6 * H, vis: false };
		if (T < 19.4) {
			const k = clamp((T - 18.2) / 0.55);
			const e = E.outB(k);
			// arc in from the bottom right
			const x = lerp(1.9 * W, W, e) + Math.sin(k * Math.PI) * -60;
			const y = lerp(2.6 * H, 0, e);
			return { x: x + 6 * nz(T * 2, 1) * clamp((T - 18.75) / 0.3), y: y + 5 * nz(T * 2.3, 4) * clamp((T - 18.75) / 0.3), vis: true };
		}
		if (T < 24.9) {
			const x = K(T, [[19.4, W], [19.98, 3.82 * W, E.ioQ], [20.35, L.oX, E.outB], [24.1, L.oX], [24.9, L.endX + 40, E.ioC]]);
			const y = K(T, [[19.4, 0], [19.98, -1.75 * H, E.ioQ], [20.35, L.y, E.outB]]);
			return { x, y, vis: true };
		}
		const c = camAt(T, CAM), c0 = camAt(24.9, CAM);
		return { x: L.endX + 40 + (c.x - c0.x), y: L.y, vis: true };
	}
	cue(18.75, 'whoosh', 0.45, 18.2); cue(18.75, 'blip', 3); cue(19.95, 'whoosh', 0.9, 19.38); cue(20.35, 'blip', 4);
	cue(20.82, 'slam'); cue(21.3, 'whoosh', 0.3, 21.1); cue(23.05, 'whoosh', 1, 22.55); cue(23.05, 'hit');
	cue(25.3, 'whoosh', 1.1, 24.9);

	function update(T) {
		const vis = T >= 14.55 && T < 25.32; show(root, vis); if (!vis) return null;
		if (!L) layout();
		if (!CAM) CAM = cam();
		const c = camAt(T, CAM);
		setT(w, camTf(c));
		const gb = tw(T, 14.55, 15.2, 0, 1);
		root.style.background = `rgb(${lerp(242, 251, gb) | 0},${lerp(242, 251, gb) | 0},${lerp(242, 251, gb) | 0})`;
		lines.forEach((l) => {
			const k = tw(T, l.t, l.t + 1.0, 0, 1, E.outC);
			l.e.style.transformOrigin = l.v ? `50% ${l.o * 100}%` : `${l.o * 100}% 50%`;
			l.e.style.transform = l.v ? `scaleY(${k})` : `scaleX(${k})`;
		});
		tiles.forEach((tl) => {
			const on = T >= tl.t; show(tl.e, on);
			if (on && tl.t > 0) {
				const k = clamp((T - tl.t) / 0.16);
				tl.e.style.transform = `scale(${lerp(0.82, 1, E.outB(k))})`;
				tl.e.style.opacity = clamp(k * 2);
			}
		});
		// title
		const ta = 20.6; // letters finish landing on the beat (tau 20.82)
		[pre, post].forEach((e, i) => {
			const a = ta + i * 0.05;
			e.style.opacity = tw(T, a, a + 0.12, 0, 1);
			e.style.transform = `translateY(${tw(T, a, a + 0.22, 30, 0, E.outQ)}px) scale(${tw(T, a, a + 0.22, 1.3, 1, E.outQ)})`;
			e.style.filter = `blur(${tw(T, a, a + 0.2, 10, 0)}px)`;
		});
		kick.style.opacity = tw(T, 20.95, 21.15, 0, 1);
		kick.style.transform = `skewX(-12deg) translateX(${tw(T, 20.95, 21.3, -24, 0, E.outQ)}px)`;
		const sk = tw(T, 21.1, 21.5, 0, 1, E.outQ);
		const ext = tw(T, 24.15, 25.3, 0, 6000, E.inC);
		stripe.style.width = px((W + 92) * sk + ext);
		// pin
		const p = pinPos(T), p2 = pinPos(T - 1 / 60);
		show(pin.p, p.vis);
		const vx = (p.x - p2.x) * 60, vy = (p.y - p2.y) * 60, sp = Math.hypot(vx, vy);
		// arrow direction from recent travel (pure function of T so frames are independent)
		const pb = pinPos(T - 0.12), ddx = p.x - pb.x, ddy = p.y - pb.y;
		const angS = T > 20.3 ? 0 : Math.hypot(ddx, ddy) > 4 ? (Math.atan2(ddy, ddx) * 180) / Math.PI : 180;
		const stt = T < 20.4 ? Math.min(0.9, sp / (1800 / Math.max(c.s, 0.6))) : Math.min(0.12, sp / 9000);
		const ang = Math.atan2(vy, vx);
		pin.p.style.left = px(p.x); pin.p.style.top = px(p.y);
		pin.p.style.transform = `scale(${K(T, [[19.95, 1.75], [20.35, 1, E.outC]])})`;
		pin.disc.style.transform = pin.core.style.transform = `rotate(${ang}rad) scaleX(${1 + stt}) scaleY(${1 / Math.sqrt(1 + stt)})`;
		pin.arrWrap.style.transform = `rotate(${angS}deg)`;
		pin.arrWrap.style.opacity = 1 - clamp(stt * 2);
		return { cam: c, lens: K(T, lens) };
	}
	return { update, get L() { return L; }, SH, PD };
})();

/* ================================================================== SCENE 5/6/7 — speed tunnel, road, post */
const S5 = (() => {
	const root = $('post'), pw = $('postw'), box = $('postimg'), p3 = $('plane3d'), plane = $('plane');
	el('div', 'ground', plane);
	const SH = S4.SH * 3.8, PD = S4.PD * 3.8;
	// speed streaks
	const svgNS = 'http://www.w3.org/2000/svg';
	const sv = document.createElementNS(svgNS, 'svg'); sv.id = 'streaks';
	sv.setAttribute('width', '6000'); sv.setAttribute('height', '1400');
	sv.innerHTML = '<defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#777" stop-opacity="0"/><stop offset=".3" stop-color="#666" stop-opacity=".9"/><stop offset=".75" stop-color="#999" stop-opacity=".7"/><stop offset="1" stop-color="#aaa" stop-opacity="0"/></linearGradient></defs>';
	plane.appendChild(sv);
	const streaks = [];
	for (let i = 0; i < 46; i++) {
		const top = rnd() < 0.5;
		const y = 700 + (top ? -1 : 1) * (SH / 2 + 22 + rnd() * 330);
		const r = document.createElementNS(svgNS, 'rect');
		const len = 500 + rnd() * 1800, th = 1.5 + rnd() * 4;
		r.setAttribute('height', th); r.setAttribute('width', len); r.setAttribute('y', y); r.setAttribute('rx', th / 2);
		r.setAttribute('fill', 'url(#sg)');
		r.setAttribute('opacity', 0.35 + rnd() * 0.65);
		sv.appendChild(r);
		streaks.push({ r, len, x0: rnd() * 6000, v: 2600 + rnd() * 3200 });
	}
	const stripe = el('div', '', plane, { top: px(-SH / 2), height: px(SH) }); stripe.id = 'rstripe';
	// pin with a little thickness so it reads as a puck once the road tilts
	const pinWrap = el('div', '', plane, { position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' });
	const edge = [];
	for (let i = 0; i < 6; i++) edge.push(el('div', '', pinWrap, { position: 'absolute', left: px(-PD / 2), top: px(-PD / 2), width: px(PD), height: px(PD), borderRadius: '50%', background: i < 3 ? '#d9e6fb' : '#0b4fc4', transform: `translateZ(${i * 3}px)` }));
	const pin = makePin(pinWrap, PD);
	pin.p.style.transform = 'translateZ(18px)';
	media(pin.ph, C.pinClip, { pos: '50% 35%' });
	edge.forEach((e) => (e.style.opacity = 0));

	// post chrome (world coords = screen coords before the camera moves)
	const ch = $('pchrome');
	const X0 = 590, BW = 740, BH = 480, BY = 345;
	const pav = el('div', 'av', ch, { left: px(X0), top: px(170) }); avatar(pav);
	const nm = el('div', 'nm', ch, { left: px(X0 + 84), top: px(172) });
	nm.innerHTML = `${C.post.name}<svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.5-.7 2.9 1.2 2.7-2.2 2 .1 3-2.9.6-1.6 2.6-2.8-1.1-2.8 1.1-1.6-2.6-2.9-.6.1-3-2.2-2 1.2-2.7-.7-2.9 2.6-1.5 1-2.8 3 .2z" fill="#1a6dff"/><path d="M7.5 12.2l3 3 6-6.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="fl">• Follow</span>`;
	const ago = el('div', 'ago', ch, { left: px(X0 + 84), top: px(212) }); ago.textContent = C.post.ago;
	const cap = el('div', 'cap', ch, { left: px(X0), top: px(266) });
	const text = C.post.caption, hs = text.indexOf(C.post.highlight), he = hs + C.post.highlight.length;
	const chars = [...text].map((chh, i) => { const s = el('span', '', cap); s.textContent = chh; s.hl = i >= hs && i < he && hs >= 0; return s; });
	const TY0 = 29.32, RATE = 15.5;
	const charT = (i) => TY0 + i / RATE + (text[i - 1] === ' ' ? 0.03 : 0);
	chars.forEach((_, i) => cue(charT(i), 'type', ((i * 7) % 5) / 5));
	let capX = null;
	const caretX = (T) => {
		if (!capX) capX = chars.map((s) => s.offsetLeft + s.offsetWidth);
		const n = clamp(Math.floor((T - TY0) * RATE), 0, chars.length);
		return X0 + (n ? capX[n - 1] : 0);
	};
	const glowT = 31.95;

	cue(26.3, 'shimmer'); cue(27.45, 'whoosh', 0.5, 26.95); cue(28.85, 'whoosh', 0.9, 27.95); cue(29.38, 'whoosh', 0.5, 29.0);
	cue(glowT, 'shine'); cue(32.62, 'end'); cue(25.3, 'wind');

	function update(T) {
		const vis = T >= 25.18; show(root, vis); if (!vis) return null;
		root.style.opacity = tw(T, 25.18, 25.3, 0, 1);
		// streaks
		const sOp = tw(T, 27.3, 27.9, 1, 0);
		sv.style.opacity = sOp;
		if (sOp > 0) streaks.forEach((s) => {
			const x = ((s.x0 - (T - 25) * s.v) % 7000 + 7000) % 7000 - 1000;
			s.r.setAttribute('x', x.toFixed(1));
		});
		sv.style.top = px(-700);
		// pin: photo blooms in, then turns into a solid puck on the road
		pin.ph.style.opacity = K(T, [[26.2, 0], [26.7, 1], [28.25, 1], [28.6, 0]]);
		pin.tint.style.opacity = K(T, [[26.2, 0.9], [27.3, 0], [28.25, 0], [28.6, 1]]);
		edge.forEach((e) => (e.style.opacity = tw(T, 28.0, 28.3, 0, 1)));
		const pS = K(T, [[26.95, 1], [27.5, 1.4, E.outC], [28.7, 1.15, E.ioC]]);
		const hov = 4 * nz(T * 2, 3) * clamp((27.6 - T) / 0.4);
		pinWrap.style.transform = `translate3d(0,${hov}px,0) scale(${pS})`;
		pin.arrWrap.style.transform = `rotate(${tw(T, 27.6, 28.6, 0, 0)}deg)`;
		stripe.style.transform = `scaleY(${K(T, [[26.95, 1], [27.5, 1.12, E.outC]])})`;
		// plane: roll, then tilt into a road
		const rz = K(T, [[27.45, 0], [28.1, -26, E.ioC], [28.75, -78, E.ioC], [29.3, -90, E.outC]]);
		const rx = K(T, [[27.95, 0], [28.75, 63, E.ioC], [29.3, 60, E.outC]]);
		const ty = K(T, [[27.95, 0], [28.75, 150, E.ioC]]);
		const ps = K(T, [[27.95, 1], [28.75, 1.25, E.ioC]]);
		plane.style.transform = `translate3d(0,${ty}px,0) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${ps})`;
		// image box shrinking into the post
		const k = tw(T, 28.85, 29.38, 0, 1, E.ioE);
		const bx = lerp(-OFF, X0, k), by = lerp(-OFF, BY, k), bw = lerp(1920 + 2 * OFF, BW, k), bh = lerp(1080 + 2 * OFF, BH, k);
		Object.assign(box.style, { left: px(bx), top: px(by), width: px(bw), height: px(bh), borderRadius: px(lerp(0, 28, k)) });
		const sc = Math.max(bw / 2160, bh / 1320);
		p3.style.transform = `translate(${bw / 2 - 1080 * sc}px,${bh / 2 - 660 * sc}px) scale(${sc})`;
		// chrome + typing
		ch.style.opacity = tw(T, 29.0, 29.3, 0, 1);
		ch.style.transform = `translateY(${tw(T, 29.0, 29.5, 40, 0, E.outQ)}px)`;
		chars.forEach((s, i) => {
			const on = T >= charT(i);
			s.className = on ? 'on' : '';
			if (s.hl) {
				const g = tw(T, glowT, glowT + 0.25, 0, 1, E.outC), pulse = g * (0.85 + 0.15 * Math.sin((T - glowT) * 9));
				s.style.color = `rgb(255,${lerp(255, 250, g) | 0},${lerp(255, 120, g) | 0})`;
				s.style.textShadow = g > 0 ? `0 0 ${8 + 10 * pulse}px rgba(226,255,60,${0.85 * pulse}), 0 0 ${2 + 3 * pulse}px rgba(240,255,120,${pulse})` : 'none';
			}
		});
		// camera on the post
		const cx0 = caretX(Math.max(T - 0.25, TY0));
		const follow = Math.max(1010, cx0 - 280);
		const c = camAt(T, [
			[29.3, { x: 960, y: 540, s: 1 }],
			[30.0, { x: 1000, y: 268, s: 2.15 }, E.ioQ],
			[30.8, { x: Math.max(1000, follow - 40), y: 262, s: 2.4 }, E.ioC],
			[31.4, { x: follow, y: 258, s: 2.55 }, E.ioC],
			[33.5, { x: follow + 30, y: 255, s: 2.62 }, E.lin],
		]);
		setT(pw, camTf(c));
		// letterbox opens as the photo blooms in the pin
		return { cam: c, lens: K(T, [[25.2, 1], [27.3, 1], [27.9, 0.35], [28.85, 0.15], [29.3, 0]]) };
	}
	return { update };
})();

/* ================================================================== compositor */
const bars = [$('barT'), $('barB')], black = $('black');
function probeAt(T) {
	// whichever scene is on top supplies the motion used for blur and the lens amount
	const r = [S1.update(T), S2.update(T), S4.update(T), S5.update(T)];
	return r[3] || r[2] || r[1] || r[0];
}
let lastLens = 0;
function blurBetween(a, b) {
	if (!a || !b) return [0, 0];
	if (a.cam && b.cam) {
		const z = Math.abs(Math.log(b.cam.s / a.cam.s)) * 960;
		return [(Math.abs(b.cam.x - a.cam.x) * b.cam.s + z * 0.5) / 2.2, (Math.abs(b.cam.y - a.cam.y) * b.cam.s + z * 0.5) / 2.2];
	}
	if (a.scr && b.scr) {
		const z = Math.abs(Math.log(b.scr.s / a.scr.s)) * 700;
		return [(Math.abs(b.scr.x - a.scr.x) + z * 0.5) / 2.2, (Math.abs(b.scr.y - a.scr.y) + z * 0.5) / 2.2];
	}
	return [0, 0];
}
function update(Tout) {
	pending = [];
	const T = Ttotau(Tout);
	const prev = probeAt(Ttotau(Tout - 0.5 / FPS)); // half-frame shutter
	const cur = probeAt(T);
	const [bx, by] = blurBetween(prev, cur);
	let lens = cur && cur.lens != null ? cur.lens : T < 7.0 ? K(T, [[1.98, 0], [2.62, 1, E.ioC], [4.75, 1], [5.4, 0.5], [6.55, 0.5], [7.0, 0.4]]) : 0;
	setFX(bx, by, lens);
	updateMedia(T);
	// letterbox
	const bk = K(T, [[22.62, 0], [23.0, 1, E.ioQ], [27.2, 1], [27.55, 0, E.ioQ]]);
	bars[0].style.transform = `translateY(${-132 * (1 - bk)}px)`;
	bars[1].style.top = px(1080 - 132 * bk);
	black.style.opacity = tw(Tout, 68 * BEAT - 0.02, 68 * BEAT + 0.03, 0, 1, E.lin);
	// beat pump: the whole frame kicks with the music from the drop on (harder on each bar's downbeat)
	const n = Tout / BEAT, k = Math.floor(n + 1e-6), ph = (n - k) * BEAT;
	let pump = 0;
	if (k >= 32 && k < 68) pump = (k % 4 === 0 ? 0.02 : 0.009) * Math.exp(-ph / 0.11);
	else if (k >= 2 && k < 32) pump = 0.0035 * Math.exp(-ph / 0.09);
	pump += 0.055 * Math.exp(-Math.max(0, Tout - 32 * BEAT) / 0.16) * (Tout >= 32 * BEAT ? 1 : 0);
	frame.style.transform = pump > 0.0004 ? `scale(${(1 + pump).toFixed(5)})` : 'none';
}

window.CUES = CUES.map((c) => ({ t: +tauToT(c.tau).toFixed(4), t0: c.t0tau == null ? null : +tauToT(c.t0tau).toFixed(4), k: c.k, v: c.v })).sort((a, b) => a.t - b.t);
window.BEAT = BEAT;
window.DURATION = DUR;
window.FPS = FPS;
window.renderFrame = async (T) => { update(T); await Promise.all(pending); };
window.READY = (async () => {
	await Promise.all(['500 40px Inter', '700 30px Inter', '800 118px Inter', '30px Anton'].map((f) => document.fonts.load(f)));
	await document.fonts.ready;
	await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
	update(0);
	return true;
})();

// dev scrubber when opened directly in a browser
if (!/render/.test(location.search)) {
	document.body.classList.add('dev');
	const sc = $('scrub'), lb = $('tlabel'), bt = $('play');
	const q = new URLSearchParams(location.search).get('t');
	let playing = false, t0 = 0, s0 = 0;
	const go = (t) => { sc.value = t; lb.textContent = (+t).toFixed(2); update(+t); };
	sc.oninput = () => go(sc.value);
	bt.onclick = () => { playing = !playing; t0 = performance.now(); s0 = +sc.value; bt.textContent = playing ? 'pause' : 'play'; if (playing) loop(); };
	const loop = () => { if (!playing) return; let t = s0 + (performance.now() - t0) / 1000; if (t > DUR) { t = 0; t0 = performance.now(); s0 = 0; } go(t); requestAnimationFrame(loop); };
	window.READY.then(() => go(q || 0));
}
})();
