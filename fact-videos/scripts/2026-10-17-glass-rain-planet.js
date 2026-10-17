// Reel: "The planet that possibly rains glass sideways" (HD 189733 b). All illustrations are original SVG drawings.
window.REEL = (function () {
	// cobalt planet with cloud bands; mood: 'happy' | 'squint' | 'shades'
	const planet = (mood = 'happy', col = '#2f5bff') => `<svg viewBox="-150 -150 300 300" width="100%" height="100%">
		<circle r="130" fill="#111" transform="translate(11 11)"/><circle r="130" fill="${col}" stroke="#111" stroke-width="10"/>
		<g fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity="0.35"><path d="M-110 -60 Q0 -95 110 -60"/><path d="M-125 40 Q0 10 125 40"/><path d="M-90 88 Q0 66 90 88"/></g>
		<path d="M-70 -78 C -90 -60, -100 -30, -100 -10" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.7"/>
		<g class="eyes">${mood === 'squint' ? `<path d="M-62 -22 L -26 -6 L -62 10 M 62 -22 L 26 -6 L 62 10" stroke="#111" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
			: mood === 'shades' ? `<rect x="-76" y="-30" width="66" height="44" rx="14" fill="#111"/><rect x="10" y="-30" width="66" height="44" rx="14" fill="#111"/><path d="M-10 -14 H10" stroke="#111" stroke-width="8"/><path d="M-62 -18 l 20 0 M 28 -18 l 20 0" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.6"/>`
			: `<ellipse cx="-36" cy="-12" rx="22" ry="26" fill="#fff" stroke="#111" stroke-width="7"/><ellipse cx="36" cy="-12" rx="22" ry="26" fill="#fff" stroke="#111" stroke-width="7"/><g class="pupils"><circle cx="-32" cy="-6" r="10" fill="#111"/><circle cx="40" cy="-6" r="10" fill="#111"/></g>`}</g>
		<path d="${mood === 'squint' ? 'M-30 58 Q0 40 30 58' : 'M-28 52 Q0 76 28 52'}" stroke="#111" stroke-width="9" fill="none" stroke-linecap="round"/></svg>`;
	const star = `<svg viewBox="-260 -260 520 520" width="100%" height="100%">
		<g stroke="#111" stroke-width="12" stroke-linecap="round">${Array.from({length: 14}, (_, i) => `<line x1="0" y1="-200" x2="0" y2="-245" transform="rotate(${i * 360 / 14})"/>`).join('')}</g>
		<circle r="190" fill="#111" transform="translate(14 14)"/><circle r="190" fill="#ffd23c" stroke="#111" stroke-width="12"/><circle r="130" fill="#ff8a1f" opacity="0.5"/></svg>`;
	const earth = `<svg viewBox="-110 -110 220 220" width="100%" height="100%"><circle r="96" fill="#111" transform="translate(9 9)"/><circle r="96" fill="#3ca8ff" stroke="#111" stroke-width="8"/>
		<g fill="#5be36b" stroke="#111" stroke-width="6" stroke-linejoin="round"><path d="M-70 -30 C -50 -70, -10 -62, -6 -34 C 0 -10, -34 -6, -42 14 C -50 30, -80 12, -84 -12 Z"/><path d="M20 20 C 50 6, 76 28, 66 56 C 50 76, 20 74, 14 56 Z"/></g></svg>`;
	const shard = (c = '#dff6ff') => `<svg viewBox="-40 -40 80 80" width="100%" height="100%"><polygon points="-30,8 -6,-34 30,-10 12,32" fill="${c}" stroke="#111" stroke-width="6" stroke-linejoin="round"/><path d="M-8 -20 L 12 -6" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>`;

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
	// glass shards streaking sideways across the frame
	function shards(ctx, t, dur, n = 14, speed = 0.9, y0 = 360, y1 = 940) {
		for (let i = 0; i < n; i++) {
			const sz = 44 + (i * 37) % 36, y = y0 + ((i * 97) % (y1 - y0));
			const e = ctx.el(`<div class="ill" style="left:-120px;top:${y}px;width:${sz}px;height:${sz}px;z-index:5">${shard(i % 2 ? '#dff6ff' : '#9fe8ff')}</div>`, ctx.stage);
			ctx.tl.fromTo(e, {x: 0, rotation: 0, autoAlpha: 1}, {x: 1320, rotation: 540, duration: speed + (i % 4) * 0.12, ease: 'none', repeat: Math.ceil(dur / speed), repeatDelay: (i % 5) * 0.1}, t + (i % 7) * 0.13);
		}
	}

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const p = el(`<div class="ill" style="left:250px;top:430px;width:580px;height:580px;z-index:2">${planet('squint')}</div>`, stage);
			M.stretch(p, start + 0.05);
			M.wobble(p, start + 0.7, dur, {amp: 3, period: 0.7});
			const g = at('glass');
			shards(ctx, g - 0.1, dur, 14, 0.85);
			ctx.cue('chime', g, 0.6);
			M.shake(p, at('Sideways'), {amp: 8, n: 9});
			cardSeq(ctx, [['Rains <span class="hl">glass</span>', g, {size: 110}], ['<span class="hl">Sideways</span>!', at('Sideways') - 0.05, {size: 120}]]);
		},

		blue(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const e = el(`<div class="ill" style="left:60px;top:780px;width:190px;height:190px">${earth}</div>`, stage);
			M.pop(e, start + 0.1);
			const p = el(`<div class="ill" style="left:560px;top:520px;width:440px;height:440px">${planet('happy')}</div>`, stage);
			M.pop(p, at('cobalt') - 0.2, {from: 0.3});
			M.float(p, at('cobalt') + 0.5, dur, {amp: 10, period: 1});
			const arc = el(`<div class="ill" style="left:0;top:480px;width:1080px;height:440px"><svg viewBox="0 0 1080 440" width="100%" height="100%"><path class="ln" d="M240 370 C 330 250, 440 210, 560 250" fill="none" stroke="#111" stroke-width="12" stroke-dasharray="28 20" stroke-linecap="round"/></svg></div>`, stage);
			M.draw(arc.querySelector('.ln'), start + 0.3, 1.2, {ease: 'power1.inOut'});
			const num = el(`<div class="big" style="left:540px;top:350px;transform:translate(-50%,-50%) rotate(-3deg);font-size:118px;color:#8a3cff;white-space:nowrap"><span class="n">0</span> light-years</div>`, stage);
			M.pop(num, at('63') - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('63') - 0.2, 0, 63, 0.9, v => Math.round(v));
			cardSeq(ctx, [['Deep <span class="hl">cobalt</span> blue', at('cobalt') - 0.05, {size: 86}]]);
		},

		why(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const wave = el(`<div class="ill" style="left:300px;top:270px;width:480px;height:220px"><svg viewBox="0 0 480 220" width="100%" height="100%">
				<g fill="none" stroke="#111" stroke-width="14" stroke-linecap="round"><path d="M30 70 q 30 -40 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0"/><path d="M30 120 q 30 -40 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0" stroke="#3ca8ff"/><path d="M30 170 q 30 -40 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0"/></g>
				<path class="x" d="M150 20 L 330 200 M330 20 L 150 200" stroke="#ff4f4f" stroke-width="26" stroke-linecap="round"/></svg></div>`, stage);
			M.pop(wave, start + 0.1, {from: 0.5});
			const o = at('ocean');
			const x = wave.querySelector('.x');
			M.draw(x, o, 0.4, {ease: 'power2.out'});
			ctx.cue('snap', o, 0.8);
			const sh = el(`<div class="ill" style="left:380px;top:560px;width:320px;height:320px">${shard('#dff6ff')}</div>`, stage);
			const d = at('drops');
			M.pop(sh, d - 0.1, {from: 0.3});
			M.float(sh, d + 0.5, dur, {amp: 8, period: 1});
			const rays = el(`<div class="ill" style="left:0;top:520px;width:1080px;height:420px"><svg viewBox="0 0 1080 420" width="100%" height="100%">
				<path class="rin" d="M40 210 H 380" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-dasharray="1"/>
				<path class="rb" d="M700 190 L 1030 80" stroke="#2f5bff" stroke-width="22" stroke-linecap="round"/><path class="rb" d="M700 210 L 1040 210" stroke="#2f5bff" stroke-width="22" stroke-linecap="round"/><path class="rb" d="M700 230 L 1030 340" stroke="#2f5bff" stroke-width="22" stroke-linecap="round"/></svg></div>`, stage);
			M.draw(rays.querySelector('.rin'), d, 0.5, {ease: 'none'});
			const sc = at('scatter');
			rays.querySelectorAll('.rb').forEach((r, i) => M.draw(r, sc + i * 0.08, 0.45, {ease: 'power2.out'}));
			ctx.cue('whoosh', sc, 0.7);
			cardSeq(ctx, [['Not an <span class="hl">ocean</span>', o, {size: 96}], ['Glass scatters <span class="hl">blue</span>', sc - 0.1, {size: 70}]], 1100);
		},

		heat(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			starfield(ctx, 36, 6);
			const s = el(`<div class="ill" style="left:520px;top:340px;width:600px;height:600px;z-index:2">${star}</div>`, stage);
			M.pop(s, start + 0.1, {from: 0.3});
			tl.to(s, {rotation: 25, duration: dur, ease: 'none'}, start);
			const p = el(`<div class="ill" style="left:290px;top:580px;width:240px;height:240px;z-index:3">${planet('squint')}</div>`, stage);
			M.pop(p, start + 0.3, {from: 0.3});
			const th = el(`<div class="ill" style="left:60px;top:400px;width:170px;height:520px;z-index:3"><svg viewBox="0 0 170 520" width="100%" height="100%">
				<rect x="50" y="10" width="70" height="400" rx="35" fill="#fff" stroke="#111" stroke-width="9"/><circle cx="85" cy="440" r="64" fill="#fff" stroke="#111" stroke-width="9"/>
				<circle cx="85" cy="440" r="46" fill="#ff3b3b"/><rect class="hg" x="70" y="40" width="30" height="400" rx="15" fill="#ff3b3b"/></svg></div>`, stage);
			M.pop(th, start + 0.2, {from: 0.4});
			const h = at('2,000');
			tl.fromTo(th.querySelector('.hg'), {scaleY: 0.05, svgOrigin: '85 440'}, {scaleY: 1, duration: 1.2, ease: 'power2.out'}, h - 0.3);
			ctx.cue('fill', h - 0.3, 0.8);
			const num = el(`<div class="big" style="left:540px;top:310px;transform:translate(-50%,-50%) rotate(-3deg);font-size:130px;color:#ff8a1f;white-space:nowrap;z-index:6"><span class="n">0</span>°F</div>`, stage);
			M.pop(num, h - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), h - 0.2, 0, 2000, 1.1);
			cardSeq(ctx, [['Nearly <span class="hl">2,000°F</span>', h, {size: 84}], ['Just <span class="hl">2.9M</span> miles away', at('million') - 0.4, {size: 70}]], 1100);
		},

		wind(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const p = el(`<div class="ill" style="left:290px;top:480px;width:500px;height:500px;z-index:2">${planet('squint')}</div>`, stage);
			M.pop(p, start + 0.05, {from: 0.4});
			tl.to(p, {x: 14, duration: 0.08, yoyo: true, repeat: 40, ease: 'none'}, start + 0.5);
			const h = at('howl');
			shards(ctx, h - 0.1, dur, 12, 0.6, 400, 960);
			for (let i = 0; i < 5; i++) {
				const w = el(`<div class="ill" style="left:-300px;top:${380 + i * 120}px;width:300px;height:30px;z-index:4"><svg viewBox="0 0 300 30" width="100%" height="100%"><path d="M0 15 H 300" stroke="#111" stroke-width="10" stroke-linecap="round" stroke-dasharray="120 60"/></svg></div>`, stage);
				tl.fromTo(w, {x: 0}, {x: 1500, duration: 0.45, ease: 'none', repeat: Math.ceil(dur / 0.5), repeatDelay: 0.05 + (i % 3) * 0.04}, h - 0.1 + i * 0.09);
			}
			const num = el(`<div class="big" style="left:540px;top:330px;transform:translate(-50%,-50%) rotate(-3deg);font-size:130px;color:#fff;white-space:nowrap;z-index:6"><span class="n">0</span> mph</div>`, stage);
			M.pop(num, at('4,500') - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('4,500') - 0.2, 0, 4500, 1.0);
			ctx.cue('whoosh', h, 0.7);
			cardSeq(ctx, [['Winds may <span class="hl">howl</span>', h - 0.05, {size: 92}]], 1100);
		},

		color(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const p = el(`<div class="ill" style="left:60px;top:470px;width:300px;height:300px;z-index:2">${planet('happy')}</div>`, stage);
			M.pop(p, start + 0.1, {from: 0.3});
			const s = el(`<div class="ill" style="left:420px;top:250px;width:560px;height:560px;z-index:3">${star}</div>`, stage);
			M.pop(s, start + 0.05, {from: 0.3});
			tl.to(s, {rotation: 20, duration: dur, ease: 'none'}, start);
			const b = at('behind');
			tl.to(p, {x: 490, y: -70, duration: 1.2, ease: 'power1.inOut'}, b - 0.3);
			tl.to(p, {autoAlpha: 0, duration: 0.2}, b + 1.0);
			const bars = el(`<div class="ill" style="left:150px;top:830px;width:780px;height:200px"><svg viewBox="0 0 780 200" width="100%" height="100%">
				<rect x="10" y="40" width="240" height="120" rx="20" fill="#ff3b3b" stroke="#111" stroke-width="9"/><rect x="270" y="40" width="240" height="120" rx="20" fill="#5be36b" stroke="#111" stroke-width="9"/>
				<g class="bb"><rect x="530" y="40" width="240" height="120" rx="20" fill="#2f5bff" stroke="#111" stroke-width="9"/></g></svg></div>`, stage);
			M.rise(bars, b);
			const v = at('vanished');
			tl.to(bars.querySelector('.bb'), {scaleX: 0.12, svgOrigin: '770 100', duration: 0.5, ease: 'power3.in'}, v);
			ctx.cue('snap', v, 0.8);
			cardSeq(ctx, [['Passes <span class="hl">behind</span> its star', b - 0.1, {size: 66}], ['<span class="hl">Blue</span> light vanished', v - 0.05, {size: 76}]], 1110);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Would you <span class="hl">visit?</span>', 540, 330, {bg: '#fff', rot: -3, size: 100});
			M.slam(q, start + 0.1);
			const p = el(`<div class="ill" style="left:290px;top:430px;width:500px;height:500px">${planet('shades')}</div>`, stage);
			M.stretch(p, at('ever') - 0.1);
			M.float(p, at('ever') + 0.5, dur, {amp: 10, period: 0.9});
			const yes = card(ctx, 'YES', 270, 1090, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1090, {bg: '#c6ff3d', size: 120, rot: 6});
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
