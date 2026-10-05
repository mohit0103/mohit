// Reel: "70 million years ago, a year had 372 days". All illustrations are original SVG drawings.
window.REEL = (function () {
	const eyes = (lx, rx, y, r = 30) => `<g class="eyes">
		<ellipse cx="${lx}" cy="${y}" rx="${r}" ry="${r * 1.12}" fill="#fff" stroke="#111" stroke-width="8"/>
		<ellipse cx="${rx}" cy="${y}" rx="${r}" ry="${r * 1.12}" fill="#fff" stroke="#111" stroke-width="8"/>
		<g class="pupils"><circle cx="${lx + 4}" cy="${y + 6}" r="${r * 0.42}" fill="#111"/><circle cx="${rx + 4}" cy="${y + 6}" r="${r * 0.42}" fill="#111"/></g></g>`;

	function earth(face = true) {
		return `<svg viewBox="-160 -160 320 320" width="100%" height="100%">
			<circle r="140" fill="#111" transform="translate(12 12)"/>
			<circle r="140" fill="#3ca8ff" stroke="#111" stroke-width="9"/>
			<g class="land" fill="#5be36b" stroke="#111" stroke-width="7" stroke-linejoin="round">
				<path d="M-110 -60 C -80 -110, -20 -100, -10 -60 C 0 -30, -50 -20, -60 10 C -70 40, -120 20, -125 -20 Z"/>
				<path d="M30 -120 C 80 -110, 120 -60, 100 -30 C 80 0, 40 -20, 30 -50 C 20 -80, 0 -100, 30 -120 Z"/>
				<path d="M20 40 C 60 20, 110 40, 100 90 C 80 120, 30 120, 20 90 C 10 70, -10 60, 20 40 Z"/>
			</g>
			${face ? eyes(-45, 45, -5, 30) + '<path d="M-28 50 Q0 74 28 50" stroke="#111" stroke-width="9" fill="none" stroke-linecap="round"/>' : ''}
		</svg>`;
	}

	function moon(face = true) {
		return `<svg viewBox="-110 -110 220 220" width="100%" height="100%">
			<circle r="95" fill="#111" transform="translate(10 10)"/>
			<circle r="95" fill="#f1f1e6" stroke="#111" stroke-width="8"/>
			<circle cx="-50" cy="-45" r="18" fill="#cfcfc0" stroke="#111" stroke-width="5"/>
			<circle cx="55" cy="40" r="14" fill="#cfcfc0" stroke="#111" stroke-width="5"/>
			<circle cx="-40" cy="55" r="10" fill="#cfcfc0" stroke="#111" stroke-width="5"/>
			${face ? eyes(-28, 30, -5, 20) + '<path d="M-18 38 Q2 52 22 38" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>' : ''}
		</svg>`;
	}

	// a friendly long-necked dinosaur (generic, original)
	const dino = `<svg viewBox="0 0 420 320" width="100%" height="100%">
		<g transform="translate(10 10)" fill="#111">
			<path d="M60 230 C 60 160, 140 130, 220 140 C 280 145, 300 120, 310 70 C 315 40, 340 20, 370 30 C 400 40, 395 75, 370 80 C 350 85, 345 110, 340 150 C 335 200, 320 230, 300 240 L 320 300 L 280 300 L 270 250 L 160 250 L 150 300 L 110 300 L 110 245 C 80 245, 40 260, 10 250 C 30 245, 55 240, 60 230 Z"/></g>
		<path d="M60 230 C 60 160, 140 130, 220 140 C 280 145, 300 120, 310 70 C 315 40, 340 20, 370 30 C 400 40, 395 75, 370 80 C 350 85, 345 110, 340 150 C 335 200, 320 230, 300 240 L 320 300 L 280 300 L 270 250 L 160 250 L 150 300 L 110 300 L 110 245 C 80 245, 40 260, 10 250 C 30 245, 55 240, 60 230 Z" fill="#c6ff3d" stroke="#111" stroke-width="9" stroke-linejoin="round"/>
		<circle cx="368" cy="50" r="9" fill="#111"/>
		<path d="M150 170 q15 -18 30 0 M200 165 q15 -18 30 0" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>
	</svg>`;

	function card(ctx, html, x, y, o = {}) {
		return ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;color:${o.color || '#111'};transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
	}

	return {
		// 1. HOOK: 372 days
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const d = el(`<div class="ill" style="left:110px;top:380px;width:520px;height:400px">${dino}</div>`, stage);
			M.slideIn(d, start + 0.05, {from: 'left'});
			M.wobble(d, start + 0.6, dur, {amp: 3, period: 0.45});
			const cal = el(`<div class="ill" style="left:600px;top:330px;width:380px;height:420px"><svg viewBox="0 0 380 420" width="100%" height="100%">
				<rect x="22" y="40" width="340" height="360" rx="34" fill="#111"/><rect x="10" y="28" width="340" height="360" rx="34" fill="#fff" stroke="#111" stroke-width="9"/>
				<rect x="10" y="28" width="340" height="96" rx="34" fill="#ff4fd8" stroke="#111" stroke-width="9"/><rect x="14" y="90" width="332" height="34" fill="#ff4fd8"/>
				<text x="180" y="98" font-size="56" text-anchor="middle" font-family="Bricolage" font-weight="800">1 YEAR</text>
				<text class="n" x="180" y="290" font-size="150" text-anchor="middle" font-family="Bricolage" font-weight="800">365</text>
				<text x="180" y="355" font-size="40" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="#555">DAYS</text></svg></div>`, stage);
			M.pop(cal, start + 0.25, {rot: 12});
			const n = cal.querySelector('.n');
			M.countUp(n, at('372') - 0.3, 365, 372, 0.8, v => Math.round(v));
			tl.to(n, {fill: '#ff4fd8', duration: 0.1}, at('372') + 0.5);
			M.shake(cal, at('372') + 0.5, {amp: 10, n: 7});
			const c = card(ctx, '70 million<br>years <span class="hl">ago</span>', 540, 990, {rot: -3, size: 96});
			M.slam(c, at('seventy') + 0.05);
			M.punchIn(stage, at('372') + 0.5);
		},

		// 2. SHORTER DAYS
		day(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const clk = el(`<div class="ill" style="left:250px;top:300px;width:580px;height:580px"><svg viewBox="-150 -150 300 300" width="100%" height="100%">
				<circle r="130" fill="#111" transform="translate(12 12)"/><circle r="130" fill="#fff" stroke="#111" stroke-width="10"/>
				${Array.from({length: 24}, (_, i) => { const a = i / 24 * Math.PI * 2, l = i % 6 ? 104 : 92; return `<line x1="${Math.sin(a) * l}" y1="${-Math.cos(a) * l}" x2="${Math.sin(a) * 116}" y2="${-Math.cos(a) * 116}" stroke="#111" stroke-width="${i % 6 ? 5 : 9}" stroke-linecap="round"/>`; }).join('')}
				<path class="cut" d="M0 0 L 0 -112 A112 112 0 0 1 ${Math.sin(Math.PI * 2 * 0.5 / 24) * 112} ${-Math.cos(Math.PI * 2 * 0.5 / 24) * 112} Z" fill="#ff4fd8" transform="rotate(-7.5)"/>
				<line class="hand" x1="0" y1="0" x2="0" y2="-96" stroke="#111" stroke-width="12" stroke-linecap="round"/>
				<circle r="12" fill="#111"/></svg></div>`, stage);
			M.pop(clk, start + 0.05);
			tl.fromTo(clk.querySelector('.hand'), {rotation: 0, svgOrigin: '0 0'}, {rotation: 352.5, duration: Math.min(2.2, dur * 0.6), ease: 'power2.inOut'}, start + 0.4);
			tl.fromTo(clk.querySelector('.cut'), {opacity: 0}, {opacity: 1, duration: 0.2, repeat: 5, yoyo: true}, at('half') - 0.2);
			const c = card(ctx, '<span class="hl">23.5</span> hours', 540, 1010, {bg: '#ffd23c', size: 110});
			M.slam(c, at('twenty') - 0.05);
		},

		// 3. FOSSIL CLAM RINGS
		clam(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const rings = Array.from({length: 9}, (_, i) => `<path class="ring" d="M${-150 + i * 14} 70 A ${150 - i * 14} ${150 - i * 14} 0 0 1 ${150 - i * 14} 70" fill="none" stroke="#7a4a1f" stroke-width="5"/>`).join('');
			const shell = el(`<div class="ill" style="left:200px;top:330px;width:680px;height:520px"><svg viewBox="-200 -120 400 260" width="100%" height="100%">
				<path d="M-170 80 A 170 170 0 0 1 170 80 Q 0 120 -170 80 Z" fill="#111" transform="translate(12 12)"/>
				<path d="M-170 80 A 170 170 0 0 1 170 80 Q 0 120 -170 80 Z" fill="#ffcf9e" stroke="#111" stroke-width="9" stroke-linejoin="round"/>
				${rings}<rect x="-40" y="80" width="80" height="34" rx="12" fill="#ffcf9e" stroke="#111" stroke-width="8"/></svg></div>`, stage);
			M.pop(shell, start + 0.05, {from: 0.4});
			shell.querySelectorAll('.ring').forEach((p, i) => { M.draw(p, start + 0.5 + i * 0.12, 0.5); ctx.cue('tick', start + 0.5 + i * 0.12, 0.5); });
			const lens = el(`<div class="ill" style="left:640px;top:600px;width:280px;height:280px"><svg viewBox="-80 -80 160 160" width="100%" height="100%">
				<line x1="35" y1="35" x2="72" y2="72" stroke="#111" stroke-width="22" stroke-linecap="round"/>
				<circle r="50" fill="rgba(255,255,255,0.45)" stroke="#111" stroke-width="12"/></svg></div>`, stage);
			M.slideIn(lens, at('growth') - 0.1, {from: 'right'});
			M.float(lens, at('growth') + 0.4, dur, {amp: 14, period: 0.7});
			const c = card(ctx, 'Daily <span class="hl">rings</span>', 540, 1030, {bg: '#fff', size: 96, rot: 3});
			M.slam(c, at('rings'));
		},

		// 4. THE MOON IS THE BRAKE
		brake(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const e = el(`<div class="ill" style="left:90px;top:440px;width:440px;height:440px">${earth()}</div>`, stage);
			const m = el(`<div class="ill" style="left:700px;top:520px;width:270px;height:270px">${moon()}</div>`, stage);
			M.pop(e, start + 0.05);
			M.pop(m, at('moon') - 0.05);
			// Earth spins fast, then slows as the Moon's pull is drawn
			const land = e.querySelector('.land');
			tl.to(land, {rotation: 720, svgOrigin: '0 0', duration: 1.4, ease: 'none'}, start + 0.2);
			tl.to(land, {rotation: 900, svgOrigin: '0 0', duration: Math.max(1, dur - 1.6), ease: 'power3.out'}, start + 1.6);
			const pull = el(`<div class="ill" style="left:470px;top:560px;width:260px;height:180px"><svg viewBox="0 0 260 180" width="100%" height="100%">
				${[40, 90, 140].map(y => `<path class="pl" d="M240 ${y} Q 130 ${y - 30} 20 ${y}" fill="none" stroke="#111" stroke-width="9" stroke-dasharray="18 14" stroke-linecap="round"/>`).join('')}</svg></div>`, stage);
			pull.querySelectorAll('.pl').forEach((p, i) => tl.fromTo(p, {opacity: 0}, {opacity: 1, duration: 0.2}, at('pull') + i * 0.1));
			tl.to(pull.querySelectorAll('.pl'), {strokeDashoffset: -96, duration: 1, repeat: Math.ceil(dur), ease: 'none'}, at('pull'));
			const c = card(ctx, 'Like a <span class="hl">brake</span>', 540, 1030, {bg: '#c6ff3d', size: 100});
			M.slam(c, at('brake'));
		},

		// 5. MOON DRIFTS AWAY
		drift(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const e = el(`<div class="ill" style="left:60px;top:500px;width:330px;height:330px">${earth()}</div>`, stage);
			const m = el(`<div class="ill" style="left:470px;top:560px;width:210px;height:210px">${moon()}</div>`, stage);
			M.pop(e, start + 0.05);
			M.pop(m, start + 0.2);
			tl.to(m, {x: 300, duration: Math.max(1.5, dur - 0.8), ease: 'power1.inOut'}, start + 0.6);
			tl.to(e.querySelector('.pupils'), {x: 10, duration: 0.3}, start + 0.8);
			const ruler = el(`<div class="ill" style="left:120px;top:880px;width:840px;height:110px"><svg viewBox="0 0 840 110" width="100%" height="100%">
				<rect x="12" y="12" width="816" height="86" rx="16" fill="#111"/><rect x="0" y="0" width="816" height="86" rx="16" fill="#ffd23c" stroke="#111" stroke-width="8"/>
				${Array.from({length: 33}, (_, i) => `<line x1="${20 + i * 24}" y1="0" x2="${20 + i * 24}" y2="${i % 4 ? 26 : 46}" stroke="#111" stroke-width="5"/>`).join('')}</svg></div>`, stage);
			M.rise(ruler, start + 0.5);
			const num = el(`<div class="big" style="left:540px;top:400px;transform:translate(-50%,-50%);font-size:170px;color:#c6ff3d"><span class="n">0.0</span> cm</div>`, stage);
			M.pop(num, at('3.8') - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('3.8') - 0.3, 0, 3.8, 0.8, v => v.toFixed(1));
			const lab = card(ctx, 'every <span class="hl">year</span>', 540, 1080, {bg: '#fff', size: 72, rot: 3});
			M.pop(lab, at('every'));
		},

		// 6. STILL GETTING LONGER
		longer(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const sw = el(`<div class="ill" style="left:300px;top:330px;width:480px;height:540px"><svg viewBox="-130 -160 260 300" width="100%" height="100%">
				<rect x="-22" y="-158" width="44" height="34" rx="8" fill="#ff4fd8" stroke="#111" stroke-width="8"/>
				<circle r="120" fill="#111" transform="translate(12 12)"/><circle r="120" fill="#fff" stroke="#111" stroke-width="10"/>
				<path class="arc" d="M0 -96 A 96 96 0 1 1 -1 -96" fill="none" stroke="#8a3cff" stroke-width="26" stroke-linecap="round"/>
				<line class="hand" x1="0" y1="0" x2="0" y2="-80" stroke="#111" stroke-width="11" stroke-linecap="round"/><circle r="11" fill="#111"/></svg></div>`, stage);
			M.pop(sw, start + 0.05);
			M.draw(sw.querySelector('.arc'), start + 0.3, Math.min(2.5, dur - 0.5), {ease: 'none'});
			tl.fromTo(sw.querySelector('.hand'), {rotation: 0, svgOrigin: '0 0'}, {rotation: 720, duration: Math.min(2.5, dur - 0.5), ease: 'none'}, start + 0.3);
			const c = card(ctx, '+1.7 ms <span class="hl">per century</span>', 540, 1010, {bg: '#3ce7ff', size: 84});
			M.slam(c, at('1.7') - 0.1);
		},

		// 7. THE QUESTION
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, '25-hour <span class="hl">days?</span>', 540, 340, {bg: '#fff', rot: -3, size: 100});
			M.slam(q, start + 0.1);
			const e = el(`<div class="ill" style="left:360px;top:470px;width:360px;height:360px">${earth()}</div>`, stage);
			M.pop(e, start + 0.3);
			M.float(e, start + 0.8, dur, {amp: 12, period: 0.9});
			const p = e.querySelector('.pupils');
			const yes = card(ctx, 'YES', 270, 1030, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1030, {bg: '#ff4fd8', size: 120, rot: 6});
			M.slideIn(yes, at('Yes') - 0.1, {from: 'left'});
			ctx.cue('pop', at('Yes'), 0.9);
			M.slideIn(no, at('no') - 0.1, {from: 'right'});
			ctx.cue('pop', at('no'), 0.9);
			tl.to(p, {x: -14, duration: 0.2}, at('Yes')).to(p, {x: 14, duration: 0.2}, at('no'));
			M.wobble(yes, at('no') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(no, at('no') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('no') + 0.35, 0.8);
		},
	};
})();
