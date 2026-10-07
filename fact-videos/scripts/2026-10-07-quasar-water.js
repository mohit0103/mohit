// Reel: "The biggest water reservoir ever found is around a black hole". All illustrations are original SVG drawings.
window.REEL = (function () {
	const eyes = (lx, rx, y, r = 30) => `<g class="eyes">
		<ellipse cx="${lx}" cy="${y}" rx="${r}" ry="${r * 1.12}" fill="#fff" stroke="#111" stroke-width="8"/>
		<ellipse cx="${rx}" cy="${y}" rx="${r}" ry="${r * 1.12}" fill="#fff" stroke="#111" stroke-width="8"/>
		<g class="pupils"><circle cx="${lx + 4}" cy="${y + 6}" r="${r * 0.42}" fill="#111"/><circle cx="${rx + 4}" cy="${y + 6}" r="${r * 0.42}" fill="#111"/></g></g>`;

	const drop = (col = '#3ca8ff') => `<svg viewBox="-130 -190 260 340" width="100%" height="100%">
		<path d="M0 -170 C 40 -100, 115 -30, 115 40 C 115 105, 64 145, 0 145 C -64 145, -115 105, -115 40 C -115 -30, -40 -100, 0 -170 Z" fill="#111" transform="translate(12 12)"/>
		<path d="M0 -170 C 40 -100, 115 -30, 115 40 C 115 105, 64 145, 0 145 C -64 145, -115 105, -115 40 C -115 -30, -40 -100, 0 -170 Z" fill="${col}" stroke="#111" stroke-width="9" stroke-linejoin="round"/>
		<path d="M-62 10 C -66 -20, -50 -50, -32 -66" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.8"/>
		${eyes(-36, 36, 40, 26)}<path d="M-22 92 Q0 110 22 92" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/></svg>`;

	function earth() {
		return `<svg viewBox="-160 -160 320 320" width="100%" height="100%">
			<circle r="140" fill="#111" transform="translate(12 12)"/><circle r="140" fill="#3ca8ff" stroke="#111" stroke-width="9"/>
			<g fill="#5be36b" stroke="#111" stroke-width="7" stroke-linejoin="round">
				<path d="M-110 -60 C -80 -110, -20 -100, -10 -60 C 0 -30, -50 -20, -60 10 C -70 40, -120 20, -125 -20 Z"/>
				<path d="M30 -120 C 80 -110, 120 -60, 100 -30 C 80 0, 40 -20, 30 -50 C 20 -80, 0 -100, 30 -120 Z"/>
				<path d="M20 40 C 60 20, 110 40, 100 90 C 80 120, 30 120, 20 90 C 10 70, -10 60, 20 40 Z"/></g>
			${eyes(-45, 45, -5, 30)}<path d="M-28 50 Q0 74 28 50" stroke="#111" stroke-width="9" fill="none" stroke-linecap="round"/></svg>`;
	}

	// black hole with a glowing accretion disk and jets
	const hole = `<svg viewBox="-260 -260 520 520" width="100%" height="100%">
		<g class="jets"><path d="M-14 -40 L 0 -250 L 14 -40 Z" fill="#c6ff3d" stroke="#111" stroke-width="7"/><path d="M-14 40 L 0 250 L 14 40 Z" fill="#c6ff3d" stroke="#111" stroke-width="7"/></g>
		<ellipse rx="240" ry="78" fill="#111" transform="translate(12 12)"/>
		<ellipse rx="240" ry="78" fill="#ff8a1f" stroke="#111" stroke-width="9"/>
		<ellipse rx="190" ry="58" fill="#ffd23c" stroke="#111" stroke-width="6"/>
		<g class="disk"><ellipse rx="215" ry="68" fill="none" stroke="#ff4fd8" stroke-width="12" stroke-dasharray="40 50" stroke-linecap="round"/></g>
		<circle r="92" fill="#111" stroke="#fff" stroke-width="6"/>
		<path d="M-190 0 A 190 58 0 0 0 190 0" fill="#ffd23c" stroke="#111" stroke-width="6"/>
		<path d="M-240 0 A 240 78 0 0 0 240 0 L 190 0 A 190 58 0 0 1 -190 0 Z" fill="#ff8a1f" stroke="#111" stroke-width="9"/></svg>`;

	// a friendly original alien
	const alien = `<svg viewBox="-120 -170 240 300" width="100%" height="100%">
		<line x1="-40" y1="-110" x2="-60" y2="-160" stroke="#111" stroke-width="8"/><circle cx="-60" cy="-160" r="14" fill="#ff4fd8" stroke="#111" stroke-width="6"/>
		<line x1="40" y1="-110" x2="60" y2="-160" stroke="#111" stroke-width="8"/><circle cx="60" cy="-160" r="14" fill="#ff4fd8" stroke="#111" stroke-width="6"/>
		<path d="M-95 -20 C -95 -100, 95 -100, 95 -20 C 95 60, 60 120, 0 120 C -60 120, -95 60, -95 -20 Z" fill="#111" transform="translate(10 10)"/>
		<path d="M-95 -20 C -95 -100, 95 -100, 95 -20 C 95 60, 60 120, 0 120 C -60 120, -95 60, -95 -20 Z" fill="#c6ff3d" stroke="#111" stroke-width="9"/>
		<ellipse cx="0" cy="-20" rx="44" ry="34" fill="#fff" stroke="#111" stroke-width="8"/><circle class="pupil" cx="6" cy="-14" r="16" fill="#111"/>
		<path d="M-26 50 Q0 70 26 50" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/></svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || '#111'};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}
	function starfield(ctx, n = 40, seed = 3) {
		let s = seed;
		const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
		const svg = `<svg viewBox="0 0 1080 1200" width="1080" height="1200">${Array.from({length: n}, () => `<circle class="st" cx="${(r() * 1080).toFixed(0)}" cy="${(r() * 1200).toFixed(0)}" r="${(2 + r() * 5).toFixed(1)}" fill="#fff"/>`).join('')}</svg>`;
		const e = ctx.el(`<div class="ill" style="left:0;top:180px;width:1080px;height:1200px;z-index:0">${svg}</div>`, ctx.stage);
		e.querySelectorAll('.st').forEach((p, i) => ctx.tl.to(p, {opacity: 0.2, duration: 0.4 + (i % 5) * 0.15, repeat: 20, yoyo: true, ease: 'sine.inOut'}, ctx.start + (i % 7) * 0.1));
		return e;
	}

	return {
		// 1. HOOK
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const d = el(`<div class="ill" style="left:330px;top:300px;width:420px;height:560px">${drop()}</div>`, stage);
			M.stretch(d, start + 0.05);
			M.float(d, start + 0.6, dur, {amp: 14, period: 0.9});
			tl.to(d.querySelector('.pupils'), {x: -10, y: -8, duration: 0.25}, start + 0.8);
			const c = card(ctx, 'Not on <span class="hl">Earth</span>', 540, 1010, {size: 100});
			M.slam(c, at('isn'));
			const c2 = card(ctx, 'Around a <span class="hl">black hole</span>', 540, 1010, {size: 84, bg: '#fff', rot: 3});
			tl.set(c, {autoAlpha: 0}, at('black') - 0.05);
			M.slam(c2, at('black') - 0.05);
			M.punchIn(stage, at('black'));
		},

		// 2. DISTANCE
		far(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			starfield(ctx, 46, 5);
			const num = el(`<div class="big" style="left:540px;top:560px;transform:translate(-50%,-50%);font-size:330px;color:#ffd23c"><span class="n">0</span>+</div>`, stage);
			M.pop(num, at('12') - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('12') - 0.25, 0, 12, 0.9, v => Math.round(v));
			const c = card(ctx, 'billion <span class="hl">light-years</span>', 540, 900, {bg: '#3ce7ff', size: 80});
			M.slam(c, at('light'));
			const beam = el(`<div class="ill" style="left:60px;top:1060px;width:960px;height:80px"><svg viewBox="0 0 960 80" width="100%" height="100%">
				<path class="bm" d="M20 40 H 900" stroke="#c6ff3d" stroke-width="18" stroke-linecap="round"/><path d="M880 12 L 940 40 L 880 68 Z" fill="#c6ff3d" stroke="#111" stroke-width="6"/></svg></div>`, stage);
			M.draw(beam.querySelector('.bm'), start + 0.3, Math.max(1, dur - 0.6), {ease: 'none'});
		},

		// 3. A QUASAR
		quasar(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const h = el(`<div class="ill" style="left:90px;top:300px;width:900px;height:640px">${hole}</div>`, stage);
			M.pop(h, start + 0.05, {from: 0.3});
			tl.to(h.querySelector('.disk ellipse'), {strokeDashoffset: -900, duration: dur, ease: 'none'}, start);
			tl.fromTo(h.querySelector('.jets'), {scaleY: 0, transformOrigin: '50% 50%', svgOrigin: '0 0'}, {scaleY: 1, duration: 0.5, ease: 'back.out(2)'}, at('eating') - 0.1);
			ctx.cue('snap', at('eating'), 0.8);
			M.shake(h, at('eating') + 0.5, {amp: 6, n: 9});
			const c = card(ctx, '<span class="hl">Quasar</span>', 540, 1030, {bg: '#c6ff3d', size: 110, rot: -4});
			M.slam(c, at('quasar'));
		},

		// 4. 140 TRILLION OCEANS
		amount(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const e = el(`<div class="ill" style="left:110px;top:640px;width:200px;height:200px">${earth()}</div>`, stage);
			M.pop(e, start + 0.05);
			const d = el(`<div class="ill" style="left:420px;top:290px;width:520px;height:690px">${drop()}</div>`, stage);
			tl.fromTo(d, {scale: 0.15, transformOrigin: '50% 90%', autoAlpha: 1}, {scale: 1, duration: 1.6, ease: 'back.out(1.4)'}, at('holds'));
			ctx.cue('fill', at('holds'), 0.8);
			tl.to(e.querySelector('.pupils'), {x: 12, y: -10, duration: 0.3}, at('holds') + 0.6);
			const num = el(`<div class="big" style="left:540px;top:400px;transform:translate(-50%,-50%) rotate(-4deg);font-size:150px;color:#fff"><span class="n">0</span> trillion×</div>`, stage);
			M.pop(num, at('140') - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('140') - 0.3, 0, 140, 1.0, v => Math.round(v));
			const c = card(ctx, "Earth's <span class=\"hl\">oceans</span>", 540, 1070, {bg: '#fff', size: 84, rot: 3});
			M.slam(c, at('oceans') - 0.1);
		},

		// 5. OLDER THAN EARTH
		older(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const line = el(`<div class="ill" style="left:60px;top:560px;width:960px;height:300px"><svg viewBox="0 0 960 300" width="100%" height="100%">
				<line x1="30" y1="150" x2="930" y2="150" stroke="#111" stroke-width="12" stroke-linecap="round"/>
				<g class="m1" transform="translate(130 150)"><circle r="34" fill="#ffd23c" stroke="#111" stroke-width="8"/><text x="-100" y="-62" font-size="46" font-family="Bricolage" font-weight="800">LIGHT LEAVES</text><text x="-100" y="108" font-size="40" font-family="Bricolage" font-weight="800">12+ bn yrs ago</text></g>
				<g class="m2" transform="translate(580 150)"><circle r="34" fill="#5be36b" stroke="#111" stroke-width="8"/><text y="-62" font-size="46" text-anchor="middle" font-family="Bricolage" font-weight="800">EARTH FORMS</text><text y="108" font-size="46" text-anchor="middle" font-family="Bricolage" font-weight="800">4.5 bn yrs ago</text></g>
				<g class="m3" transform="translate(900 150)"><circle r="26" fill="#ff4fd8" stroke="#111" stroke-width="8"/><text x="30" y="-62" font-size="46" text-anchor="end" font-family="Bricolage" font-weight="800">NOW</text></g></svg></div>`, stage);
			M.rise(line, start + 0.05);
			M.pop(line.querySelector('.m1'), at('light') - 0.1);
			M.pop(line.querySelector('.m2'), at('Earth') - 0.1);
			M.pop(line.querySelector('.m3'), at('existed') - 0.1, {sfx: false});
			const c = card(ctx, 'Older than <span class="hl">Earth</span>', 540, 1040, {bg: '#c6ff3d', size: 96, rot: -3});
			M.slam(c, at('existed'));
		},

		// 6. THE QUESTION
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Life out <span class="hl">there?</span>', 540, 330, {bg: '#fff', rot: -3, size: 100});
			M.slam(q, start + 0.1);
			const a = el(`<div class="ill" style="left:380px;top:440px;width:320px;height:440px">${alien}</div>`, stage);
			M.stretch(a, at('life') - 0.1);
			M.float(a, at('life') + 0.4, dur, {amp: 14, period: 0.8});
			const yes = card(ctx, 'YES', 270, 1030, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1030, {bg: '#ff4fd8', size: 120, rot: 6});
			M.slideIn(yes, at('Yes') - 0.1, {from: 'left'});
			ctx.cue('pop', at('Yes'), 0.9);
			M.slideIn(no, at('no') - 0.1, {from: 'right'});
			ctx.cue('pop', at('no'), 0.9);
			tl.to(a.querySelector('.pupil'), {x: -20, duration: 0.2}, at('Yes')).to(a.querySelector('.pupil'), {x: 20, duration: 0.2}, at('no'));
			M.wobble(yes, at('no') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(no, at('no') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('no') + 0.35, 0.8);
		},
	};
})();
