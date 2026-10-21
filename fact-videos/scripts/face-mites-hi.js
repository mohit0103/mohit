// Hindi reel: "Face mites live on your face" - character-driven, original SVG art. Narration: Gemini (Fenrir).
window.REEL = (function () {
	const SKIN = '#ffb98a', INK = '#111';
	// Demodex is a worm-shaped mite: long striped body, eight stubby legs near the head. (viewBox -220 -120 440 240)
	const NEAR = [0, 1, 2, 3].map(i => [24 + i * 30, 40, 20 + i * 30, 70, 14 + i * 30, 100]);
	const FAR = [0, 1, 2, 3].map(i => [42 + i * 30, 36, 44 + i * 30, 66, 50 + i * 30, 92]);
	const legList = () => [...NEAR.map((L, i) => [L, i]), ...FAR.map((L, i) => [L, i + 4])];
	const legSvg = (list, fill) => list.map(([L]) => `<g class="lg" data-ax="${L[0]}" data-ay="${L[1]}"><path d="M${L[0]} ${L[1]} Q${L[2]} ${L[3]} ${L[4]} ${L[5]}" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M${L[0]} ${L[1]} Q${L[2]} ${L[3]} ${L[4]} ${L[5]}" fill="none" stroke="${fill}" stroke-width="10" stroke-linecap="round"/><circle cx="${L[4]}" cy="${L[5]}" r="9" fill="${fill}" stroke="${INK}" stroke-width="5"/></g>`).join('');
	const CAP = 'M-165 -8 C -165 -44, -120 -62, -60 -62 L 70 -62 C 120 -62, 160 -44, 164 -8 C 160 28, 120 46, 70 46 L -60 46 C -120 46, -165 28, -165 -8 Z';
	const mite = (acc = '') => `<svg viewBox="-220 -120 440 240" width="100%" height="100%">
		${legSvg(legList().slice(4), '#cbb184')}
		<g class="bd"><path d="${CAP}" fill="${INK}" transform="translate(10 10)"/><path d="${CAP}" fill="#f2e3c4" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
		<path d="M-130 -56 Q-100 -8 -130 40 M-96 -60 Q-66 -8 -96 44 M-62 -61 Q-32 -8 -62 45 M-28 -61 Q2 -8 -28 45 M6 -61 Q36 -8 6 45" fill="none" stroke="#c9ae7e" stroke-width="8" stroke-linecap="round"/>
		<circle cx="84" cy="20" r="14" fill="#ff8fb1" opacity="0.65"/>
		<g class="eyes"><circle cx="96" cy="-22" r="25" fill="#fff" stroke="${INK}" stroke-width="7"/><circle cx="136" cy="-16" r="21" fill="#fff" stroke="${INK}" stroke-width="7"/>
		<g class="pupils"><circle cx="102" cy="-18" r="11" fill="${INK}"/><circle cx="141" cy="-13" r="9" fill="${INK}"/><circle cx="106" cy="-23" r="4" fill="#fff"/></g></g>
		<path class="ms" d="M104 22 Q124 40 146 20" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
		<ellipse class="mo" cx="126" cy="28" rx="12" ry="15" fill="${INK}" opacity="0"/></g>
		${legSvg(legList().slice(0, 4), '#e8d3ad')}
		${acc.includes('case') ? `<g class="acc"><rect x="120" y="70" width="62" height="44" rx="8" fill="#b8693a" stroke="${INK}" stroke-width="7"/><path d="M140 70 v-12 h22 v12" fill="none" stroke="${INK}" stroke-width="7"/></g>` : ''}
		${acc.includes('bow') ? `<g class="acc"><path d="M70 50 L 38 32 V 70 Z M70 50 L 102 32 V 70 Z" fill="#ff4fd8" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/><circle cx="70" cy="50" r="9" fill="#ffd23c" stroke="${INK}" stroke-width="5"/></g>` : ''}
		${acc.includes('flower') ? `<g class="acc"><path d="M168 40 V-50" stroke="#2e9b3e" stroke-width="9" stroke-linecap="round"/><g fill="#ff4fd8" stroke="${INK}" stroke-width="5"><circle cx="168" cy="-82" r="13"/><circle cx="186" cy="-66" r="13"/><circle cx="150" cy="-66" r="13"/><circle cx="168" cy="-50" r="13"/></g><circle cx="168" cy="-66" r="10" fill="#ffd23c" stroke="${INK}" stroke-width="5"/></g>` : ''}
		${acc.includes('shades') ? `<g class="shades" opacity="0"><rect x="66" y="-48" width="58" height="40" rx="13" fill="${INK}"/><rect x="118" y="-42" width="50" height="36" rx="12" fill="${INK}"/><path d="M122 -30 H126" stroke="${INK}" stroke-width="8"/><path d="M76 -34 h18 M128 -28 h14" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6"/></g>` : ''}
		</svg>`;

	// big cartoon face (viewBox -300 -380 600 760): lids (.lid), pupils, brows, mouth variants (.mS .mO .mZ), pores
	const face = (o = {}) => `<svg viewBox="-300 -380 600 760" width="100%" height="100%">
		<ellipse cx="-258" cy="40" rx="40" ry="62" fill="${SKIN}" stroke="${INK}" stroke-width="11"/><ellipse cx="258" cy="40" rx="40" ry="62" fill="${SKIN}" stroke="${INK}" stroke-width="11"/>
		<ellipse rx="252" ry="318" fill="${INK}" transform="translate(14 14)"/><ellipse rx="252" ry="318" fill="${SKIN}" stroke="${INK}" stroke-width="12"/>
		<path d="M-236 -120 C -250 -300, 250 -300, 236 -120 C 200 -210, -200 -210, -236 -120 Z" fill="#2b1a12" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
		<g fill="#e9966a" opacity="0.55">${[[-170, 100], [-150, 150], [-195, 140], [170, 100], [150, 150], [195, 140], [-40, -150], [40, -165], [0, -120], [-80, 120], [80, 120]].map(([x, y]) => `<circle class="pore" cx="${x}" cy="${y}" r="7"/>`).join('')}</g>
		<g class="lashes" stroke="${INK}" stroke-width="9" stroke-linecap="round">${[-150, -125, -100, -75, -50].map((x, i) => `<path d="M${x} ${-76 + Math.abs(i - 2) * 6} l ${(i - 2) * -7} -26"/>`).join('')}${[50, 75, 100, 125, 150].map((x, i) => `<path d="M${x} ${-76 + Math.abs(i - 2) * 6} l ${(i - 2) * 7} -26"/>`).join('')}</g>
		${[-100, 100].map(cx => `<ellipse cx="${cx}" cy="-40" rx="56" ry="44" fill="#fff"/>`).join('')}
		<g class="pupils"><circle cx="-100" cy="-38" r="22" fill="${INK}"/><circle cx="100" cy="-38" r="22" fill="${INK}"/><circle cx="-93" cy="-46" r="7" fill="#fff"/><circle cx="107" cy="-46" r="7" fill="#fff"/></g>
		${[-100, 100].map(cx => `<ellipse class="lid" data-cx="${cx}" data-top="-84" cx="${cx}" cy="-40" rx="56" ry="44" fill="${SKIN}" opacity="${o.closed ? 1 : 0}"/>`).join('')}
		${[-100, 100].map(cx => `<ellipse cx="${cx}" cy="-40" rx="56" ry="44" fill="none" stroke="${INK}" stroke-width="9"/><path class="shut" d="M${cx - 52} -34 Q${cx} 4 ${cx + 52} -34" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" opacity="${o.closed ? 1 : 0}"/>`).join('')}
		<g class="brows" stroke="${INK}" stroke-width="16" stroke-linecap="round" fill="none"><path d="M-160 -122 Q-100 -150 -42 -122"/><path d="M42 -122 Q100 -150 160 -122"/></g>
		<path d="M-18 -10 C -50 60, -70 90, -48 112 C -20 130, 20 130, 48 112 C 70 90, 50 60, 18 -10" fill="${SKIN}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
		<ellipse cx="-24" cy="106" rx="11" ry="8" fill="${INK}"/><ellipse cx="24" cy="106" rx="11" ry="8" fill="${INK}"/>
		<path class="mS" d="M-80 196 Q0 262 80 196" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
		<ellipse class="mO" cx="0" cy="214" rx="40" ry="52" fill="${INK}" opacity="0"/>
		<ellipse class="mZ" cx="0" cy="214" rx="34" ry="24" fill="${INK}" opacity="0"/>
		<path class="mF" d="M-60 214 H60" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" opacity="0"/>
		<g class="sweat" opacity="0"><path d="M214 -150 C 232 -122, 240 -108, 240 -96 C 240 -78, 228 -70, 214 -70 C 200 -70, 188 -78, 188 -96 C 188 -108, 196 -122, 214 -150 Z" fill="#3ce7ff" stroke="${INK}" stroke-width="8"/></g></svg>`;

	const burst = `<svg viewBox="-250 -250 500 500" width="100%" height="100%"><polygon points="${Array.from({length: 24}, (_, i) => { const a = i * Math.PI / 12, r = i % 2 ? 130 : 240; return (Math.cos(a) * r).toFixed(0) + ',' + (Math.sin(a) * r).toFixed(0); }).join(' ')}" fill="#ffd23c" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/><circle r="84" fill="#ff7a45" stroke="${INK}" stroke-width="8"/></svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || INK};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}
	function cardPx(ctx, html, cx, cy, o = {}) {
		const c = card(ctx, html, cx, cy, o);
		const w = c.offsetWidth, h = c.offsetHeight;
		c.style.left = (cx - w / 2) + 'px'; c.style.top = (cy - h / 2) + 'px'; c.style.transform = 'rotate(' + (o.rot ?? -3) + 'deg)';
		return c;
	}
	function cardSeq(ctx, list, y = 1120) {
		let prev = null;
		list.forEach(([html, t, o], i) => {
			const c = cardPx(ctx, html, 540, y, Object.assign({rot: i % 2 ? 3 : -3, bg: i % 2 ? '#fff' : '#c6ff3d'}, o || {}));
			if (prev) ctx.tl.set(prev, {autoAlpha: 0}, t - 0.05);
			ctx.M.slam(c, t - (prev ? 0.05 : 0));
			prev = c;
		});
	}
	const plain = (txt, x, y, size, col, rot = -3) => `<div style="position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%) rotate(${rot}deg);font-size:${size}px;font-family:Bricolage,Baloo,sans-serif;font-weight:800;color:${col};white-space:nowrap;z-index:6">${txt}</div>`;

	// ---- helpers -------------------------------------------------------------------------------
	function placeFace(ctx, L, T, W, o) {
		const k = W / 600, H = 760 * k;
		const e = ctx.el(`<div class="ill" style="left:${L}px;top:${T}px;width:${W}px;height:${H}px;z-index:3">${face(o)}</div>`, ctx.stage);
		e.querySelectorAll('.lid').forEach(l => ctx.tl.set(l, {scaleY: o && o.closed ? 1 : 0, svgOrigin: `${l.dataset.cx} ${l.dataset.top}`}, 0));
		return {e, k, fp: (x, y) => [L + (x + 300) * k, T + (y + 380) * k]};
	}
	const lidTo = (ctx, f, t, v, d = 0.12) => { f.e.querySelectorAll('.lid').forEach(l => { ctx.tl.set(l, {opacity: 1}, t); ctx.tl.to(l, {scaleY: v, duration: d}, t); }); f.e.querySelectorAll('.shut').forEach(l => ctx.tl.set(l, {opacity: v >= 0.99 ? 1 : 0}, t + d)); };
	const blink = (ctx, f, t) => f.e.querySelectorAll('.lid').forEach(l => { ctx.tl.set(l, {opacity: 1}, t); ctx.tl.to(l, {scaleY: 1, duration: 0.07, yoyo: true, repeat: 1}, t); });
	const look = (ctx, f, t, x, y, d = 0.18) => ctx.tl.to(f.e.querySelector('.pupils'), {x, y, duration: d, ease: 'power2.out'}, t);
	const mouth = (ctx, f, t, which) => ['mS', 'mO', 'mZ', 'mF'].forEach(c => ctx.tl.set(f.e.querySelector('.' + c), {opacity: c === 'm' + which ? 1 : 0}, t));
	const brows = (ctx, f, t, y) => ctx.tl.to(f.e.querySelector('.brows'), {y, duration: 0.15, ease: 'back.out(2)'}, t);
	function miteAt(ctx, cx, cy, w, acc, z = 5) {
		const h = w * 240 / 440;
		return ctx.el(`<div class="ill" style="left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;z-index:${z}">${mite(acc)}</div>`, ctx.stage);
	}
	function walk(ctx, m, t, dur, speed = 0.2) {
		m.querySelectorAll('.lg').forEach((g, i) => ctx.tl.fromTo(g, {rotation: -9}, {rotation: 9, svgOrigin: `${g.dataset.ax} ${g.dataset.ay}`, duration: speed + (i % 2) * 0.04, yoyo: true, repeat: Math.ceil(dur / speed), ease: 'sine.inOut', immediateRender: false}, t));
	}
	const popUp = (ctx, e, t, from = 0.2) => { ctx.tl.fromTo(e, {scale: from, autoAlpha: 0, transformOrigin: '50% 100%'}, {scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.2)'}, t); ctx.cue('pop', t, 0.8); };
	const drift = (ctx, to = 1.06, oy = '50% 55%') => ctx.tl.fromTo(ctx.stage, {scale: 1, transformOrigin: oy}, {scale: to, duration: ctx.dur, ease: 'none', immediateRender: false}, ctx.start);

	return {
		// 1. a giant bored face, then a tiny tenant steps out of a pore
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 230, 290, 620);
			M.pop(f.e, start + 0.05, {from: 0.7});
			M.float(f.e, start + 0.6, dur, {amp: 6, period: 1.2});
			look(ctx, f, start + 0.2, 0, 0);
			blink(ctx, f, start + 0.8);
			brows(ctx, f, at('अभी'), -22);
			const t = at('किरायेदार');
			const [mx, my] = f.fp(185, 150);
			const m = miteAt(ctx, mx + 30, my + 40, 230, 'case');
			popUp(ctx, m, t - 0.15, 0.1);
			walk(ctx, m, t, dur, 0.16);
			tl.fromTo(m.querySelectorAll('.lg')[0], {rotation: -30}, {rotation: 30, duration: 0.22, yoyo: true, repeat: 9, ease: 'sine.inOut', immediateRender: false}, t + 0.3);
			look(ctx, f, t, 22, 20, 0.12);
			mouth(ctx, f, t, 'O');
			tl.fromTo(f.e.querySelector('.sweat'), {opacity: 0, y: -20}, {opacity: 1, y: 30, duration: 0.5}, t + 0.3);
			M.shake(f.e, t, {amp: 5, n: 5});
			ctx.cue('snap', t, 0.9);
			cardSeq(ctx, [['<span class="hl">किरायेदार</span>!', t - 0.05, {size: 96}]]);
			drift(ctx, 1.05);
		},

		// 2. the tenant, up close: eight legs counted one by one
		legs(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const W = 700, H = W * 240 / 440, L = 190, T = 520;
			const m = el(`<div class="ill" style="left:${L}px;top:${T}px;width:${W}px;height:${H}px;z-index:3">${mite('bow')}</div>`, stage);
			M.stretch(m, start + 0.05);
			walk(ctx, m, start + 0.5, dur, 0.22);
			M.float(m, start + 0.6, dur, {amp: 8, period: 1});
			const t = at('आठ');
			legList().forEach(([Lg, i], k) => {
				const px = L + (Lg[4] + 220) * (W / 440), py = T + (Lg[5] + 120) * (H / 240);
				const by = py + (k % 2 ? 100 : 40);
				const b = el(`<div class="ill" style="left:${px - 26}px;top:${by - 26}px;width:52px;height:52px;z-index:7"><svg viewBox="-30 -30 60 60" width="100%" height="100%"><circle r="26" fill="#ff4fd8" stroke="${INK}" stroke-width="6"/><text y="11" font-size="32" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="#fff">${k + 1}</text></svg></div>`, stage);
				const tk = t - 0.05 + k * 0.13;
				M.pop(b, tk, {from: 0.1, sfx: false});
				ctx.cue('tick', tk, 0.7);
			});
			cardSeq(ctx, [['<span class="hl">8</span> पैर', t - 0.05, {size: 110}]]);
			drift(ctx, 1.05);
		},

		// 3. nine heads out of ten wear a tenant
		percent(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const t = at('नब्बे');
			const num = el(plain('<span class="n">0</span>%+', 540, 330, 150, '#111'), stage);
			M.pop(num, t - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), t - 0.2, 0, 90, 1.0, v => Math.round(v));
			for (let i = 0; i < 10; i++) {
				const x = 140 + (i % 5) * 200, y = 560 + Math.floor(i / 5) * 270;
				const h = el(`<div class="ill" style="left:${x - 85}px;top:${y - 95}px;width:170px;height:190px"><svg viewBox="-85 -95 170 190" width="100%" height="100%"><circle r="78" fill="${INK}" transform="translate(7 7)"/><circle r="78" fill="${SKIN}" stroke="${INK}" stroke-width="8"/><circle cx="-26" cy="-8" r="9" fill="${INK}"/><circle cx="26" cy="-8" r="9" fill="${INK}"/><path d="${i === 9 ? 'M-24 34 H24' : 'M-26 28 Q0 52 26 28'}" stroke="${INK}" stroke-width="8" fill="none" stroke-linecap="round"/></svg></div>`, stage);
				M.pop(h, start + 0.1 + i * 0.05, {from: 0.3, sfx: i === 0});
				if (i < 9) {
					const m = miteAt(ctx, x, y - 96, 150, '', 6);
					popUp(ctx, m, t + i * 0.1, 0.1);
					walk(ctx, m, t + i * 0.1, dur, 0.2);
				} else {
					tl.to(h, {x: 6, duration: 0.08, yoyo: true, repeat: 7}, t + 1.2);
				}
			}
			ctx.cue('chime', t + 0.9, 0.7);
			cardSeq(ctx, [['<span class="hl">9</span> / 10 लोग', at('लोगों') - 0.05, {size: 96}]]);
			drift(ctx, 1.04);
		},

		// 4. three favourite addresses on the face
		where(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 230, 290, 620);
			M.pop(f.e, start + 0.05, {from: 0.7});
			M.float(f.e, start + 0.6, dur, {amp: 5, period: 1.3});
			blink(ctx, f, start + 0.9);
			const spots = [
				['नाक', at('नाक'), f.fp(-70, 118), [0, 18], 'right', 960, 700],
				['माथा', at('माथे'), f.fp(0, -168), [0, -18], 'right', 960, 470],
				['पलकें', at('पलकों'), f.fp(-100, -98), [-20, -20], 'left', 120, 560],
			];
			spots.forEach(([name, t, [px, py], [lx, ly], side, tx, ty], i) => {
				const m = miteAt(ctx, px, py - 34, 200, '', 6);
				popUp(ctx, m, t, 0.1);
				walk(ctx, m, t, dur, 0.2);
				look(ctx, f, t, lx, ly, 0.15);
				const tag = cardPx(ctx, name, tx, ty, {bg: i % 2 ? '#fff' : '#ff4fd8', size: 58, rot: side === 'left' ? -6 : 6});
				M.slideIn(tag, t, {from: side});
				const ring = el(`<div class="ill" style="left:${px - 70}px;top:${py - 70}px;width:140px;height:140px;z-index:4"><svg viewBox="-70 -70 140 140" width="100%" height="100%"><circle r="50" fill="none" stroke="#fff" stroke-width="10"/></svg></div>`, stage);
				tl.fromTo(ring, {scale: 0.3, autoAlpha: 1}, {scale: 1.6, autoAlpha: 0, duration: 0.6, ease: 'power2.out'}, t);
			});
			mouth(ctx, f, at('नाक'), 'F');
			drift(ctx, 1.05, '50% 40%');
		},

		// 5. dinner is free
		food(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const W = 560, H = W * 240 / 440;
			const m = el(`<div class="ill" style="left:80px;top:600px;width:${W}px;height:${H}px;z-index:4">${mite('')}</div>`, stage);
			M.pop(m, start + 0.05, {from: 0.3});
			walk(ctx, m, start + 0.5, dur, 0.25);
			const bd = m.querySelector('.bd');
			// puddle of oil
			const oil = el(`<div class="ill" style="left:560px;top:760px;width:420px;height:200px;z-index:3"><svg viewBox="-210 -100 420 200" width="100%" height="100%"><ellipse rx="190" ry="80" fill="${INK}" transform="translate(10 10)"/><ellipse rx="190" ry="80" fill="#ffd23c" stroke="${INK}" stroke-width="9"/><ellipse cx="-70" cy="-22" rx="60" ry="18" fill="#fff" opacity="0.75"/></svg></div>`, stage);
			const tt = at('तेल');
			const drop = el(`<div class="ill" style="left:720px;top:260px;width:100px;height:140px;z-index:5"><svg viewBox="-50 -70 100 140" width="100%" height="100%"><path d="M0 -62 C 22 -24, 40 -6, 40 14 C 40 40, 22 56, 0 56 C -22 56, -40 40, -40 14 C -40 -6, -22 -24, 0 -62 Z" fill="#ffd23c" stroke="${INK}" stroke-width="9"/><path d="M-18 6 C -20 -8, -12 -20, -4 -28" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.8"/></svg></div>`, stage);
			tl.fromTo(drop, {y: -200, autoAlpha: 0}, {y: 480, autoAlpha: 1, duration: 0.55, ease: 'power2.in'}, tt - 0.45);
			tl.to(drop, {autoAlpha: 0, duration: 0.05}, tt + 0.1);
			tl.fromTo(oil, {scale: 1, transformOrigin: '50% 50%'}, {scale: 1.12, duration: 0.15, yoyo: true, repeat: 1}, tt + 0.1);
			ctx.cue('snap', tt + 0.08, 0.9);
			// straw + slurps
			const straw = el(`<div class="ill" style="left:0;top:560px;width:1080px;height:420px;z-index:6"><svg viewBox="0 0 1080 420" width="100%" height="100%"><path class="st" d="M515 218 C 600 120, 740 130, 775 285" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="round"/><path class="st" d="M515 218 C 600 120, 740 130, 775 285" fill="none" stroke="#ff4fd8" stroke-width="12" stroke-linecap="round"/></svg></div>`, stage);
			straw.querySelectorAll('.st').forEach(p => M.draw(p, tt + 0.3, 0.5, {ease: 'power2.out'}));
			for (let k = 0; k < 3; k++) {
				tl.to(m.querySelector('.bd'), {scale: 1.1 + k * 0.08, svgOrigin: '0 0', duration: 0.25, ease: 'back.out(2)'}, tt + 0.9 + k * 0.45);
				ctx.cue('fill', tt + 0.9 + k * 0.45, 0.6);
			}
			// the price tag: Rs 0
			const f0 = at('फ्री');
			const tag = el(`<div class="ill" style="left:640px;top:280px;width:340px;height:240px;z-index:7;transform-origin:50% 0%"><svg viewBox="0 0 340 240" width="100%" height="100%"><path d="M170 0 V40" stroke="${INK}" stroke-width="8"/><path d="M40 60 H300 V210 H40 L8 135 Z" fill="${INK}" transform="translate(9 9)"/><path d="M40 60 H300 V210 H40 L8 135 Z" fill="#c6ff3d" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><circle cx="52" cy="135" r="10" fill="#fff" stroke="${INK}" stroke-width="6"/><text x="180" y="170" font-size="104" text-anchor="middle" font-family="Bricolage" font-weight="800">₹0</text></svg></div>`, stage);
			tl.fromTo(tag, {rotation: -40, y: -300, autoAlpha: 0}, {rotation: 0, y: 0, autoAlpha: 1, duration: 0.8, ease: 'elastic.out(1,0.35)'}, f0 - 0.15);
			cardSeq(ctx, [['चेहरे का <span class="hl">तेल</span>', tt - 0.05, {size: 84}]], 1110);
			drift(ctx, 1.04);
		},

		// 6. night shift: the tenants go on a date while the face sleeps
		night(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 230, 330, 620, {closed: false});
			M.pop(f.e, start + 0.05, {from: 0.7});
			const moon = el(`<div class="ill" style="left:790px;top:250px;width:230px;height:230px;z-index:2"><svg viewBox="-110 -110 220 220" width="100%" height="100%"><circle r="92" fill="#fff7d0" stroke="${INK}" stroke-width="9"/><circle cx="26" cy="-10" r="82" fill="#111"/><circle cx="-24" cy="-40" r="9" fill="#f0e2a8"/><circle cx="-40" cy="10" r="12" fill="#f0e2a8"/></svg></div>`, stage);
			const r = at('रात');
			M.pop(moon, r - 0.2, {from: 0.2});
			M.float(moon, r + 0.5, dur, {amp: 10, period: 1.4});
			const s = at('सो');
			lidTo(ctx, f, s, 1, 0.25);
			mouth(ctx, f, s + 0.2, 'Z');
			look(ctx, f, s, 0, 8, 0.2);
			['z', 'Z', 'Z'].forEach((ch, i) => {
				const z = el(plain(ch, 160 + i * 36, 470 - i * 70, 70 + i * 26, '#fff', -8), stage);
				tl.fromTo(z, {y: 0, autoAlpha: 0}, {y: -80, autoAlpha: 1, duration: 1.0, ease: 'sine.out', repeat: Math.ceil(dur / 1.4), repeatDelay: 0.4}, s + 0.3 + i * 0.45);
			});
			tl.to(f.e.querySelector('.mZ'), {scaleY: 1.5, svgOrigin: '0 214', duration: 0.7, yoyo: true, repeat: Math.ceil(dur / 0.7), ease: 'sine.inOut'}, s + 0.3);
			const b = at('बाहर');
			const [lx, ly] = f.fp(-175, 125), [rx, ry] = f.fp(175, 125), [cx, cy] = f.fp(0, 170);
			const A = miteAt(ctx, lx, ly, 230, 'bow', 6), B = miteAt(ctx, rx, ry, 230, 'flower', 6);
			popUp(ctx, A, b, 0.1); popUp(ctx, B, b + 0.15, 0.1);
			walk(ctx, A, b, dur, 0.2); walk(ctx, B, b + 0.15, dur, 0.2);
			const d = at('डेट');
			tl.to(A, {x: cx - lx - 70, y: cy - ly, duration: 0.7, ease: 'power2.inOut'}, d - 0.2);
			tl.to(B, {x: cx - rx + 70, y: cy - ry, duration: 0.7, ease: 'power2.inOut'}, d - 0.2);
			const heart = el(`<div class="ill" style="left:${cx - 60}px;top:${cy - 190}px;width:120px;height:110px;z-index:8"><svg viewBox="-60 -55 120 110" width="100%" height="100%"><path d="M0 48 C -70 0, -56 -48, -24 -48 C -8 -48, 0 -36, 0 -28 C 0 -36, 8 -48, 24 -48 C 56 -48, 70 0, 0 48 Z" fill="#ff4fd8" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/></svg></div>`, stage);
			popUp(ctx, heart, d + 0.4, 0.1);
			M.float(heart, d + 0.9, dur, {amp: 14, period: 0.8});
			ctx.cue('chime', d + 0.4, 0.8);
			// the sleeper stirs
			lidTo(ctx, f, d + 1.0, 0.55, 0.15);
			look(ctx, f, d + 1.0, 0, 26, 0.15);
			lidTo(ctx, f, d + 1.6, 1, 0.2);
			drift(ctx, 1.05, '50% 45%');
		},

		// 7. harmless, and no exploding
		harmless(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const W = 620, H = W * 240 / 440;
			const m = el(`<div class="ill" style="left:230px;top:560px;width:${W}px;height:${H}px;z-index:4">${mite('shades')}</div>`, stage);
			M.stretch(m, start + 0.05);
			walk(ctx, m, start + 0.5, dur, 0.25);
			M.float(m, start + 0.6, dur, {amp: 8, period: 1});
			const h = at('हानिरहित');
			const sh = el(`<div class="ill" style="left:700px;top:330px;width:260px;height:300px;z-index:7"><svg viewBox="-100 -120 200 240" width="100%" height="100%"><path d="M0 -105 L 90 -70 C 90 30, 60 85, 0 110 C -60 85, -90 30, -90 -70 Z" fill="${INK}" transform="translate(9 9)"/><path d="M0 -105 L 90 -70 C 90 30, 60 85, 0 110 C -60 85, -90 30, -90 -70 Z" fill="#5be36b" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><path d="M-42 0 L -10 34 L 44 -30" fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`, stage);
			popUp(ctx, sh, h - 0.2, 0.1);
			ctx.cue('chime', h, 0.8);
			const f = at('फटते');
			const bu = el(`<div class="ill" style="left:290px;top:430px;width:500px;height:500px;z-index:8"><div style="width:100%;height:100%">${burst}</div></div>`, stage);
			popUp(ctx, bu, f - 0.1, 0.1);
			ctx.cue('punch', f, 1);
			M.shake(stage, f, {amp: 8, n: 7});
			tl.to(bu, {autoAlpha: 0, duration: 0.2}, at('अफवाह') - 0.1);
			const x = el(`<div class="ill" style="left:290px;top:420px;width:500px;height:500px;z-index:9"><svg viewBox="-100 -100 200 200" width="100%" height="100%"><path d="M-72 -72 L 72 72 M72 -72 L -72 72" stroke="#ff3b3b" stroke-width="34" stroke-linecap="round"/></svg></div>`, stage);
			const a = at('अफवाह');
			M.pop(x, a - 0.1, {from: 0.2});
			tl.to(m.querySelector('.shades'), {opacity: 1, duration: 0.05}, a);
			cardSeq(ctx, [['<span class="hl">हानिरहित</span>', h - 0.05, {size: 96}], ['<span class="hl">अफवाह</span>!', a - 0.05, {size: 120, bg: '#ff3b3b', color: '#fff'}]], 1130);
			drift(ctx, 1.04);
		},

		// 8. your call
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = cardPx(ctx, 'रहने दो या <span class="hl">भगाओ</span>?', 540, 320, {bg: '#fff', rot: -3, size: 74});
			M.slam(q, start + 0.1);
			const f = placeFace(ctx, 290, 420, 500);
			M.stretch(f.e, start + 0.2);
			M.float(f.e, start + 0.8, dur, {amp: 8, period: 1});
			const [nx, ny] = f.fp(0, 70);
			const m = miteAt(ctx, nx, ny - 20, 170, '', 6);
			popUp(ctx, m, start + 0.4, 0.1);
			walk(ctx, m, start + 0.5, dur, 0.18);
			const r = at('रहने'), g = at('भगा');
			const A = cardPx(ctx, 'रहने दो', 270, 1110, {bg: '#c6ff3d', size: 84, rot: -6});
			const B = cardPx(ctx, 'भगाओ', 810, 1110, {bg: '#ff4fd8', size: 84, rot: 6});
			M.slideIn(A, r - 0.1, {from: 'left'});
			M.slideIn(B, g - 0.1, {from: 'right'});
			ctx.cue('pop', r, 0.9); ctx.cue('pop', g, 0.9);
			look(ctx, f, r, -24, 10); look(ctx, f, g, 24, 10);
			tl.to(m.querySelector('.eyes'), {y: 4, duration: 0.15}, g);
			M.wobble(A, g + 0.3, dur, {amp: 3, period: 0.5});
			M.wobble(B, g + 0.4, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', g + 0.4, 0.8);
		},
	};
})();
