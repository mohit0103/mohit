// Reel: "Saturn's rings are raining away". All illustrations are original SVG drawings.
window.REEL = (function () {
	// ringed planet; mood 'worried' | 'shades' | 'happy'; scale shrinks the rings via .rs
	const saturn = (mood = 'worried') => `<svg viewBox="-340 -240 680 480" width="100%" height="100%">
		<g transform="rotate(-14)"><g class="rs"><path d="M-300 0 A 300 82 0 0 1 300 0" fill="none" stroke="#111" stroke-width="46"/><path d="M-300 0 A 300 82 0 0 1 300 0" fill="none" stroke="#f3e3b5" stroke-width="30"/><path d="M-250 0 A 250 66 0 0 1 250 0" fill="none" stroke="#e0b979" stroke-width="12" opacity="0.8"/></g></g>
		<circle r="120" fill="#111" transform="translate(12 12)"/><circle r="120" fill="#ffb347" stroke="#111" stroke-width="10"/>
		<g fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity="0.4"><path d="M-105 -50 Q0 -80 105 -50"/><path d="M-118 40 Q0 10 118 40"/></g>
		<g class="eyes">${mood === 'shades' ? `<rect x="-76" y="-34" width="66" height="44" rx="14" fill="#111"/><rect x="10" y="-34" width="66" height="44" rx="14" fill="#111"/><path d="M-10 -18 H10" stroke="#111" stroke-width="8"/>`
			: `<ellipse cx="-34" cy="-14" rx="22" ry="27" fill="#fff" stroke="#111" stroke-width="7"/><ellipse cx="34" cy="-14" rx="22" ry="27" fill="#fff" stroke="#111" stroke-width="7"/><g class="pupils"><circle cx="-30" cy="-8" r="10" fill="#111"/><circle cx="38" cy="-8" r="10" fill="#111"/></g>`}</g>
		<path d="${mood === 'worried' ? 'M-28 62 Q0 44 28 62' : 'M-28 52 Q0 76 28 52'}" stroke="#111" stroke-width="9" fill="none" stroke-linecap="round"/>
		<g transform="rotate(-14)"><g class="rs"><path d="M-300 0 A 300 82 0 0 0 300 0" fill="none" stroke="#111" stroke-width="46"/><path d="M-300 0 A 300 82 0 0 0 300 0" fill="none" stroke="#f3e3b5" stroke-width="30"/><path d="M-250 0 A 250 66 0 0 0 250 0" fill="none" stroke="#e0b979" stroke-width="12" opacity="0.8"/></g></g></svg>`;
	const ice = `<svg viewBox="-16 -16 32 32" width="100%" height="100%"><circle r="11" fill="#fff" stroke="#111" stroke-width="5"/></svg>`;
	const pool = `<svg viewBox="0 0 760 360" width="100%" height="100%">
		<rect x="20" y="20" width="720" height="320" rx="26" fill="#111" transform="translate(10 10)"/><rect x="20" y="20" width="720" height="320" rx="26" fill="#fff" stroke="#111" stroke-width="10"/>
		<clipPath id="pc"><rect x="34" y="34" width="692" height="292" rx="18"/></clipPath>
		<g clip-path="url(#pc)"><rect class="water" x="34" y="34" width="692" height="292" fill="#3ca8ff"/>
		<g stroke="#fff" stroke-width="6" opacity="0.7">${[1, 2, 3, 4].map(i => `<path d="M34 ${34 + i * 58} H726" stroke-dasharray="26 18"/>`).join('')}</g></g></svg>`;

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
	function starfield(ctx, n = 40, seed = 3) {
		let s = seed;
		const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
		const svg = `<svg viewBox="0 0 1080 1200" width="1080" height="1200">${Array.from({length: n}, () => `<circle class="st" cx="${(r() * 1080).toFixed(0)}" cy="${(r() * 1200).toFixed(0)}" r="${(2 + r() * 5).toFixed(1)}" fill="#fff"/>`).join('')}</svg>`;
		const e = ctx.el(`<div class="ill" style="left:0;top:180px;width:1080px;height:1200px;z-index:0">${svg}</div>`, ctx.stage);
		e.querySelectorAll('.st').forEach((p, i) => ctx.tl.to(p, {opacity: 0.2, duration: 0.4 + (i % 5) * 0.15, repeat: 20, yoyo: true, ease: 'sine.inOut'}, ctx.start + (i % 7) * 0.1));
		return e;
	}
	// ice flakes dropping from the ring plane down onto the planet
	function rain(ctx, t, dur, cx = 540, y0 = 560, fall = 230, n = 9, spread = 560) {
		for (let i = 0; i < n; i++) {
			const x = cx - spread / 2 + (i * 137) % spread;
			const e = ctx.el(`<div class="ill" style="left:${x}px;top:${y0}px;width:34px;height:34px;z-index:4">${ice}</div>`, ctx.stage);
			ctx.tl.fromTo(e, {y: 0, autoAlpha: 0}, {y: fall, autoAlpha: 1, duration: 0.8, ease: 'power1.in', repeat: Math.ceil(dur / 0.9), repeatDelay: 0.1 + (i % 3) * 0.1}, t + (i % 5) * 0.17);
		}
	}

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			starfield(ctx, 46, 21);
			const s = el(`<div class="ill" style="left:100px;top:420px;width:880px;height:622px;z-index:2">${saturn('worried')}</div>`, stage);
			M.stretch(s, start + 0.05);
			M.float(s, start + 0.7, dur, {amp: 10, period: 1.1});
			const r = at('raining');
			rain(ctx, r - 0.1, dur, 540, 560, 250, 10, 640);
			ctx.cue('chime', r, 0.6);
			tl.to(s.querySelector('.pupils'), {y: 8, duration: 0.2}, r);
			cardSeq(ctx, [['Rings are <span class="hl">raining</span>', r - 0.1, {size: 90}]], 1110);
		},

		field(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const s = el(`<div class="ill" style="left:240px;top:540px;width:600px;height:423px;z-index:2">${saturn('worried')}</div>`, stage);
			M.pop(s, start + 0.05, {from: 0.4});
			const m = at('magnetic');
			const f = el(`<div class="ill" style="left:0;top:300px;width:1080px;height:640px;z-index:3"><svg viewBox="0 0 1080 640" width="100%" height="100%" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-dasharray="26 16">
				<path class="fl" d="M470 280 C 250 20, 60 160, 130 420"/><path class="fl" d="M610 280 C 830 20, 1020 160, 950 420"/><path class="fl" d="M500 250 C 380 120, 250 180, 280 360"/><path class="fl" d="M580 250 C 700 120, 830 180, 800 360"/></svg></div>`, stage);
			f.querySelectorAll('.fl').forEach((p, i) => M.draw(p, m + i * 0.1, 0.7, {ease: 'power1.out'}));
			ctx.cue('whoosh', m, 0.7);
			rain(ctx, at('dusty'), dur, 540, 600, 200, 8, 520);
			cardSeq(ctx, [['Dusty rain of <span class="hl">ice</span>', at('dusty') - 0.05, {size: 76}], ['<span class="hl">Magnetic</span> field', m - 0.05, {size: 96}]], 1110);
		},

		pool(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const p = el(`<div class="ill" style="left:160px;top:560px;width:760px;height:360px">${pool}</div>`, stage);
			M.pop(p, start + 0.05, {from: 0.5});
			const h = at('half');
			tl.fromTo(p.querySelector('.water'), {scaleX: 0.04, svgOrigin: '34 180'}, {scaleX: 1, duration: 1.6, ease: 'power1.inOut'}, h - 0.2);
			ctx.cue('fill', h - 0.2, 0.9);
			const ck = el(`<div class="ill" style="left:230px;top:260px;width:280px;height:280px"><svg viewBox="-130 -130 260 260" width="100%" height="100%"><circle r="110" fill="#111" transform="translate(10 10)"/><circle r="110" fill="#fff" stroke="#111" stroke-width="10"/>
				<path d="M0 -110 A 110 110 0 0 1 0 110" fill="#ff4fd8" opacity="0.8" class="sl"/><line class="hd" x1="0" y1="0" x2="0" y2="-85" stroke="#111" stroke-width="12" stroke-linecap="round"/><circle r="12" fill="#111"/></svg></div>`, stage);
			M.pop(ck, h - 0.4, {from: 0.3});
			tl.fromTo(ck.querySelector('.hd'), {rotation: 0, svgOrigin: '0 0'}, {rotation: 180, svgOrigin: '0 0', duration: 1.6, ease: 'power1.inOut'}, h - 0.2);
			const lbl = el(`<div class="big" style="left:790px;top:340px;transform:translate(-50%,-50%) rotate(-5deg);font-size:96px;color:#fff;white-space:nowrap">30 min</div>`, stage);
			M.slam(lbl, h);
			cardSeq(ctx, [['Every <span class="hl">half</span> hour', h - 0.05, {size: 92}], ['One <span class="hl">Olympic</span> pool', at('Olympic') - 0.05, {size: 84}]], 1100);
		},

		a300(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const s = el(`<div class="ill" style="left:290px;top:520px;width:500px;height:353px;z-index:2">${saturn('worried')}</div>`, stage);
			M.pop(s, start + 0.05, {from: 0.4});
			const n = at('300');
			const num = el(`<div class="big" style="left:540px;top:350px;transform:translate(-50%,-50%) rotate(-3deg);font-size:190px;color:#111;white-space:nowrap"><span class="n">0</span></div>`, stage);
			M.pop(num, n - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), n - 0.2, 0, 300, 1.0, v => Math.round(v));
			const my = el(`<div style="position:absolute;left:540px;top:490px;transform:translate(-50%,-50%) rotate(-3deg);font-size:84px;font-family:Bricolage,sans-serif;font-weight:800;color:#111;white-space:nowrap">million years</div>`, stage);
			M.pop(my, n + 0.6, {from: 0.5});
			tl.to(s.querySelectorAll('.rs'), {scale: 0.75, svgOrigin: '0 0', duration: Math.max(2, dur - 1), ease: 'none'}, start + 0.5);
			cardSeq(ctx, [['Rings <span class="hl">gone</span>', at('gone') - 0.05, {size: 110}]], 1100);
		},

		less(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const s = el(`<div class="ill" style="left:290px;top:540px;width:500px;height:353px;z-index:2">${saturn('worried')}</div>`, stage);
			M.pop(s, start + 0.05, {from: 0.4});
			tl.fromTo(s.querySelectorAll('.rs'), {scale: 0.75, svgOrigin: '0 0'}, {scale: 0.35, svgOrigin: '0 0', duration: Math.max(2, dur - 0.8), ease: 'none', immediateRender: false}, start + 0.5);
			const n = at('100');
			const num = el(`<div class="big" style="left:540px;top:350px;transform:translate(-50%,-50%) rotate(-3deg);font-size:170px;color:#fff;white-space:nowrap">&lt;<span class="n">300</span></div>`, stage);
			M.pop(num, start + 0.1, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), n - 0.3, 300, 100, 0.9, v => Math.round(v));
			const my = el(`<div style="position:absolute;left:540px;top:490px;transform:translate(-50%,-50%) rotate(-3deg);font-size:80px;font-family:Bricolage,sans-serif;font-weight:800;color:#111;white-space:nowrap">million years left</div>`, stage);
			M.pop(my, start + 0.4, {from: 0.5});
			ctx.cue('punch', n, 0.8);
			cardSeq(ctx, [['Even <span class="hl">less</span> time', at('less') - 0.05, {size: 92}]], 1100);
		},

		young(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const bar = el(`<div class="ill" style="left:60px;top:430px;width:960px;height:360px"><svg viewBox="0 0 960 360" width="100%" height="100%">
				<rect x="10" y="150" width="940" height="100" rx="30" fill="#111" transform="translate(10 10)"/>
				<rect class="long" x="10" y="150" width="940" height="100" rx="30" fill="#fff" stroke="#111" stroke-width="10"/>
				<text class="lt" x="480" y="215" font-size="50" text-anchor="middle" font-family="Bricolage" font-weight="800">SATURN: OVER 4 BILLION YEARS</text>
				<g class="tiny"><rect x="826" y="150" width="124" height="100" rx="30" fill="#ff4fd8" stroke="#111" stroke-width="10"/></g>
				<text class="tt" x="780" y="95" font-size="48" text-anchor="end" font-family="Bricolage" font-weight="800">RINGS: UNDER 100M</text>
				<path class="tt" d="M800 110 L 880 140" stroke="#111" stroke-width="8" stroke-linecap="round" fill="none"/></svg></div>`, stage);
			const b = at('billion');
			tl.fromTo(bar.querySelector('.long'), {scaleX: 0.05, svgOrigin: '10 200'}, {scaleX: 1, duration: 0.9, ease: 'power2.out'}, b - 0.6);
			tl.fromTo(bar.querySelector('.lt'), {opacity: 0}, {opacity: 1, duration: 0.3}, b - 0.1);
			ctx.cue('fill', b - 0.6, 0.8);
			const y = at('young');
			tl.fromTo(bar.querySelectorAll('.tiny, .tt'), {opacity: 0, y: 14}, {opacity: 1, y: 0, duration: 0.3, ease: 'back.out(2)'}, y - 0.2);
			ctx.cue('pop', y - 0.1, 0.9);
			M.rise(bar, start + 0.05);
			cardSeq(ctx, [['Rings may be <span class="hl">young</span>', y - 0.05, {size: 78}]], 1100);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'See them <span class="hl">first?</span>', 540, 330, {bg: '#fff', rot: -3, size: 100});
			M.slam(q, start + 0.1);
			const s = el(`<div class="ill" style="left:200px;top:440px;width:680px;height:480px">${saturn('shades')}</div>`, stage);
			M.stretch(s, at('see') - 0.1);
			M.float(s, at('see') + 0.5, dur, {amp: 10, period: 0.9});
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
