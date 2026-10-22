// @kit
// Hindi reel: "All-nighter brain ~ a little drunk". Character-driven, original SVG art (shared kit in pop/kit.js).
window.REEL = (function () {
	const {INK, SKIN, face, clock, beaker, card, cardPx, cardSeq, plain, placeFace, lidTo, blink, look, mouth, brows, bags, dizzy, popUp, drift, headIcon} = KIT;

	const books = `<svg viewBox="-110 -90 220 180" width="100%" height="100%">${[[-8, 40, '#ff4fd8', 190], [6, -6, '#3ce7ff', 170], [-12, -50, '#c6ff3d', 180]].map(([dx, y, c, w]) => `<g transform="translate(${dx} ${y})"><rect x="${-w / 2}" y="-24" width="${w}" height="46" rx="8" fill="${INK}" transform="translate(7 7)"/><rect x="${-w / 2}" y="-24" width="${w}" height="46" rx="8" fill="${c}" stroke="${INK}" stroke-width="7"/><path d="M${-w / 2 + 24} -24 V22" stroke="${INK}" stroke-width="6"/><path d="M${w / 2 - 40} -4 H${w / 2 - 12}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>`).join('')}</svg>`;
	const cup = `<svg viewBox="-80 -120 160 200" width="100%" height="100%"><g class="steam" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity="0.9"><path d="M-22 -40 q-14 -22 0 -40 q14 -18 0 -36"/><path d="M18 -40 q-14 -22 0 -40 q14 -18 0 -36"/></g><path d="M-60 -30 H50 L40 60 Q38 74 24 74 H-34 Q-48 74 -50 60 Z" fill="${INK}" transform="translate(8 8)"/><path d="M-60 -30 H50 L40 60 Q38 74 24 74 H-34 Q-48 74 -50 60 Z" fill="#fff" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><path d="M50 -10 q34 4 26 30 q-6 18 -34 20" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><rect x="-54" y="-30" width="102" height="22" fill="#8a4b24" stroke="${INK}" stroke-width="6"/></svg>`;
	const snail = `<svg viewBox="-200 -130 400 250" width="100%" height="100%">
		<path d="M-150 80 C -170 80, -170 20, -140 20 H 100 C 150 20, 168 -10, 160 -50 C 156 -64, 168 -78, 176 -64 C 190 -40, 186 10, 170 40 C 160 62, 140 80, 100 80 Z" fill="${INK}" transform="translate(8 8)"/>
		<path d="M-150 80 C -170 80, -170 20, -140 20 H 100 C 150 20, 168 -10, 160 -50 C 156 -64, 168 -78, 176 -64 C 190 -40, 186 10, 170 40 C 160 62, 140 80, 100 80 Z" fill="#8fd16b" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
		<g stroke="${INK}" stroke-width="8" stroke-linecap="round"><path d="M150 -20 L 138 -90 M178 -22 L 196 -86"/></g>
		<circle cx="138" cy="-96" r="17" fill="#fff" stroke="${INK}" stroke-width="7"/><circle cx="196" cy="-92" r="17" fill="#fff" stroke="${INK}" stroke-width="7"/><circle cx="142" cy="-94" r="7" fill="${INK}"/><circle cx="200" cy="-90" r="7" fill="${INK}"/>
		<path d="M150 30 Q166 44 182 30" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
		<circle cx="-30" cy="-12" r="96" fill="${INK}" transform="translate(8 8)"/><circle cx="-30" cy="-12" r="96" fill="#ff8a1f" stroke="${INK}" stroke-width="9"/>
		<path d="M-30 -12 m0 0 a14 14 0 1 1 14 14 a30 30 0 1 1 -30 -30 a50 50 0 1 1 50 50 a70 70 0 1 1 -70 -70" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/></svg>`;
	const paper = `<svg viewBox="0 0 700 460" width="100%" height="100%"><rect x="20" y="20" width="660" height="430" rx="14" fill="${INK}" transform="translate(12 12)"/><rect x="20" y="20" width="660" height="430" rx="14" fill="#fff" stroke="${INK}" stroke-width="9"/>
		<text x="350" y="100" font-size="60" text-anchor="middle" font-family="Baloo, Bricolage" font-weight="800">EXAM</text>
		<g stroke="${INK}" stroke-width="8" stroke-linecap="round" opacity="0.3"><path d="M70 150 H630 M70 205 H600 M70 260 H630 M70 315 H560 M70 370 H620"/></g></svg>`;

	return {
		// 1. a face that has been up all night; the room spins
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 230, 290, 620);
			M.pop(f.e, start + 0.05, {from: 0.7});
			M.float(f.e, start + 0.6, dur, {amp: 6, period: 1.2});
			const bk = el(`<div class="ill" style="left:10px;top:900px;width:260px;height:213px;z-index:5">${books}</div>`, stage);
			M.pop(bk, start + 0.2, {from: 0.3, sfx: false});
			const cp = el(`<div class="ill" style="left:820px;top:880px;width:210px;height:262px;z-index:5">${cup}</div>`, stage);
			M.pop(cp, start + 0.3, {from: 0.3, sfx: false});
			tl.fromTo(cp.querySelector('.steam'), {y: 0, opacity: 0.9}, {y: -18, opacity: 0.3, duration: 0.8, yoyo: true, repeat: Math.ceil(dur / 0.8)}, start + 0.5);
			lidTo(ctx, f, start + 0.5, 0.5, 0.5);
			bags(ctx, f, at('दिमा') - 0.3);
			const t = at('टल्ली');
			lidTo(ctx, f, t - 0.1, 0, 0.1);
			dizzy(ctx, f, t, ctx.end - t);
			cardSeq(ctx, [['<span class="hl">Talli</span>!', t - 0.05, {size: 120}]]);
			drift(ctx, 1.05);
		},

		// 2. 39 volunteers, 28 hours
		study(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const a = at('उनतालीस');
			const num = el(plain('<span class="n">0</span>', 250, 390, 190, INK), stage);
			M.pop(num, a - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), a - 0.2, 0, 39, 1.0, v => Math.round(v));
			const heads = [];
			for (let i = 0; i < 39; i++) {
				const x = 90 + (i % 10) * 100, y = 740 + Math.floor(i / 10) * 118;
				const h = el(`<div class="ill" style="left:${x - 45}px;top:${y - 52}px;width:90px;height:105px">${headIcon(i % 3 ? SKIN : '#e0a070', true)}</div>`, stage);
				M.pop(h, a - 0.1 + i * 0.022, {from: 0.2, sfx: i % 8 === 0});
				heads.push(h);
			}
			const b = at('अठाईस');
			const ck = el(`<div class="ill" style="left:560px;top:260px;width:250px;height:250px;z-index:5">${clock}</div>`, stage);
			M.pop(ck, b - 0.3, {from: 0.3});
			tl.fromTo(ck.querySelector('.hd'), {rotation: 0, svgOrigin: '0 0'}, {rotation: 360 * 6, svgOrigin: '0 0', duration: 2.2, ease: 'power1.inOut'}, b - 0.1);
			tl.fromTo(ck.querySelector('.hm'), {rotation: 0, svgOrigin: '0 0'}, {rotation: 360 * 14, svgOrigin: '0 0', duration: 2.2, ease: 'power1.inOut'}, b - 0.1);
			ctx.cue('whoosh', b - 0.1, 0.6);
			const hrs = el(plain('<span class="n">0</span> ghante', 760, 580, 76, INK, 3), stage);
			M.pop(hrs, b + 0.1, {from: 0.5, sfx: false});
			M.countUp(hrs.querySelector('.n'), b + 0.1, 0, 28, 1.6, v => Math.round(v));
			heads.forEach((h, i) => tl.to(h.querySelector('.lids'), {opacity: 1, duration: 0.15}, b + 0.5 + i * 0.03));
			heads.forEach((h, i) => tl.to(h.querySelector('.ey'), {y: 6, duration: 0.2}, b + 0.5 + i * 0.03));
			drift(ctx, 1.03);
		},

		// 3. the same people, now with a measured dose and the same tests
		alcohol(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 40, 470, 360);
			M.pop(f.e, start + 0.1, {from: 0.5});
			blink(ctx, f, start + 0.8);
			const bk = el(`<div class="ill" style="left:430px;top:330px;width:280px;height:444px;z-index:4">${beaker()}</div>`, stage);
			const s = at('शराब');
			M.pop(bk, s - 0.5, {from: 0.3});
			tl.fromTo(bk.querySelector('.liq'), {scaleY: 0, svgOrigin: '0 170'}, {scaleY: 0.48, svgOrigin: '0 170', duration: 1.2, ease: 'power1.inOut'}, s - 0.1);
			ctx.cue('fill', s - 0.1, 0.9);
			look(ctx, f, s, 26, 4);
			const cb = el(`<div class="ill" style="left:740px;top:380px;width:290px;height:400px;z-index:4"><svg viewBox="0 0 290 400" width="100%" height="100%"><rect x="14" y="20" width="262" height="364" rx="22" fill="${INK}" transform="translate(10 10)"/><rect x="14" y="20" width="262" height="364" rx="22" fill="#fff" stroke="${INK}" stroke-width="9"/><rect x="82" y="4" width="126" height="40" rx="12" fill="#c9c9c9" stroke="${INK}" stroke-width="8"/>
				${[0, 1, 2].map(i => `<rect x="44" y="${84 + i * 100}" width="52" height="52" rx="10" fill="none" stroke="${INK}" stroke-width="8"/><path class="ck" d="M52 ${110 + i * 100} L 68 ${126 + i * 100} L 100 ${86 + i * 100}" fill="none" stroke="#2e9b3e" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M120 ${110 + i * 100} H 250" stroke="${INK}" stroke-width="8" stroke-linecap="round" opacity="0.3"/>`).join('')}</svg></div>`, stage);
			M.pop(cb, at('टेस्ट') - 0.2, {from: 0.4});
			cb.querySelectorAll('.ck').forEach((p, i) => { M.draw(p, at('दोबारा') - 0.4 + i * 0.35, 0.3, {ease: 'power2.out'}); ctx.cue('tick', at('दोबारा') - 0.4 + i * 0.35, 0.8); });
			cardSeq(ctx, [['Naapi-tauli <span class="hl">sharaab</span>', s - 0.05, {size: 80}]], 1110);
			drift(ctx, 1.04);
		},

		// 4. 17-19 hours awake ~ a little alcohol
		result(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const s = at('सत्रह');
			const fL = placeFace(ctx, 60, 500, 360, {bags: true});
			M.pop(fL.e, s - 0.3, {from: 0.4});
			lidTo(ctx, fL, s, 0.45, 0.3);
			const lbl = el(plain('17–19 ghante', 250, 440, 62, INK, -4), stage);
			M.slam(lbl, s);
			const ck = el(`<div class="ill" style="left:150px;top:250px;width:130px;height:130px;z-index:5">${clock}</div>`, stage);
			M.pop(ck, s, {from: 0.3, sfx: false});
			tl.fromTo(ck.querySelector('.hd'), {rotation: 0, svgOrigin: '0 0'}, {rotation: 360 * 3, svgOrigin: '0 0', duration: 2, ease: 'power1.inOut'}, s);
			const h = at('थो');
			const fR = placeFace(ctx, 660, 500, 360);
			M.pop(fR.e, h - 0.3, {from: 0.4});
			const bk = el(`<div class="ill" style="left:830px;top:240px;width:110px;height:174px;z-index:5">${beaker()}</div>`, stage);
			M.pop(bk, h - 0.2, {from: 0.3, sfx: false});
			tl.fromTo(bk.querySelector('.liq'), {scaleY: 0, svgOrigin: '0 170'}, {scaleY: 0.4, svgOrigin: '0 170', duration: 0.8}, h - 0.1);
			const lbl2 = el(plain('Thodi sharaab', 800, 440, 56, INK, 4), stage);
			M.slam(lbl2, h);
			const eq = el(plain('=', 540, 720, 230, '#fff', -4), stage);
			M.slam(eq, h + 0.15);
			ctx.cue('punch', h + 0.15, 0.9);
			dizzy(ctx, fL, h + 0.2, ctx.end - h - 0.2);
			dizzy(ctx, fR, h + 0.3, ctx.end - h - 0.3);
			cardSeq(ctx, [['Kuch test mein, <span class="hl">waisa hi</span>', h - 0.05, {size: 76}]], 1110);
			drift(ctx, 1.03);
		},

		// 5. a snail: reactions up to 50% slower
		slow(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const p = at('पचास');
			const num = el(plain('−<span class="n">0</span>%', 540, 360, 200, '#fff'), stage);
			M.pop(num, p - 0.3, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), p - 0.2, 0, 50, 0.9, v => Math.round(v));
			const light = el(`<div class="ill" style="left:80px;top:600px;width:150px;height:150px;z-index:4"><svg viewBox="-75 -75 150 150" width="100%" height="100%"><circle r="62" fill="${INK}" transform="translate(7 7)"/><circle class="lt" r="62" fill="#ff3b3b" stroke="${INK}" stroke-width="9"/></svg></div>`, stage);
			M.pop(light, start + 0.1, {from: 0.3, sfx: false});
			tl.set(light.querySelector('.lt'), {attr: {fill: '#2ee06a'}}, start + 0.8);
			ctx.cue('snap', start + 0.8, 0.9);
			const sn = el(`<div class="ill" style="left:-300px;top:640px;width:440px;height:275px;z-index:4">${snail}</div>`, stage);
			const d = at('धीमा');
			tl.fromTo(sn, {x: 0}, {x: 780, duration: Math.max(3, ctx.end - start - 0.6), ease: 'none'}, start + 0.8);
			M.wobble(sn, start + 0.8, dur, {amp: 2, period: 0.7});
			cardSeq(ctx, [['Reaction <span class="hl">dheema</span>', d - 0.05, {size: 92}]], 1110);
			drift(ctx, 1.04);
		},

		// 6. keep going and the glass fills to the top
		longer(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 300, 340, 560, {bags: true});
			M.pop(f.e, start + 0.05, {from: 0.5});
			const bk = el(`<div class="ill" style="left:20px;top:620px;width:260px;height:412px;z-index:5">${beaker()}</div>`, stage);
			M.pop(bk, start + 0.15, {from: 0.3, sfx: false});
			const s = at('सबसे');
			tl.fromTo(bk.querySelector('.liq'), {scaleY: 0.3, svgOrigin: '0 170'}, {scaleY: 1, svgOrigin: '0 170', duration: 1.4, ease: 'power1.inOut'}, s - 0.3);
			ctx.cue('fill', s - 0.3, 0.9);
			dizzy(ctx, f, s - 0.2, ctx.end - s + 0.2);
			tl.fromTo(f.e, {y: 0}, {y: 40, duration: 0.6, yoyo: true, repeat: Math.ceil(dur / 0.6), ease: 'sine.inOut'}, s);
			cardSeq(ctx, [['Sabse zyada <span class="hl">sharaab</span> level', s - 0.05, {size: 62}]], 1120);
			drift(ctx, 1.04, '50% 40%');
		},

		// 7. into the exam hall
		moral(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 350, 250, 380, {bags: true});
			M.pop(f.e, start + 0.05, {from: 0.5});
			lidTo(ctx, f, start + 0.4, 0.5, 0.4);
			const pp = el(`<div class="ill" style="left:220px;top:750px;width:640px;height:421px;z-index:5">${paper}</div>`, stage);
			M.rise(pp, start + 0.1);
			const r = at('रटना');
			tl.fromTo(f.e, {rotation: -3}, {rotation: 3, duration: 0.4, yoyo: true, repeat: Math.ceil(dur / 0.4), ease: 'sine.inOut', immediateRender: false}, start + 0.3);
			const t = at('टल्ली');
			const stamp = cardPx(ctx, 'TALLI', 560, 930, {bg: '#ff3b3b', color: '#fff', size: 150, rot: -14});
			stamp.style.zIndex = 8; stamp.style.border = '8px dashed #fff';
			M.slam(stamp, t);
			M.shake(stage, t + 0.05, {amp: 8, n: 7});
			ctx.cue('punch', t, 1);
			dizzy(ctx, f, t + 0.1, ctx.end - t - 0.1);
			drift(ctx, 1.04, '50% 45%');
		},

		// 8. your call
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = cardPx(ctx, 'Raat bhar <span class="hl">jaagoge?</span>', 540, 320, {bg: '#fff', rot: -3, size: 84});
			M.slam(q, start + 0.1);
			const f = placeFace(ctx, 290, 420, 500, {bags: true});
			M.stretch(f.e, start + 0.2);
			M.float(f.e, start + 0.8, dur, {amp: 8, period: 1});
			mouth(ctx, f, start + 0.6, 'O');
			lidTo(ctx, f, start + 0.6, 0.5, 0.3);
			const a = at('जागोगे'), b = at('सोओगे');
			const A = cardPx(ctx, 'Jaagunga', 270, 1110, {bg: '#c6ff3d', size: 84, rot: -6});
			const B = cardPx(ctx, 'Soonga', 810, 1110, {bg: '#ff4fd8', size: 84, rot: 6});
			M.slideIn(A, a - 0.1, {from: 'left'});
			M.slideIn(B, b - 0.1, {from: 'right'});
			ctx.cue('pop', a, 0.9); ctx.cue('pop', b, 0.9);
			look(ctx, f, a, -24, 8); look(ctx, f, b, 24, 8);
			M.wobble(A, b + 0.3, dur, {amp: 3, period: 0.5});
			M.wobble(B, b + 0.4, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', b + 0.4, 0.8);
		},
	};
})();
