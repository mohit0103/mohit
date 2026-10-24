// Shared building blocks for character-driven reels (prepended to a reel JS that starts with "// @kit").
// Everything is original SVG; the face is a big cartoon head with lids, pupils, brows, mouth variants,
// eye bags, spiral "dizzy" eyes, a tongue and orbiting stars.
const KIT = (function () {
	const SKIN = '#ffb98a', INK = '#111';
	const spiral = (cx, cy) => {
		const pts = Array.from({length: 61}, (_, i) => { const a = i / 60 * Math.PI * 6, r = 3 + i / 60 * 34; return `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`; });
		return 'M' + pts.join(' L');
	};
	const face = (o = {}) => `<svg viewBox="-300 -380 600 760" width="100%" height="100%">
		<g class="stars" opacity="0">${[0, 120, 240].map(a => `<g transform="rotate(${a} 0 -250)"><polygon points="0,-405 12,-380 40,-378 18,-360 26,-332 0,-348 -26,-332 -18,-360 -40,-378 -12,-380" fill="#ffd23c" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/></g>`).join('')}</g>
		<ellipse cx="-258" cy="40" rx="40" ry="62" fill="${SKIN}" stroke="${INK}" stroke-width="11"/><ellipse cx="258" cy="40" rx="40" ry="62" fill="${SKIN}" stroke="${INK}" stroke-width="11"/>
		<ellipse rx="252" ry="318" fill="${INK}" transform="translate(14 14)"/><ellipse rx="252" ry="318" fill="${SKIN}" stroke="${INK}" stroke-width="12"/>
		<path d="M-236 -120 C -250 -300, 250 -300, 236 -120 C 200 -210, -200 -210, -236 -120 Z" fill="${o.hair || '#2b1a12'}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
		<g class="lashes" stroke="${INK}" stroke-width="9" stroke-linecap="round">${[-150, -125, -100, -75, -50].map((x, i) => `<path d="M${x} ${-76 + Math.abs(i - 2) * 6} l ${(i - 2) * -7} -26"/>`).join('')}${[50, 75, 100, 125, 150].map((x, i) => `<path d="M${x} ${-76 + Math.abs(i - 2) * 6} l ${(i - 2) * 7} -26"/>`).join('')}</g>
		${[-100, 100].map(cx => `<ellipse cx="${cx}" cy="-40" rx="56" ry="44" fill="#fff"/>`).join('')}
		<g class="pupils"><circle cx="-100" cy="-38" r="22" fill="${INK}"/><circle cx="100" cy="-38" r="22" fill="${INK}"/><circle cx="-93" cy="-46" r="7" fill="#fff"/><circle cx="107" cy="-46" r="7" fill="#fff"/></g>
		${[-100, 100].map(cx => `<g class="spir" opacity="0" data-cx="${cx}"><ellipse cx="${cx}" cy="-40" rx="52" ry="40" fill="#fff"/><path d="${spiral(cx, -40)}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/></g>`).join('')}
		${[-100, 100].map(cx => `<ellipse class="lid" data-cx="${cx}" data-top="-84" cx="${cx}" cy="-40" rx="56" ry="44" fill="${SKIN}" opacity="${o.closed ? 1 : 0}"/>`).join('')}
		${[-100, 100].map(cx => `<ellipse cx="${cx}" cy="-40" rx="56" ry="44" fill="none" stroke="${INK}" stroke-width="9"/><path class="shut" d="M${cx - 52} -34 Q${cx} 4 ${cx + 52} -34" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" opacity="${o.closed ? 1 : 0}"/>`).join('')}
		<g class="glasses" opacity="${o.glasses ? 1 : 0}" fill="none" stroke="${INK}" stroke-width="9"><circle cx="-100" cy="-40" r="62"/><circle cx="100" cy="-40" r="62"/><path d="M-38 -44 H38"/></g>
		<g class="bags" opacity="${o.bags ? 1 : 0}" fill="none" stroke="#6b4a8a" stroke-width="12" stroke-linecap="round"><path d="M-148 14 Q-100 44 -52 14"/><path d="M52 14 Q100 44 148 14"/></g>
		<g class="brows" stroke="${INK}" stroke-width="16" stroke-linecap="round" fill="none"><path class="bl" d="M-160 -122 Q-100 -150 -42 -122"/><path class="br" d="M42 -122 Q100 -150 160 -122"/></g>
		<path d="M-18 -10 C -50 60, -70 90, -48 112 C -20 130, 20 130, 48 112 C 70 90, 50 60, 18 -10" fill="${SKIN}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
		<ellipse cx="-24" cy="106" rx="11" ry="8" fill="${INK}"/><ellipse cx="24" cy="106" rx="11" ry="8" fill="${INK}"/>
		<ellipse class="tongue" cx="26" cy="246" rx="30" ry="34" fill="#ff6b8b" stroke="${INK}" stroke-width="8" opacity="0"/>
		<path class="mS" d="M-80 196 Q0 262 80 196" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
		<ellipse class="mO" cx="0" cy="214" rx="40" ry="52" fill="${INK}" opacity="0"/>
		<ellipse class="mZ" cx="0" cy="214" rx="34" ry="24" fill="${INK}" opacity="0"/>
		<path class="mF" d="M-60 214 H60" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" opacity="0"/>
		<path class="mW" d="M-84 210 Q-56 180 -28 210 T 28 210 T 84 210" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" opacity="0"/></svg>`;

	const clock = `<svg viewBox="-130 -130 260 260" width="100%" height="100%"><circle r="110" fill="${INK}" transform="translate(10 10)"/><circle r="110" fill="#fff" stroke="${INK}" stroke-width="10"/>${Array.from({length: 12}, (_, i) => `<line x1="0" y1="-92" x2="0" y2="-78" stroke="${INK}" stroke-width="7" stroke-linecap="round" transform="rotate(${i * 30})"/>`).join('')}<line class="hd" x1="0" y1="0" x2="0" y2="-74" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><line class="hm" x1="0" y1="0" x2="0" y2="-50" stroke="#ff4fd8" stroke-width="12" stroke-linecap="round"/><circle r="11" fill="${INK}"/></svg>`;
	let beakerN = 0;
	const beaker = () => { const id = 'bk' + (++beakerN); return `<svg viewBox="-120 -190 240 380" width="100%" height="100%"><clipPath id="${id}"><path d="M-80 -150 H80 L 70 150 Q 70 170 50 170 H-50 Q-70 170 -70 150 Z"/></clipPath>
		<path d="M-80 -150 H80 L 70 150 Q 70 170 50 170 H-50 Q-70 170 -70 150 Z" fill="${INK}" transform="translate(10 10)"/>
		<path d="M-80 -150 H80 L 70 150 Q 70 170 50 170 H-50 Q-70 170 -70 150 Z" fill="#fff"/>
		<g clip-path="url(#${id})"><rect class="liq" x="-90" y="-150" width="180" height="330" fill="#ffb020"/><ellipse class="foam" cx="0" cy="-150" rx="80" ry="10" fill="#fff3c0"/></g>
		<path d="M-80 -150 H80 L 70 150 Q 70 170 50 170 H-50 Q-70 170 -70 150 Z" fill="none" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
		<g stroke="${INK}" stroke-width="7" stroke-linecap="round"><path d="M-70 -90 H-40 M-70 -30 H-40 M-70 30 H-40 M-70 90 H-40"/></g></svg>`; };

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || INK};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}
	// pixel-positioned card (a percent translate can be disturbed by slide-in tweens)
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
	function placeFace(ctx, L, T, W, o) {
		const k = W / 600, H = 760 * k;
		const e = ctx.el(`<div class="ill" style="left:${L}px;top:${T}px;width:${W}px;height:${H}px;z-index:3">${face(o)}</div>`, ctx.stage);
		e.querySelectorAll('.lid').forEach(l => ctx.tl.set(l, {scaleY: o && o.closed ? 1 : 0, svgOrigin: `${l.dataset.cx} ${l.dataset.top}`}, 0));
		return {e, k, fp: (x, y) => [L + (x + 300) * k, T + (y + 380) * k]};
	}
	const lidTo = (ctx, f, t, v, d = 0.12) => { f.e.querySelectorAll('.lid').forEach(l => { ctx.tl.set(l, {opacity: 1}, t); ctx.tl.to(l, {scaleY: v, duration: d}, t); }); f.e.querySelectorAll('.shut').forEach(l => ctx.tl.set(l, {opacity: v >= 0.99 ? 1 : 0}, t + d)); };
	const blink = (ctx, f, t) => f.e.querySelectorAll('.lid').forEach(l => { ctx.tl.set(l, {opacity: 1}, t); ctx.tl.to(l, {scaleY: 1, duration: 0.07, yoyo: true, repeat: 1}, t); });
	const look = (ctx, f, t, x, y, d = 0.18) => ctx.tl.to(f.e.querySelector('.pupils'), {x, y, duration: d, ease: 'power2.out'}, t);
	const mouth = (ctx, f, t, which) => ['mS', 'mO', 'mZ', 'mF', 'mW'].forEach(c => ctx.tl.set(f.e.querySelector('.' + c), {opacity: c === 'm' + which ? 1 : 0}, t));
	const brows = (ctx, f, t, y) => ctx.tl.to(f.e.querySelector('.brows'), {y, duration: 0.15, ease: 'back.out(2)'}, t);
	const browTilt = (ctx, f, t, deg) => { ctx.tl.to(f.e.querySelector('.bl'), {rotation: deg, svgOrigin: '-100 -130', duration: 0.15}, t); ctx.tl.to(f.e.querySelector('.br'), {rotation: -deg, svgOrigin: '100 -130', duration: 0.15}, t); };
	const bags = (ctx, f, t) => ctx.tl.fromTo(f.e.querySelector('.bags'), {opacity: 0}, {opacity: 1, duration: 0.3}, t);
	// spiral eyes + tongue + orbiting stars: the "dizzy" look
	function dizzy(ctx, f, t, dur) {
		f.e.querySelectorAll('.spir').forEach(g => {
			ctx.tl.set(g, {opacity: 1}, t);
			ctx.tl.fromTo(g, {rotation: 0}, {rotation: 360 * Math.max(2, Math.ceil(dur / 0.8)), svgOrigin: `${g.dataset.cx} -40`, duration: dur, ease: 'none', immediateRender: false}, t);
		});
		ctx.tl.set(f.e.querySelector('.pupils'), {opacity: 0}, t);
		ctx.tl.set(f.e.querySelector('.tongue'), {opacity: 1}, t);
		mouth(ctx, f, t, 'W');
		const st = f.e.querySelector('.stars');
		ctx.tl.set(st, {opacity: 1}, t);
		ctx.tl.fromTo(st, {rotation: 0}, {rotation: 360 * Math.max(1, Math.ceil(dur / 1.5)), svgOrigin: '0 -250', duration: dur, ease: 'none', immediateRender: false}, t);
		ctx.tl.fromTo(f.e, {rotation: -4}, {rotation: 4, duration: 0.5, yoyo: true, repeat: Math.ceil(dur / 0.5), ease: 'sine.inOut', immediateRender: false}, t);
		ctx.cue('chime', t, 0.6);
	}
	const popUp = (ctx, e, t, from = 0.2) => { ctx.tl.fromTo(e, {scale: from, autoAlpha: 0, transformOrigin: '50% 100%'}, {scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.2)'}, t); ctx.cue('pop', t, 0.8); };
	const drift = (ctx, to = 1.06, oy = '50% 55%') => ctx.tl.fromTo(ctx.stage, {scale: 1, transformOrigin: oy}, {scale: to, duration: ctx.dur, ease: 'none', immediateRender: false}, ctx.start);
	const headIcon = (skin = SKIN, droop = false) => `<svg viewBox="-60 -70 120 140" width="100%" height="100%"><circle r="48" fill="${INK}" transform="translate(6 6)"/><circle r="48" fill="${skin}" stroke="${INK}" stroke-width="7"/><g class="ey"><circle cx="-18" cy="-6" r="8" fill="${INK}"/><circle cx="18" cy="-6" r="8" fill="${INK}"/></g>${droop ? `<path class="lids" d="M-30 -10 H-6 M6 -10 H30" stroke="${INK}" stroke-width="9" stroke-linecap="round" opacity="0"/>` : ''}<path d="M-14 22 Q0 32 14 22" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;

	return {browTilt, SKIN, INK, face, clock, beaker, card, cardPx, cardSeq, plain, placeFace, lidTo, blink, look, mouth, brows, bags, dizzy, popUp, drift, headIcon};
})();
