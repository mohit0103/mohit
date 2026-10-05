/* factloop Pop Bold engine: builds one paused GSAP timeline from window.DATA and the reel's scene functions.
   The renderer seeks the timeline frame by frame (FL.seek) and screenshots each frame. */
(function () {
	const W = 1080, H = 1920;
	const C = {lime: '#c6ff3d', purple: '#8a3cff', pink: '#ff4fd8', ink: '#111111', white: '#ffffff',
	           yellow: '#ffd23c', cyan: '#3ce7ff', red: '#ff3b3b', orange: '#ff8a1f'};
	const tl = gsap.timeline({paused: true});
	const cues = [];
	const app = document.getElementById('app');

	function el(html, parent) {
		const t = document.createElement('template');
		t.innerHTML = html.trim();
		const n = t.content.firstChild;
		(parent || app).appendChild(n);
		return n;
	}
	const cue = (name, t, gain) => cues.push({name, t: Math.max(0, t), gain: gain == null ? 1 : gain});

	// ---------------------------------------------------------------- moves (from the guide's vocabulary)
	const M = {
		pop(e, t, o = {}) {
			tl.fromTo(e, {scale: o.from ?? 0, autoAlpha: 0, rotation: o.rot ?? 0},
				{scale: o.to ?? 1, autoAlpha: 1, rotation: 0, duration: o.dur ?? 0.5, ease: o.ease ?? 'back.out(2.6)'}, t);
			if (o.sfx !== false) cue(o.sfx || 'pop', t, o.gain ?? 0.8);
		},
		rise(e, t, o = {}) {
			tl.fromTo(e, {y: o.y ?? 80, autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: o.dur ?? 0.55, ease: 'power3.out'}, t);
		},
		slam(e, t, o = {}) {
			tl.fromTo(e, {scale: o.from ?? 2.4, autoAlpha: 0, rotation: o.rot ?? -6},
				{scale: 1, autoAlpha: 1, rotation: o.endRot ?? -3, duration: o.dur ?? 0.32, ease: 'power4.out'}, t);
			cue('snap', t + 0.1, 1);
		},
		slideIn(e, t, o = {}) {
			const d = o.from || 'left';
			const v = {left: {x: -900}, right: {x: 900}, top: {y: -900}, bottom: {y: 900}}[d];
			tl.fromTo(e, {...v, autoAlpha: 1}, {x: 0, y: 0, duration: o.dur ?? 0.5, ease: o.ease ?? 'back.out(1.6)'}, t);
		},
		blurIn(e, t, o = {}) {
			tl.fromTo(e, {filter: 'blur(30px)', autoAlpha: 0, scale: 1.15}, {filter: 'blur(0px)', autoAlpha: 1, scale: 1, duration: o.dur ?? 0.6, ease: 'power2.out'}, t);
		},
		stretch(e, t, o = {}) {
			tl.fromTo(e, {scaleY: 0.05, scaleX: 1.4, autoAlpha: 0}, {scaleY: 1, scaleX: 1, autoAlpha: 1, duration: o.dur ?? 0.45, ease: 'elastic.out(1, 0.55)'}, t);
			cue('pop', t, 0.7);
		},
		wobble(e, t, dur, o = {}) {
			const n = Math.max(1, Math.floor(dur / (o.period ?? 0.6)));
			tl.fromTo(e, {rotation: -(o.amp ?? 4)}, {rotation: o.amp ?? 4, duration: o.period ?? 0.6, ease: 'sine.inOut', repeat: n, yoyo: true, immediateRender: false}, t);
		},
		float(e, t, dur, o = {}) {
			const n = Math.max(1, Math.floor(dur / (o.period ?? 1.2)));
			tl.to(e, {y: `+=${o.amp ?? 18}`, duration: o.period ?? 1.2, ease: 'sine.inOut', repeat: n, yoyo: true}, t);
		},
		spin(e, t, dur, o = {}) {
			tl.to(e, {rotation: `+=${(o.speed ?? 45) * dur}`, duration: dur, ease: 'none'}, t);
		},
		squash(e, t) {
			tl.to(e, {scaleY: 0.82, scaleX: 1.12, duration: 0.09, ease: 'power2.out', transformOrigin: '50% 100%'}, t)
				.to(e, {scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)'}, t + 0.09);
		},
		shake(e, t, o = {}) {
			tl.fromTo(e, {x: -(o.amp ?? 16)}, {x: o.amp ?? 16, duration: 0.05, repeat: o.n ?? 7, yoyo: true, ease: 'none', immediateRender: false}, t)
				.to(e, {x: 0, duration: 0.05}, t + 0.05 * ((o.n ?? 7) + 1));
		},
		countUp(e, t, from, to, dur, fmt) {
			const o = {v: from};
			fmt = fmt || (v => Math.round(v).toLocaleString('en-US'));
			tl.fromTo(o, {v: from}, {v: to, duration: dur, ease: 'power2.out', onUpdate: () => { e.textContent = fmt(o.v); }, immediateRender: true}, t);
			tl.set({}, {onComplete: () => {}}, t);
			e.textContent = fmt(from);
			const n = Math.min(14, Math.ceil(dur * 9));
			for (let i = 0; i < n; i++) cue('tick', t + dur * Math.pow(i / n, 1.6), 0.55);
		},
		typewriter(e, t, text, cps = 22) {
			const o = {n: 0};
			tl.fromTo(o, {n: 0}, {n: text.length, duration: text.length / cps, ease: 'none', onUpdate: () => { e.textContent = text.slice(0, Math.round(o.n)); }}, t);
			e.textContent = '';
			for (let i = 0; i < text.length; i += 2) cue('tick', t + i / cps, 0.35);
		},
		draw(path, t, dur, o = {}) {
			const L = path.getTotalLength();
			path.style.strokeDasharray = L;
			tl.fromTo(path, {strokeDashoffset: L}, {strokeDashoffset: 0, duration: dur, ease: o.ease ?? 'power2.inOut'}, t);
		},
		barFill(e, t, pct, dur = 0.9) {
			tl.fromTo(e, {width: '0%'}, {width: pct + '%', duration: dur, ease: 'power3.out'}, t);
			cue('fill', t, 0.7);
		},
		punchIn(root, t, o = {}) {
			tl.to(root, {scale: o.scale ?? 1.12, duration: 0.12, ease: 'power3.out'}, t)
				.to(root, {scale: 1, duration: 0.5, ease: 'power2.out'}, t + 0.12);
			cue('punch', t, 0.9);
		},
		out(e, t, o = {}) {
			tl.to(e, {scale: 0, autoAlpha: 0, duration: o.dur ?? 0.25, ease: 'back.in(2)'}, t);
		},
	};

	// ---------------------------------------------------------------- stickers (Pop Bold decoration)
	const STICKERS = {
		star: c => `<svg viewBox="-60 -60 120 120"><path d="M0-52 15-16 54-14 24 10 34 50 0 28-34 50-24 10-54-14-15-16Z" fill="${c}" stroke="#111" stroke-width="7" stroke-linejoin="round"/></svg>`,
		burst: c => `<svg viewBox="-60 -60 120 120"><path d="${Array.from({length: 24}, (_, i) => { const r = i % 2 ? 36 : 52, a = i / 24 * Math.PI * 2; return (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1); }).join(' ')}Z" fill="${c}" stroke="#111" stroke-width="7" stroke-linejoin="round"/></svg>`,
		squiggle: c => `<svg viewBox="0 0 140 60"><path d="M8 40 C 28 0, 44 0, 56 30 S 88 60, 100 26 S 124 10, 132 26" fill="none" stroke="#111" stroke-width="20" stroke-linecap="round"/><path d="M8 40 C 28 0, 44 0, 56 30 S 88 60, 100 26 S 124 10, 132 26" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/></svg>`,
		half: c => `<svg viewBox="-60 -60 120 120"><circle r="48" fill="#fff" stroke="#111" stroke-width="7"/><path d="M0-48A48 48 0 0 1 0 48Z" fill="${c}" stroke="#111" stroke-width="7"/><circle r="10" fill="#111"/></svg>`,
		plus: c => `<svg viewBox="-60 -60 120 120"><path d="M-14-46H14V-14H46V14H14V46H-14V14H-46V-14H-14Z" fill="${c}" stroke="#111" stroke-width="7" stroke-linejoin="round"/></svg>`,
		spark: c => `<svg viewBox="-60 -60 120 120"><path d="M0-54C6-10 10-6 54 0 10 6 6 10 0 54-6 10-10 6-54 0-10-6-6-10 0-54Z" fill="${c}" stroke="#111" stroke-width="7" stroke-linejoin="round"/></svg>`,
		arrow: c => `<svg viewBox="-60 -60 120 120"><path d="M-12 50V-10H-36L0-54 36-10H12V50Z" fill="${c}" stroke="#111" stroke-width="7" stroke-linejoin="round"/></svg>`,
	};
	const SPOTS = [[90, 330], [960, 360], [110, 1130], [960, 1110], [80, 760], [1000, 820], [520, 250], [880, 1000]];

	function stickers(root, t, dur, colors, n = 5, seed = 1) {
		let s = seed * 9301 + 49297;
		const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
		const kinds = Object.keys(STICKERS);
		const spots = SPOTS.slice().sort(() => rnd() - 0.5).slice(0, n);
		spots.forEach(([x, y], i) => {
			const k = kinds[Math.floor(rnd() * kinds.length)];
			const size = 90 + rnd() * 70;
			const c = colors[i % colors.length];
			const e = el(`<div class="sticker" style="left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px">${STICKERS[k](c)}</div>`, root);
			M.pop(e, t + 0.15 + i * 0.07, {rot: -90, sfx: false, dur: 0.5});
			if (k === 'squiggle' || k === 'arrow') M.wobble(e, t + 0.6, dur, {amp: 10, period: 0.7});
			else M.spin(e, t, dur + 1, {speed: (rnd() > 0.5 ? 1 : -1) * (30 + rnd() * 40)});
		});
	}

	// ---------------------------------------------------------------- scenes, transitions, captions, chrome
	const D = window.DATA;
	const scenes = D.scenes.map((s, i) => {
		const root = el(`<div class="scene" style="background:${s.bg};z-index:${10 + i}"><div class="stage"></div></div>`);
		return {...s, i, root, stage: root.querySelector('.stage')};
	});
	const TRANS = ['circle', 'slideUp', 'diag', 'circle', 'slideLeft', 'diag'];

	scenes.forEach((s, i) => {
		const start = s.start, end = s.end;
		tl.set(s.root, {visibility: 'visible'}, Math.max(0, start - 0.001));
		if (i > 0) {
			const k = s.transition || TRANS[(i - 1) % TRANS.length];
			const t0 = start - 0.12;
			if (k === 'circle') tl.fromTo(s.root, {clipPath: 'circle(0% at 50% 45%)'}, {clipPath: 'circle(140% at 50% 45%)', duration: 0.5, ease: 'power3.inOut'}, t0);
			else if (k === 'diag') tl.fromTo(s.root, {clipPath: 'polygon(0 0, 0 0, 0 0, 0 0)'}, {clipPath: 'polygon(0 0, 220% 0, 0 220%, 0 0)', duration: 0.5, ease: 'power3.inOut'}, t0);
			else if (k === 'slideLeft') tl.fromTo(s.root, {xPercent: 100}, {xPercent: 0, duration: 0.45, ease: 'power4.out'}, t0);
			else tl.fromTo(s.root, {yPercent: 100}, {yPercent: 0, duration: 0.45, ease: 'power4.out'}, t0);
			cue('swoosh', t0, 0.5);
		} else {
			tl.set(s.root, {clipPath: 'none'}, 0);
		}
		if (i < scenes.length - 1) tl.set(s.root, {visibility: 'hidden'}, scenes[i + 1].start + 0.5);
		const ctx = {
			tl, M, C, el, cue, stickers, W, H, s, root: s.root, stage: s.stage, start, end, dur: end - start,
			at(word, n = 1) {
				const norm = w => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
				let k = 0;
				for (const [w, ws] of s.words) if (norm(w).startsWith(norm(word)) && ++k === n) return ws - 0.06;
				return start + 0.2;
			},
		};
		const fn = (window.REEL || {})[s.id];
		if (fn) fn(ctx);
		if (s.stickers !== false) stickers(s.stage, start, end - start, s.sticker_colors || [C.pink, C.lime, C.yellow, C.cyan, C.purple], s.n_stickers ?? 5, i + 3);
	});

	// captions: chunky outlined words, the spoken word gets a highlight block
	const cap = el('<div id="captions"></div>');
	(D.chunks || []).forEach(ch => {
		const box = el('<div class="chunk"><div class="cbox"></div></div>', cap);
		const inner = box.firstChild;
		const spans = ch.words.map(([w, ws, we, hl]) => {
			const sp = el(`<span class="w${hl ? ' hl' : ''}">${w.replace(/</g, '&lt;')}</span>`, inner);
			return [sp, ws, we, hl];
		});
		tl.fromTo(box, {autoAlpha: 0, scale: 0.75, y: 20}, {autoAlpha: 1, scale: 1, y: 0, duration: 0.16, ease: 'back.out(3)'}, ch.start);
		spans.forEach(([sp, ws, we, hl]) => {
			tl.fromTo(sp, {autoAlpha: 0.0, y: 14}, {autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out'}, Math.max(ch.start, ws - 0.04));
			if (!hl) {
				tl.set(sp, {backgroundColor: C.yellow}, ws);
				tl.set(sp, {backgroundColor: 'rgba(0,0,0,0)'}, Math.max(ws + 0.05, we));
			}
		});
		tl.to(box, {autoAlpha: 0, duration: 0.08}, ch.end);
	});

	// chrome: channel chip + progress
	const chip = el(`<div id="chip">${D.channel}<span>!</span></div>`);
	const prog = el('<div id="progress"><div></div></div>');
	tl.fromTo(prog.firstChild, {width: '0%'}, {width: '100%', duration: D.total, ease: 'none'}, 0);
	tl.set({}, {}, D.total);

	window.FL = {
		tl, cues,
		seek(t) { tl.time(t, false); return true; },  // events on, so count-up onUpdate handlers run
		total: D.total,
	};
})();
