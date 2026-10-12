// Reel: "The stopped-clock illusion". All illustrations are original SVG drawings.
window.REEL = (function () {
	// big cartoon eyeball; .iris moves, .dim darkens it
	const eye = (id = '') => `<svg viewBox="-210 -150 420 300" width="100%" height="100%">
		<ellipse rx="190" ry="125" fill="#111" transform="translate(12 12)"/>
		<ellipse rx="190" ry="125" fill="#fff" stroke="#111" stroke-width="9"/>
		<g class="iris"><circle r="82" fill="#3ce7ff" stroke="#111" stroke-width="8"/><circle r="44" fill="#111"/><circle cx="-22" cy="-24" r="14" fill="#fff"/></g>
		<ellipse class="dim" rx="184" ry="119" fill="#111" opacity="0"/>
		<path d="M-120 -128 L -150 -190 M -40 -140 L -50 -205 M 40 -140 L 50 -205 M 120 -128 L 150 -190" stroke="#111" stroke-width="9" stroke-linecap="round"/></svg>`;

	// wall clock with a stepping second hand
	const clock = `<svg viewBox="-230 -230 460 460" width="100%" height="100%">
		<circle r="205" fill="#111" transform="translate(14 14)"/>
		<circle r="205" fill="#fff" stroke="#111" stroke-width="12"/>
		${Array.from({length: 12}, (_, i) => `<line x1="0" y1="-178" x2="0" y2="${i % 3 ? -158 : -148}" stroke="#111" stroke-width="${i % 3 ? 8 : 12}" stroke-linecap="round" transform="rotate(${i * 30})"/>`).join('')}
		<line x1="0" y1="0" x2="0" y2="-95" stroke="#111" stroke-width="16" stroke-linecap="round" transform="rotate(-60)"/>
		<line x1="0" y1="0" x2="0" y2="-135" stroke="#111" stroke-width="12" stroke-linecap="round" transform="rotate(70)"/>
		<g class="sec"><line x1="0" y1="25" x2="0" y2="-165" stroke="#ff4fd8" stroke-width="9" stroke-linecap="round"/></g>
		<circle r="16" fill="#ff4fd8" stroke="#111" stroke-width="7"/></svg>`;

	const film = `<svg viewBox="0 0 960 420" width="100%" height="100%">
		<rect x="0" y="40" width="960" height="340" rx="18" fill="#111"/>
		${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `<rect x="${24 + i * 80}" y="52" width="36" height="20" rx="5" fill="#fff"/><rect x="${24 + i * 80}" y="348" width="36" height="20" rx="5" fill="#fff"/>`).join('')}
		<rect x="30" y="100" width="280" height="220" rx="14" fill="#3ce7ff" stroke="#fff" stroke-width="6"/>
		<circle cx="100" cy="210" r="42" fill="#ffd23c" stroke="#111" stroke-width="7"/>
		<rect class="gapf" x="340" y="100" width="280" height="220" rx="14" fill="#2b2b2b" stroke="#fff" stroke-width="6" stroke-dasharray="18 14"/>
		<text class="q" x="480" y="240" font-size="130" text-anchor="middle" fill="#fff" font-family="Bricolage" font-weight="800">?</text>
		<g class="filled" opacity="0"><rect x="340" y="100" width="280" height="220" rx="14" fill="#c6ff3d" stroke="#fff" stroke-width="6"/><circle cx="480" cy="210" r="42" fill="#ffd23c" stroke="#111" stroke-width="7"/></g>
		<rect x="650" y="100" width="280" height="220" rx="14" fill="#3ce7ff" stroke="#fff" stroke-width="6"/>
		<circle cx="860" cy="210" r="42" fill="#ffd23c" stroke="#111" stroke-width="7"/></svg>`;

	const timeline = `<svg viewBox="0 0 960 420" width="100%" height="100%">
		<line x1="40" y1="210" x2="920" y2="210" stroke="#111" stroke-width="12" stroke-linecap="round"/>
		<rect class="stretch" x="320" y="165" width="600" height="90" rx="14" fill="#c6ff3d" stroke="#111" stroke-width="8"/>
		<g class="m1" transform="translate(320 210)"><circle r="32" fill="#ff4fd8" stroke="#111" stroke-width="8"/><text y="-70" font-size="50" text-anchor="middle" font-family="Bricolage" font-weight="800">EYES MOVE</text></g>
		<g class="m2" transform="translate(700 210)"><circle r="32" fill="#ffd23c" stroke="#111" stroke-width="8"/><text y="118" font-size="50" text-anchor="middle" font-family="Bricolage" font-weight="800">YOU SEE IT</text></g></svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || '#111'};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}

	// second hand ticks once every `gap` s from t0 until t1 (inclusive count)
	function tickHand(ctx, hand, t0, n, gap, from = 0) {
		const {tl} = ctx;
		for (let k = 1; k <= n; k++) {
			tl.to(hand, {rotation: from + k * 6, svgOrigin: '0 0', duration: 0.09, ease: 'power2.out'}, t0 + k * gap);
			ctx.cue('tick', t0 + k * gap, 0.55);
		}
		return from + n * 6;
	}

	return {
		hook(ctx) {
			const {M, el, stage, start, tl, at} = ctx;
			const c = el(`<div class="ill" style="left:215px;top:290px;width:650px;height:650px">${clock}</div>`, stage);
			M.pop(c, start + 0.05, {from: 0.4});
			const sec = c.querySelector('.sec');
			tl.set(sec, {rotation: 0, svgOrigin: '0 0'}, start);
			const frozen = at('frozen');
			const n = Math.max(1, Math.floor((frozen - start - 0.3) / 0.4));
			tickHand(ctx, sec, start + 0.1, n, 0.4);
			M.shake(c, frozen + 0.1, {amp: 6, n: 7});
			const k1 = card(ctx, 'Frozen<span class="hl">?</span>', 540, 1040, {size: 110});
			M.slam(k1, frozen);
			const k2 = card(ctx, 'It\'s <span class="hl">lying</span>', 540, 1040, {size: 110, bg: '#fff', rot: 3});
			tl.set(k1, {autoAlpha: 0}, at('lying') - 0.05);
			M.slam(k2, at('lying') - 0.05);
			M.punchIn(stage, at('lying'));
		},

		eyes(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const e = el(`<div class="ill" style="left:130px;top:330px;width:820px;height:580px">${eye()}</div>`, stage);
			M.pop(e, start + 0.05, {from: 0.4});
			const iris = e.querySelector('.iris'), dim = e.querySelector('.dim');
			const j = at('jump');
			const jumps = [[-90, -20], [80, 14], [-50, 28], [90, -22], [0, 0]];
			jumps.forEach(([x, y], i) => {
				const t = j + i * 0.42;
				tl.to(iris, {x, y, duration: 0.07, ease: 'power3.out'}, t);
				tl.fromTo(dim, {opacity: 0}, {opacity: 0.85, duration: 0.05, yoyo: true, repeat: 1}, t);
				ctx.cue('snap', t, 0.35);
			});
			M.float(e, start + 0.6, dur, {amp: 8, period: 1.1});
			const c1 = card(ctx, 'Eyes <span class="hl">jump</span>', 540, 1040, {size: 110});
			M.slam(c1, j);
			const c2 = card(ctx, 'Vision <span class="hl">dims</span>', 540, 1040, {size: 110, bg: '#fff', rot: 3});
			tl.set(c1, {autoAlpha: 0}, at('dims') - 0.05);
			M.slam(c2, at('dims') - 0.05);
		},

		gap(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = el(`<div class="ill" style="left:60px;top:430px;width:960px;height:420px">${film}</div>`, stage);
			M.rise(f, start + 0.05);
			const edits = at('edits');
			tl.to(f.querySelector('.q'), {opacity: 0, duration: 0.15}, edits + 0.25);
			tl.fromTo(f.querySelector('.filled'), {opacity: 0, scale: 0.6, svgOrigin: '480 210'}, {opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)'}, edits + 0.3);
			ctx.cue('pop', edits + 0.3, 0.9);
			M.shake(f, at('blur'), {amp: 5, n: 6});
			const c = card(ctx, 'Brain <span class="hl">edits</span> it out', 540, 1030, {size: 84, bg: '#fff', rot: -3});
			M.slam(c, edits);
		},

		stretch(ctx) {
			const {M, el, stage, start, tl, at} = ctx;
			const t = el(`<div class="ill" style="left:60px;top:400px;width:960px;height:420px">${timeline}</div>`, stage);
			M.rise(t, start + 0.05);
			M.pop(t.querySelector('.m1'), start + 0.3, {sfx: false});
			M.pop(t.querySelector('.m2'), start + 0.5, {sfx: false});
			const bar = t.querySelector('.stretch');
			tl.fromTo(bar, {scaleX: 0.37, svgOrigin: '920 210'}, {scaleX: 1, duration: 0.9, ease: 'back.out(1.3)'}, at('backward') - 0.2);
			ctx.cue('fill', at('backward') - 0.2, 0.8);
			const c = card(ctx, 'Stretched <span class="hl">backward</span>', 540, 1040, {size: 84});
			M.slam(c, at('stretches'));
		},

		clock(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const c = el(`<div class="ill" style="left:215px;top:330px;width:650px;height:650px">${clock}</div>`, stage);
			M.pop(c, start + 0.05, {from: 0.4});
			const sec = c.querySelector('.sec');
			tl.set(sec, {rotation: 0, svgOrigin: '0 0'}, start);
			const first = at('first');
			const hold = first - 0.05;
			// the second hand ticks normally, then the "first" tick sticks, then resumes
			let rot = tickHand(ctx, sec, start + 0.1, 1, 0.3);
			tl.to(sec, {rotation: rot + 6, svgOrigin: '0 0', duration: 0.09, ease: 'power2.out'}, hold);
			ctx.cue('tick', hold, 0.7);
			const L = at('longer');
			tl.to(sec, {rotation: rot + 12, svgOrigin: '0 0', duration: 0.09, ease: 'power2.out'}, L + 0.5);
			ctx.cue('tick', L + 0.5, 0.55);
			const e = el(`<div class="ill" style="left:700px;top:260px;width:340px;height:240px">${eye()}</div>`, stage);
			M.pop(e, at('land') - 0.1, {from: 0.3});
			tl.to(e.querySelector('.iris'), {x: -70, y: 30, duration: 0.2}, at('land') + 0.1);
			M.float(e, at('land') + 0.4, dur, {amp: 8, period: 1});
			const card1 = card(ctx, 'First second <span class="hl">longer</span>', 540, 1050, {size: 76, bg: '#fff', rot: 2});
			M.slam(card1, L);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Trust your <span class="hl">eyes?</span>', 540, 330, {bg: '#fff', rot: -3, size: 100});
			M.slam(q, start + 0.1);
			const e = el(`<div class="ill" style="left:250px;top:430px;width:580px;height:410px">${eye()}</div>`, stage);
			M.stretch(e, at('trust') - 0.1);
			M.float(e, at('trust') + 0.4, dur, {amp: 10, period: 0.9});
			const yes = card(ctx, 'YES', 270, 1030, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1030, {bg: '#ff4fd8', size: 120, rot: 6});
			M.slideIn(yes, at('Yes') - 0.1, {from: 'left'});
			ctx.cue('pop', at('Yes'), 0.9);
			M.slideIn(no, at('no') - 0.1, {from: 'right'});
			ctx.cue('pop', at('no'), 0.9);
			const iris = e.querySelector('.iris');
			tl.to(iris, {x: -70, duration: 0.15}, at('Yes')).to(iris, {x: 70, duration: 0.15}, at('no'));
			M.wobble(yes, at('no') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(no, at('no') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('no') + 0.35, 0.8);
		},
	};
})();
