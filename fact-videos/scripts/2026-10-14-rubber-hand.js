// Reel: "Your brain can own a rubber hand". All illustrations are original SVG drawings.
window.REEL = (function () {
	// cartoon hand; col = skin colour, face = eyes on the palm
	const hand = (col, face) => {
		const fingers = [[-62, -35, -125], [-22, -35, -160], [20, -35, -165], [60, -35, -135]];
		const thumb = [[-70, 60, -130, -5]];
		const line = (x1, y1, x2, y2, w, c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
		return `<svg viewBox="-160 -200 320 400" width="100%" height="100%">
			${fingers.map(([x, y1, y2]) => line(x, y1, x, y2, 46, '#111')).join('')}${thumb.map(([a, b, c, d]) => line(a, b, c, d, 46, '#111')).join('')}
			${fingers.map(([x, y1, y2]) => line(x, y1, x, y2, 30, col)).join('')}${thumb.map(([a, b, c, d]) => line(a, b, c, d, 30, col)).join('')}
			<rect x="-90" y="-45" width="180" height="200" rx="52" fill="#111" transform="translate(10 10)"/>
			<rect x="-90" y="-45" width="180" height="200" rx="52" fill="${col}" stroke="#111" stroke-width="9"/>
			${face ? `<g class="eyes"><ellipse cx="-32" cy="30" rx="22" ry="26" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="32" cy="30" rx="22" ry="26" fill="#fff" stroke="#111" stroke-width="6"/><g class="pupils"><circle cx="-28" cy="36" r="9" fill="#111"/><circle cx="36" cy="36" r="9" fill="#111"/></g></g><path d="M-26 100 Q0 122 26 100" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>` : ''}
			<path d="M-90 125 H90" stroke="#111" stroke-width="6" stroke-dasharray="14 12" opacity="0.5"/></svg>`;
	};
	const brush = `<svg viewBox="-60 -250 120 330" width="100%" height="100%">
		<rect x="-14" y="-240" width="28" height="170" rx="14" fill="#ffd23c" stroke="#111" stroke-width="8"/>
		<rect x="-22" y="-80" width="44" height="40" fill="#c9c9c9" stroke="#111" stroke-width="8"/>
		<path d="M-22 -42 C -30 20, -10 60, 0 70 C 10 60, 30 20, 22 -42 Z" fill="#ff4fd8" stroke="#111" stroke-width="8" stroke-linejoin="round"/></svg>`;
	const mallet = `<svg viewBox="-170 -170 340 340" width="100%" height="100%"><g transform="rotate(-35)">
		<rect x="-14" y="-40" width="28" height="200" rx="12" fill="#ffd23c" stroke="#111" stroke-width="8"/>
		<rect x="-95" y="-120" width="190" height="90" rx="20" fill="#111" transform="translate(8 8)"/>
		<rect x="-95" y="-120" width="190" height="90" rx="20" fill="#ff4f4f" stroke="#111" stroke-width="9"/>
		<rect x="-95" y="-120" width="40" height="90" rx="14" fill="#fff" opacity="0.35"/></g></svg>`;
	const brain = `<svg viewBox="-170 -120 340 240" width="100%" height="100%">
		<g fill="#111" transform="translate(10 10)"><circle cx="-90" cy="10" r="60"/><circle cx="-30" cy="-45" r="68"/><circle cx="45" cy="-40" r="66"/><circle cx="100" cy="15" r="56"/><circle cx="-5" cy="45" r="62"/></g>
		<g fill="#ff8fc8" stroke="#111" stroke-width="9"><circle cx="-90" cy="10" r="60"/><circle cx="-30" cy="-45" r="68"/><circle cx="45" cy="-40" r="66"/><circle cx="100" cy="15" r="56"/><circle cx="-5" cy="45" r="62"/></g>
		<g fill="#ff8fc8"><circle cx="-90" cy="10" r="55"/><circle cx="-30" cy="-45" r="63"/><circle cx="45" cy="-40" r="61"/><circle cx="100" cy="15" r="51"/><circle cx="-5" cy="45" r="57"/></g>
		<path d="M-60 -30 Q-30 -10 -50 20 M30 -60 Q60 -30 30 -5 M70 10 Q90 40 55 50 M-40 55 Q-10 70 20 55" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/>
		<g class="eyes"><ellipse cx="-25" cy="0" rx="17" ry="20" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="25" cy="0" rx="17" ry="20" fill="#fff" stroke="#111" stroke-width="6"/><circle cx="-21" cy="5" r="7" fill="#111"/><circle cx="29" cy="5" r="7" fill="#111"/></g></svg>`;
	const drop = `<svg viewBox="-30 -50 60 90" width="100%" height="100%"><path d="M0 -44 C 18 -14, 28 -2, 28 14 C 28 30, 16 38, 0 38 C -16 38, -28 30, -28 14 C -28 -2, -18 -14, 0 -44 Z" fill="#3ce7ff" stroke="#111" stroke-width="7"/></svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || '#111'};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}
	// a run of cards at the same spot; each replaces the previous one
	function cardSeq(ctx, list, y = 1090) {
		let prev = null;
		list.forEach(([html, t, o], i) => {
			const c = card(ctx, html, 540, y, Object.assign({rot: i % 2 ? 3 : -3, bg: i % 2 ? '#fff' : '#c6ff3d'}, o || {}));
			if (prev) ctx.tl.set(prev, {autoAlpha: 0}, t - 0.05);
			ctx.M.slam(c, t - (prev ? 0.05 : 0));
			prev = c;
		});
	}
	const PEACH = '#ffb98a', RUBBER = '#c6ff3d';

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const h = el(`<div class="ill" style="left:290px;top:330px;width:500px;height:625px">${hand(RUBBER, true)}</div>`, stage);
			M.stretch(h, start + 0.05);
			M.wobble(h, start + 0.7, dur, {amp: 4, period: 0.8});
			tl.to(h.querySelector('.pupils'), {x: -8, y: -6, duration: 0.2}, start + 0.9);
			M.punchIn(stage, at('owning') - 0.05);
			cardSeq(ctx, [['Brain <span class="hl">tricked</span>', at('tricked'), {size: 100}], ['Owns a <span class="hl">rubber hand</span>', at('owning') - 0.1, {size: 70}]]);
		},

		setup(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const real = el(`<div class="ill" style="left:40px;top:470px;width:400px;height:500px">${hand(PEACH, false)}</div>`, stage);
			M.pop(real, start + 0.1);
			const hid = at('Hide');
			tl.to(real, {opacity: 0.3, duration: 0.3}, hid + 0.1);
			const tag = card(ctx, 'HIDDEN', 240, 760, {bg: '#111', color: '#fff', size: 60, rot: -6});
			M.slideIn(tag, hid + 0.1, {from: 'top'});
			const fake = el(`<div class="ill" style="left:640px;top:470px;width:400px;height:500px">${hand(RUBBER, false)}</div>`, stage);
			M.pop(fake, at('fake') - 0.1);
			const st = at('stroke');
			[[240, 'a'], [840, 'b']].forEach(([x, k]) => {
				const b = el(`<div class="ill" style="left:${x - 50}px;top:260px;width:100px;height:275px">${brush}</div>`, stage);
				M.slideIn(b, st - 0.1, {from: 'top'});
				tl.fromTo(b, {x: -60}, {x: 60, duration: 0.42, yoyo: true, repeat: 12, ease: 'sine.inOut'}, st + 0.3);
				ctx.cue('swoosh', st + 0.3, 0.4);
			});
			cardSeq(ctx, [['Hide your <span class="hl">hand</span>', hid, {size: 86}], ['Add a <span class="hl">fake</span> one', at('fake') - 0.1, {size: 86}], ['Stroke <span class="hl">both</span>', st, {size: 90}]]);
		},

		feel(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const h = el(`<div class="ill" style="left:290px;top:560px;width:400px;height:500px">${hand(RUBBER, false)}</div>`, stage);
			M.pop(h, start + 0.05, {from: 0.4});
			const t = at('touch');
			for (let i = 0; i < 3; i++) {
				const r = el(`<div class="ill" style="left:390px;top:700px;width:200px;height:200px"><svg viewBox="-100 -100 200 200" width="100%" height="100%"><circle r="80" fill="none" stroke="#ff4fd8" stroke-width="12"/></svg></div>`, stage);
				tl.fromTo(r, {scale: 0.3, autoAlpha: 1}, {scale: 2.2, autoAlpha: 0, duration: 0.7, ease: 'power2.out'}, t + i * 0.2);
			}
			ctx.cue('pop', t, 0.9);
			const b = el(`<div class="ill" style="left:310px;top:260px;width:460px;height:325px">${brain}</div>`, stage);
			M.pop(b, at('brain') - 0.2, {from: 0.3});
			M.float(b, at('brain') + 0.5, dur, {amp: 10, period: 0.9});
			tl.to(b.querySelector('.eyes'), {y: 8, duration: 0.2}, at('decides'));
			ctx.cue('chime', at('yours'), 0.8);
			cardSeq(ctx, [['Feels <span class="hl">real</span>', t, {size: 100}], ['It\'s <span class="hl">mine</span>', at('yours') - 0.1, {size: 110}]]);
		},

		threat(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const h = el(`<div class="ill" style="left:290px;top:530px;width:400px;height:500px">${hand(RUBBER, true)}</div>`, stage);
			M.pop(h, start + 0.05, {from: 0.4});
			const m = el(`<div class="ill" style="left:500px;top:260px;width:340px;height:340px">${mallet}</div>`, stage);
			const th = at('threatens');
			M.slideIn(m, th - 0.1, {from: 'top'});
			M.float(m, th + 0.5, dur, {amp: 10, period: 0.7});
			const r = at('reacts');
			M.shake(h, r, {amp: 10, n: 9});
			tl.to(h.querySelector('.pupils'), {scale: 1.5, transformOrigin: '50% 50%', duration: 0.1}, r);
			ctx.cue('snap', r, 0.9);
			[[300, 560], [660, 590], [260, 760], [720, 800]].forEach(([x, y], i) => {
				const d = el(`<div class="ill" style="left:${x}px;top:${y}px;width:60px;height:90px">${drop}</div>`, stage);
				tl.fromTo(d, {y: -20, scale: 0.3, autoAlpha: 0}, {y: 30, scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(2)'}, r + 0.05 * i);
				tl.to(d, {y: 90, autoAlpha: 0, duration: 0.5}, r + 0.6 + 0.05 * i);
			});
			cardSeq(ctx, [['Danger<span class="hl">!</span>', th, {size: 110}], ['Body <span class="hl">reacts</span>', r, {size: 100}]]);
		},

		why(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const col = ['#ff4fd8', '#3ce7ff', '#ffd23c', '#c6ff3d'];
			const pieces = [
				[`<circle cx="0" cy="0" r="70"`, 0, 0, 140, 140, 330, 280, 'head'],
			];
			const body = el(`<div class="ill" style="left:290px;top:260px;width:500px;height:700px"><svg viewBox="-250 -90 500 700" width="100%" height="100%">
				<g class="p0"><circle r="75" cy="0" fill="${col[0]}" stroke="#111" stroke-width="9"/><circle cx="-26" cy="-8" r="9" fill="#111"/><circle cx="26" cy="-8" r="9" fill="#111"/><path d="M-26 28 Q0 46 26 28" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/></g>
				<g class="p1"><rect x="-80" y="90" width="160" height="230" rx="40" fill="${col[1]}" stroke="#111" stroke-width="9"/></g>
				<g class="p2"><rect x="-190" y="100" width="90" height="200" rx="40" fill="${col[2]}" stroke="#111" stroke-width="9"/><rect x="100" y="100" width="90" height="200" rx="40" fill="${col[2]}" stroke="#111" stroke-width="9"/></g>
				<g class="p3"><rect x="-75" y="335" width="68" height="230" rx="34" fill="${col[3]}" stroke="#111" stroke-width="9"/><rect x="7" y="335" width="68" height="230" rx="34" fill="${col[3]}" stroke="#111" stroke-width="9"/></g></svg></div>`, stage);
			const bt = at('built');
			['.p0', '.p1', '.p2', '.p3'].forEach((s, i) => {
				const g = body.querySelector(s);
				tl.fromTo(g, {y: -500, autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: 0.45, ease: 'bounce.out'}, bt - 0.15 + i * 0.18);
				ctx.cue('pop', bt - 0.15 + i * 0.18 + 0.2, 0.7);
			});
			M.float(body, bt + 1, dur, {amp: 8, period: 1});
			const see = card(ctx, 'SEE', 130, 560, {bg: '#fff', size: 70, rot: -8});
			M.slideIn(see, at('see') - 0.1, {from: 'left'});
			const feel = card(ctx, 'FEEL', 950, 640, {bg: '#fff', size: 70, rot: 8});
			M.slideIn(feel, at('feel') - 0.1, {from: 'right'});
			cardSeq(ctx, [['Body = <span class="hl">built</span>', bt, {size: 96}]], 1100);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Would you <span class="hl">try?</span>', 540, 330, {bg: '#fff', rot: -3, size: 100});
			M.slam(q, start + 0.1);
			const h = el(`<div class="ill" style="left:340px;top:440px;width:400px;height:500px">${hand(RUBBER, true)}</div>`, stage);
			M.stretch(h, at('try') - 0.1);
			M.wobble(h, at('try') + 0.5, dur, {amp: 5, period: 0.8});
			const yes = card(ctx, 'YES', 270, 1030, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1030, {bg: '#ffd23c', size: 120, rot: 6});
			M.slideIn(yes, at('Yes') - 0.1, {from: 'left'});
			ctx.cue('pop', at('Yes'), 0.9);
			M.slideIn(no, at('no') - 0.1, {from: 'right'});
			ctx.cue('pop', at('no'), 0.9);
			tl.to(h.querySelector('.pupils'), {x: -12, duration: 0.15}, at('Yes')).to(h.querySelector('.pupils'), {x: 12, duration: 0.15}, at('no'));
			M.wobble(yes, at('no') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(no, at('no') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('no') + 0.35, 0.8);
		},
	};
})();
