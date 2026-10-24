// @kit
// Hindi reel (category B): the Ben Franklin effect. Generic cartoon characters; Franklin's story + a 1969 study, with the caveats kept.
window.REEL = (function () {
	const {INK, SKIN, face, card, cardPx, cardSeq, plain, placeFace, lidTo, blink, look, mouth, brows, browTilt, bags, dizzy, popUp, drift, headIcon} = KIT;
	const GREY = '#1c1c1c', WHITE = '#f4f4f4';

	const book = `<svg viewBox="-120 -150 240 300" width="100%" height="100%"><rect x="-100" y="-130" width="200" height="260" rx="14" fill="${INK}" transform="translate(10 10)"/><rect x="-100" y="-130" width="200" height="260" rx="14" fill="#b3202a" stroke="${INK}" stroke-width="9"/><rect x="-100" y="-130" width="34" height="260" rx="10" fill="#7d1219" stroke="${INK}" stroke-width="7"/>
		<rect x="-40" y="-92" width="110" height="70" rx="8" fill="none" stroke="#ffd23c" stroke-width="7"/><path d="M-22 -58 H52 M-22 -40 H34" stroke="#ffd23c" stroke-width="7" stroke-linecap="round"/><path d="M-100 -130 l30 0 M70 -130 l30 0 M-100 130 l30 0 M70 130 l30 0" stroke="#ffd23c" stroke-width="11"/>
		<g class="sp" fill="#ffd23c" stroke="${INK}" stroke-width="5"><path d="M110 -120 l8 20 l20 8 l-20 8 l-8 20 l-8 -20 l-20 -8 l20 -8 z"/><path d="M-112 90 l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6 l14 -6 z"/></g></svg>`;
	const note = (t1, t2) => `<svg viewBox="0 0 260 200" width="100%" height="100%"><rect x="14" y="14" width="232" height="172" rx="10" fill="${INK}" transform="translate(9 9)"/><rect x="14" y="14" width="232" height="172" rx="10" fill="#fff8d8" stroke="${INK}" stroke-width="8"/><text x="130" y="76" font-size="40" text-anchor="middle" font-family="Bricolage" font-weight="800">${t1}</text><text x="130" y="128" font-size="40" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="#ff4fd8">${t2}</text></svg>`;
	const heart = `<svg viewBox="-60 -55 120 110" width="100%" height="100%"><path d="M0 48 C -70 0, -56 -48, -24 -48 C -8 -48, 0 -36, 0 -28 C 0 -36, 8 -48, 24 -48 C 56 -48, 70 0, 0 48 Z" fill="#ff4fd8" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/></svg>`;
	const calendar = `<svg viewBox="0 0 340 260" width="100%" height="100%"><rect x="14" y="14" width="312" height="232" rx="18" fill="${INK}" transform="translate(10 10)"/><rect x="14" y="14" width="312" height="232" rx="18" fill="#fff" stroke="${INK}" stroke-width="9"/><rect x="14" y="14" width="312" height="62" rx="18" fill="#ff3b3b" stroke="${INK}" stroke-width="9"/><text x="170" y="60" font-size="40" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="#fff">1 WEEK</text>
		${Array.from({length: 7}, (_, i) => `<rect x="${34 + (i % 4) * 72}" y="${96 + Math.floor(i / 4) * 70}" width="58" height="56" rx="10" fill="#f3f3f3" stroke="${INK}" stroke-width="6"/><path class="ck" d="M${44 + (i % 4) * 72} ${126 + Math.floor(i / 4) * 70} l14 14 l26 -30" fill="none" stroke="#2e9b3e" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
	const angry = `<svg viewBox="-40 -40 80 80" width="100%" height="100%"><g stroke="#ff3b3b" stroke-width="10" stroke-linecap="round" fill="none"><path d="M-26 -8 Q-8 -8 -8 -26 M26 -8 Q8 -8 8 -26 M-26 8 Q-8 8 -8 26 M26 8 Q8 8 8 26"/></g></svg>`;
	const bubble = (txt) => `<svg viewBox="0 0 360 200" width="100%" height="100%"><path d="M30 20 H330 Q350 20 350 40 V130 Q350 150 330 150 H190 L150 190 L150 150 H30 Q10 150 10 130 V40 Q10 20 30 20 Z" fill="${INK}" transform="translate(9 9)"/><path d="M30 20 H330 Q350 20 350 40 V130 Q350 150 330 150 H190 L150 190 L150 150 H30 Q10 150 10 130 V40 Q10 20 30 20 Z" fill="#fff" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><text x="180" y="100" font-size="52" text-anchor="middle" font-family="Bricolage" font-weight="800">${txt}</text></svg>`;
	const charger = `<svg viewBox="-80 -80 160 160" width="100%" height="100%"><path d="M-8 60 Q -8 20 -50 20" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><rect x="-34" y="-62" width="68" height="84" rx="14" fill="${INK}" transform="translate(7 7)"/><rect x="-34" y="-62" width="68" height="84" rx="14" fill="#fff" stroke="${INK}" stroke-width="8"/><rect x="-20" y="-82" width="10" height="24" fill="${INK}"/><rect x="10" y="-82" width="10" height="24" fill="${INK}"/><path d="M6 -38 L -10 -8 H4 L -4 12 L 14 -18 H 0 Z" fill="#ffd23c" stroke="${INK}" stroke-width="4"/></svg>`;
	const notebook = `<svg viewBox="-80 -90 160 180" width="100%" height="100%"><rect x="-60" y="-76" width="120" height="152" rx="12" fill="${INK}" transform="translate(8 8)"/><rect x="-60" y="-76" width="120" height="152" rx="12" fill="#3ce7ff" stroke="${INK}" stroke-width="8"/><rect x="-36" y="-52" width="76" height="40" rx="6" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M-60 -50 h-8 M-60 -20 h-8 M-60 10 h-8 M-60 40 h-8" stroke="${INK}" stroke-width="8" stroke-linecap="round"/></svg>`;

	return {
		// 1. a rival, a book, and a friendship
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const R = placeFace(ctx, 20, 440, 430, {hair: GREY});
			const F = placeFace(ctx, 630, 440, 430, {hair: WHITE, glasses: true});
			M.pop(R.e, start + 0.1, {from: 0.5}); M.pop(F.e, start + 0.2, {from: 0.5});
			mouth(ctx, R, start + 0.2, 'F'); browTilt(ctx, R, start + 0.3, 20);
			const j = at('जलता');
			const av = el(`<div class="ill" style="left:300px;top:470px;width:110px;height:110px;z-index:6">${angry}</div>`, stage);
			popUp(ctx, av, j, 0.2);
			M.shake(R.e, j + 0.1, {amp: 6, n: 7});
			const b = at('किताब');
			const bk = el(`<div class="ill" style="left:400px;top:500px;width:280px;height:350px;z-index:7">${book}</div>`, stage);
			popUp(ctx, bk, b - 0.1, 0.2);
			tl.to(bk, {y: -30, duration: 0.5, yoyo: true, repeat: 5, ease: 'sine.inOut'}, b + 0.5);
			look(ctx, R, b, 20, 0, 0.2); look(ctx, F, b, -22, 0, 0.2);
			const d = at('दोस्त');
			browTilt(ctx, R, d, 0); mouth(ctx, R, d, 'S'); mouth(ctx, F, d, 'S');
			tl.to(av, {autoAlpha: 0, duration: 0.15}, d);
			const h = el(`<div class="ill" style="left:445px;top:300px;width:190px;height:175px;z-index:8">${heart}</div>`, stage);
			popUp(ctx, h, d + 0.1, 0.1);
			M.float(h, d + 0.6, dur, {amp: 14, period: 0.8});
			ctx.cue('chime', d + 0.1, 0.9);
			cardSeq(ctx, [['Ek <span class="hl">kitaab</span>', b - 0.05, {size: 100}]], 1130);
			drift(ctx, 1.04);
		},

		// 2. Franklin's own account: a rival makes a long speech against him
		speech(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const F = placeFace(ctx, 20, 590, 380, {hair: WHITE, glasses: true});
			const R = placeFace(ctx, 650, 380, 390, {hair: GREY});
			M.pop(F.e, start + 0.1, {from: 0.5});
			const a = at('आत्मकथा');
			const bk = el(`<div class="ill" style="left:60px;top:270px;width:200px;height:250px;z-index:6">${book}</div>`, stage);
			popUp(ctx, bk, a - 0.1, 0.2);
			const tg = el(plain('Autobiography', 160, 540, 44, INK, -5), stage);
			M.pop(tg, a + 0.1, {sfx: false});
			const s = at('सदस्य');
			M.pop(R.e, s - 0.3, {from: 0.5});
			browTilt(ctx, R, s, 18);
			const sp = at('भाषण');
			const bub = el(`<div class="ill" style="left:380px;top:250px;width:330px;height:183px;z-index:7">${bubble('BLAH BLAH!')}</div>`, stage);
			popUp(ctx, bub, sp - 0.2, 0.3);
			for (let k = 0; k < 10; k++) mouth(ctx, R, sp + k * 0.22, k % 2 ? 'S' : 'O');
			M.wobble(bub, sp + 0.5, dur, {amp: 4, period: 0.4});
			tl.fromTo(F.e.querySelector('.sweat'), {opacity: 0, y: -10}, {opacity: 1, y: 24, duration: 0.5}, sp + 0.3);
			mouth(ctx, F, sp, 'F');
			lidTo(ctx, F, sp + 0.4, 0.45, 0.3);
			cardSeq(ctx, [['Lamba <span class="hl">bhaashan</span>', sp - 0.05, {size: 90}]], 1130);
			drift(ctx, 1.04);
		},

		// 3. borrow a rare book; return it a week later with thanks
		book(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const d = at('दुर्लभ');
			const bk = el(`<div class="ill" style="left:330px;top:440px;width:420px;height:525px;z-index:4">${book}</div>`, stage);
			popUp(ctx, bk, d - 0.1, 0.1);
			M.float(bk, d + 0.6, dur, {amp: 10, period: 1});
			const rare = el(plain('RARE', 540, 380, 110, '#fff', -5), stage);
			M.slam(rare, d);
			const req = el(`<div class="ill" style="left:30px;top:620px;width:260px;height:200px;z-index:6">${note('PLEASE', 'LEND?')}</div>`, stage);
			const k = at('किताब');
			tl.fromTo(req, {x: -400, autoAlpha: 1, rotation: -20}, {x: 0, rotation: -6, duration: 0.5, ease: 'back.out(1.6)'}, k - 0.1);
			ctx.cue('whoosh', k - 0.1, 0.6);
			const cal = el(`<div class="ill" style="left:700px;top:250px;width:340px;height:260px;z-index:6">${calendar}</div>`, stage);
			const w = at('बाद');
			popUp(ctx, cal, w - 1.3, 0.2);
			cal.querySelectorAll('.ck').forEach((c, i) => { tl.fromTo(c, {opacity: 0}, {opacity: 1, duration: 0.1}, w - 1.0 + i * 0.13); ctx.cue('tick', w - 1.0 + i * 0.13, 0.5); });
			const t = at('शुक्रिया');
			const th = el(`<div class="ill" style="left:760px;top:620px;width:260px;height:200px;z-index:6">${note('THANK', 'YOU')}</div>`, stage);
			tl.fromTo(th, {x: -420, autoAlpha: 1, rotation: -20}, {x: 0, rotation: 6, duration: 0.5, ease: 'back.out(1.6)'}, t - 0.1);
			const h = el(`<div class="ill" style="left:870px;top:540px;width:110px;height:100px;z-index:8">${heart}</div>`, stage);
			popUp(ctx, h, t + 0.3, 0.1);
			ctx.cue('chime', t + 0.3, 0.8);
			cardSeq(ctx, [['Ek hafte baad <span class="hl">thanks</span>', t - 0.05, {size: 70}]], 1130);
			drift(ctx, 1.03);
		},

		// 4. they became friends
		friends(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const R = placeFace(ctx, 20, 480, 430, {hair: GREY});
			const F = placeFace(ctx, 630, 480, 430, {hair: WHITE, glasses: true});
			const kh = at('खुद');
			tl.fromTo(R.e, {x: -500, autoAlpha: 1}, {x: 140, duration: 0.7, ease: 'back.out(1.4)'}, kh - 0.2);
			tl.fromTo(F.e, {x: 500, autoAlpha: 1}, {x: -140, duration: 0.7, ease: 'back.out(1.4)'}, kh);
			ctx.cue('whoosh', kh, 0.7);
			mouth(ctx, R, kh + 0.7, 'S'); mouth(ctx, F, kh + 0.7, 'S');
			const d = at('दोस्त');
			for (let i = 0; i < 5; i++) {
				const h = el(`<div class="ill" style="left:${240 + i * 130}px;top:300px;width:${100 + (i % 2) * 40}px;height:${92 + (i % 2) * 36}px;z-index:8">${heart}</div>`, stage);
				popUp(ctx, h, d + i * 0.12, 0.1);
				tl.to(h, {y: -60, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: Math.ceil(dur / 1.2)}, d + 0.6 + i * 0.12);
			}
			ctx.cue('chime', d, 0.9);
			M.shake(stage, d + 0.05, {amp: 6, n: 5});
			cardSeq(ctx, [['Umar bhar ke <span class="hl">dost</span>', d - 0.05, {size: 80}]], 1130);
			drift(ctx, 1.04);
		},

		// 5. the 1969 study (no numbers)
		study(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const tg = el(plain('1969 STUDY', 540, 330, 120, INK, -3), stage);
			M.slam(tg, at('स्टडी') - 0.3);
			const bars = el(`<div class="ill" style="left:100px;top:380px;width:880px;height:660px;z-index:4"><svg viewBox="0 0 880 660" width="100%" height="100%">
				<g class="b1"><rect x="60" y="240" width="300" height="300" rx="22" fill="${INK}" transform="translate(10 10)"/><rect x="60" y="240" width="300" height="300" rx="22" fill="#ff4fd8" stroke="${INK}" stroke-width="9"/></g>
				<g class="b2"><rect x="500" y="420" width="300" height="120" rx="22" fill="${INK}" transform="translate(10 10)"/><rect x="500" y="420" width="300" height="120" rx="22" fill="#3ce7ff" stroke="${INK}" stroke-width="9"/></g>
				<text x="210" y="578" font-size="42" text-anchor="middle" font-family="Bricolage" font-weight="800">Researcher ne</text><text x="210" y="624" font-size="42" text-anchor="middle" font-family="Bricolage" font-weight="800">khud manga</text><text x="650" y="578" font-size="42" text-anchor="middle" font-family="Bricolage" font-weight="800">Secretary ne</text><text x="650" y="624" font-size="42" text-anchor="middle" font-family="Bricolage" font-weight="800">manga</text></svg></div>`, stage);
			M.rise(bars, at('मदद') - 0.5);
			const p = at('पसंद');
			tl.fromTo(bars.querySelector('.b1'), {scaleY: 0.05, svgOrigin: '60 540'}, {scaleY: 1, duration: 0.8, ease: 'back.out(1.4)'}, p - 0.2);
			tl.fromTo(bars.querySelector('.b2'), {scaleY: 0.05, svgOrigin: '500 540'}, {scaleY: 1, duration: 0.8, ease: 'back.out(1.4)'}, p);
			ctx.cue('fill', p - 0.2, 0.8);
			const h1 = el(`<div class="ill" style="left:185px;top:470px;width:150px;height:140px;z-index:8">${heart}</div>`, stage);
			popUp(ctx, h1, p + 0.7, 0.1);
			M.float(h1, p + 1.3, dur, {amp: 12, period: 0.8});
			const h2 = el(`<div class="ill" style="left:655px;top:690px;width:90px;height:82px;z-index:8">${heart}</div>`, stage);
			popUp(ctx, h2, p + 0.9, 0.1);
			cardSeq(ctx, [['Madad karne walon ko <span class="hl">zyada pasand</span>', p - 0.05, {size: 54}]], 1140);
			drift(ctx, 1.03);
		},

		// 6. the honest caveat
		caveat(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 300, 300, 480);
			M.pop(f.e, start + 0.1, {from: 0.5});
			const n = at('नहीं');
			mouth(ctx, f, n - 0.2, 'F'); browTilt(ctx, f, n - 0.2, 16);
			look(ctx, f, n, 24, -6, 0.2);
			const no = cardPx(ctx, 'Har baar <span class="hl">nahin</span>', 540, 1010, {bg: '#fff', size: 80, rot: -3});
			M.slam(no, n);
			const d = at('दिखावे');
			const st = cardPx(ctx, 'DIKHAAVA', 540, 640, {bg: '#ff3b3b', color: '#fff', size: 120, rot: -10});
			st.style.zIndex = 9; st.style.border = '8px dashed #fff';
			M.slam(st, d);
			M.shake(stage, d + 0.05, {amp: 8, n: 7});
			ctx.cue('punch', d, 1);
			lidTo(ctx, f, d + 0.2, 0.55, 0.2);
			tl.fromTo(f.e, {rotation: 0}, {rotation: 5, duration: 0.5, yoyo: true, repeat: Math.ceil(dur / 0.5), ease: 'sine.inOut', immediateRender: false}, d + 0.3);
			drift(ctx, 1.04);
		},

		// 7. your call
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = cardPx(ctx, 'Maangoge ya <span class="hl">khud?</span>', 540, 320, {bg: '#fff', rot: -3, size: 78});
			M.slam(q, start + 0.1);
			const f = placeFace(ctx, 290, 430, 500);
			M.stretch(f.e, start + 0.2);
			M.float(f.e, start + 0.8, dur, {amp: 8, period: 1});
			const ch = el(`<div class="ill" style="left:50px;top:600px;width:200px;height:200px;z-index:5">${charger}</div>`, stage);
			const nb = el(`<div class="ill" style="left:830px;top:600px;width:180px;height:203px;z-index:5">${notebook}</div>`, stage);
			const a = at('चार्जर'), b = at('खुद');
			popUp(ctx, ch, a - 0.1, 0.2); popUp(ctx, nb, at('नोट्स') - 0.1, 0.2);
			look(ctx, f, a, -24, 8); look(ctx, f, at('नोट्स'), 24, 8);
			const A = cardPx(ctx, 'Maangunga', 270, 1110, {bg: '#c6ff3d', size: 76, rot: -6});
			const B = cardPx(ctx, 'Khud karunga', 790, 1110, {bg: '#ff4fd8', size: 62, rot: 6});
			M.slideIn(A, a + 0.3, {from: 'left'}); M.slideIn(B, b - 0.1, {from: 'right'});
			ctx.cue('pop', a + 0.3, 0.9); ctx.cue('pop', b, 0.9);
			look(ctx, f, b, 0, 20);
			M.wobble(A, b + 0.3, dur, {amp: 3, period: 0.5});
			M.wobble(B, b + 0.4, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', b + 0.4, 0.8);
		},
	};
})();
