// Reel: "The McGurk effect: your eyes change what you hear". All illustrations are original SVG drawings.
window.REEL = (function () {
	// round face with ears; .earR/.earL for pulsing, .pupils for looking
	const face = (skin = '#ffb98a') => `<svg viewBox="-170 -150 340 320" width="100%" height="100%">
		<g class="earL"><ellipse cx="-104" cy="6" rx="30" ry="42" fill="${skin}" stroke="#111" stroke-width="9"/><path d="M-110 -10 q 14 10 0 28" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/></g>
		<g class="earR"><ellipse cx="104" cy="6" rx="30" ry="42" fill="${skin}" stroke="#111" stroke-width="9"/><path d="M110 -10 q -14 10 0 28" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/></g>
		<circle r="100" fill="#111" transform="translate(9 9)"/><circle r="100" fill="${skin}" stroke="#111" stroke-width="9"/>
		<g class="eyes"><ellipse cx="-34" cy="-14" rx="22" ry="26" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="34" cy="-14" rx="22" ry="26" fill="#fff" stroke="#111" stroke-width="6"/>
		<g class="pupils"><circle cx="-30" cy="-8" r="10" fill="#111"/><circle cx="38" cy="-8" r="10" fill="#111"/></g></g>
		<path d="M-26 44 Q0 64 26 44" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
	const baby = `<svg viewBox="-150 -170 300 320" width="100%" height="100%">
		<circle r="105" fill="#111" transform="translate(9 9)"/><circle r="105" fill="#ffd4a8" stroke="#111" stroke-width="9"/>
		<path d="M-8 -100 C -30 -150, 30 -165, 22 -128 C 16 -108, -2 -116, 6 -126" fill="none" stroke="#111" stroke-width="9" stroke-linecap="round"/>
		<circle cx="-62" cy="30" r="22" fill="#ff8fb1" opacity="0.7"/><circle cx="62" cy="30" r="22" fill="#ff8fb1" opacity="0.7"/>
		<g class="eyes"><ellipse cx="-34" cy="-10" rx="24" ry="30" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="34" cy="-10" rx="24" ry="30" fill="#fff" stroke="#111" stroke-width="6"/>
		<g class="pupils"><circle cx="-30" cy="-2" r="14" fill="#111"/><circle cx="38" cy="-2" r="14" fill="#111"/><circle cx="-25" cy="-8" r="4" fill="#fff"/><circle cx="43" cy="-8" r="4" fill="#fff"/></g></g>
		<path d="M-18 52 Q0 70 18 52" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
	const screen = `<svg viewBox="0 0 420 340" width="100%" height="100%">
		<rect x="14" y="14" width="392" height="300" rx="30" fill="#111" transform="translate(10 10)"/><rect x="14" y="14" width="392" height="300" rx="30" fill="#2b2b2b" stroke="#111" stroke-width="10"/>
		<rect x="40" y="40" width="340" height="248" rx="14" fill="#ffd4a8"/>
		<g class="mth"><ellipse cx="210" cy="168" rx="104" ry="64" fill="#ff4f6a" stroke="#111" stroke-width="9"/>
		<ellipse class="open" cx="210" cy="168" rx="70" ry="40" fill="#5a0f1f" stroke="#111" stroke-width="6"/><rect x="160" y="130" width="100" height="22" rx="8" fill="#fff"/></g></svg>`;
	const speaker = `<svg viewBox="0 0 300 260" width="100%" height="100%">
		<rect x="20" y="70" width="70" height="120" rx="14" fill="#111" transform="translate(8 8)"/><rect x="20" y="70" width="70" height="120" rx="14" fill="#ff4fd8" stroke="#111" stroke-width="9"/>
		<path d="M90 80 L 170 20 V 240 L 90 180 Z" fill="#111" transform="translate(8 8)"/><path d="M90 80 L 170 20 V 240 L 90 180 Z" fill="#ffd23c" stroke="#111" stroke-width="9" stroke-linejoin="round"/>
		<g class="wv" fill="none" stroke="#111" stroke-width="12" stroke-linecap="round"><path d="M205 90 Q 235 130 205 170"/><path d="M235 60 Q 285 130 235 200"/></g></svg>`;
	const paper = `<svg viewBox="0 0 330 430" width="100%" height="100%">
		<rect x="20" y="20" width="290" height="390" rx="14" fill="#111" transform="translate(10 10)"/><rect x="20" y="20" width="290" height="390" rx="14" fill="#fff" stroke="#111" stroke-width="9"/>
		<rect x="20" y="20" width="290" height="80" rx="14" fill="#c6ff3d" stroke="#111" stroke-width="9"/><text x="165" y="78" font-size="56" text-anchor="middle" font-family="Bricolage" font-weight="800">1976</text>
		<text x="165" y="170" font-size="34" text-anchor="middle" font-family="Bricolage" font-weight="800">Hearing lips</text><text x="165" y="214" font-size="34" text-anchor="middle" font-family="Bricolage" font-weight="800">and seeing</text><text x="165" y="258" font-size="34" text-anchor="middle" font-family="Bricolage" font-weight="800">voices</text>
		<g stroke="#111" stroke-width="8" stroke-linecap="round" opacity="0.35"><path d="M60 310 H270 M60 340 H270 M60 370 H200"/></g></svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || '#111'};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
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
	// card placed by pixel offsets (no percent translate), so slide-ins can't disturb its centring
	function cardPx(ctx, html, cx, cy, o = {}) {
		const c = card(ctx, html, cx, cy, o);
		const w = c.offsetWidth, h = c.offsetHeight;
		c.style.left = (cx - w / 2) + 'px';
		c.style.top = (cy - h / 2) + 'px';
		c.style.transform = 'rotate(' + (o.rot ?? -3) + 'deg)';
		return c;
	}
	// pulsing sound arcs aimed at the face's right ear
	function earWaves(ctx, t, dur, x = 770, y = 470, col = '#ff4fd8') {
		for (let i = 0; i < 3; i++) {
			const w = ctx.el(`<div class="ill" style="left:${x}px;top:${y}px;width:220px;height:220px;z-index:4"><svg viewBox="-110 -110 220 220" width="100%" height="100%"><path d="M40 -80 Q -30 0 40 80" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round"/></svg></div>`, ctx.stage);
			ctx.tl.fromTo(w, {x: 120, scale: 0.5, autoAlpha: 0}, {x: 0, scale: 1.1, autoAlpha: 1, duration: 0.8, ease: 'power1.out', repeat: Math.ceil(dur / 1.0), repeatDelay: 0.2}, t + i * 0.3);
		}
	}
	const X = `<svg viewBox="-100 -100 200 200" width="100%" height="100%"><path d="M-70 -70 L 70 70 M70 -70 L -70 70" stroke="#ff4f4f" stroke-width="30" stroke-linecap="round"/></svg>`;

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = el(`<div class="ill" style="left:210px;top:380px;width:660px;height:622px;z-index:3">${face()}</div>`, stage);
			M.stretch(f, start + 0.05);
			M.float(f, start + 0.7, dur, {amp: 8, period: 1});
			const e = at('ears');
			earWaves(ctx, e, dur, 760, 560);
			ctx.cue('chime', e, 0.6);
			tl.fromTo(f.querySelector('.earR'), {scale: 1, svgOrigin: '104 6'}, {scale: 1.25, duration: 0.15, yoyo: true, repeat: 5}, e);
			const ey = at('eyes');
			tl.to(f.querySelector('.pupils'), {x: -14, duration: 0.15}, ey).to(f.querySelector('.pupils'), {x: 14, duration: 0.3}, ey + 0.25).to(f.querySelector('.pupils'), {x: 0, duration: 0.2}, ey + 0.6);
			M.punchIn(stage, ey);
			cardSeq(ctx, [['Hear with <span class="hl">ears</span>', e - 0.05, {size: 92}], ['<span class="hl">Eyes</span> change it', ey - 0.05, {size: 92}]]);
		},

		test(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const sp = el(`<div class="ill" style="left:40px;top:430px;width:380px;height:330px">${speaker}</div>`, stage);
			const sb = at('ba');
			M.pop(sp, sb - 0.4, {from: 0.3});
			tl.fromTo(sp.querySelector('.wv'), {opacity: 0.2}, {opacity: 1, duration: 0.2, yoyo: true, repeat: 20}, sb);
			const ba = card(ctx, 'BA', 230, 380, {bg: '#3ce7ff', size: 120, rot: -6});
			M.slam(ba, sb);
			const scr = el(`<div class="ill" style="left:560px;top:400px;width:480px;height:390px">${screen}</div>`, stage);
			const mo = at('mouth');
			M.pop(scr, mo - 0.1, {from: 0.3});
			const gg = at('ga');
			tl.fromTo(scr.querySelector('.open'), {scaleY: 0.2, svgOrigin: '210 168'}, {scaleY: 1, duration: 0.28, yoyo: true, repeat: 14, ease: 'sine.inOut'}, mo + 0.2);
			const ga = card(ctx, 'GA', 800, 370, {bg: '#c6ff3d', size: 120, rot: 6});
			M.slam(ga, gg);
			cardSeq(ctx, [['Sound: <span class="hl">BA</span>', sb, {size: 100}], ['Mouth: <span class="hl">GA</span>', gg - 0.05, {size: 100}]]);
		},

		result(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const b = card(ctx, 'BA', 250, 380, {bg: '#3ce7ff', size: 110, rot: -6});
			const g = card(ctx, 'GA', 830, 380, {bg: '#c6ff3d', size: 110, rot: 6});
			M.pop(b, start + 0.1, {from: 0.3});
			M.pop(g, start + 0.3, {from: 0.3});
			const xb = el(`<div class="ill" style="left:130px;top:290px;width:240px;height:240px;z-index:5">${X}</div>`, stage);
			const xg = el(`<div class="ill" style="left:710px;top:290px;width:240px;height:240px;z-index:5">${X}</div>`, stage);
			M.pop(xb, at('ba'), {from: 0.2});
			M.pop(xg, at('ga'), {from: 0.2});
			const d = at('da');
			const da = el(`<div class="big" style="left:540px;top:760px;transform:translate(-50%,-50%) rotate(-4deg);font-size:360px;color:#ff4fd8;white-space:nowrap">DA</div>`, stage);
			M.slam(da, d - 0.05);
			M.shake(da, d + 0.1, {amp: 8, n: 8});
			ctx.cue('chime', d, 0.8);
			cardSeq(ctx, [['Heard a <span class="hl">third</span> sound', at('They') + 0.05, {size: 76}]], 1100);
		},

		named(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const p = el(`<div class="ill" style="left:300px;top:300px;width:480px;height:627px">${paper}</div>`, stage);
			M.pop(p, at('1976') - 0.4, {from: 0.4});
			tl.to(p, {rotation: -4, duration: 0.5, ease: 'back.out(2)'}, at('1976') - 0.2);
			M.float(p, at('1976') + 0.5, dur, {amp: 8, period: 1});
			cardSeq(ctx, [['The <span class="hl">McGurk</span> effect', at('McGurk') - 0.05, {size: 80}]], 1090);
		},

		robust(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = el(`<div class="ill" style="left:260px;top:540px;width:560px;height:528px;z-index:3">${face()}</div>`, stage);
			M.pop(f, start + 0.05, {from: 0.4});
			const k = at('know');
			const b = card(ctx, 'I know it\'s a <span class="hl">trick</span>!', 540, 380, {bg: '#fff', size: 66, rot: -3});
			M.slam(b, k - 0.1);
			const w = at('working');
			const da = el(`<div class="big" style="left:900px;top:560px;transform:translate(-50%,-50%) rotate(8deg);font-size:130px;color:#ffd23c;white-space:nowrap;z-index:4">DA</div>`, stage);
			M.pop(da, w, {from: 0.3, sfx: false});
			M.wobble(da, w + 0.4, dur, {amp: 6, period: 0.5});
			earWaves(ctx, w, dur, 700, 600, '#ffd23c');
			tl.to(f.querySelector('.pupils'), {x: -10, duration: 0.2}, k);
			cardSeq(ctx, [['Still <span class="hl">works</span>', w - 0.05, {size: 110}]], 1100);
		},

		babies(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const b = el(`<div class="ill" style="left:290px;top:420px;width:500px;height:533px">${baby}</div>`, stage);
			M.stretch(b, at('Babies') - 0.1);
			M.float(b, at('Babies') + 0.7, dur, {amp: 10, period: 1});
			const num = el(`<div class="big" style="left:540px;top:330px;transform:translate(-50%,-50%) rotate(-3deg);font-size:140px;color:#ffd23c;white-space:nowrap"><span class="n">0</span> months</div>`, stage);
			const f = at('four');
			M.pop(num, f - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), f - 0.2, 0, 4, 0.6, v => Math.round(v));
			tl.to(b.querySelector('.pupils'), {x: 8, duration: 0.2}, f);
			cardSeq(ctx, [['Babies <span class="hl">too</span>', at('Babies') + 0.1, {size: 110}]], 1100);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Ears or <span class="hl">eyes?</span>', 540, 330, {bg: '#fff', rot: -3, size: 90});
			M.slam(q, start + 0.1);
			const f = el(`<div class="ill" style="left:290px;top:440px;width:500px;height:470px">${face()}</div>`, stage);
			M.stretch(f, at('trust') - 0.1);
			M.float(f, at('trust') + 0.5, dur, {amp: 10, period: 0.9});
			const A = cardPx(ctx, 'EARS', 270, 1050, {bg: '#ff4fd8', size: 100, rot: -6});
			const B = cardPx(ctx, 'EYES', 810, 1050, {bg: '#c6ff3d', size: 100, rot: 6});
			M.slideIn(A, at('trust') + 0.2, {from: 'left'});
			ctx.cue('pop', at('trust') + 0.3, 0.9);
			M.slideIn(B, at('trust') + 0.5, {from: 'right'});
			ctx.cue('pop', at('trust') + 0.6, 0.9);
			tl.to(f.querySelector('.pupils'), {x: -14, duration: 0.15}, at('eyes')).to(f.querySelector('.pupils'), {x: 14, duration: 0.15}, at('eyes') + 0.5);
			M.wobble(A, at('eyes') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(B, at('eyes') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('eyes') + 0.4, 0.8);
		},
	};
})();
