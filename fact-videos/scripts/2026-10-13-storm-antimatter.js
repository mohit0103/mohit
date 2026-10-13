// Reel: "Thunderstorms shoot antimatter into space". All illustrations are original SVG drawings.
window.REEL = (function () {
	const cloud = `<svg viewBox="-230 -170 460 420" width="100%" height="100%">
		<g class="bolt"><path d="M10 40 L -50 150 L -5 150 L -35 240 L 70 110 L 22 110 L 55 40 Z" fill="#ffd23c" stroke="#111" stroke-width="9" stroke-linejoin="round"/></g>
		<g fill="#111" transform="translate(12 12)"><circle cx="-120" cy="0" r="75"/><circle cx="-40" cy="-60" r="85"/><circle cx="60" cy="-45" r="80"/><circle cx="125" cy="10" r="65"/><rect x="-125" y="0" width="250" height="75"/></g>
		<g fill="#fff" stroke="#111" stroke-width="9"><circle cx="-120" cy="0" r="75"/><circle cx="-40" cy="-60" r="85"/><circle cx="60" cy="-45" r="80"/><circle cx="125" cy="10" r="65"/><rect x="-125" y="0" width="250" height="75"/></g>
		<g fill="#fff"><circle cx="-120" cy="0" r="70"/><circle cx="-40" cy="-60" r="80"/><circle cx="60" cy="-45" r="75"/><circle cx="125" cy="10" r="60"/><rect x="-125" y="-4" width="250" height="75"/></g>
		<g class="eyes"><ellipse cx="-50" cy="10" rx="24" ry="27" fill="#fff" stroke="#111" stroke-width="7"/><ellipse cx="40" cy="10" rx="24" ry="27" fill="#fff" stroke="#111" stroke-width="7"/>
		<circle cx="-44" cy="16" r="10" fill="#111"/><circle cx="46" cy="16" r="10" fill="#111"/></g>
		<path d="M-84 -26 L -22 -8 M 76 -26 L 14 -8" stroke="#111" stroke-width="10" stroke-linecap="round"/>
		<path d="M-30 52 Q-5 36 20 52" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/></svg>`;

	const sat = `<svg viewBox="-210 -110 420 220" width="100%" height="100%">
		<g fill="#3ce7ff" stroke="#111" stroke-width="8" stroke-linejoin="round"><rect x="-200" y="-55" width="120" height="110" rx="6"/><rect x="80" y="-55" width="120" height="110" rx="6"/></g>
		<g stroke="#111" stroke-width="5"><path d="M-160 -55 V55 M-120 -55 V55 M80 -55 V55 M120 -55 V55 M160 -55 V55 M-200 0 H-80 M80 0 H200"/></g>
		<line x1="-80" y1="0" x2="-45" y2="0" stroke="#111" stroke-width="8"/><line x1="45" y1="0" x2="80" y2="0" stroke="#111" stroke-width="8"/>
		<rect x="-45" y="-45" width="90" height="90" rx="10" fill="#111" transform="translate(7 7)"/>
		<rect x="-45" y="-45" width="90" height="90" rx="10" fill="#c6ff3d" stroke="#111" stroke-width="8"/>
		<circle cx="0" cy="0" r="22" fill="#fff" stroke="#111" stroke-width="7"/><circle class="pupil" cx="4" cy="2" r="9" fill="#111"/></svg>`;

	// matter (blue) / antimatter (pink) twin balls
	const ball = (col, mirror, label) => `<svg viewBox="-110 -140 220 280" width="100%" height="100%">
		<circle r="100" fill="#111" transform="translate(10 10)"/><circle r="100" fill="${col}" stroke="#111" stroke-width="9"/>
		<g transform="scale(${mirror ? -1 : 1} 1)"><ellipse cx="-34" cy="-18" rx="20" ry="24" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="34" cy="-18" rx="20" ry="24" fill="#fff" stroke="#111" stroke-width="6"/>
		<circle cx="-28" cy="-12" r="9" fill="#111"/><circle cx="40" cy="-12" r="9" fill="#111"/><path d="M-30 36 Q0 62 30 36" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/></g>
		<text y="140" font-size="40" text-anchor="middle" font-family="Bricolage" font-weight="800">${label}</text></svg>`;

	const burst = `<svg viewBox="-250 -250 500 500" width="100%" height="100%"><polygon points="${Array.from({length: 24}, (_, i) => { const a = i * Math.PI / 12, r = i % 2 ? 130 : 240; return (Math.cos(a) * r).toFixed(0) + ',' + (Math.sin(a) * r).toFixed(0); }).join(' ')}" fill="#ffd23c" stroke="#111" stroke-width="9" stroke-linejoin="round"/><circle r="85" fill="#fff" stroke="#111" stroke-width="8"/></svg>`;

	const screen = `<svg viewBox="0 0 960 520" width="100%" height="100%">
		<rect x="22" y="22" width="920" height="480" rx="30" fill="#111" transform="translate(10 10)"/>
		<rect x="20" y="20" width="920" height="480" rx="30" fill="#111" stroke="#111" stroke-width="10"/>
		<rect x="50" y="50" width="860" height="420" rx="14" fill="#1d3b1d"/>
		<g stroke="#2e6b2e" stroke-width="3"><path d="M50 150 H910 M50 260 H910 M50 370 H910 M240 50 V470 M430 50 V470 M620 50 V470 M810 50 V470"/></g>
		<path class="wave" d="M70 380 H 330 L 365 120 L 400 420 L 435 380 H 890" fill="none" stroke="#c6ff3d" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || '#111'};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}
	// rising antimatter particles ("+" balls)
	function particles(ctx, root, t, x0, y0, n = 6, rise = 260, spread = 120) {
		for (let i = 0; i < n; i++) {
			const p = ctx.el(`<div class="ill" style="left:${x0 + (i - (n - 1) / 2) * spread / n * 2 - 24}px;top:${y0}px;width:48px;height:48px"><svg viewBox="-24 -24 48 48" width="100%" height="100%"><circle r="20" fill="#ff4fd8" stroke="#111" stroke-width="5"/><path d="M-9 0 H9 M0 -9 V9" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg></div>`, root);
			ctx.tl.fromTo(p, {y: 0, autoAlpha: 0, scale: 0.6}, {y: -rise, autoAlpha: 1, scale: 1, duration: 0.55, ease: 'power1.out', repeat: 12, repeatDelay: 0.2}, t + i * 0.18);
		}
	}

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const c = el(`<div class="ill" style="left:260px;top:500px;width:560px;height:510px">${cloud}</div>`, stage);
			M.stretch(c, start + 0.05);
			M.float(c, start + 0.7, dur, {amp: 10, period: 0.9});
			const bolt = c.querySelector('.bolt');
			tl.set(bolt, {opacity: 0}, start);
			const s = at('shoot');
			tl.fromTo(bolt, {opacity: 0}, {opacity: 1, duration: 0.05, yoyo: true, repeat: 5}, s);
			tl.set(bolt, {opacity: 1}, s + 0.6);
			ctx.cue('snap', s, 0.9);
			M.shake(c, s + 0.05, {amp: 8, n: 8});
			particles(ctx, stage, s + 0.1, 540, 480, 5, 190, 160);
			const k1 = card(ctx, 'Storms <span class="hl">shoot</span>', 540, 1110, {size: 96, bg: '#fff'});
			M.slam(k1, s - 0.05);
			const k2 = card(ctx, '<span class="hl">Antimatter</span>?!', 540, 1110, {size: 100, bg: '#c6ff3d', rot: 3});
			tl.set(k1, {autoAlpha: 0}, at('antimatter') - 0.05);
			M.slam(k2, at('antimatter') - 0.05);
			const sa = el(`<div class="ill" style="left:690px;top:260px;width:340px;height:176px">${sat}</div>`, stage);
			M.slideIn(sa, at('NASA') - 0.1, {from: 'right'});
			M.float(sa, at('NASA') + 0.5, dur, {amp: 8, period: 1.2});
		},

		twin(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const a = el(`<div class="ill" style="left:60px;top:430px;width:330px;height:420px">${ball('#3ca8ff', false, 'MATTER')}</div>`, stage);
			const b = el(`<div class="ill" style="left:690px;top:430px;width:330px;height:420px">${ball('#ff4fd8', true, 'ANTIMATTER')}</div>`, stage);
			M.pop(a, start + 0.1, {from: 0.3});
			M.pop(b, at('mirror') - 0.1, {from: 0.3});
			M.float(a, start + 0.8, at('touch') - start - 0.8, {amp: 10, period: 0.8});
			M.float(b, at('mirror') + 0.6, at('touch') - at('mirror') - 0.6, {amp: 10, period: 0.8});
			const t = at('touch');
			tl.to(a, {x: 230, duration: 0.35, ease: 'power3.in'}, t - 0.1);
			tl.to(b, {x: -230, duration: 0.35, ease: 'power3.in'}, t - 0.1);
			const v = at('vanish');
			tl.to([a, b], {scale: 0, autoAlpha: 0, duration: 0.2, ease: 'back.in(2)'}, v);
			const bu = el(`<div class="ill" style="left:290px;top:370px;width:500px;height:500px">${burst}</div>`, stage);
			M.pop(bu, v, {from: 0.2, sfx: false});
			ctx.cue('punch', v, 1);
			M.shake(stage, v + 0.05, {amp: 8, n: 8});
			const k1 = card(ctx, 'Mirror <span class="hl">twin</span>', 540, 1030, {size: 100, bg: '#fff'});
			M.slam(k1, at('mirror'));
			const k2 = card(ctx, 'Both <span class="hl">vanish</span>', 540, 1030, {size: 100, bg: '#c6ff3d', rot: 3});
			tl.set(k1, {autoAlpha: 0}, v - 0.05);
			M.slam(k2, v - 0.05);
		},

		zambia(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const big = el(`<div class="big" style="left:540px;top:350px;transform:translate(-50%,-50%) rotate(-3deg);font-size:210px;color:#fff">2009</div>`, stage);
			M.slam(big, at('2009'));
			const c = el(`<div class="ill" style="left:280px;top:560px;width:520px;height:470px">${cloud}</div>`, stage);
			M.rise(c, start + 0.1);
			M.float(c, start + 0.8, dur, {amp: 10, period: 1});
			const bolt = c.querySelector('.bolt');
			const b = at('beamed');
			particles(ctx, stage, b, 540, 560, 6, 130, 180);
			tl.fromTo(bolt, {opacity: 0.2}, {opacity: 1, duration: 0.06, yoyo: true, repeat: 5}, b - 0.1);
			ctx.cue('snap', b, 0.9);
			const k = card(ctx, '<span class="hl">Zambia</span>', 540, 1110, {size: 110, bg: '#fff'});
			M.slam(k, at('Zambia'));
		},

		travel(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const num = el(`<div class="big" style="left:540px;top:350px;transform:translate(-50%,-50%) rotate(-3deg);font-size:120px;white-space:nowrap;color:#ffd23c"><span class="n">0</span> miles</div>`, stage);
			M.pop(num, at('about') - 0.25, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('about') - 0.1, 0, 2800, 1.1);
			const c = el(`<div class="ill" style="left:60px;top:700px;width:300px;height:275px">${cloud}</div>`, stage);
			M.pop(c, start + 0.1);
			const arc = el(`<div class="ill" style="left:0;top:430px;width:1080px;height:520px"><svg viewBox="0 0 1080 520" width="100%" height="100%"><path class="arc" d="M210 300 C 360 40, 660 40, 840 150" fill="none" stroke="#c6ff3d" stroke-width="16" stroke-dasharray="26 18" stroke-linecap="round"/></svg></div>`, stage);
			const f = at('followed');
			M.draw(arc.querySelector('.arc'), f, 1.4, {ease: 'power1.inOut'});
			ctx.cue('whoosh', f, 0.6);
			const sa = el(`<div class="ill" style="left:700px;top:520px;width:340px;height:176px">${sat}</div>`, stage);
			M.pop(sa, at('Fermi') - 0.1, {from: 0.3});
			M.float(sa, at('Fermi') + 0.5, dur, {amp: 8, period: 1.1});
			tl.to(sa.querySelector('.pupil'), {x: -8, y: 6, duration: 0.2}, at('Fermi') + 0.2);
			const k = card(ctx, 'Over <span class="hl">Egypt</span>', 540, 1100, {size: 104, bg: '#fff'});
			M.slam(k, at('Egypt'));
		},

		flash(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const s = el(`<div class="ill" style="left:60px;top:300px;width:960px;height:520px">${screen}</div>`, stage);
			M.pop(s, start + 0.1, {from: 0.6});
			const D = 1.8, f = at('flash');
			M.draw(s.querySelector('.wave'), Math.max(start + 0.2, f - 0.35 * D), D, {ease: 'none'});
			const bu = el(`<div class="ill" style="left:310px;top:230px;width:260px;height:260px">${burst}</div>`, stage);
			M.pop(bu, f, {from: 0.2, sfx: false});
			ctx.cue('punch', f, 0.9);
			M.shake(s, f + 0.05, {amp: 6, n: 7});
			const num = el(`<div class="big" style="left:540px;top:900px;transform:translate(-50%,-50%) rotate(-3deg);font-size:120px;white-space:nowrap;color:#fff"><span class="n">0</span> eV</div>`, stage);
			M.pop(num, at('511') - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('511') - 0.2, 0, 511000, 1.0);
			const k = card(ctx, 'Gamma <span class="hl">rays</span>', 540, 1085, {size: 84, bg: '#fff'});
			M.slam(k, at('gamma'));
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Storms did <span class="hl">that?</span>', 540, 330, {bg: '#fff', rot: -3, size: 96});
			M.slam(q, start + 0.1);
			const c = el(`<div class="ill" style="left:300px;top:430px;width:480px;height:440px">${cloud}</div>`, stage);
			M.stretch(c, at('think') - 0.1);
			M.float(c, at('think') + 0.4, dur, {amp: 12, period: 0.9});
			const yes = card(ctx, 'YES', 270, 1030, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1030, {bg: '#c6ff3d', size: 120, rot: 6});
			M.slideIn(yes, at('Yes') - 0.1, {from: 'left'});
			ctx.cue('pop', at('Yes'), 0.9);
			M.slideIn(no, at('no') - 0.1, {from: 'right'});
			ctx.cue('pop', at('no'), 0.9);
			tl.to(c.querySelector('.eyes'), {x: -10, duration: 0.15}, at('Yes')).to(c.querySelector('.eyes'), {x: 10, duration: 0.15}, at('no'));
			M.wobble(yes, at('no') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(no, at('no') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('no') + 0.35, 0.8);
		},
	};
})();
