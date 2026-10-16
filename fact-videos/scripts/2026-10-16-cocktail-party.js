// Reel: "Hearing your name in a noisy room". All illustrations are original SVG drawings.
window.REEL = (function () {
	// round-faced listener wearing headphones
	const face = (skin = '#ffb98a') => `<svg viewBox="-150 -170 300 330" width="100%" height="100%">
		<path d="M-112 -10 C -125 -150, 125 -150, 112 -10" fill="none" stroke="#111" stroke-width="20" stroke-linecap="round"/>
		<circle r="100" fill="#111" transform="translate(9 9)"/><circle r="100" fill="${skin}" stroke="#111" stroke-width="9"/>
		<g class="eyes"><ellipse cx="-34" cy="-14" rx="21" ry="25" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="34" cy="-14" rx="21" ry="25" fill="#fff" stroke="#111" stroke-width="6"/>
		<g class="pupils"><circle cx="-30" cy="-8" r="9" fill="#111"/><circle cx="38" cy="-8" r="9" fill="#111"/></g></g>
		<path d="M-26 42 Q0 62 26 42" class="mouth" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>
		<rect x="-136" y="-52" width="44" height="86" rx="20" fill="#8a3cff" stroke="#111" stroke-width="9"/><rect x="92" y="-52" width="44" height="86" rx="20" fill="#8a3cff" stroke="#111" stroke-width="9"/></svg>`;
	const shield = `<svg viewBox="-100 -120 200 240" width="100%" height="100%"><path d="M0 -105 L 90 -70 C 90 30, 60 85, 0 110 C -60 85, -90 30, -90 -70 Z" fill="#111" transform="translate(8 8)"/>
		<path d="M0 -105 L 90 -70 C 90 30, 60 85, 0 110 C -60 85, -90 30, -90 -70 Z" fill="#c6ff3d" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="M0 -60 V 60 M-45 -10 H 45" stroke="#111" stroke-width="12" stroke-linecap="round"/></svg>`;
	const brain = `<svg viewBox="-170 -120 340 240" width="100%" height="100%">
		<g fill="#111" transform="translate(10 10)"><circle cx="-90" cy="10" r="60"/><circle cx="-30" cy="-45" r="68"/><circle cx="45" cy="-40" r="66"/><circle cx="100" cy="15" r="56"/><circle cx="-5" cy="45" r="62"/></g>
		<g fill="#ff8fc8" stroke="#111" stroke-width="9"><circle cx="-90" cy="10" r="60"/><circle cx="-30" cy="-45" r="68"/><circle cx="45" cy="-40" r="66"/><circle cx="100" cy="15" r="56"/><circle cx="-5" cy="45" r="62"/></g>
		<g fill="#ff8fc8"><circle cx="-90" cy="10" r="55"/><circle cx="-30" cy="-45" r="63"/><circle cx="45" cy="-40" r="61"/><circle cx="100" cy="15" r="51"/><circle cx="-5" cy="45" r="57"/></g>
		<path d="M-60 -30 Q-30 -10 -50 20 M30 -60 Q60 -30 30 -5 M70 10 Q90 40 55 50 M-40 55 Q-10 70 20 55" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/>
		<g><ellipse cx="-25" cy="0" rx="17" ry="20" fill="#fff" stroke="#111" stroke-width="6"/><ellipse cx="25" cy="0" rx="17" ry="20" fill="#fff" stroke="#111" stroke-width="6"/><circle cx="-21" cy="5" r="7" fill="#111"/><circle cx="29" cy="5" r="7" fill="#111"/></g></svg>`;
	const bang = `<svg viewBox="-90 -90 180 180" width="100%" height="100%"><polygon points="${Array.from({length: 16}, (_, i) => { const a = i * Math.PI / 8, r = i % 2 ? 50 : 85; return (Math.cos(a) * r).toFixed(0) + ',' + (Math.sin(a) * r).toFixed(0); }).join(' ')}" fill="#ffd23c" stroke="#111" stroke-width="7" stroke-linejoin="round"/><text y="26" font-size="76" text-anchor="middle" font-family="Bricolage" font-weight="800">!</text></svg>`;

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
	const NOISE = ['#3ce7ff', '#ffd23c', '#c6ff3d', '#ff8a1f', '#fff', '#3ce7ff'];
	// a babble bubble with talking squiggles
	function babble(ctx, x, y, col, i, t, dur) {
		const b = ctx.el(`<div class="ill" style="left:${x}px;top:${y}px;width:190px;height:120px"><svg viewBox="0 0 190 120" width="100%" height="100%">
			<rect x="10" y="8" width="170" height="86" rx="34" fill="#111" transform="translate(7 7)"/><rect x="10" y="8" width="170" height="86" rx="34" fill="${col}" stroke="#111" stroke-width="7"/>
			<path d="M36 106 L 56 90 L 76 94 Z" fill="${col}" stroke="#111" stroke-width="7" stroke-linejoin="round"/>
			<path d="M40 50 q 12 -16 24 0 t 24 0 t 24 0 t 18 0" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round"/></svg></div>`, ctx.stage);
		ctx.M.pop(b, t + i * 0.12, {from: 0.3, sfx: i < 2});
		ctx.M.wobble(b, t + 0.6 + i * 0.12, dur, {amp: 4 + (i % 3), period: 0.5 + (i % 3) * 0.12});
		return b;
	}

	return {
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const spots = [[40, 330], [800, 300], [30, 700], [830, 680], [60, 880], [820, 880]];
			spots.forEach(([x, y], i) => babble(ctx, x, y, NOISE[i], i, start + 0.05, dur));
			const f = el(`<div class="ill" style="left:280px;top:480px;width:520px;height:572px;z-index:3">${face()}</div>`, stage);
			M.stretch(f, start + 0.05);
			M.float(f, start + 0.7, dur, {amp: 8, period: 1});
			const n = at('name');
			const b = el(`<div class="ill" style="left:700px;top:300px;width:260px;height:260px;z-index:4">${bang}</div>`, stage);
			M.pop(b, n, {from: 0.2});
			ctx.cue('chime', n, 0.8);
			tl.to(f.querySelector('.pupils'), {x: 14, y: -10, duration: 0.15}, n);
			cardSeq(ctx, [['Hear your <span class="hl">name</span>?', n - 0.1, {size: 100}], ['Weaker <span class="hl">focus</span>?', at('weaker') - 0.1, {size: 96}]], 1100);
		},

		test(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = el(`<div class="ill" style="left:340px;top:520px;width:400px;height:440px">${face()}</div>`, stage);
			M.pop(f, start + 0.05, {from: 0.4});
			const A = card(ctx, 'Voice A', 185, 410, {bg: '#c6ff3d', size: 60, rot: -4});
			const B = card(ctx, 'Voice B', 895, 410, {bg: '#fff', size: 60, rot: 4});
			const r = at('repeat');
			M.slideIn(A, r - 0.1, {from: 'left'});
			M.slideIn(B, r + 0.3, {from: 'right'});
			tl.fromTo(f.querySelector('.mouth'), {scaleY: 1}, {scaleY: 1.6, svgOrigin: '0 42', duration: 0.18, yoyo: true, repeat: 8}, r + 0.2);
			const ig = at('ignore');
			const x = el(`<div class="ill" style="left:790px;top:330px;width:210px;height:210px;z-index:4"><svg viewBox="-100 -100 200 200" width="100%" height="100%"><path d="M-70 -70 L 70 70 M70 -70 L -70 70" stroke="#ff4f4f" stroke-width="30" stroke-linecap="round"/></svg></div>`, stage);
			M.pop(x, ig, {from: 0.2});
			const N = card(ctx, 'NAME!', 895, 410, {bg: '#ff4fd8', size: 64, rot: 6});
			const nm = at('name');
			tl.set(B, {autoAlpha: 0}, nm - 0.05); tl.set(x, {autoAlpha: 0}, nm - 0.05);
			M.slam(N, nm - 0.05);
			tl.to(f.querySelector('.pupils'), {x: 14, duration: 0.15}, nm);
			cardSeq(ctx, [['Repeat <span class="hl">one</span>', r, {size: 100}], ['Ignore the <span class="hl">other</span>', ig - 0.05, {size: 80}], ['Hear your <span class="hl">name</span>', nm - 0.05, {size: 90}]]);
		},

		third(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const faces = [[40, '#ffb98a'], [380, '#e0a070'], [720, '#ffd4a8']].map(([x, c], i) => {
				const f = el(`<div class="ill" style="left:${x}px;top:560px;width:320px;height:352px">${face(c)}</div>`, stage);
				M.pop(f, start + 0.1 + i * 0.12, {from: 0.3, sfx: i === 0});
				return f;
			});
			const num = el(`<div class="big" style="left:540px;top:380px;transform:translate(-50%,-50%) rotate(-3deg);font-size:190px;color:#111;white-space:nowrap">1 in 3</div>`, stage);
			M.slam(num, at('one'));
			const nt = at('noticed');
			const b = el(`<div class="ill" style="left:110px;top:410px;width:200px;height:200px;z-index:4">${bang}</div>`, stage);
			M.pop(b, nt, {from: 0.2});
			ctx.cue('chime', nt, 0.7);
			tl.to(faces[0].querySelector('.pupils'), {x: 12, y: -10, duration: 0.15}, nt);
			faces.slice(1).forEach(f => M.wobble(f, nt + 0.2, dur, {amp: 3, period: 0.9}));
			cardSeq(ctx, [['Only <span class="hl">some</span> noticed', at('Only') + 0.1, {size: 90}]]);
		},

		split(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const w = at('working');
			const b = el(`<div class="ill" style="left:340px;top:260px;width:400px;height:282px">${brain}</div>`, stage);
			M.pop(b, w - 0.1, {from: 0.3});
			M.float(b, w + 0.5, dur, {amp: 8, period: 1});
			const ws = at('workspace');
			const blocks = (x0, n, col) => Array.from({length: n}, (_, i) => `<rect class="bl" x="${x0 + 22 + (i % 3) * 126}" y="${90 + Math.floor(i / 3) * 90}" width="104" height="72" rx="14" fill="${col}" stroke="#111" stroke-width="7"/>`).join('');
			const box = el(`<div class="ill" style="left:60px;top:590px;width:960px;height:420px"><svg viewBox="0 0 960 420" width="100%" height="100%">
				<rect class="cb" x="20" y="60" width="420" height="300" rx="26" fill="#fff" stroke="#111" stroke-width="9"/><rect class="cb" x="520" y="60" width="420" height="300" rx="26" fill="#fff" stroke="#111" stroke-width="9"/>
				${blocks(20, 3, '#ff4fd8')}${blocks(520, 9, '#8a3cff')}
				<text x="230" y="35" font-size="52" text-anchor="middle" font-family="Bricolage" font-weight="800">LOW</text><text x="730" y="35" font-size="52" text-anchor="middle" font-family="Bricolage" font-weight="800">HIGH</text></svg></div>`, stage);
			M.rise(box, ws - 0.1);
			box.querySelectorAll('.bl').forEach((e, i) => {
				tl.fromTo(e, {scale: 0, autoAlpha: 0, svgOrigin: `${+e.getAttribute('x') + 52} ${+e.getAttribute('y') + 36}`}, {scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2)'}, ws + 0.3 + (i < 3 ? i : i - 3) * 0.14 + (i < 3 ? 0 : 0.1));
			});
			cardSeq(ctx, [['Working <span class="hl">memory</span>', w, {size: 88}], ['Mental <span class="hl">workspace</span>', ws - 0.05, {size: 80}]], 1100);
		},

		numbers(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const base = 960, scale = 640;
			const mk = (x, pct, col, label, t) => {
				const H = Math.round(pct / 100 * scale);
				const bar = el(`<div class="ill" style="left:${x}px;top:${base - H}px;width:340px;height:${H}px;background:${col};border:8px solid #111;border-radius:26px 26px 6px 6px;box-shadow:12px 12px 0 #111;transform-origin:50% 100%"><div style="position:absolute;bottom:14px;left:0;right:0;text-align:center;font-size:60px;font-family:Bricolage,sans-serif;font-weight:800;color:#111">${label}</div></div>`, stage);
				tl.fromTo(bar, {scaleY: 0}, {scaleY: 1, duration: 0.6, ease: 'back.out(1.4)'}, t - 0.2);
				ctx.cue('fill', t - 0.2, 0.7);
				const num = el(`<div class="big" style="left:${x + 170}px;top:${base - H - 90}px;transform:translate(-50%,-50%) rotate(-3deg);font-size:130px;color:#fff;white-space:nowrap"><span class="n">0%</span></div>`, stage);
				M.pop(num, t - 0.1, {sfx: false, from: 0.5});
				M.countUp(num.querySelector('.n'), t, 0, pct, 0.9, v => Math.round(v) + '%');
			};
			mk(60, 65, '#c6ff3d', 'LOW', at('65'));
			mk(680, 20, '#ffd23c', 'HIGH', at('20'));
			cardSeq(ctx, [['Heard their <span class="hl">name</span>', at('heard'), {size: 76}]], 1100);
		},

		why(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = el(`<div class="ill" style="left:330px;top:500px;width:420px;height:462px;z-index:3">${face()}</div>`, stage);
			M.pop(f, start + 0.05, {from: 0.4});
			M.float(f, start + 0.7, dur, {amp: 8, period: 1});
			const bl = at('blocking');
			const sh = el(`<div class="ill" style="left:130px;top:520px;width:200px;height:240px;z-index:4">${shield}</div>`, stage);
			M.pop(sh, bl - 0.1, {from: 0.2});
			ctx.cue('punch', bl, 0.8);
			// distractions bounce off the shield
			[[380, 0], [620, 120], [450, 240]].forEach(([y, d], i) => {
				const b = el(`<div class="ill" style="left:-220px;top:${y + 140}px;width:190px;height:120px;z-index:2"><svg viewBox="0 0 190 120" width="100%" height="100%"><rect x="10" y="8" width="170" height="86" rx="34" fill="${NOISE[i]}" stroke="#111" stroke-width="7"/><path d="M40 50 q 12 -16 24 0 t 24 0 t 24 0 t 18 0" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round"/></svg></div>`, stage);
				for (let k = 0; k < 4; k++) {
					const t0 = bl + 0.2 + d / 1000 + k * 0.9;
					tl.fromTo(b, {x: 0, autoAlpha: 1}, {x: 300, duration: 0.4, ease: 'power1.in'}, t0);
					tl.to(b, {x: 120, autoAlpha: 0, duration: 0.35, ease: 'power2.out'}, t0 + 0.4);
				}
			});
			const nm = el(`<div class="ill" style="left:-300px;top:700px;width:230px;height:130px;z-index:5"><svg viewBox="0 0 230 130" width="100%" height="100%"><rect x="10" y="8" width="210" height="96" rx="36" fill="#ff4fd8" stroke="#111" stroke-width="7"/><text x="115" y="75" font-size="48" text-anchor="middle" font-family="Bricolage" font-weight="800">NAME</text></svg></div>`, stage);
			const tn = Math.max(bl + 1.6, start + dur - 1.5);
			tl.fromTo(nm, {x: 0}, {x: 560, duration: 0.6, ease: 'power1.inOut'}, tn);
			tl.to(f.querySelector('.pupils'), {x: -14, duration: 0.15}, tn + 0.4);
			ctx.cue('whoosh', tn, 0.7);
			cardSeq(ctx, [['Bad at <span class="hl">blocking</span>', bl, {size: 90}]], 1130);
		},

		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Hear your <span class="hl">name?</span>', 540, 330, {bg: '#fff', rot: -3, size: 96});
			M.slam(q, start + 0.1);
			const f = el(`<div class="ill" style="left:290px;top:440px;width:500px;height:550px">${face()}</div>`, stage);
			M.stretch(f, at('crowd') - 0.1);
			M.float(f, at('crowd') + 0.5, dur, {amp: 10, period: 0.9});
			const yes = card(ctx, 'YES', 270, 1090, {bg: '#8a3cff', size: 120, rot: -6, color: '#fff'});
			const no = card(ctx, 'NO', 810, 1090, {bg: '#ffd23c', size: 120, rot: 6});
			M.slideIn(yes, at('Yes') - 0.1, {from: 'left'});
			ctx.cue('pop', at('Yes'), 0.9);
			M.slideIn(no, at('no') - 0.1, {from: 'right'});
			ctx.cue('pop', at('no'), 0.9);
			tl.to(f.querySelector('.pupils'), {x: -14, duration: 0.15}, at('Yes')).to(f.querySelector('.pupils'), {x: 14, duration: 0.15}, at('no'));
			M.wobble(yes, at('no') + 0.4, dur, {amp: 3, period: 0.5});
			M.wobble(no, at('no') + 0.5, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', at('no') + 0.35, 0.8);
		},
	};
})();
