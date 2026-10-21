// Reel: "Sunsets on Mars are blue". All illustrations are original SVG drawings.
window.REEL = (function () {
	// framed sunset panel: sky colour, sun height, optional blue halo (class .halo) and ground
	const sunset = (o) => `<svg viewBox="0 0 440 520" width="100%" height="100%">
		<rect x="14" y="14" width="412" height="492" rx="30" fill="#111" transform="translate(10 10)"/>
		<clipPath id="${o.id}"><rect x="14" y="14" width="412" height="492" rx="30"/></clipPath>
		<g clip-path="url(#${o.id})"><rect x="0" y="0" width="440" height="520" fill="${o.sky}"/>
		${o.halo ? `<g class="halo"><circle cx="220" cy="${o.sunY}" r="200" fill="#6fa8ff" opacity="0.35"/><circle cx="220" cy="${o.sunY}" r="140" fill="#4f86ff" opacity="0.55"/><circle cx="220" cy="${o.sunY}" r="90" fill="#2f5bff" opacity="0.8"/></g>` : ''}
		<circle class="sun" cx="220" cy="${o.sunY}" r="${o.sunR}" fill="${o.sun}" stroke="#111" stroke-width="8"/>
		<path d="M0 400 C 80 380, 160 420, 240 396 C 320 372, 380 410, 440 392 V520 H0 Z" fill="${o.ground}" stroke="#111" stroke-width="8"/></g>
		<rect x="14" y="14" width="412" height="492" rx="30" fill="none" stroke="#111" stroke-width="12"/></svg>`;
	const rover = `<svg viewBox="-170 -170 340 300" width="100%" height="100%">
		<line x1="40" y1="-60" x2="40" y2="-130" stroke="#111" stroke-width="10" stroke-linecap="round"/>
		<g class="head"><rect x="8" y="-168" width="100" height="62" rx="16" fill="#111" transform="translate(7 7)"/><rect x="8" y="-168" width="100" height="62" rx="16" fill="#c6ff3d" stroke="#111" stroke-width="8"/>
		<circle cx="40" cy="-136" r="18" fill="#fff" stroke="#111" stroke-width="6"/><circle class="pupil" cx="44" cy="-136" r="8" fill="#111"/><circle cx="82" cy="-136" r="12" fill="#fff" stroke="#111" stroke-width="6"/></g>
		<rect x="-130" y="-70" width="260" height="96" rx="22" fill="#111" transform="translate(9 9)"/><rect x="-130" y="-70" width="260" height="96" rx="22" fill="#fff" stroke="#111" stroke-width="9"/>
		<rect x="-110" y="-54" width="110" height="46" rx="10" fill="#3ce7ff" stroke="#111" stroke-width="6"/><path d="M-90 -54 V-8 M-55 -54 V-8 M-20 -54 V-8" stroke="#111" stroke-width="4"/>
		<g fill="#111" stroke="#111" stroke-width="6"><circle cx="-90" cy="52" r="32"/><circle cx="0" cy="52" r="32"/><circle cx="90" cy="52" r="32"/></g><g fill="#ffd23c"><circle cx="-90" cy="52" r="16"/><circle cx="0" cy="52" r="16"/><circle cx="90" cy="52" r="16"/></g></svg>`;
	const sunDisc = (c, label) => `<svg viewBox="-170 -190 340 380" width="100%" height="100%"><circle r="150" fill="#111" transform="translate(10 10)"/><circle r="150" fill="${c}" stroke="#111" stroke-width="10"/><text y="200" font-size="54" text-anchor="middle" font-family="Bricolage" font-weight="800">${label}</text></svg>`;

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
	const plain = (txt, x, y, size, col, rot = -3) => `<div style="position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%) rotate(${rot}deg);font-size:${size}px;font-family:Bricolage,sans-serif;font-weight:800;color:${col};white-space:nowrap">${txt}</div>`;

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const p = el(`<div class="ill" style="left:230px;top:300px;width:620px;height:733px">${sunset({id: 'h1', sky: '#f3b469', sunY: 360, sunR: 66, sun: '#fff7d0', ground: '#b5482a', halo: true})}</div>`, stage);
			M.pop(p, start + 0.05, {from: 0.5});
			const b = at('blue');
			tl.fromTo(p.querySelector('.halo'), {scale: 0.2, autoAlpha: 0, svgOrigin: '220 360'}, {scale: 1, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.4)'}, b - 0.3);
			tl.fromTo(p.querySelector('.sun'), {y: -80}, {y: 20, duration: Math.max(2, dur - 0.5), ease: 'sine.inOut'}, start + 0.2);
			ctx.cue('chime', b, 0.7);
			M.punchIn(stage, b);
			cardSeq(ctx, [['Mars <span class="hl">sunsets</span>', at('Sunsets') - 0.05, {size: 100}], ['They\'re <span class="hl">blue</span>', b - 0.05, {size: 110, bg: '#fff'}]], 1110);
		},

		compare(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const L = el(`<div class="ill" style="left:40px;top:420px;width:480px;height:568px">${sunset({id: 'c1', sky: '#ff7a45', sunY: 380, sunR: 58, sun: '#ffe36b', ground: '#2b2b6b'})}</div>`, stage);
			const R = el(`<div class="ill" style="left:560px;top:420px;width:480px;height:568px">${sunset({id: 'c2', sky: '#f3b469', sunY: 380, sunR: 58, sun: '#fff7d0', ground: '#b5482a', halo: true})}</div>`, stage);
			const e = at('Earth'), m = at('Mars');
			M.pop(L, e - 0.2, {from: 0.4});
			M.pop(R, m - 0.2, {from: 0.4});
			tl.fromTo(R.querySelector('.halo'), {scale: 0.2, autoAlpha: 0, svgOrigin: '220 380'}, {scale: 1, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.4)'}, m + 0.2);
			const lt = el(plain('EARTH', 280, 360, 64, '#fff'), stage), rt = el(plain('MARS', 800, 360, 64, '#fff', 3), stage);
			M.pop(lt, e, {from: 0.4, sfx: false}); M.pop(rt, m, {from: 0.4, sfx: false});
			cardSeq(ctx, [['Earth: red & <span class="hl">orange</span>', e - 0.05, {size: 70}], ['Mars: <span class="hl">blue</span> glow', m - 0.05, {size: 80}]], 1100);
		},

		dust(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const specks = Array.from({length: 26}, (_, i) => `<circle class="sp" cx="${380 + (i * 61) % 280}" cy="${120 + (i * 83) % 300}" r="${8 + (i * 7) % 9}" fill="#d9a066" stroke="#111" stroke-width="5"/>`).join('');
			const sv = el(`<div class="ill" style="left:40px;top:330px;width:1000px;height:560px"><svg viewBox="0 0 1000 560" width="100%" height="100%">
				${specks}
				<path class="rb" d="M30 270 H 970" stroke="#4f86ff" stroke-width="24" stroke-linecap="round" fill="none"/>
				<path class="rr" d="M30 250 L 380 220 L 470 120 L 560 60 L 700 30" stroke="#ff6b3d" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
				<path class="rr" d="M30 290 L 380 330 L 470 430 L 560 500 L 700 530" stroke="#ffd23c" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>`, stage);
			const d = at('dust');
			sv.querySelectorAll('.sp').forEach((c, i) => M.pop(c, d - 0.2 + i * 0.03, {sfx: i === 0, from: 0.1}));
			M.draw(sv.querySelectorAll('.rr')[0], d + 0.5, 0.9, {ease: 'power1.out'});
			M.draw(sv.querySelectorAll('.rr')[1], d + 0.5, 0.9, {ease: 'power1.out'});
			const b = at('blue');
			M.draw(sv.querySelector('.rb'), b - 0.1, 0.8, {ease: 'power2.out'});
			ctx.cue('whoosh', b, 0.7);
			cardSeq(ctx, [['Fine <span class="hl">dust</span>', d - 0.05, {size: 110}], ['<span class="hl">Blue</span> slips through', b - 0.05, {size: 84}]], 1100);
		},

		close(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const sv = el(`<div class="ill" style="left:90px;top:330px;width:900px;height:760px"><svg viewBox="-450 -380 900 760" width="100%" height="100%">
				<circle class="r3" r="360" fill="#ff9a3c" stroke="#111" stroke-width="10"/><circle class="r2" r="260" fill="#ffd23c" stroke="#111" stroke-width="10"/>
				<circle class="r1" r="150" fill="#4f86ff" stroke="#111" stroke-width="10"/><circle class="s" r="70" fill="#fff7d0" stroke="#111" stroke-width="10"/></svg></div>`, stage);
			const c = at('close'), o = at('orange');
			M.pop(sv.querySelector('.s'), start + 0.1, {from: 0.2, sfx: false});
			tl.fromTo(sv.querySelector('.r1'), {scale: 0.2, svgOrigin: '0 0', autoAlpha: 0}, {scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.6)'}, c - 0.3);
			tl.fromTo(sv.querySelector('.r2'), {scale: 0.2, svgOrigin: '0 0', autoAlpha: 0}, {scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.4)'}, at('yellow') - 0.2);
			tl.fromTo(sv.querySelector('.r3'), {scale: 0.2, svgOrigin: '0 0', autoAlpha: 0}, {scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.4)'}, o - 0.2);
			ctx.cue('fill', c, 0.7); ctx.cue('pop', o, 0.8);
			// keep sun on top
			sv.querySelector('svg').appendChild(sv.querySelector('.s'));
			cardSeq(ctx, [['Blue stays <span class="hl">close</span>', c - 0.05, {size: 84}], ['Sky: <span class="hl">orange</span>', o - 0.05, {size: 100}]], 1100);
		},

		size(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const big = el(`<div class="ill" style="left:60px;top:420px;width:440px;height:490px">${sunDisc('#ffe36b', 'EARTH')}</div>`, stage);
			const small = el(`<div class="ill" style="left:580px;top:420px;width:440px;height:490px">${sunDisc('#ff9a3c', 'MARS')}</div>`, stage);
			M.pop(big, start + 0.1, {from: 0.3});
			const t = at('two');
			M.pop(small, t - 0.3, {from: 0.3});
			tl.fromTo(small.querySelector('svg circle:nth-of-type(2)'), {scale: 1, svgOrigin: '0 0'}, {scale: 0.67, svgOrigin: '0 0', duration: 0.6, ease: 'back.out(1.6)'}, t + 0.1);
			tl.fromTo(small.querySelector('svg circle:nth-of-type(1)'), {scale: 1, svgOrigin: '0 0'}, {scale: 0.67, svgOrigin: '0 0', duration: 0.6, ease: 'back.out(1.6)'}, t + 0.1);
			const num = el(plain('⅔ the size', 540, 340, 130, '#111'), stage);
			M.slam(num, t);
			ctx.cue('punch', t, 0.8);
			cardSeq(ctx, [['Sun looks <span class="hl">smaller</span>', at('Sun') + 0.1, {size: 84}]], 1100);
		},

		twilight(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const p = el(`<div class="ill" style="left:90px;top:420px;width:900px;height:520px"><svg viewBox="0 0 900 520" width="100%" height="100%">
				<rect x="14" y="14" width="872" height="492" rx="30" fill="#111" transform="translate(10 10)"/><clipPath id="tw"><rect x="14" y="14" width="872" height="492" rx="30"/></clipPath>
				<g clip-path="url(#tw)"><rect width="900" height="520" fill="#3b1f6b"/><ellipse class="gl" cx="450" cy="400" rx="420" ry="230" fill="#ff8a1f" opacity="0.55"/><ellipse class="gl" cx="450" cy="400" rx="260" ry="140" fill="#4f86ff" opacity="0.6"/>
				<path d="M0 400 C 150 380, 300 420, 450 396 C 600 372, 750 410, 900 392 V520 H0 Z" fill="#7a2b17" stroke="#111" stroke-width="8"/></g><rect x="14" y="14" width="872" height="492" rx="30" fill="none" stroke="#111" stroke-width="12"/></svg></div>`, stage);
			M.pop(p, start + 0.05, {from: 0.5});
			const t = at('Twilight');
			tl.fromTo(p.querySelectorAll('.gl'), {opacity: 0.9}, {opacity: 0.12, duration: Math.max(2.5, dur - 1), ease: 'none'}, t);
			const ck = el(`<div class="ill" style="left:70px;top:290px;width:280px;height:280px;z-index:4"><svg viewBox="-130 -130 260 260" width="100%" height="100%"><circle r="110" fill="#111" transform="translate(10 10)"/><circle r="110" fill="#fff" stroke="#111" stroke-width="10"/><line class="hd" x1="0" y1="0" x2="0" y2="-80" stroke="#111" stroke-width="12" stroke-linecap="round"/><circle r="12" fill="#111"/></svg></div>`, stage);
			const two = at('two');
			M.pop(ck, two - 0.4, {from: 0.3});
			tl.fromTo(ck.querySelector('.hd'), {rotation: 0, svgOrigin: '0 0'}, {rotation: 720, svgOrigin: '0 0', duration: 1.6, ease: 'power1.inOut'}, two - 0.2);
			const num = el(plain('<span class="n">0</span> hours', 690, 380, 120, '#fff'), stage);
			M.countUp(num.querySelector('.n'), two - 0.1, 0, 2, 0.5, v => Math.round(v));
			cardSeq(ctx, [['Long <span class="hl">twilight</span>', t - 0.05, {size: 100}]], 1100);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Watch a <span class="hl">Martian</span> sunset?', 540, 330, {bg: '#fff', rot: -3, size: 70});
			M.slam(q, start + 0.1);
			const p = el(`<div class="ill" style="left:90px;top:420px;width:900px;height:520px"><svg viewBox="0 0 900 520" width="100%" height="100%"><rect x="14" y="14" width="872" height="492" rx="30" fill="#111" transform="translate(10 10)"/><clipPath id="ct"><rect x="14" y="14" width="872" height="492" rx="30"/></clipPath><g clip-path="url(#ct)"><rect width="900" height="520" fill="#f3b469"/><circle cx="450" cy="300" r="210" fill="#4f86ff" opacity="0.5"/><circle cx="450" cy="300" r="120" fill="#2f5bff" opacity="0.7"/><circle cx="450" cy="300" r="64" fill="#fff7d0" stroke="#111" stroke-width="8"/><path d="M0 380 C 150 360, 300 400, 450 376 C 600 352, 750 390, 900 372 V520 H0 Z" fill="#b5482a" stroke="#111" stroke-width="8"/></g><rect x="14" y="14" width="872" height="492" rx="30" fill="none" stroke="#111" stroke-width="12"/></svg></div>`, stage);
			M.pop(p, start + 0.2, {from: 0.5});
			const r = el(`<div class="ill" style="left:380px;top:600px;width:360px;height:318px;z-index:6">${rover}</div>`, stage);
			M.pop(r, start + 0.5, {from: 0.3});
			M.wobble(r, start + 1.2, dur, {amp: 2, period: 0.8});
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
