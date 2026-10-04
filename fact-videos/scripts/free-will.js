// Pilot reel: "Your brain decides before you do". All illustrations are original SVG drawings.
window.REEL = (function () {
	const LOBES = [[-112, -38, 78], [-62, -100, 74], [18, -116, 78], [98, -72, 80], [128, 18, 72], [70, 84, 70], [-18, 96, 72], [-108, 62, 70], [0, 0, 108]];

	function brain(col = '#ff7ad9', fold = '#c43aa0') {
		return `<svg viewBox="-230 -200 460 400" width="100%" height="100%">
			<g fill="#111" transform="translate(14 14)">${LOBES.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 9}"/>`).join('')}</g>
			<g fill="#111">${LOBES.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 9}"/>`).join('')}</g>
			<g fill="${col}">${LOBES.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
			<g stroke="${fold}" stroke-width="10" fill="none" stroke-linecap="round">
				<path d="M2 -150 C -22 -80, 24 -30, 0 30"/><path d="M-150 -40 C -110 -60, -90 -20, -60 -40"/>
				<path d="M140 -40 C 110 -10, 150 20, 120 50"/><path d="M60 -150 C 70 -120, 40 -110, 60 -90"/>
				<path d="M-90 120 C -70 100, -40 130, -30 110"/></g>
			<g class="eyes">
				<ellipse cx="-58" cy="-4" rx="46" ry="52" fill="#fff" stroke="#111" stroke-width="9"/>
				<ellipse cx="58" cy="-4" rx="46" ry="52" fill="#fff" stroke="#111" stroke-width="9"/>
				<g class="pupils"><circle cx="-52" cy="6" r="19" fill="#111"/><circle cx="64" cy="6" r="19" fill="#111"/>
				<circle cx="-46" cy="-2" r="6" fill="#fff"/><circle cx="70" cy="-2" r="6" fill="#fff"/></g>
			</g>
			<path class="mouth" d="M-36 74 Q0 108 36 74" stroke="#111" stroke-width="11" fill="none" stroke-linecap="round"/>
		</svg>`;
	}

	function card(ctx, html, x, y, o = {}) {
		const e = ctx.el(`<div class="card" style="left:${x}px;top:${y}px;background:${o.bg || '#c6ff3d'};font-size:${o.size || 92}px;transform:translate(-50%,-50%) rotate(${o.rot ?? -3}deg)">${html}</div>`, ctx.stage);
		return e;
	}

	return {
		// 1. HOOK
		hook(ctx) {
			const {M, el, stage, start, dur, tl} = ctx;
			const b = el(`<div class="ill" style="left:260px;top:420px;width:560px;height:490px">${brain()}</div>`, stage);
			M.pop(b, start + 0.05, {dur: 0.6, sfx: 'pop'});
			M.float(b, start + 0.7, dur, {amp: 16, period: 1.1});
			const pupils = b.querySelector('.pupils');
			tl.to(pupils, {x: -16, duration: 0.25, ease: 'power2.out'}, start + 0.8).to(pupils, {x: 16, duration: 0.25}, start + 1.4).to(pupils, {x: 0, y: -10, duration: 0.25}, start + 2.0);
			const c = card(ctx, 'Your brain<br>decides <span class="hl">first.</span>', 540, 1120, {rot: -4});
			M.slam(c, ctx.at('before'));
			M.punchIn(stage, ctx.at('before') + 0.05);
		},

		// 2. LIBET 1983
		libet(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const lab = card(ctx, '1983', 540, 330, {bg: '#fff', size: 110, rot: 3});
			M.pop(lab, start + 0.05);
			// a lab clock with a fast-moving dot (like the one in the experiment)
			const clk = el(`<div class="ill" style="left:150px;top:520px;width:420px;height:420px"><svg viewBox="-110 -110 220 220" width="100%" height="100%">
				<circle r="96" fill="#111" transform="translate(7 7)"/><circle r="96" fill="#fff" stroke="#111" stroke-width="8"/>
				${Array.from({length: 12}, (_, i) => { const a = i / 12 * Math.PI * 2; return `<line x1="${Math.sin(a) * 74}" y1="${-Math.cos(a) * 74}" x2="${Math.sin(a) * 86}" y2="${-Math.cos(a) * 86}" stroke="#111" stroke-width="7" stroke-linecap="round"/>`; }).join('')}
				<g class="dot"><circle cx="0" cy="-60" r="15" fill="#ff4fd8" stroke="#111" stroke-width="6"/></g>
				<circle r="9" fill="#111"/></svg></div>`, stage);
			M.pop(clk, start + 0.25);
			tl.to(clk.querySelector('.dot'), {rotation: 360 * dur / 1.4, transformOrigin: '0px 0px', duration: dur, ease: 'none', svgOrigin: '0 0'}, start + 0.2);
			// a cartoon hand that flicks
			const hand = el(`<div class="ill" style="left:600px;top:560px;width:340px;height:380px"><svg viewBox="-90 -120 180 240" width="100%" height="100%">
				<g transform="translate(8 8)" fill="#111"><rect x="-60" y="-20" width="120" height="140" rx="50"/><rect x="-58" y="-110" width="34" height="110" rx="17"/><rect x="-20" y="-120" width="34" height="120" rx="17"/><rect x="18" y="-110" width="34" height="110" rx="17"/><rect x="-100" y="-10" width="70" height="34" rx="17" transform="rotate(-30)"/></g>
				<g fill="#ffd23c" stroke="#111" stroke-width="8"><rect x="-58" y="-110" width="34" height="120" rx="17"/><rect x="-20" y="-120" width="34" height="130" rx="17"/><rect x="18" y="-110" width="34" height="120" rx="17"/><rect x="-100" y="-10" width="70" height="34" rx="17" transform="rotate(-30)"/><rect x="-60" y="-30" width="120" height="150" rx="50"/></g>
				</svg></div>`, stage);
			M.slideIn(hand, start + 0.35, {from: 'right'});
			const tw = at('move');
			tl.to(hand, {rotation: -24, transformOrigin: '50% 100%', duration: 0.12, ease: 'power3.out'}, tw)
				.to(hand, {rotation: 0, duration: 0.5, ease: 'elastic.out(1,0.4)'}, tw + 0.12);
			ctx.cue('snap', tw, 0.8);
			M.wobble(hand, tw + 0.7, dur - (tw - start), {amp: 6, period: 0.5});
		},

		// 3. THE SIGNAL RISES EARLY
		signal(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const box = el(`<div class="card" style="left:540px;top:720px;width:900px;height:760px;background:#fff;padding:0;transform:translate(-50%,-50%) rotate(-2deg)"><svg viewBox="0 0 900 760" width="100%" height="100%">
				<line x1="80" y1="620" x2="840" y2="620" stroke="#111" stroke-width="8" stroke-linecap="round"/>
				<path class="sig" d="M90 600 C 260 600, 300 598, 380 590 C 470 580, 520 470, 600 330 C 650 240, 700 180, 820 150" fill="none" stroke="#8a3cff" stroke-width="16" stroke-linecap="round"/>
				<g class="fb" transform="translate(400 590)"><line y1="0" y2="-300" stroke="#111" stroke-width="7"/><rect x="0" y="-300" width="190" height="78" rx="14" fill="#ff4fd8" stroke="#111" stroke-width="7"/><text x="95" y="-247" font-size="44" text-anchor="middle" font-family="Bricolage" font-weight="800">BRAIN</text></g>
				<g class="fy" transform="translate(690 590)"><line y1="0" y2="-470" stroke="#111" stroke-width="7"/><rect x="-100" y="-470" width="160" height="78" rx="14" fill="#c6ff3d" stroke="#111" stroke-width="7"/><text x="-20" y="-417" font-size="44" text-anchor="middle" font-family="Bricolage" font-weight="800">YOU</text></g>
				<text x="460" y="700" font-size="46" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="#111">TIME →</text>
			</svg></div>`, stage);
			M.pop(box, start + 0.05, {from: 0.6});
			M.draw(box.querySelector('.sig'), start + 0.4, 1.6);
			M.pop(box.querySelector('.fb'), at('rising'), {dur: 0.45});
			M.pop(box.querySelector('.fy'), at('urge'), {dur: 0.45});
			const big = el(`<div class="big" style="left:540px;top:1240px;transform:translate(-50%,-50%);font-size:170px;color:#c6ff3d">0.35s</div>`, stage);
			M.slam(big, at('third'), {endRot: -4});
		},

		// 4. SCANS: 10 SECONDS EARLY
		scan(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const lab = card(ctx, '2008', 540, 300, {bg: '#3ce7ff', size: 100, rot: -3});
			M.pop(lab, start + 0.05);
			const sc = el(`<div class="ill" style="left:190px;top:420px;width:700px;height:600px"><svg viewBox="-230 -200 460 400" width="100%" height="100%">
				<g fill="none" stroke="#3ce7ff" stroke-width="7">${LOBES.map(([x, y, r]) => `<circle class="lo" cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
				${[[-90, -40], [40, -90], [110, 30], [-30, 70], [10, -10]].map(([x, y], i) => `<circle class="spot" cx="${x}" cy="${y}" r="26" fill="#ff4fd8" stroke="#111" stroke-width="6"/>`).join('')}
			</svg></div>`, stage);
			sc.querySelectorAll('.lo').forEach((p, i) => M.draw(p, start + 0.2 + i * 0.06, 0.8));
			sc.querySelectorAll('.spot').forEach((p, i) => {
				tl.fromTo(p, {scale: 0, transformOrigin: '50% 50%'}, {scale: 1, duration: 0.35, ease: 'back.out(3)'}, start + 0.9 + i * 0.12);
				tl.to(p, {scale: 1.35, duration: 0.45, repeat: Math.floor(dur / 0.45), yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 50%'}, start + 1.4 + i * 0.1);
			});
			const num = el(`<div class="big" style="left:540px;top:1180px;transform:translate(-50%,-50%);font-size:230px;color:#c6ff3d"><span class="n">0</span>s</div>`, stage);
			M.pop(num, at('ten') - 0.2, {sfx: false, from: 0.5});
			M.countUp(num.querySelector('.n'), at('ten') - 0.2, 0, 10, 0.9, v => Math.round(v));
			M.punchIn(stage, at('early'));
		},

		// 5. BETTER THAN A COIN FLIP
		coin(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const coin = el(`<div class="ill" style="left:330px;top:440px;width:420px;height:420px"><svg viewBox="-110 -110 220 220" width="100%" height="100%">
				<circle r="96" fill="#111" transform="translate(8 8)"/><circle r="96" fill="#ffd23c" stroke="#111" stroke-width="8"/><circle r="70" fill="none" stroke="#111" stroke-width="6" stroke-dasharray="10 10"/>
				<text y="38" font-size="110" text-anchor="middle" font-family="Bricolage" font-weight="800" fill="#111">?</text></svg></div>`, stage);
			M.pop(coin, start + 0.05);
			tl.to(coin, {scaleX: -1, duration: 0.22, repeat: 9, yoyo: true, ease: 'sine.inOut'}, start + 0.4);
			tl.fromTo(coin, {y: 0}, {y: -260, duration: 0.55, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false}, start + 0.4);
			const c = card(ctx, 'Better than<br><span class="hl">50 / 50</span>', 540, 1140, {bg: '#fff', rot: 3});
			M.slam(c, at('better'));
		},

		// 6. SCIENTISTS ARGUE
		argue(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const b = el(`<div class="ill" style="left:290px;top:700px;width:500px;height:440px">${brain('#ff7ad9')}</div>`, stage);
			M.pop(b, start + 0.05);
			tl.to(b.querySelector('.pupils'), {rotation: 360 * 3, svgOrigin: '6 6', duration: dur, ease: 'none'}, start + 0.4);
			M.wobble(b, start + 0.5, dur, {amp: 5, period: 0.35});
			const bub = (txt, x, y, col, flip) => el(`<div class="ill" style="left:${x}px;top:${y}px;width:400px;height:300px"><svg viewBox="0 0 400 300" width="100%" height="100%">
				<path d="M40 30 H360 Q380 30 380 50 V190 Q380 210 360 210 H${flip ? 120 : 280} L${flip ? 60 : 340} 280 L${flip ? 150 : 250} 210 H40 Q20 210 20 190 V50 Q20 30 40 30Z" fill="#111" transform="translate(10 10)"/>
				<path d="M40 30 H360 Q380 30 380 50 V190 Q380 210 360 210 H${flip ? 120 : 280} L${flip ? 60 : 340} 280 L${flip ? 150 : 250} 210 H40 Q20 210 20 190 V50 Q20 30 40 30Z" fill="${col}" stroke="#111" stroke-width="9"/>
				<text x="200" y="160" font-size="120" text-anchor="middle" font-family="Bricolage" font-weight="800">${txt}</text></svg></div>`, stage);
			const b1 = bub('?!', 60, 300, '#c6ff3d', true), b2 = bub('!!', 620, 380, '#ffd23c', false), b3 = bub('??', 80, 560, '#3ce7ff', true);
			M.pop(b1, at('scientists'), {rot: -20});
			M.pop(b2, at('argue'), {rot: 20});
			M.pop(b3, at('really'), {rot: -15});
			M.shake(b2, at('argue') + 0.5, {amp: 10, n: 9});
		},

		// 7. THE QUESTION
		cta(ctx) {
			const {M, el, stage, start, dur, tl, at} = ctx;
			const q = card(ctx, 'Is free will<br><span class="hl">real?</span>', 540, 380, {bg: '#fff', rot: -3});
			M.slam(q, start + 0.1);
			const b = el(`<div class="ill" style="left:330px;top:620px;width:420px;height:370px">${brain()}</div>`, stage);
			M.pop(b, start + 0.3);
			const p = b.querySelector('.pupils');
			tl.to(p, {x: -20, duration: 0.2}, at('Yes')).to(p, {x: 20, duration: 0.2}, at('no'));
			const yes = card(ctx, 'YES', 270, 1180, {bg: '#8a3cff', size: 120, rot: -6});
			yes.style.color = '#fff';
			const no = card(ctx, 'NO', 810, 1180, {bg: '#ff4fd8', size: 120, rot: 6});
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
