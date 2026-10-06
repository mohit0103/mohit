// Reel: "You can't tickle yourself". All illustrations are original SVG drawings.
window.REEL = (function () {
	const LOBES = [[-112, -38, 78], [-62, -100, 74], [18, -116, 78], [98, -72, 80], [128, 18, 72], [70, 84, 70], [-18, 96, 72], [-108, 62, 70], [0, 0, 108]];
	function brain() {
		return `<svg viewBox="-230 -200 460 400" width="100%" height="100%">
			<g fill="#111" transform="translate(14 14)">${LOBES.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 9}"/>`).join('')}</g>
			<g fill="#111">${LOBES.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 9}"/>`).join('')}</g>
			<g fill="#ff7ad9">${LOBES.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
			<g stroke="#c43aa0" stroke-width="10" fill="none" stroke-linecap="round"><path d="M2 -150 C -22 -80, 24 -30, 0 30"/><path d="M-150 -40 C -110 -60, -90 -20, -60 -40"/><path d="M140 -40 C 110 -10, 150 20, 120 50"/></g>
			<g class="eyes"><ellipse cx="-58" cy="-4" rx="46" ry="52" fill="#fff" stroke="#111" stroke-width="9"/><ellipse cx="58" cy="-4" rx="46" ry="52" fill="#fff" stroke="#111" stroke-width="9"/>
			<g class="pupils"><circle cx="-52" cy="6" r="19" fill="#111"/><circle cx="64" cy="6" r="19" fill="#111"/></g></g>
			<path class="mouth" d="M-36 74 Q0 108 36 74" stroke="#111" stroke-width="11" fill="none" stroke-linecap="round"/></svg>`;
	}
	// open cartoon hand (palm facing us)
	const hand = `<svg viewBox="-100 -130 200 260" width="100%" height="100%">
		<g transform="translate(9 9)" fill="#111"><rect x="-64" y="-30" width="128" height="150" rx="54"/><rect x="-62" y="-118" width="34" height="110" rx="17"/><rect x="-22" y="-128" width="34" height="120" rx="17"/><rect x="18" y="-118" width="34" height="110" rx="17"/><rect x="-108" y="-10" width="72" height="34" rx="17" transform="rotate(-30)"/></g>
		<g fill="#ffd23c" stroke="#111" stroke-width="8"><rect x="-62" y="-118" width="34" height="120" rx="17"/><rect x="-22" y="-128" width="34" height="130" rx="17"/><rect x="18" y="-118" width="34" height="120" rx="17"/><rect x="-108" y="-10" width="72" height="34" rx="17" transform="rotate(-30)"/><rect x="-64" y="-40" width="128" height="160" rx="54"/></g>
		<path d="M-30 40 q30 20 60 0" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.5"/></svg>`;
	// a feather with a cheeky face
	const feather = `<svg viewBox="-60 -170 120 340" width="100%" height="100%">
		<path d="M0 160 C 4 60, 6 -40, 0 -160" stroke="#111" stroke-width="10" fill="none" stroke-linecap="round"/>
		<path d="M2 -160 C 70 -110, 70 40, 6 120 C -64 40, -66 -110, 2 -160 Z" fill="#111" transform="translate(8 8)"/>
		<path d="M2 -160 C 70 -110, 70 40, 6 120 C -64 40, -66 -110, 2 -160 Z" fill="#3ce7ff" stroke="#111" stroke-width="8" stroke-linejoin="round"/>
		${[-110, -70, -30, 10, 50].map(y => `<path d="M3 ${y} L 38 ${y - 26} M3 ${y} L -32 ${y - 26}" stroke="#111" stroke-width="5" stroke-linecap="round"/>`).join('')}
		<circle cx="-14" cy="-50" r="9" fill="#111"/><circle cx="18" cy="-50" r="9" fill="#111"/><path d="M-12 -24 Q3 -8 18 -24" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;
	// an original boxy robot holding a feather
	const robot = `<svg viewBox="-170 -210 340 420" width="100%" height="100%">
		<line x1="0" y1="-190" x2="0" y2="-140" stroke="#111" stroke-width="9"/><circle cx="0" cy="-195" r="16" fill="#ff4fd8" stroke="#111" stroke-width="7"/>
		<g transform="translate(12 12)" fill="#111"><rect x="-90" y="-140" width="180" height="130" rx="30"/><rect x="-110" y="0" width="220" height="190" rx="34"/></g>
		<rect x="-90" y="-140" width="180" height="130" rx="30" fill="#c6c9d6" stroke="#111" stroke-width="9"/>
		<rect x="-60" y="-110" width="120" height="66" rx="18" fill="#111"/><circle class="re" cx="-28" cy="-77" r="14" fill="#c6ff3d"/><circle class="re" cx="28" cy="-77" r="14" fill="#c6ff3d"/>
		<rect x="-110" y="0" width="220" height="190" rx="34" fill="#c6c9d6" stroke="#111" stroke-width="9"/>
		<rect x="-50" y="40" width="100" height="56" rx="12" fill="#ffd23c" stroke="#111" stroke-width="7"/>
		<g class="arm"><path d="M110 60 C 160 40, 170 -10, 150 -50" stroke="#111" stroke-width="22" fill="none" stroke-linecap="round"/>
		<path d="M150 -50 C 154 -100, 160 -140, 156 -190" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>
		<path d="M157 -190 C 190 -160, 190 -90, 158 -60 C 126 -90, 124 -160, 157 -190 Z" fill="#3ce7ff" stroke="#111" stroke-width="6"/></g></svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || '#111'};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}

	return {
		// 1. HOOK: you can't tickle yourself
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const h = el(`<div class="ill" style="left:150px;top:360px;width:420px;height:540px">${hand}</div>`, stage);
			const f = el(`<div class="ill" style="left:560px;top:330px;width:240px;height:560px">${feather}</div>`, stage);
			M.pop(h, start + 0.05);
			M.slideIn(f, start + 0.2, {from: 'right'});
			tl.to(f, {rotation: -14, x: -40, duration: 0.14, repeat: Math.max(3, Math.floor(dur / 0.28)), yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 100%'}, start + 0.7);
			const c = card(ctx, 'Brain says <span class="hl">no.</span>', 540, 1030, {size: 100});
			M.slam(c, at('brain'));
			M.punchIn(stage, at('brain') + 0.05);
		},

		// 2. THE BRAIN PREDICTS
		predict(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const b = el(`<div class="ill" style="left:120px;top:520px;width:480px;height:420px">${brain()}</div>`, stage);
			M.pop(b, start + 0.05);
			M.float(b, start + 0.5, dur, {amp: 12, period: 1});
			const bub = el(`<div class="ill" style="left:560px;top:270px;width:420px;height:400px"><svg viewBox="0 0 420 400" width="100%" height="100%">
				<circle cx="40" cy="360" r="18" fill="#fff" stroke="#111" stroke-width="7"/><circle cx="80" cy="310" r="28" fill="#fff" stroke="#111" stroke-width="7"/>
				<ellipse cx="250" cy="170" rx="165" ry="140" fill="#111" transform="translate(10 10)"/><ellipse cx="250" cy="170" rx="165" ry="140" fill="#fff" stroke="#111" stroke-width="9"/></svg></div>`, stage);
			M.pop(bub, at('predicts') - 0.2);
			const fi = el(`<div class="ill" style="left:735px;top:300px;width:110px;height:260px">${feather}</div>`, stage);
			M.pop(fi, at('predicts') + 0.1, {rot: 30});
			M.wobble(fi, at('predicts') + 0.5, dur, {amp: 12, period: 0.3});
			tl.to(b.querySelector('.pupils'), {x: 14, y: -12, duration: 0.25}, at('predicts'));
			const c = card(ctx, '<span class="hl">Predicted!</span>', 540, 1080, {bg: '#fff', size: 88, rot: 3});
			M.slam(c, at('exactly'));
		},

		// 3. THE TICKLE GETS TURNED DOWN
		cancel(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const meter = el(`<div class="card" style="left:540px;top:640px;width:860px;height:420px;background:#fff;padding:40px 50px;transform:translate(-50%,-50%) rotate(-2deg);white-space:normal">
				<div style="font-size:70px;text-align:left;margin-bottom:30px">TICKLE <span style="color:#ff4fd8">METER</span></div>
				<div style="height:120px;border:7px solid #111;border-radius:60px;overflow:hidden;background:#eee"><div class="fill" style="height:100%;width:95%;background:#ff4fd8;border-right:7px solid #111"></div></div>
			</div>`, stage);
			M.pop(meter, start + 0.05, {from: 0.6});
			const fill = meter.querySelector('.fill');
			tl.fromTo(fill, {width: '95%'}, {width: '12%', duration: 1.1, ease: 'power3.inOut', immediateRender: false}, at('turns'));
			ctx.cue('fill', at('turns'), 0.7);
			const knob = el(`<div class="ill" style="left:430px;top:900px;width:220px;height:220px"><svg viewBox="-60 -60 120 120" width="100%" height="100%">
				<circle r="50" fill="#111" transform="translate(6 6)"/><circle r="50" fill="#ffd23c" stroke="#111" stroke-width="8"/><line class="k" x1="0" y1="0" x2="0" y2="-36" stroke="#111" stroke-width="10" stroke-linecap="round"/></svg></div>`, stage);
			M.pop(knob, start + 0.4);
			tl.fromTo(knob.querySelector('.k'), {rotation: 120, svgOrigin: '0 0'}, {rotation: -120, duration: 1.1, ease: 'power3.inOut', immediateRender: false}, at('turns'));
		},

		// 4. THE TICKLE ROBOT
		robot(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const r = el(`<div class="ill" style="left:130px;top:320px;width:520px;height:640px">${robot}</div>`, stage);
			M.stretch(r, at('robot') - 0.1);
			tl.to(r.querySelectorAll('.re'), {scale: 0.2, transformOrigin: '50% 50%', duration: 0.08, repeat: 3, yoyo: true}, at('robot') + 0.6);
			const h = el(`<div class="ill" style="left:660px;top:500px;width:300px;height:390px">${hand}</div>`, stage);
			M.slideIn(h, at('palm') - 0.4, {from: 'right'});
			tl.to(r.querySelector('.arm'), {rotation: 10, svgOrigin: '110 60', duration: 0.16, repeat: Math.max(3, Math.floor((dur - 1) / 0.32)), yoyo: true, ease: 'sine.inOut'}, at('stroked') - 0.1);
			const c = card(ctx, 'Tickle <span class="hl">robot</span>', 540, 1080, {bg: '#ffd23c', size: 96});
			M.slam(c, at('robot') + 0.2);
		},

		// 5. ADD A DELAY: MORE TICKLY
		delay(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const sw = el(`<div class="ill" style="left:90px;top:330px;width:340px;height:380px"><svg viewBox="-130 -160 260 300" width="100%" height="100%">
				<rect x="-22" y="-158" width="44" height="34" rx="8" fill="#ff4fd8" stroke="#111" stroke-width="8"/>
				<circle r="120" fill="#111" transform="translate(12 12)"/><circle r="120" fill="#fff" stroke="#111" stroke-width="10"/>
				<line class="hand" x1="0" y1="0" x2="0" y2="-82" stroke="#111" stroke-width="12" stroke-linecap="round"/><circle r="11" fill="#111"/></svg></div>`, stage);
			M.pop(sw, start + 0.05);
			tl.fromTo(sw.querySelector('.hand'), {rotation: 0, svgOrigin: '0 0'}, {rotation: 90, duration: 0.6, ease: 'back.out(2)'}, at('delay'));
			const chart = el(`<div class="card" style="left:690px;top:640px;width:560px;height:560px;background:#fff;padding:0;transform:translate(-50%,-50%) rotate(2deg)"><svg viewBox="0 0 560 560" width="100%" height="100%">
				<line x1="60" y1="470" x2="510" y2="470" stroke="#111" stroke-width="8" stroke-linecap="round"/>
				${[[90, 70, '#3ce7ff'], [220, 190, '#c6ff3d'], [350, 330, '#ff4fd8']].map(([x, h, c], i) => `<rect class="bar" x="${x}" y="${470 - h}" width="100" height="${h}" rx="10" fill="${c}" stroke="#111" stroke-width="7"/>`).join('')}
				<text x="285" y="530" font-size="38" text-anchor="middle" font-family="Bricolage" font-weight="800">MORE DELAY →</text></svg></div>`, stage);
			M.pop(chart, start + 0.3, {from: 0.6});
			chart.querySelectorAll('.bar').forEach((b, i) => {
				tl.fromTo(b, {scaleY: 0, transformOrigin: '50% 100%'}, {scaleY: 1, duration: 0.45, ease: 'back.out(2)'}, at('longer') + i * 0.28);
				ctx.cue('tick', at('longer') + i * 0.28, 0.8);
			});
			const c = card(ctx, 'More <span class="hl">tickly</span>', 540, 1080, {bg: '#c6ff3d', size: 96, rot: -3});
			M.slam(c, at('tickled') - 0.1);
		},

		// 6. NOT MINE?!
		why(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const b = el(`<div class="ill" style="left:300px;top:380px;width:480px;height:420px">${brain()}</div>`, stage);
			M.pop(b, start + 0.05);
			tl.to(b.querySelector('.pupils'), {rotation: 360 * 2, svgOrigin: '6 6', duration: dur, ease: 'none'}, start + 0.3);
			M.wobble(b, start + 0.4, dur, {amp: 5, period: 0.35});
			const q = el(`<div class="big" style="left:810px;top:420px;transform:translate(-50%,-50%) rotate(12deg);font-size:220px;color:#ffd23c">?</div>`, stage);
			M.pop(q, at('recognising') - 0.2, {rot: 40});
			const c = card(ctx, 'Not <span class="hl">mine?!</span>', 540, 1010, {bg: '#fff', size: 104, rot: 3});
			M.slam(c, at('own') - 0.15);
			M.shake(b, at('own'), {amp: 12, n: 7});
		},

		// 7. THE QUESTION
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Tickle <span class="hl">yourself?</span>', 540, 340, {bg: '#fff', rot: -3, size: 96});
			M.slam(q, start + 0.1);
			const f = el(`<div class="ill" style="left:450px;top:430px;width:180px;height:440px">${feather}</div>`, stage);
			M.pop(f, start + 0.3);
			M.wobble(f, start + 0.7, dur, {amp: 14, period: 0.3});
			const yes = card(ctx, 'YES', 270, 1030, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1030, {bg: '#ff4fd8', size: 120, rot: 6});
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
