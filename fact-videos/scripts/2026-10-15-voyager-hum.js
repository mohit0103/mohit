// Reel: "Even empty space hums". All illustrations are original SVG drawings.
window.REEL = (function () {
	// friendly original space probe: dish face, body, booms
	const probe = `<svg viewBox="-210 -160 420 320" width="100%" height="100%">
		<line x1="55" y1="30" x2="190" y2="-55" stroke="#111" stroke-width="10" stroke-linecap="round"/><rect x="170" y="-85" width="38" height="38" rx="6" fill="#ff4fd8" stroke="#111" stroke-width="8" transform="rotate(-20 190 -66)"/>
		<line x1="-55" y1="50" x2="-190" y2="95" stroke="#111" stroke-width="10" stroke-linecap="round"/><rect x="-208" y="80" width="38" height="38" rx="6" fill="#3ce7ff" stroke="#111" stroke-width="8" transform="rotate(15 -190 99)"/>
		<rect x="-65" y="10" width="130" height="110" rx="20" fill="#111" transform="translate(9 9)"/>
		<rect x="-65" y="10" width="130" height="110" rx="20" fill="#ffd23c" stroke="#111" stroke-width="9"/>
		<path d="M-40 60 H40 M-40 85 H40" stroke="#111" stroke-width="7" stroke-linecap="round" opacity="0.5"/>
		<circle cy="-50" r="110" fill="#111" transform="translate(9 9)"/>
		<circle cy="-50" r="110" fill="#fff" stroke="#111" stroke-width="9"/><circle cy="-50" r="92" fill="none" stroke="#c6ff3d" stroke-width="14"/>
		<g class="eyes"><ellipse cx="-32" cy="-62" rx="20" ry="24" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="32" cy="-62" rx="20" ry="24" fill="#fff" stroke="#111" stroke-width="6"/>
		<g class="pupils"><circle cx="-28" cy="-56" r="9" fill="#111"/><circle cx="36" cy="-56" r="9" fill="#111"/></g></g>
		<path d="M-24 -14 Q0 6 24 -14" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
	const sun = `<svg viewBox="-150 -150 300 300" width="100%" height="100%">
		<g stroke="#111" stroke-width="9" stroke-linecap="round">${Array.from({length: 12}, (_, i) => `<line x1="0" y1="-98" x2="0" y2="-135" transform="rotate(${i * 30})"/>`).join('')}</g>
		<circle r="90" fill="#111" transform="translate(9 9)"/><circle r="90" fill="#ffd23c" stroke="#111" stroke-width="9"/>
		<circle cx="-30" cy="-12" r="9" fill="#111"/><circle cx="30" cy="-12" r="9" fill="#111"/><path d="M-30 25 Q0 52 30 25" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/></svg>`;
	const cloud = `<svg viewBox="-230 -170 460 420" width="100%" height="100%">
		<g class="bolt"><path d="M10 40 L -50 150 L -5 150 L -35 240 L 70 110 L 22 110 L 55 40 Z" fill="#ffd23c" stroke="#111" stroke-width="9" stroke-linejoin="round"/></g>
		<g fill="#111" transform="translate(12 12)"><circle cx="-120" cy="0" r="75"/><circle cx="-40" cy="-60" r="85"/><circle cx="60" cy="-45" r="80"/><circle cx="125" cy="10" r="65"/><rect x="-125" y="0" width="250" height="75"/></g>
		<g fill="#fff" stroke="#111" stroke-width="9"><circle cx="-120" cy="0" r="75"/><circle cx="-40" cy="-60" r="85"/><circle cx="60" cy="-45" r="80"/><circle cx="125" cy="10" r="65"/><rect x="-125" y="0" width="250" height="75"/></g>
		<g fill="#fff"><circle cx="-120" cy="0" r="70"/><circle cx="-40" cy="-60" r="80"/><circle cx="60" cy="-45" r="75"/><circle cx="125" cy="10" r="60"/><rect x="-125" y="-4" width="250" height="75"/></g>
		<g class="eyes"><path d="M-75 10 Q-50 -14 -25 10 M15 10 Q40 -14 65 10" stroke="#111" stroke-width="9" fill="none" stroke-linecap="round"/></g>
		<path d="M-30 45 Q-5 62 20 45" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/></svg>`;
	const dropSvg = `<svg viewBox="-20 -34 40 62" width="100%" height="100%"><path d="M0 -30 C 12 -10, 18 -2, 18 8 C 18 20, 10 26, 0 26 C -10 26, -18 20, -18 8 C -18 -2, -12 -10, 0 -30 Z" fill="#3a6cff" stroke="#111" stroke-width="5"/></svg>`;
	const earthSvg = `<svg viewBox="-110 -110 220 220" width="100%" height="100%"><circle r="96" fill="#111" transform="translate(9 9)"/><circle r="96" fill="#3ca8ff" stroke="#111" stroke-width="8"/>
		<g fill="#5be36b" stroke="#111" stroke-width="6" stroke-linejoin="round"><path d="M-70 -30 C -50 -70, -10 -62, -6 -34 C 0 -10, -34 -6, -42 14 C -50 30, -80 12, -84 -12 Z"/><path d="M20 20 C 50 6, 76 28, 66 56 C 50 76, 20 74, 14 56 Z"/></g></svg>`;

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
	function starfield(ctx, n = 40, seed = 3) {
		let s = seed;
		const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
		const svg = `<svg viewBox="0 0 1080 1200" width="1080" height="1200">${Array.from({length: n}, () => `<circle class="st" cx="${(r() * 1080).toFixed(0)}" cy="${(r() * 1200).toFixed(0)}" r="${(2 + r() * 5).toFixed(1)}" fill="#fff"/>`).join('')}</svg>`;
		const e = ctx.el(`<div class="ill" style="left:0;top:180px;width:1080px;height:1200px;z-index:0">${svg}</div>`, ctx.stage);
		e.querySelectorAll('.st').forEach((p, i) => ctx.tl.to(p, {opacity: 0.2, duration: 0.4 + (i % 5) * 0.15, repeat: 20, yoyo: true, ease: 'sine.inOut'}, ctx.start + (i % 7) * 0.1));
		return e;
	}
	// sound arcs pulsing out of the dish (right side)
	function waves(ctx, root, x, y, t, dur, col = '#c6ff3d') {
		for (let i = 0; i < 3; i++) {
			const w = ctx.el(`<div class="ill" style="left:${x}px;top:${y}px;width:260px;height:260px"><svg viewBox="-130 -130 260 260" width="100%" height="100%"><path d="M-40 -90 Q 70 0 -40 90" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round"/></svg></div>`, root);
			ctx.tl.fromTo(w, {scale: 0.4, autoAlpha: 0, x: 0}, {scale: 1.3, autoAlpha: 1, x: 40, duration: 0.9, ease: 'power1.out', repeat: Math.ceil(dur / 1.1), repeatDelay: 0.2}, t + i * 0.35);
		}
	}

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			starfield(ctx, 46, 9);
			const p = el(`<div class="ill" style="left:150px;top:400px;width:700px;height:533px;z-index:2">${probe}</div>`, stage);
			M.stretch(p, start + 0.05);
			M.float(p, start + 0.7, dur, {amp: 12, period: 1});
			const h = at('hums');
			waves(ctx, stage, 790, 470, h, dur);
			ctx.cue('chime', h, 0.6);
			tl.to(p.querySelector('.pupils'), {x: 10, y: -4, duration: 0.2}, at('listening'));
			cardSeq(ctx, [['Space <span class="hl">hums</span>', h, {size: 110}], ['Since <span class="hl">1977</span>', at('1977') - 0.05, {size: 110}]]);
		},

		exit(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const bubble = el(`<div class="ill" style="left:40px;top:300px;width:700px;height:700px"><svg viewBox="-350 -350 700 700" width="100%" height="100%"><circle r="330" fill="none" stroke="#c6ff3d" stroke-width="14" stroke-dasharray="30 22" stroke-linecap="round"/></svg></div>`, stage);
			M.pop(bubble, start + 0.05, {from: 0.5});
			tl.to(bubble.querySelector('svg'), {rotation: 40, duration: dur, ease: 'none', transformOrigin: '50% 50%'}, start);
			const s = el(`<div class="ill" style="left:200px;top:460px;width:280px;height:280px">${sun}</div>`, stage);
			M.pop(s, start + 0.1);
			tl.to(s, {rotation: 20, duration: dur, ease: 'none'}, start);
			const pr = el(`<div class="ill" style="left:270px;top:640px;width:300px;height:229px;z-index:3">${probe}</div>`, stage);
			M.pop(pr, start + 0.3, {from: 0.3});
			const L = at('left');
			tl.to(pr, {x: 570, y: -80, duration: Math.max(1.8, dur - (L - start) - 0.4), ease: 'power1.inOut'}, L - 0.2);
			ctx.cue('whoosh', L - 0.2, 0.7);
			const big = el(`<div class="big" style="left:540px;top:350px;transform:translate(-50%,-50%) rotate(-3deg);font-size:190px;color:#fff;white-space:nowrap">2012</div>`, stage);
			M.slam(big, at('2012'));
			cardSeq(ctx, [['Left the <span class="hl">solar system</span>', L, {size: 78}], ['Into <span class="hl">interstellar</span> space', at('interstellar') - 0.05, {size: 64}]]);
		},

		miles(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const e = el(`<div class="ill" style="left:60px;top:790px;width:200px;height:200px">${earthSvg}</div>`, stage);
			M.pop(e, start + 0.1);
			const pr = el(`<div class="ill" style="left:700px;top:520px;width:300px;height:229px">${probe}</div>`, stage);
			M.pop(pr, start + 0.3, {from: 0.3});
			M.float(pr, start + 0.9, dur, {amp: 8, period: 1.1});
			const arc = el(`<div class="ill" style="left:0;top:480px;width:1080px;height:420px"><svg viewBox="0 0 1080 420" width="100%" height="100%"><path class="ln" d="M200 380 C 360 330, 560 220, 700 140" fill="none" stroke="#111" stroke-width="12" stroke-dasharray="28 20" stroke-linecap="round"/></svg></div>`, stage);
			M.draw(arc.querySelector('.ln'), start + 0.4, 1.6, {ease: 'power1.inOut'});
			const num = el(`<div class="big" style="left:540px;top:345px;transform:translate(-50%,-50%) rotate(-3deg);font-size:130px;color:#8a3cff;white-space:nowrap"><span class="n">0</span>+ billion miles</div>`, stage);
			M.pop(num, at('14') - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('14') - 0.2, 0, 14, 0.9, v => Math.round(v));
			cardSeq(ctx, [['By <span class="hl">2021</span>', at('2021'), {size: 110}], ['From <span class="hl">Earth</span>', at('Earth') - 0.05, {size: 110}]]);
		},

		drone(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			starfield(ctx, 40, 4);
			const pr = el(`<div class="ill" style="left:380px;top:270px;width:320px;height:244px;z-index:2">${probe}</div>`, stage);
			M.stretch(pr, start + 0.05);
			M.float(pr, start + 0.7, dur, {amp: 8, period: 1});
			const d = at('drone');
			const bars = el(`<div class="ill" style="left:90px;top:580px;width:900px;height:400px;z-index:2"><svg viewBox="0 0 900 400" width="100%" height="100%">${Array.from({length: 15}, (_, i) => `<rect class="bar" x="${20 + i * 58}" y="150" width="38" height="100" rx="14" fill="${i % 2 ? '#ff4fd8' : '#c6ff3d'}" stroke="#fff" stroke-width="5"/>`).join('')}</svg></div>`, stage);
			bars.querySelectorAll('.bar').forEach((b, i) => {
				tl.fromTo(b, {scaleY: 0.1, svgOrigin: `${39 + i * 58} 200`}, {scaleY: 1, duration: 0.3, ease: 'back.out(2)'}, d - 0.2 + i * 0.03);
				tl.to(b, {scaleY: 0.7 + (i % 3) * 0.12, svgOrigin: `${39 + i * 58} 200`, duration: 0.45 + (i % 4) * 0.08, yoyo: true, repeat: 14, ease: 'sine.inOut'}, d + 0.3 + i * 0.03);
			});
			ctx.cue('fill', d - 0.1, 0.7);
			cardSeq(ctx, [['Plasma <span class="hl">waves</span>', at('plasma'), {size: 100}], ['Steady <span class="hl">drone</span>', d - 0.05, {size: 100}]]);
		},

		rain(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const c = el(`<div class="ill" style="left:240px;top:300px;width:600px;height:547px">${cloud}</div>`, stage);
			M.stretch(c, start + 0.05);
			M.float(c, start + 0.7, dur, {amp: 8, period: 1});
			const bolt = c.querySelector('.bolt');
			tl.set(bolt, {opacity: 0}, start);
			const R = at('rain');
			for (let i = 0; i < 8; i++) {
				const d = el(`<div class="ill" style="left:${330 + i * 56}px;top:710px;width:34px;height:54px">${dropSvg}</div>`, stage);
				tl.fromTo(d, {y: 0, autoAlpha: 0}, {y: 250, autoAlpha: 1, duration: 0.9, ease: 'none', repeat: Math.ceil(dur / 0.9), }, R - 0.1 + (i % 4) * 0.22 + (i > 3 ? 0.11 : 0));
			}
			const L = at('lightning');
			tl.fromTo(bolt, {opacity: 0}, {opacity: 1, duration: 0.06, yoyo: true, repeat: 5}, L - 0.1);
			tl.set(bolt, {opacity: 1}, L + 0.5);
			M.shake(c, L, {amp: 8, n: 8});
			ctx.cue('snap', L, 0.9);
			cardSeq(ctx, [['Gentle <span class="hl">rain</span>', R, {size: 110}], ['Solar <span class="hl">lightning</span>', L - 0.05, {size: 92}]]);
		},

		track(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const ch = el(`<div class="ill" style="left:60px;top:340px;width:960px;height:520px"><svg viewBox="0 0 960 520" width="100%" height="100%">
				<rect x="10" y="10" width="940" height="500" rx="26" fill="#111" transform="translate(10 10)"/><rect x="10" y="10" width="940" height="500" rx="26" fill="#fff" stroke="#111" stroke-width="9"/>
				<path d="M60 70 V440 H900" stroke="#111" stroke-width="9" fill="none" stroke-linecap="round"/>
				<path class="ln" d="M70 300 Q130 250 190 290 T310 280 T430 300 T550 270 T670 295 T790 275 T890 290" fill="none" stroke="#ff4fd8" stroke-width="14" stroke-linecap="round"/>
				<g class="dots">${[190, 310, 430, 550, 670, 790].map((x, i) => `<circle cx="${x}" cy="${[290, 280, 300, 270, 295, 275][i]}" r="14" fill="#c6ff3d" stroke="#111" stroke-width="7"/>`).join('')}</g></svg></div>`, stage);
			M.pop(ch, start + 0.1, {from: 0.6});
			const T = at('track');
			M.draw(ch.querySelector('.ln'), T - 0.1, Math.max(1.8, dur - (T - start) - 0.8), {ease: 'none'});
			ch.querySelectorAll('.dots circle').forEach((c, i) => M.pop(c, T + 0.3 + i * 0.3, {sfx: false, from: 0.2}));
			ctx.cue('tick', T + 0.3, 0.6);
			cardSeq(ctx, [['Tracked <span class="hl">nonstop</span>', T, {size: 92}], ['No <span class="hl">storm</span> needed', at('storm') - 0.05, {size: 90}]]);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			starfield(ctx, 36, 12);
			const q = card(ctx, 'Would you <span class="hl">listen?</span>', 540, 330, {bg: '#fff', rot: -3, size: 90});
			M.slam(q, start + 0.1);
			const p = el(`<div class="ill" style="left:290px;top:430px;width:500px;height:381px;z-index:2">${probe}</div>`, stage);
			M.stretch(p, at('space') - 0.1);
			M.float(p, at('space') + 0.5, dur, {amp: 10, period: 0.9});
			const yes = card(ctx, 'YES', 270, 1030, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1030, {bg: '#ffd23c', size: 120, rot: 6});
			M.slideIn(yes, at('Yes') - 0.1, {from: 'left'});
			ctx.cue('pop', at('Yes'), 0.9);
			M.slideIn(no, at('no') - 0.1, {from: 'right'});
			ctx.cue('pop', at('no'), 0.9);
			tl.to(p.querySelector('.pupils'), {x: -14, duration: 0.15}, at('Yes')).to(p.querySelector('.pupils'), {x: 14, duration: 0.15}, at('no'));
			M.wobble(yes, at('no') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(no, at('no') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('no') + 0.35, 0.8);
		},
	};
})();
