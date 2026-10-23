// @kit
// Hindi reel: "Does phone battery change your cab fare?" Generic illustrated phones/cars (no logos); framing: the psychology is real, no proof it is used.
window.REEL = (function () {
	const {INK, SKIN, face, card, cardPx, cardSeq, plain, placeFace, lidTo, blink, look, mouth, brows, bags, dizzy, popUp, drift, headIcon} = KIT;

	// generic smartphone: battery bar (.bat) + percent (.pct) + price line (.price) + BOOK button
	const phone = (o = {}) => `<svg viewBox="0 0 300 560" width="100%" height="100%">
		<rect x="10" y="10" width="280" height="540" rx="44" fill="${INK}" transform="translate(10 10)"/>
		<rect x="10" y="10" width="280" height="540" rx="44" fill="#1d1d1d" stroke="${INK}" stroke-width="10"/>
		<rect x="30" y="40" width="240" height="480" rx="28" fill="#eaf6ff"/>
		<rect x="40" y="52" width="92" height="36" rx="9" fill="#fff" stroke="${INK}" stroke-width="5"/><rect x="132" y="63" width="8" height="14" rx="3" fill="${INK}"/>
		<rect class="bat" x="45" y="57" width="82" height="26" rx="5" fill="${o.low ? '#ff3b3b' : '#2ee06a'}" ${o.low ? 'transform="translate(0 0)"' : ''}/>
		<text class="pct" x="214" y="82" font-size="32" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="${INK}">${o.pct || '100%'}</text>
		<g><rect x="40" y="104" width="220" height="220" rx="18" fill="#cfeec0" stroke="${INK}" stroke-width="5"/><path d="M40 250 C 100 190, 140 290, 200 220 S 250 200 260 190" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/>
		<path d="M40 250 C 100 190, 140 290, 200 220 S 250 200 260 190" fill="none" stroke="#9aa" stroke-width="4" stroke-dasharray="14 12"/>
		<g transform="translate(130 238)"><rect x="-30" y="-16" width="60" height="26" rx="10" fill="#ffd23c" stroke="${INK}" stroke-width="5"/><rect x="-12" y="-26" width="24" height="12" rx="4" fill="#ffd23c" stroke="${INK}" stroke-width="5"/><circle cx="-16" cy="12" r="8" fill="${INK}"/><circle cx="16" cy="12" r="8" fill="${INK}"/></g></g>
		<rect x="40" y="338" width="220" height="74" rx="16" fill="#fff" stroke="${INK}" stroke-width="6"/>
		<text class="price" x="150" y="392" font-size="46" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="${INK}">${o.price || '₹ ???'}</text>
		<rect x="40" y="426" width="220" height="70" rx="18" fill="#8a3cff" stroke="${INK}" stroke-width="6"/><text x="150" y="474" font-size="38" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="#fff">BOOK</text></svg>`;
	const cab = `<svg viewBox="-90 -70 180 120" width="100%" height="100%"><rect x="-80" y="-18" width="160" height="50" rx="16" fill="${INK}" transform="translate(7 7)"/><rect x="-80" y="-18" width="160" height="50" rx="16" fill="#ffd23c" stroke="${INK}" stroke-width="8"/><path d="M-46 -18 L -30 -50 H 30 L 46 -18" fill="#ffd23c" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><rect x="-20" y="-64" width="40" height="18" rx="5" fill="#fff" stroke="${INK}" stroke-width="5"/><text y="-50" font-size="14" text-anchor="middle" font-family="Bricolage" font-weight="800">CAB</text><circle cx="-46" cy="34" r="16" fill="${INK}"/><circle cx="46" cy="34" r="16" fill="${INK}"/></svg>`;
	const bolt = `<svg viewBox="-40 -60 80 120" width="100%" height="100%"><path d="M8 -52 L -30 6 H -4 L -14 52 L 32 -10 H 4 Z" fill="#ffd23c" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/></svg>`;
	const notice = `<svg viewBox="0 0 260 340" width="100%" height="100%"><rect x="14" y="14" width="232" height="312" rx="12" fill="${INK}" transform="translate(10 10)"/><rect x="14" y="14" width="232" height="312" rx="12" fill="#fff" stroke="${INK}" stroke-width="8"/><text x="130" y="76" font-size="44" text-anchor="middle" font-family="Bricolage" font-weight="800">NOTICE</text><g stroke="${INK}" stroke-width="7" stroke-linecap="round" opacity="0.3"><path d="M44 120 H216 M44 156 H216 M44 192 H190 M44 228 H216"/></g><circle cx="190" cy="270" r="26" fill="#ff3b3b" stroke="${INK}" stroke-width="6"/></svg>`;
	const paper = `<svg viewBox="0 0 300 200" width="100%" height="100%"><rect x="12" y="12" width="276" height="176" rx="10" fill="${INK}" transform="translate(9 9)"/><rect x="12" y="12" width="276" height="176" rx="10" fill="#fff" stroke="${INK}" stroke-width="8"/><text x="150" y="68" font-size="38" text-anchor="middle" font-family="Bricolage" font-weight="800">NEWS</text><g stroke="${INK}" stroke-width="7" stroke-linecap="round" opacity="0.3"><path d="M40 96 H260 M40 124 H260 M40 152 H200"/></g></svg>`;
	const qHead = (i) => `<svg viewBox="-60 -90 120 160" width="100%" height="100%"><circle r="46" fill="${INK}" transform="translate(6 6)"/><circle r="46" fill="${SKIN}" stroke="${INK}" stroke-width="7"/><circle cx="-16" cy="-6" r="7" fill="${INK}"/><circle cx="16" cy="-6" r="7" fill="${INK}"/><path d="M-14 24 Q0 16 14 24" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/><text y="-52" font-size="52" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="${INK}">?</text></svg>`;
	const plank = `<svg viewBox="-380 -160 760 260" width="100%" height="100%"><path d="M0 -4 L -70 96 H 70 Z" fill="${INK}" transform="translate(8 8)"/><path d="M0 -4 L -70 96 H 70 Z" fill="#8a3cff" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><g class="pl"><rect x="-340" y="-34" width="680" height="34" rx="14" fill="${INK}" transform="translate(8 8)"/><rect x="-340" y="-34" width="680" height="34" rx="14" fill="#ffd23c" stroke="${INK}" stroke-width="8"/></g></svg>`;

	const vsetP = (ctx, p, v) => p.querySelector('.price').textContent = v;

	return {
		// 1. the claim: low battery, higher fare accepted
		hook(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const ph = el(`<div class="ill" style="left:520px;top:290px;width:420px;height:784px;z-index:3">${phone()}</div>`, stage);
			M.pop(ph, start + 0.1, {from: 0.5});
			M.float(ph, start + 0.8, dur, {amp: 8, period: 1.2});
			const f = placeFace(ctx, 40, 580, 400);
			M.pop(f.e, start + 0.2, {from: 0.5});
			blink(ctx, f, start + 1.2);
			const talk = at('कहा');
			for (let k = 0; k < 8; k++) { mouth(ctx, f, talk + k * 0.28, k % 2 ? 'S' : 'O'); }
			mouth(ctx, f, talk + 8 * 0.28, 'S');
			const b = at('बैटरी');
			const bat = ph.querySelector('.bat'), pct = ph.querySelector('.pct');
			tl.fromTo(bat, {scaleX: 1, svgOrigin: '45 70'}, {scaleX: 0.1, duration: 1.3, ease: 'power1.inOut'}, b - 0.1);
			tl.set(bat, {attr: {fill: '#ff3b3b'}}, b + 0.9);
			M.countUp(pct, b - 0.1, 100, 8, 1.3, v => Math.round(v) + '%');
			ctx.cue('fill', b - 0.1, 0.8);
			const k = at('किराया');
			tl.set(ph.querySelector('.price'), {onComplete: () => {}}, k);
			M.shake(ph, k + 0.1, {amp: 6, n: 6});
			tl.fromTo(ph.querySelector('.price'), {opacity: 1}, {opacity: 0.2, duration: 0.08, yoyo: true, repeat: 7}, k);
			ctx.cue('snap', k, 0.9);
			look(ctx, f, k, 26, -10, 0.15);
			brows(ctx, f, k, -22);
			cardSeq(ctx, [['Battery <span class="hl">kam</span>', b - 0.05, {size: 96}], ['Kiraya <span class="hl">zyada</span>?', k - 0.05, {size: 96}]]);
			drift(ctx, 1.05);
		},

		// 2. the denial + what actually drives price
		denial(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const f = placeFace(ctx, 360, 260, 360);
			M.pop(f.e, start + 0.05, {from: 0.5});
			tl.fromTo(f.e, {rotation: -8}, {rotation: 8, duration: 0.35, yoyo: true, repeat: Math.ceil(dur / 0.35), ease: 'sine.inOut', immediateRender: false}, start + 0.4);
			mouth(ctx, f, start + 0.3, 'F');
			const n = at('नहीं');
			const ph = el(`<div class="ill" style="left:60px;top:300px;width:200px;height:373px;z-index:3">${phone({low: true, pct: '8%', price: '₹ ↑'})}</div>`, stage);
			M.pop(ph, at('बैटरी') - 0.2, {from: 0.4});
			tl.set(ph.querySelector('.bat'), {scaleX: 0.1, svgOrigin: '45 70'}, 0);
			const x = el(`<div class="ill" style="left:30px;top:280px;width:260px;height:260px;z-index:7"><svg viewBox="-100 -100 200 200" width="100%" height="100%"><path d="M-72 -72 L 72 72 M72 -72 L -72 72" stroke="#ff3b3b" stroke-width="30" stroke-linecap="round"/></svg></div>`, stage);
			M.pop(x, n - 0.1, {from: 0.2});
			ctx.cue('snap', n, 0.9);
			// seesaw: demand vs drivers
			const s = el(`<div class="ill" style="left:150px;top:760px;width:780px;height:268px;z-index:3">${plank}</div>`, stage);
			M.pop(s, at('डिमांड') - 0.4, {from: 0.4, sfx: false});
			const pl = s.querySelector('.pl');
			const d = at('डिमांड'), dr = at('ड्राइवरों');
			for (let i = 0; i < 3; i++) {
				const h = el(`<div class="ill" style="left:${200 + i * 62}px;top:660px;width:70px;height:82px;z-index:5">${headIcon()}</div>`, stage);
				popUp(ctx, h, d + i * 0.12, 0.2);
				tl.to(h, {y: 40, duration: 0.5, ease: 'power2.inOut'}, d + 0.6);
			}
			for (let i = 0; i < 3; i++) {
				const c = el(`<div class="ill" style="left:${640 + i * 78}px;top:690px;width:86px;height:57px;z-index:5">${cab}</div>`, stage);
				popUp(ctx, c, dr + i * 0.12, 0.2);
				tl.to(c, {y: -20, duration: 0.5, ease: 'power2.inOut'}, dr + 0.6);
			}
			tl.to(pl, {rotation: -7, svgOrigin: '0 -20', duration: 0.5, ease: 'back.out(2)'}, d + 0.6);
			tl.to(pl, {rotation: 4, svgOrigin: '0 -20', duration: 0.6, ease: 'back.out(2)'}, dr + 0.6);
			cardSeq(ctx, [['Battery se <span class="hl">nahin</span>', n - 0.05, {size: 84}], ['Demand + <span class="hl">drivers</span>', d - 0.05, {size: 84}]]);
			drift(ctx, 1.03);
		},

		// 3. a newspaper tried two phones; others could not repeat it
		test(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const np = el(`<div class="ill" style="left:380px;top:250px;width:320px;height:213px;z-index:5">${paper}</div>`, stage);
			M.pop(np, start + 0.1, {from: 0.4});
			tl.to(np, {rotation: -5, duration: 0.6, ease: 'back.out(2)'}, start + 0.4);
			const two = at('दो');
			const L = el(`<div class="ill" style="left:60px;top:480px;width:310px;height:579px;z-index:3">${phone({low: true, pct: '12%', price: '₹ + 6%'})}</div>`, stage);
			const R = el(`<div class="ill" style="left:710px;top:480px;width:310px;height:579px;z-index:3">${phone({pct: '84%', price: '₹ base'})}</div>`, stage);
			M.pop(L, two - 0.2, {from: 0.3}); M.pop(R, two - 0.1, {from: 0.3});
			tl.set(L.querySelector('.bat'), {scaleX: 0.14, svgOrigin: '45 70'}, 0);
			const eq = el(plain('≈', 540, 780, 150, '#fff'), stage);
			const b = at('बारह'), c = at('छह');
			M.pop(eq, c - 0.2, {sfx: false, from: 0.3});
			const tag = el(plain('+6%', 540, 640, 130, '#ff3b3b', -6), stage);
			M.slam(tag, c);
			ctx.cue('punch', c, 0.9);
			tl.fromTo(L.querySelector('.bat'), {opacity: 1}, {opacity: 0.4, duration: 0.15, yoyo: true, repeat: 5}, b);
			const d = at('दोहरा');
			for (let i = 0; i < 3; i++) {
				const h = el(`<div class="ill" style="left:${330 + i * 150}px;top:900px;width:130px;height:174px;z-index:6">${qHead(i)}</div>`, stage);
				popUp(ctx, h, d + i * 0.12, 0.2);
				M.wobble(h, d + 0.5, dur, {amp: 5, period: 0.5});
			}
			tl.to(tag, {opacity: 0.25, duration: 0.3}, d + 0.4);
			cardSeq(ctx, [['Sirf <span class="hl">2</span> phone', two - 0.05, {size: 92}], ['Dohra <span class="hl">nahin</span>', d - 0.05, {size: 92}]], 1130);
			drift(ctx, 1.03);
		},

		// 4. India: notice over iPhone vs Android fares (phone model, not battery)
		ccpa(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const ind = cardPx(ctx, 'INDIA', 540, 320, {bg: '#ff9933', color: INK, size: 80, rot: -3});
			M.slam(ind, at('भारत') - 0.05);
			const A = el(`<div class="ill" style="left:80px;top:430px;width:280px;height:523px;z-index:3">${phone({pct: '100%', price: '₹ ?'})}</div>`, stage);
			const B = el(`<div class="ill" style="left:720px;top:430px;width:280px;height:523px;z-index:3">${phone({pct: '100%', price: '₹ ??'})}</div>`, stage);
			M.pop(A, start + 0.3, {from: 0.3}); M.pop(B, start + 0.45, {from: 0.3});
			const la = el(plain('iPhone', 220, 400, 56, INK, -5), stage), lb = el(plain('Android', 860, 400, 56, INK, 5), stage);
			M.pop(la, start + 0.4, {sfx: false}); M.pop(lb, start + 0.55, {sfx: false});
			const n = at('नोटिस');
			const nt = el(`<div class="ill" style="left:390px;top:480px;width:300px;height:390px;z-index:7">${notice}</div>`, stage);
			tl.fromTo(nt, {y: -700, rotation: -30, autoAlpha: 1}, {y: 0, rotation: -6, duration: 0.5, ease: 'back.out(1.6)'}, n - 0.3);
			ctx.cue('punch', n, 0.9);
			M.shake(stage, n + 0.05, {amp: 8, n: 6});
			const m = at('मना');
			const bub = cardPx(ctx, 'Uber: <span class="hl">nahin</span>!', 540, 1010, {bg: '#fff', size: 80, rot: 3});
			M.slam(bub, m);
			cardSeq(ctx, [['Phone model, <span class="hl">battery nahin</span>', at('दो') + 0.05, {size: 56}]], 1130);
			drift(ctx, 1.03);
		},

		// 5. no proof; charge it or compare
		tip(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const ph = el(`<div class="ill" style="left:310px;top:290px;width:400px;height:747px;z-index:3">${phone({low: true, pct: '8%', price: '₹ ???'})}</div>`, stage);
			M.pop(ph, start + 0.05, {from: 0.5});
			tl.set(ph.querySelector('.bat'), {scaleX: 0.1, svgOrigin: '45 70'}, 0);
			const s = at('सबूत');
			const stamp = cardPx(ctx, 'NO PROOF', 540, 640, {bg: '#ff3b3b', color: '#fff', size: 116, rot: -12});
			stamp.style.zIndex = 9; stamp.style.border = '8px dashed #fff';
			M.slam(stamp, s);
			M.shake(stage, s + 0.05, {amp: 8, n: 7});
			ctx.cue('punch', s, 1);
			tl.to(stamp, {autoAlpha: 0, duration: 0.2}, at('चार्ज') - 0.35);
			const c = at('चार्ज');
			tl.fromTo(ph.querySelector('.bat'), {scaleX: 0.1, svgOrigin: '45 70'}, {scaleX: 1, duration: 1.3, ease: 'power1.inOut'}, c);
			tl.set(ph.querySelector('.bat'), {attr: {fill: '#2ee06a'}}, c + 0.2);
			M.countUp(ph.querySelector('.pct'), c, 8, 100, 1.3, v => Math.round(v) + '%');
			const bl = el(`<div class="ill" style="left:700px;top:330px;width:150px;height:225px;z-index:8">${bolt}</div>`, stage);
			popUp(ctx, bl, c, 0.2);
			M.wobble(bl, c + 0.4, dur, {amp: 8, period: 0.4});
			ctx.cue('fill', c, 0.9);
			const d = at('दूसरी');
			const ph2 = el(`<div class="ill" style="left:760px;top:640px;width:260px;height:485px;z-index:6">${phone({pct: '100%', price: '₹ ✓'})}</div>`, stage);
			M.slideIn(ph2, d - 0.1, {from: 'right'});
			cardSeq(ctx, [['Charge <span class="hl">karo</span>', c - 0.05, {size: 100}], ['Doosri app se <span class="hl">compare</span>', d - 0.05, {size: 64}]], 1130);
			drift(ctx, 1.03);
		},

		// 6. your call
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = cardPx(ctx, 'Cab se pehle <span class="hl">charge?</span>', 540, 320, {bg: '#fff', rot: -3, size: 76});
			M.slam(q, start + 0.1);
			const f = placeFace(ctx, 60, 440, 520);
			M.stretch(f.e, start + 0.2);
			M.float(f.e, start + 0.8, dur, {amp: 8, period: 1});
			const ph = el(`<div class="ill" style="left:640px;top:420px;width:340px;height:635px;z-index:3">${phone({low: true, pct: '5%', price: '₹ ???'})}</div>`, stage);
			M.pop(ph, start + 0.3, {from: 0.4});
			tl.set(ph.querySelector('.bat'), {scaleX: 0.07, svgOrigin: '45 70'}, 0);
			M.float(ph, start + 0.9, dur, {amp: 8, period: 1.1});
			const a = at('चार्ज'), b = at('नहीं');
			const A = cardPx(ctx, 'Haan, charge', 250, 1110, {bg: '#c6ff3d', size: 56, rot: -6});
			const B = cardPx(ctx, 'Seedha book', 800, 1110, {bg: '#ff4fd8', size: 56, rot: 6});
			M.slideIn(A, a - 0.1, {from: 'left'});
			M.slideIn(B, b - 0.1, {from: 'right'});
			ctx.cue('pop', a, 0.9); ctx.cue('pop', b, 0.9);
			look(ctx, f, a, 26, 8); look(ctx, f, b, -24, 8);
			M.wobble(A, b + 0.3, dur, {amp: 3, period: 0.5});
			M.wobble(B, b + 0.4, dur, {amp: 3, period: 0.55});
			ctx.cue('chime', b + 0.4, 0.8);
		},
	};
})();
