// @kit
// Hindi reel (category C): wombats and their roughly cube-shaped droppings. Cartoon cubes only; hedges kept (known / roughly / scientists think / expert says).
window.REEL = (function () {
	const {INK, SKIN, face, card, cardPx, cardSeq, plain, placeFace, lidTo, blink, look, mouth, brows, browTilt, popUp, drift} = KIT;
	const BROWN = '#a67c52', DARK = '#6b4423';

	// cartoon wombat facing right (viewBox -260 -150 520 300)
	const wombat = `<svg viewBox="-260 -150 520 300" width="100%" height="100%">
		<ellipse cx="-215" cy="20" rx="34" ry="28" fill="${INK}" transform="translate(8 8)"/><ellipse cx="-215" cy="20" rx="34" ry="28" fill="${DARK}" stroke="${INK}" stroke-width="9"/>
		<g fill="${DARK}" stroke="${INK}" stroke-width="9"><rect x="-150" y="70" width="52" height="66" rx="22"/><rect x="-70" y="76" width="52" height="64" rx="22"/><rect x="40" y="76" width="52" height="64" rx="22"/><rect x="120" y="70" width="52" height="66" rx="22"/></g>
		<ellipse cx="-20" cy="0" rx="200" ry="112" fill="${INK}" transform="translate(10 10)"/><ellipse cx="-20" cy="0" rx="200" ry="112" fill="${BROWN}" stroke="${INK}" stroke-width="10"/>
		<ellipse cx="-30" cy="40" rx="120" ry="52" fill="#c49a6c" opacity="0.7"/>
		<circle cx="150" cy="-78" r="26" fill="${DARK}" stroke="${INK}" stroke-width="8"/><circle cx="214" cy="-70" r="24" fill="${DARK}" stroke="${INK}" stroke-width="8"/>
		<ellipse cx="180" cy="10" rx="96" ry="82" fill="${INK}" transform="translate(8 8)"/><ellipse cx="180" cy="10" rx="96" ry="82" fill="${BROWN}" stroke="${INK}" stroke-width="10"/>
		<ellipse cx="258" cy="18" rx="30" ry="22" fill="${INK}"/><ellipse cx="250" cy="10" rx="9" ry="5" fill="#fff" opacity="0.5"/>
		<g class="eyes"><circle cx="196" cy="-14" r="22" fill="#fff" stroke="${INK}" stroke-width="7"/><g class="pupils"><circle cx="202" cy="-10" r="10" fill="${INK}"/><circle cx="206" cy="-15" r="3" fill="#fff"/></g></g>
		<path d="M206 52 Q236 66 262 50" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/></svg>`;
	// cartoon cube (a brown block with a lighter top)
	const cube = `<svg viewBox="-60 -60 120 120" width="100%" height="100%"><rect x="-46" y="-46" width="92" height="92" rx="9" fill="${INK}" transform="translate(7 7)"/><rect x="-46" y="-46" width="92" height="92" rx="9" fill="${DARK}" stroke="${INK}" stroke-width="8"/><rect x="-46" y="-46" width="92" height="30" rx="9" fill="#8a5a33"/><path d="M-30 -2 H-6 M-30 20 H10" stroke="#a97444" stroke-width="7" stroke-linecap="round"/></svg>`;
	const ball = `<svg viewBox="-50 -50 100 100" width="100%" height="100%"><circle r="40" fill="${INK}" transform="translate(6 6)"/><circle r="40" fill="${DARK}" stroke="${INK}" stroke-width="8"/><path d="M-20 -14 q10 -12 24 -10" stroke="#a97444" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
	const trophy = `<svg viewBox="-110 -150 220 300" width="100%" height="100%"><path d="M-70 -110 H70 V-40 Q70 20 0 30 Q-70 20 -70 -40 Z" fill="${INK}" transform="translate(9 9)"/><path d="M-70 -110 H70 V-40 Q70 20 0 30 Q-70 20 -70 -40 Z" fill="#ffd23c" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/><path d="M-70 -90 Q-110 -90 -100 -50 Q-92 -20 -64 -24 M70 -90 Q110 -90 100 -50 Q92 -20 64 -24" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><rect x="-14" y="26" width="28" height="56" fill="#ffd23c" stroke="${INK}" stroke-width="8"/><rect x="-56" y="82" width="112" height="34" rx="8" fill="#8a3cff" stroke="${INK}" stroke-width="9"/><text y="-52" font-size="30" text-anchor="middle" font-family="Bricolage" font-weight="800">IG NOBEL</text></svg>`;
	const rock = `<svg viewBox="0 0 500 300" width="100%" height="100%"><path d="M10 290 L60 150 Q120 30 260 50 Q400 70 450 200 L490 290 Z" fill="${INK}" transform="translate(12 12)"/><path d="M10 290 L60 150 Q120 30 260 50 Q400 70 450 200 L490 290 Z" fill="#9aa3ad" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/><path d="M120 120 Q190 80 250 100" fill="none" stroke="#c7cdd4" stroke-width="12" stroke-linecap="round"/></svg>`;
	const log = `<svg viewBox="0 0 480 200" width="100%" height="100%"><rect x="20" y="40" width="440" height="140" rx="40" fill="${INK}" transform="translate(10 10)"/><rect x="20" y="40" width="440" height="140" rx="40" fill="#8b5a2b" stroke="${INK}" stroke-width="10"/><g fill="none" stroke="#6b4423" stroke-width="7" stroke-linecap="round"><path d="M80 80 H300 M120 120 H400 M70 150 H260"/></g><ellipse cx="46" cy="110" rx="26" ry="62" fill="#d8b27d" stroke="${INK}" stroke-width="8"/></svg>`;

	return {
		// 1. the claim: a wombat does it, and a cube pops out
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const L = 120, T = 430, W = 820, H = W * 300 / 520;
			const w = el(`<div class="ill" style="left:${L}px;top:${T}px;width:${W}px;height:${H}px;z-index:3">${wombat}</div>`, stage);
			popUp(ctx, w, start + 0.15, 0.2);
			M.float(w, start + 1, dur, {amp: 8, period: 1.2});
			const t = at('चौकोर');
			const rx = L + (-215 + 260) * (W / 520), ry = T + (20 + 150) * (H / 300);
			[0, 1].forEach(i => {
				const c = el(`<div class="ill" style="left:${rx - 60 + i * 130}px;top:${ry - 70}px;width:120px;height:120px;z-index:5">${cube}</div>`, stage);
				tl.fromTo(c, {y: -40, scale: 0.2, autoAlpha: 0}, {y: 230, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'bounce.out'}, t + i * 0.8);
				tl.fromTo(c, {rotation: 0}, {rotation: 360 * 1, duration: 0.5}, t + i * 0.8);
				ctx.cue('pop', t + i * 0.8 + 0.2, 0.9);
			});
			look(ctx, {e: w}, t, -20, 0, 0.2);
			M.shake(w, t + 0.5, {amp: 5, n: 5});
			cardSeq(ctx, [['<span class="hl">Chaukor</span> potty!', t - 0.05, {size: 96}]], 1130);
			drift(ctx, 1.05);
		},

		// 2. it's the wombat; Ig Nobel prize for this
		name(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const w = at('वॉम्बैट');
			const wb = el(`<div class="ill" style="left:40px;top:700px;width:560px;height:323px;z-index:3">${wombat}</div>`, stage);
			popUp(ctx, wb, w - 0.2, 0.2);
			const tg = el(plain('WOMBAT', 330, 610, 100, INK, -5), stage);
			M.slam(tg, w);
			const n = at('नोबेल');
			const tr = el(`<div class="ill" style="left:600px;top:420px;width:340px;height:463px;z-index:6">${trophy}</div>`, stage);
			popUp(ctx, tr, n - 0.2, 0.1);
			M.wobble(tr, n + 0.4, dur, {amp: 5, period: 0.5});
			ctx.cue('chime', n, 0.9);
			const s1 = placeFace(ctx, 60, 260, 250, {glasses: true, hair: '#f4f4f4'});
			const s2 = placeFace(ctx, 330, 270, 230, {hair: '#1c1c1c'});
			M.pop(s1.e, n - 0.1, {from: 0.3}); M.pop(s2.e, n, {from: 0.3});
			['S', 'S'].forEach((_, i) => mouth(ctx, i ? s2 : s1, n, 'O'));
			for (let i = 0; i < 12; i++) {
				const c = el(`<div class="ill" style="left:${80 + (i * 83) % 880}px;top:240px;width:34px;height:34px;z-index:7"><svg viewBox="-20 -20 40 40" width="100%" height="100%"><polygon points="0,-16 5,-5 16,-4 8,4 10,16 0,10 -10,16 -8,4 -16,-4 -5,-5" fill="${['#ff4fd8', '#c6ff3d', '#3ce7ff', '#ffd23c'][i % 4]}" stroke="${INK}" stroke-width="4"/></svg></div>`, stage);
				tl.fromTo(c, {y: 0, autoAlpha: 0, rotation: 0}, {y: 560 + (i % 3) * 60, autoAlpha: 1, rotation: 360, duration: 1.4, ease: 'power1.in'}, n + 0.1 + (i % 6) * 0.08);
				tl.to(c, {autoAlpha: 0, duration: 0.2}, n + 1.3 + (i % 6) * 0.08);
			}
			cardSeq(ctx, [['Ig Nobel <span class="hl">inaam</span>', n - 0.05, {size: 84}]], 1130);
			drift(ctx, 1.03);
		},

		// 3. it forms inside the last 17% of the gut, not at the exit
		where(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const tube = el(`<div class="ill" style="left:0;top:520px;width:1080px;height:300px;z-index:3"><svg viewBox="0 0 1080 300" width="100%" height="100%">
				<path d="M60 150 H1020" stroke="${INK}" stroke-width="124" stroke-linecap="round"/><path class="t1" d="M60 150 H857" stroke="#ff8fc8" stroke-width="100" stroke-linecap="round"/><path class="t2" d="M857 150 H1020" stroke="#ffb020" stroke-width="100" stroke-linecap="round"/>
				<path d="M857 80 V220" stroke="${INK}" stroke-width="8" stroke-dasharray="12 10"/></svg></div>`, stage);
			M.pop(tube, start + 0.1, {from: 0.5, sfx: false});
			const s = at('सत्रह');
			// blobs travel along the gut and turn square in the orange part
			for (let i = 0; i < 3; i++) {
				const b = el(`<div class="ill" style="left:0;top:520px;width:1080px;height:300px;z-index:5"><svg viewBox="0 0 1080 300" width="100%" height="100%"><rect class="bl" x="-35" y="115" width="70" height="70" rx="35" fill="${DARK}" stroke="${INK}" stroke-width="7"/></svg></div>`, stage);
				const t0 = start + 0.5 + i * 1.3, D = 2.4;
				const bl = b.querySelector('.bl');
				tl.fromTo(bl, {x: 110, autoAlpha: 0}, {x: 940, autoAlpha: 1, duration: D, ease: 'none'}, t0);
				tl.to(bl, {attr: {rx: 6}, duration: 0.5, ease: 'power2.out'}, t0 + D * (857 - 110) / (940 - 110) - 0.2);
				tl.to(bl, {autoAlpha: 0, duration: 0.15}, t0 + D + 0.05);
			}
			const num = el(plain('<span class="n">0</span>%', 330, 400, 150, INK), stage);
			M.pop(num, s - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), s - 0.2, 0, 17, 0.9, v => Math.round(v));
			const ar = el(`<div class="ill" style="left:830px;top:610px;width:200px;height:200px;z-index:8"><svg viewBox="-100 -100 200 200" width="100%" height="100%"><path d="M0 70 V-40 M-34 -8 L0 -44 L34 -8" fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`, stage);
			popUp(ctx, ar, s + 0.4, 0.2);
			const b = at('बाहर');
			const x = el(`<div class="ill" style="left:880px;top:850px;width:160px;height:160px;z-index:8"><svg viewBox="-100 -100 200 200" width="100%" height="100%"><path d="M-70 -70 L 70 70 M70 -70 L -70 70" stroke="#ff3b3b" stroke-width="30" stroke-linecap="round"/></svg></div>`, stage);
			M.pop(x, b - 0.1, {from: 0.2});
			cardSeq(ctx, [['Bahar <span class="hl">nahin</span>', b - 0.05, {size: 96}], ['Aakhiri <span class="hl">17%</span> gut', s - 0.05, {size: 84}]], 1130);
			drift(ctx, 1.03);
		},

		// 4. stiff and stretchy patches squeeze the cube into shape
		stiff(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const gut = el(`<div class="ill" style="left:0;top:430px;width:1080px;height:520px;z-index:3"><svg viewBox="0 0 1080 520" width="100%" height="100%">
				<rect x="20" y="20" width="1040" height="120" rx="40" fill="#8ad6f5" stroke="${INK}" stroke-width="9"/><rect x="20" y="380" width="1040" height="120" rx="40" fill="#8ad6f5" stroke="${INK}" stroke-width="9"/>
				${[150, 600].map(x => `<g class="st"><rect x="${x}" y="130" width="260" height="90" rx="28" fill="#8a3cff" stroke="${INK}" stroke-width="9"/><rect x="${x}" y="300" width="260" height="90" rx="28" fill="#8a3cff" stroke="${INK}" stroke-width="9"/></g>`).join('')}
				<text x="280" y="82" font-size="48" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="${INK}">STRETCHY</text><text x="750" y="82" font-size="48" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="${INK}">STRETCHY</text></svg></div>`, stage);
			M.pop(gut, start + 0.1, {from: 0.5, sfx: false});
			const c = at('चार');
			const lb = el(plain('<span class="n">1</span>x STIFF', 540, 340, 110, INK), stage);
			M.pop(lb, c - 0.3, {sfx: false, from: 0.5});
			M.countUp(lb.querySelector('.n'), c - 0.2, 1, 4, 0.8, v => Math.round(v));
			const bl = el(`<div class="ill" style="left:0;top:430px;width:1080px;height:520px;z-index:5"><svg viewBox="0 0 1080 520" width="100%" height="100%"><rect class="bl" x="-90" y="170" width="160" height="180" rx="80" fill="${DARK}" stroke="${INK}" stroke-width="8"/></svg></div>`, stage).querySelector('.bl');
			tl.fromTo(bl, {x: 60, autoAlpha: 1}, {x: 1000, duration: Math.max(3, dur - 0.6), ease: 'none'}, start + 0.5);
			[150, 600].forEach(x => {
				const t = start + 0.5 + (x + 80 - 60) / 940 * Math.max(3, dur - 0.6);
				tl.to(bl, {attr: {rx: 10, height: 130, y: 195}, duration: 0.35, ease: 'power2.out'}, t);
				tl.to(bl, {attr: {rx: 10}, duration: 0.2}, t + 0.6);
			});
			const k = at('कोने');
			for (let i = 0; i < 4; i++) {
				const d = el(`<div class="ill" style="left:${[120, 340, 120, 340][i] + 520}px;top:${[560, 560, 730, 730][i]}px;width:48px;height:48px;z-index:8"><svg viewBox="-30 -30 60 60" width="100%" height="100%"><circle r="22" fill="#ffd23c" stroke="${INK}" stroke-width="7"/></svg></div>`, stage);
				popUp(ctx, d, k + i * 0.1, 0.1);
			}
			ctx.cue('punch', k, 0.9);
			cardSeq(ctx, [['Kone <span class="hl">ban gaye</span>', k - 0.05, {size: 92}]], 1130);
			drift(ctx, 1.03);
		},

		// 5. a round dropping rolls off the rock; a cube stays put
		why(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const rk = el(`<div class="ill" style="left:60px;top:680px;width:520px;height:312px;z-index:3">${rock}</div>`, stage);
			M.pop(rk, start + 0.1, {from: 0.5, sfx: false});
			const lg = el(`<div class="ill" style="left:580px;top:820px;width:460px;height:192px;z-index:3">${log}</div>`, stage);
			M.pop(lg, at('पत्थरों') - 0.2, {from: 0.5, sfx: false});
			const w = el(`<div class="ill" style="left:620px;top:420px;width:420px;height:242px;z-index:4">${wombat}</div>`, stage);
			M.pop(w, start + 0.2, {from: 0.4, sfx: false});
			const m = at('मानते');
			const wo = el(plain('Scientists maante hain', 540, 330, 66, INK, -3), stage);
			M.slam(wo, m);
			const c1 = el(`<div class="ill" style="left:210px;top:640px;width:110px;height:110px;z-index:5">${cube}</div>`, stage);
			const c2 = el(`<div class="ill" style="left:830px;top:760px;width:100px;height:100px;z-index:5">${cube}</div>`, stage);
			popUp(ctx, c1, at('पत्थरों'), 0.2); popUp(ctx, c2, at('लकड़ियों'), 0.2);
			const l = at('लुढ़कते');
			const bl = el(`<div class="ill" style="left:400px;top:615px;width:100px;height:100px;z-index:5">${ball}</div>`, stage);
			tl.fromTo(bl, {x: 0, y: 0, rotation: 0, autoAlpha: 0}, {autoAlpha: 1, duration: 0.1}, l - 0.4);
			tl.to(bl, {x: 150, y: 190, rotation: 540, duration: 0.9, ease: 'power2.in'}, l - 0.2);
			tl.to(bl, {autoAlpha: 0, duration: 0.2}, l + 0.8);
			ctx.cue('whoosh', l - 0.2, 0.7);
			tl.fromTo(c1, {rotation: 0}, {rotation: -3, duration: 0.15, yoyo: true, repeat: 5}, l + 0.2);
			const mk = at('मार्क');
			const sc = el(`<div class="ill" style="left:200px;top:540px;width:140px;height:110px;z-index:8"><svg viewBox="-70 -55 140 110" width="100%" height="100%"><g fill="none" stroke="#ff4fd8" stroke-width="9" stroke-linecap="round"><path d="M-40 40 q-14 -22 0 -40 q14 -18 0 -36"/><path d="M0 40 q-14 -22 0 -40 q14 -18 0 -36"/><path d="M40 40 q-14 -22 0 -40 q14 -18 0 -36"/></g></svg></div>`, stage);
			popUp(ctx, sc, mk, 0.2);
			M.float(sc, mk + 0.5, dur, {amp: 10, period: 0.8});
			cardSeq(ctx, [['Ludhakte <span class="hl">nahin</span>', l - 0.05, {size: 92}]], 1130);
			drift(ctx, 1.03);
		},

		// 6. the tower myth, according to an expert
		myth(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const ex = placeFace(ctx, 20, 480, 380, {glasses: true, hair: '#f4f4f4'});
			const v = at('विशेषज्ञ');
			M.pop(ex.e, v - 0.2, {from: 0.4});
			const t = at('मीनारें');
			const cs = [0, 1, 2].map(i => {
				const c = el(`<div class="ill" style="left:650px;top:${700 - i * 120}px;width:150px;height:150px;z-index:5">${cube}</div>`, stage);
				M.pop(c, t + i * 0.25, {from: 0.3, sfx: false});
				return c;
			});
			const b = at('बस');
			cs.forEach((c, i) => tl.to(c, {x: (i - 1) * 140, y: 260 - i * 20, rotation: (i - 1) * 90, duration: 0.5, ease: 'power2.in'}, b + 0.5));
			ctx.cue('punch', b, 0.9);
			M.shake(stage, b + 0.05, {amp: 6, n: 6});
			browTilt(ctx, ex, b, 16); mouth(ctx, ex, b, 'F');
			tl.fromTo(ex.e, {rotation: -6}, {rotation: 6, duration: 0.35, yoyo: true, repeat: Math.ceil(dur / 0.35), ease: 'sine.inOut', immediateRender: false}, b);
			const st = cardPx(ctx, 'AFWAAH', 560, 700, {bg: '#ff3b3b', color: '#fff', size: 130, rot: -10});
			st.style.zIndex = 9; st.style.border = '8px dashed #fff';
			M.slam(st, b + 0.4);
			cardSeq(ctx, [['Meenaarein? <span class="hl">Nahin</span>', t - 0.05, {size: 84}]], 1130);
			drift(ctx, 1.03);
		},

		// 7. your call
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = cardPx(ctx, 'Hansi ya <span class="hl">hairani?</span>', 540, 320, {bg: '#fff', rot: -3, size: 80});
			M.slam(q, start + 0.1);
			const w = el(`<div class="ill" style="left:130px;top:470px;width:820px;height:473px;z-index:3">${wombat}</div>`, stage);
			M.stretch(w, start + 0.2);
			M.float(w, start + 0.8, dur, {amp: 8, period: 1});
			const a = at('हँसी'), b = at('हैरानी');
			const A = cardPx(ctx, 'Hansi', 270, 1110, {bg: '#c6ff3d', size: 96, rot: -6});
			const B = cardPx(ctx, 'Hairaani', 790, 1110, {bg: '#ff4fd8', size: 84, rot: 6});
			M.slideIn(A, a - 0.1, {from: 'left'}); M.slideIn(B, b - 0.1, {from: 'right'});
			ctx.cue('pop', a, 0.9); ctx.cue('pop', b, 0.9);
			M.wobble(A, b + 0.3, dur, {amp: 3, period: 0.5}); M.wobble(B, b + 0.4, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', b + 0.4, 0.8);
		},
	};
})();
