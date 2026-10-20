// Reel: "Your ears make sound" (otoacoustic emissions). All illustrations are original SVG drawings.
window.REEL = (function () {
	const SKIN = '#ffb98a';
	// cartoon ear with a little face
	const ear = (mood = 'happy') => `<svg viewBox="-200 -230 400 460" width="100%" height="100%">
		<path d="M-20 -190 C 120 -200, 180 -60, 120 40 C 90 100, 70 140, 70 190 C 70 225, 20 235, -10 205 C -50 165, -90 125, -100 50 C -120 -40, -90 -170, -20 -190 Z" fill="#111" transform="translate(12 12)"/>
		<path d="M-20 -190 C 120 -200, 180 -60, 120 40 C 90 100, 70 140, 70 190 C 70 225, 20 235, -10 205 C -50 165, -90 125, -100 50 C -120 -40, -90 -170, -20 -190 Z" fill="${SKIN}" stroke="#111" stroke-width="11" stroke-linejoin="round"/>
		<path d="M-10 -135 C 80 -145, 120 -60, 78 12 C 55 52, 28 72, 20 118" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round" opacity="0.55"/>
		<g class="eyes">${mood === 'shades' ? `<rect x="-62" y="-46" width="54" height="36" rx="12" fill="#111"/><rect x="2" y="-46" width="54" height="36" rx="12" fill="#111"/><path d="M-8 -34 H2" stroke="#111" stroke-width="7"/>`
			: `<ellipse cx="-34" cy="-34" rx="19" ry="23" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="22" cy="-34" rx="19" ry="23" fill="#fff" stroke="#111" stroke-width="6"/><g class="pupils"><circle cx="-31" cy="-28" r="8" fill="#111"/><circle cx="25" cy="-28" r="8" fill="#111"/></g>`}</g>
		<path d="M-30 14 Q-6 34 18 14" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
	// spiral cochlea with hair cells (built in JS so it's easy to animate)
	function cochlea() {
		const pts = [], cells = [];
		for (let i = 0; i <= 120; i++) {
			const a = i / 120 * Math.PI * 5, r = 24 + i / 120 * 150;
			pts.push([Math.cos(a) * r, Math.sin(a) * r]);
		}
		const d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
		for (let i = 12; i <= 120; i += 9) cells.push(pts[i]);
		return `<svg viewBox="-200 -200 400 400" width="100%" height="100%">
			<path class="sp" d="${d}" fill="none" stroke="#111" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="${d}" fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
			${cells.map(([x, y], i) => `<g class="hc" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11" fill="#ff4fd8" stroke="#111" stroke-width="5"/></g>`).join('')}</svg>`;
	}
	const mic = `<svg viewBox="-80 -130 160 260" width="100%" height="100%"><rect x="-34" y="-110" width="68" height="120" rx="34" fill="#111" transform="translate(8 8)"/><rect x="-34" y="-110" width="68" height="120" rx="34" fill="#3ce7ff" stroke="#111" stroke-width="9"/>
		<path d="M-34 -70 H34 M-34 -40 H34" stroke="#111" stroke-width="6" opacity="0.5"/><path d="M-56 -20 Q-56 50 0 50 Q56 50 56 -20" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"/><path d="M0 50 V110 M-36 110 H36" stroke="#111" stroke-width="9" stroke-linecap="round"/></svg>`;
	const scientist = `<svg viewBox="-150 -170 300 330" width="100%" height="100%">
		<path d="M-120 160 C -120 70, -70 50, 0 50 C 70 50, 120 70, 120 160 Z" fill="#fff" stroke="#111" stroke-width="9"/><path d="M-30 52 L 0 110 L 30 52" fill="none" stroke="#111" stroke-width="8" stroke-linejoin="round"/>
		<circle r="92" cy="-40" fill="#111" transform="translate(9 9)"/><circle r="92" cy="-40" fill="#e0a070" stroke="#111" stroke-width="9"/>
		<path d="M-86 -62 C -90 -130, 90 -130, 86 -62 C 60 -98, -60 -98, -86 -62 Z" fill="#ddd" stroke="#111" stroke-width="8"/>
		<g class="eyes"><circle cx="-34" cy="-40" r="26" fill="#fff" stroke="#111" stroke-width="7"/><circle cx="34" cy="-40" r="26" fill="#fff" stroke="#111" stroke-width="7"/><path d="M-8 -40 H8" stroke="#111" stroke-width="7"/>
		<g class="pupils"><circle cx="-30" cy="-36" r="9" fill="#111"/><circle cx="38" cy="-36" r="9" fill="#111"/></g></g>
		<path d="M-24 10 Q0 30 24 10" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
	const head = (col) => `<svg viewBox="-60 -70 120 140" width="100%" height="100%"><circle class="hd" r="46" fill="${col}" stroke="#111" stroke-width="7"/><ellipse cx="-50" cy="4" rx="11" ry="17" fill="#ffb98a" stroke="#111" stroke-width="6"/><ellipse cx="50" cy="4" rx="11" ry="17" fill="#ffb98a" stroke="#111" stroke-width="6"/>
		<circle cx="-16" cy="-8" r="7" fill="#111"/><circle cx="16" cy="-8" r="7" fill="#111"/><path d="M-14 20 Q0 32 14 20" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;
	const baby = `<svg viewBox="-170 -170 340 320" width="100%" height="100%">
		<ellipse cx="108" cy="8" rx="22" ry="34" fill="#ffd4a8" stroke="#111" stroke-width="8"/>
		<circle r="105" fill="#111" transform="translate(9 9)"/><circle r="105" fill="#ffd4a8" stroke="#111" stroke-width="9"/>
		<path d="M-8 -100 C -30 -150, 30 -165, 22 -128 C 16 -108, -2 -116, 6 -126" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"/>
		<circle cx="-62" cy="30" r="22" fill="#ff8fb1" opacity="0.7"/><circle cx="62" cy="30" r="22" fill="#ff8fb1" opacity="0.7"/>
		<g class="eyes"><ellipse cx="-34" cy="-10" rx="24" ry="30" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="34" cy="-10" rx="24" ry="30" fill="#fff" stroke="#111" stroke-width="6"/>
		<g class="pupils"><circle cx="-30" cy="-2" r="14" fill="#111"/><circle cx="38" cy="-2" r="14" fill="#111"/></g></g>
		<path d="M-18 52 Q0 70 18 52" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || '#111'};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}
	function cardPx(ctx, html, cx, cy, o = {}) {
		const c = card(ctx, html, cx, cy, o);
		const w = c.offsetWidth, h = c.offsetHeight;
		c.style.left = (cx - w / 2) + 'px'; c.style.top = (cy - h / 2) + 'px'; c.style.transform = 'rotate(' + (o.rot ?? -3) + 'deg)';
		return c;
	}
	function cardSeq(ctx, list, y = 1090) {
		let prev = null;
		list.forEach(([html, t, o], i) => {
			const c = card(ctx, html, 540, y, Object.assign({rot: i % 2 ? 3 : -3, bg: i % 2 ? '#fff' : '#c6ff3d'}, o || {}));
			if (prev) ctx.tl.set(prev, {autoAlpha: 0}, t - 0.05);
			ctx.M.slam(c, t - (prev ? 0.05 : 0));
			prev = c;
		});
	}
	// sound arcs pulsing outward to the right
	function waves(ctx, t, dur, x, y, col = '#ff4fd8', size = 260) {
		for (let i = 0; i < 3; i++) {
			const w = ctx.el(`<div class="ill" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;z-index:4"><svg viewBox="-130 -130 260 260" width="100%" height="100%"><path d="M-40 -90 Q 70 0 -40 90" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round"/></svg></div>`, ctx.stage);
			ctx.tl.fromTo(w, {scale: 0.4, autoAlpha: 0, x: 0}, {scale: 1.3, autoAlpha: 1, x: 50, duration: 0.9, ease: 'power1.out', repeat: Math.ceil(dur / 1.1), repeatDelay: 0.2}, t + i * 0.35);
		}
	}

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const e = el(`<div class="ill" style="left:200px;top:300px;width:600px;height:690px;z-index:3">${ear()}</div>`, stage);
			M.stretch(e, start + 0.05);
			M.float(e, start + 0.7, dur, {amp: 10, period: 1});
			const m = at('make');
			waves(ctx, m, dur, 740, 500);
			ctx.cue('chime', m, 0.7);
			tl.to(e.querySelector('.pupils'), {x: 8, duration: 0.2}, m);
			M.punchIn(stage, m);
			cardSeq(ctx, [['Ears <span class="hl">hear</span>', at('hear') - 0.05, {size: 110}], ['They make <span class="hl">sound</span>', m - 0.05, {size: 92}]], 1100);
		},

		cells(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const c = el(`<div class="ill" style="left:290px;top:300px;width:500px;height:500px;z-index:2">${cochlea()}</div>`, stage);
			const h = at('hair');
			M.pop(c, start + 0.05, {from: 0.4});
			tl.to(c, {rotation: 360, duration: dur + 2, ease: 'none'}, start);
			const cells = c.querySelectorAll('.hc');
			cells.forEach((g, i) => M.pop(g, h + i * 0.07, {sfx: i === 0, from: 0.1}));
			const a = at('amplify');
			cells.forEach((g, i) => tl.to(g, {scale: 1.6, svgOrigin: g.getAttribute('transform').replace(/translate\(|\)/g, ''), duration: 0.18, yoyo: true, repeat: 14, ease: 'sine.inOut'}, a + i * 0.03));
			ctx.cue('fill', a, 0.8);
			const mc = el(`<div class="ill" style="left:60px;top:620px;width:200px;height:325px;z-index:3">${mic}</div>`, stage);
			const r = at('record');
			M.slideIn(mc, r - 0.1, {from: 'left'});
			waves(ctx, r, dur, 160, 700, '#ff4fd8', 200);
			cardSeq(ctx, [['Hair <span class="hl">cells</span>', h - 0.05, {size: 100}], ['Amplify <span class="hl">sound</span>', a - 0.05, {size: 90}], ['<span class="hl">Record</span> it', r - 0.05, {size: 104}]], 1100);
		},

		kemp(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const s = el(`<div class="ill" style="left:290px;top:420px;width:500px;height:550px">${scientist}</div>`, stage);
			M.stretch(s, at('Physicist') - 0.1);
			M.float(s, at('Physicist') + 0.7, dur, {amp: 8, period: 1});
			const y = at('1978');
			const big = el(`<div class="big" style="left:540px;top:330px;transform:translate(-50%,-50%) rotate(-3deg);font-size:210px;color:#fff;white-space:nowrap">1978</div>`, stage);
			M.slam(big, y - 0.05);
			ctx.cue('chime', y, 0.8);
			tl.to(s.querySelector('.pupils'), {x: 8, duration: 0.2}, y);
			cardSeq(ctx, [['David <span class="hl">Kemp</span>', at('Kemp') - 0.05, {size: 110}]], 1100);
		},

		percent(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const heads = [];
			for (let i = 0; i < 10; i++) {
				const x = 90 + (i % 5) * 190, y = 470 + Math.floor(i / 5) * 230;
				const h = el(`<div class="ill" style="left:${x}px;top:${y}px;width:180px;height:210px">${head('#fff')}</div>`, stage);
				M.pop(h, start + 0.1 + i * 0.06, {from: 0.3, sfx: i === 0});
				heads.push(h);
			}
			const a = at('35');
			const num = el(`<div style="position:absolute;left:540px;top:340px;transform:translate(-50%,-50%) rotate(-3deg);font-size:150px;font-family:Bricolage,sans-serif;font-weight:800;color:#111;white-space:nowrap">35–50%</div>`, stage);
			M.slam(num, a - 0.05);
			[0, 1, 2, 3, 4].forEach(i => {
				const t = a + 0.2 + i * 0.18;
				tl.to(heads[i].querySelector('.hd'), {attr: {fill: '#ff4fd8'}, duration: 0.15}, t);
				ctx.cue('pop', t, 0.4);
				M.wobble(heads[i], t, dur, {amp: 4, period: 0.4});
			});
			cardSeq(ctx, [['A faint sound by <span class="hl">itself</span>', at('itself') - 0.4, {size: 66}], ['Most never <span class="hl">notice</span>', at('notice') - 0.05, {size: 80}]], 1100);
		},

		newborn(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const b = el(`<div class="ill" style="left:330px;top:440px;width:520px;height:490px">${baby}</div>`, stage);
			M.pop(b, start + 0.05, {from: 0.4});
			M.float(b, start + 0.7, dur, {amp: 8, period: 1});
			const c = at('click');
			const ck = card(ctx, 'CLICK!', 170, 620, {bg: '#ffd23c', size: 76, rot: -8});
			M.slam(ck, c);
			ctx.cue('snap', c, 1);
			const l = at('listen');
			waves(ctx, l, dur, 790, 540, '#ffd23c', 200);
			tl.to(b.querySelector('.pupils'), {x: 8, duration: 0.2}, l);
			cardSeq(ctx, [['Play a <span class="hl">click</span>', c - 0.05, {size: 96}], ['<span class="hl">Listen</span> back', l - 0.05, {size: 100}]], 1100);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Hear your own <span class="hl">ears?</span>', 540, 330, {bg: '#fff', rot: -3, size: 80});
			M.slam(q, start + 0.1);
			const e = el(`<div class="ill" style="left:300px;top:430px;width:480px;height:552px">${ear('shades')}</div>`, stage);
			M.stretch(e, at('hear') - 0.1);
			M.float(e, at('hear') + 0.5, dur, {amp: 10, period: 0.9});
			const yes = cardPx(ctx, 'YES', 270, 1090, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = cardPx(ctx, 'NO', 810, 1090, {bg: '#ffd23c', size: 120, rot: 6});
			M.slideIn(yes, at('Yes') - 0.1, {from: 'left'});
			ctx.cue('pop', at('Yes'), 0.9);
			M.slideIn(no, at('no') - 0.1, {from: 'right'});
			ctx.cue('pop', at('no'), 0.9);
			M.wobble(yes, at('no') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(no, at('no') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('no') + 0.35, 0.8);
		},
	};
})();
