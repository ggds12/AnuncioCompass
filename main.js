/* Compasso · página de vendas
   - Céu em pixel que atravessa um mês com a rolagem (manhã → pôr do sol → noite e mar)
   - Tartarugas em pixel desenhadas a partir do logo, com humor, piscadas e nado
   - Demonstrações: janela do app, segurar para pagar, leitura de fatura, simulação do humor
   Sem dependências. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const money = v => (v < 0 ? '−' : '') + brl0.format(Math.abs(v)).replace(/\s/g, ' ');

  /* ------------------------------------------------------------------
     Palavras que sobem
  ------------------------------------------------------------------ */
  function split(el) {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span');
            s.className = 'w';
            s.style.setProperty('--i', i++);
            s.textContent = part;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }
  $$('[data-split]').forEach(split);
  const heroTitle = $('.hero-title');
  heroTitle.style.setProperty('--d0', '120ms');
  requestAnimationFrame(() => heroTitle.classList.add('is-split-in'));

  /* ------------------------------------------------------------------
     Revelação na rolagem
  ------------------------------------------------------------------ */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      // depois da entrada, solta o filtro para não pesar na rolagem
      setTimeout(() => e.target.classList.add('is-done'), 1400 + (parseInt(e.target.style.getPropertyValue('--rd')) || 0));
      $$('[data-split]', e.target).forEach(s => s.classList.add('is-split-in'));
      if (e.target.matches('[data-split]')) e.target.classList.add('is-split-in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  // Irmãos que entram juntos (cartões lado a lado) chegam em cascata
  $$('.reveal').forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    const i = sibs.indexOf(el);
    if (sibs.length > 1 && i > 0) el.style.setProperty('--rd', Math.min(i, 4) * 110 + 'ms');
  });
  $$('.reveal, .giant').forEach(el => revealIO.observe(el));

  /* ------------------------------------------------------------------
     Carrossel de bancos: duplica a lista para o laço não ter emenda
  ------------------------------------------------------------------ */
  $$('[data-marquee]').forEach(track => {
    [...track.children].forEach(li => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
  });

  /* ------------------------------------------------------------------
     Tartaruga em pixel (a partir do logo)
     k = corpo · w = traço do casco · e = olho
  ------------------------------------------------------------------ */
  const FRAME_A = [
    '...................kkkk..',
    '.................kkkkkkk.',
    '..........kkkkk..kwwwwkkk',
    '.......kkkkkkkkkkwwkwkkk.',
    '.....kkkkwwwwwkkkwwwwkkkk',
    '..kkkkkkwwkkkkkkkkkkkkkkk',
    '.kkkkkwwkkkkkkkkkkkkkkkk.',
    'kkk.kwwkkkkkkkkkkkkkk....',
    'kk..kkkkkkkkkkkkkkkkkk...',
    '...kkkkkkkkkkkkkkkkkkkk..',
    '...kkkkkkkkkkkkkkk.kkkk..',
    '....kkkkkkkkkkkkk...kkkk.',
    '.......kkkkkkkk......kkk.',
    '......................kk.',
  ];
  const FRAME_B = [
    '...................kkkk..',
    '.................kkkkkkk.',
    '..........kkkkk..kwwwwkkk',
    '.......kkkkkkkkkkwwkwkkk.',
    'kk...kkkkwwwwwkkkwwwwkkkk',
    'kkkkkkkkwwkkkkkkkkkkkkkkk',
    '.kkkkkwwkkkkkkkkkkkkkkkk.',
    '....kwwkkkkkkkkkkkkkk....',
    '....kkkkkkkkkkkkkkkkkk...',
    '...kkkkkkkkkkkkkkkkkkkk..',
    '...kkkkkkkkkkkkkkkkkkk...',
    '....kkkkkkkkkkkkkkkkk....',
    '.......kkkkkkkk.kkkkk....',
    '................kkk......',
  ];
  const markEye = g => g.map((row, y) => (y >= 2 && y <= 4) ? row.split('').map((c, x) => (c === 'w' && x >= 16 ? 'e' : c)).join('') : row);
  const FRAMES = [markEye(FRAME_A), markEye(FRAME_B)];
  const GW = 25, GH = 14, PAD_T = 3, PAD_B = 1, PAD_X = 1;
  const MOOD_PERIOD = { calm: 460, alert: 230, stress: 120 };
  const turtles = [];

  const turtleIO = new IntersectionObserver(entries => {
    entries.forEach(e => { const t = e.target._turtle; if (t) t.visible = e.isIntersecting; });
  }, { rootMargin: '80px' });

  function makeTurtle(cv) {
    const d = cv.dataset;
    const s = +d.scale || 3;
    const t = {
      cv, ctx: cv.getContext('2d'), s,
      mood: d.mood || 'calm',
      body: d.color || '#161616',
      detail: d.eye || '#ffffff',
      flip: 'flip' in d,
      speed: +d.speed || 1,
      frame: 0, blink: false, visible: true,
      nextFrame: 0, blinkAt: performance.now() + 800 + Math.random() * 3200, blinkEnd: 0,
    };
    cv.width = (GW + PAD_X * 2) * s;
    cv.height = (GH + PAD_T + PAD_B) * s;
    cv.style.width = cv.width + 'px';
    cv.style.height = cv.height + 'px';
    cv._turtle = t;
    drawTurtle(t);
    turtles.push(t);
    turtleIO.observe(cv);
    return t;
  }

  function px(ctx, s, x, y, c) { ctx.fillStyle = c; ctx.fillRect((x + PAD_X) * s, (y + PAD_T) * s, s, s); }

  function drawTurtle(t) {
    const { ctx, cv, s } = t;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    if (t.flip) { ctx.translate(cv.width, 0); ctx.scale(-1, 1); }
    const g = FRAMES[t.frame];
    for (let y = 0; y < GH; y++) {
      const row = g[y];
      for (let x = 0; x < GW; x++) {
        const c = row[x];
        if (c === '.') continue;
        const col = c === 'k' ? t.body : c === 'w' ? t.detail : (t.blink ? t.body : t.detail);
        px(ctx, s, x, y, col);
      }
    }
    if (t.mood === 'alert') {
      const drop = '#4aa8ff';
      px(ctx, s, 15, -2, drop); px(ctx, s, 14, -1, drop); px(ctx, s, 15, -1, drop); px(ctx, s, 15, 0, '#9fd2ff');
    } else if (t.mood === 'stress') {
      const m = '#ff5a4a';
      const wob = t.frame;
      px(ctx, s, 19, -3 + wob, m); px(ctx, s, 19, -2 + wob, m);
      px(ctx, s, 23, -2, m); px(ctx, s, 24, -3, m);
      px(ctx, s, 15, -2, m); px(ctx, s, 14, -3, m);
    }
    ctx.restore();
  }

  function setMood(t, mood) { if (t.mood !== mood) { t.mood = mood; drawTurtle(t); } }

  $$('canvas.px-turtle').forEach(makeTurtle);

  // Filhotes no fim da página
  const hatch = $('[data-hatch]');
  if (hatch) {
    const n = innerWidth < 760 ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const cv = document.createElement('canvas');
      cv.className = 'px-turtle';
      cv.dataset.scale = String(i % 3 === 0 ? 3 : 2);
      cv.dataset.speed = '1.8';
      cv.dataset.color = '#0b0f22';
      cv.dataset.eye = '#e9ecff';
      const dur = 24 + Math.random() * 14;
      cv.style.setProperty('--t', dur.toFixed(1) + 's');
      cv.style.setProperty('--d', (-(i / n) * dur - Math.random() * 3).toFixed(1) + 's');
      cv.style.bottom = (i % 3) * 7 + 'px';
      hatch.appendChild(cv);
      makeTurtle(cv);
    }
  }

  function tickTurtles(now) {
    for (const t of turtles) {
      if (!t.visible) continue;
      let dirty = false;
      if (now >= t.nextFrame) {
        t.frame ^= 1;
        t.nextFrame = now + (MOOD_PERIOD[t.mood] || 460) / t.speed;
        dirty = true;
      }
      if (!t.blink && now >= t.blinkAt) { t.blink = true; t.blinkEnd = now + 140; dirty = true; }
      else if (t.blink && now >= t.blinkEnd) { t.blink = false; t.blinkAt = now + 2400 + Math.random() * 3600; dirty = true; }
      if (dirty) drawTurtle(t);
    }
  }

  /* ------------------------------------------------------------------
     Céu em pixel
  ------------------------------------------------------------------ */
  const sky = $('.sky');
  const sctx = sky.getContext('2d');
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // p, topo, meio, baixo, horizonte, nuvem clara, nuvem sombra, estrelas
  const KEYS = [
    [0.00, '#1a54b8', '#2f74dc', '#5c98ec', '#86b6f3', '#ffffff', '#cfe0fa', 0],
    [0.30, '#1c5bc8', '#3a82e6', '#69a6f2', '#93c2f7', '#ffffff', '#d3e3fb', 0],
    [0.50, '#2d45a2', '#6159b8', '#b37a9e', '#d99484', '#fff0ea', '#efb2ad', 0],
    [0.62, '#262b80', '#5d439c', '#b9667e', '#e08a6c', '#ffd7c6', '#c58595', 0.12],
    [0.74, '#10164e', '#24256a', '#47377a', '#7c5180', '#8a84b6', '#58528e', 0.6],
    [0.86, '#060a26', '#0c1440', '#18225a', '#2a3570', '#4a5288', '#323a6c', 1],
    [1.00, '#04071c', '#081032', '#111b4a', '#1d2a60', '#3d4680', '#2a3262', 1],
  ].map(k => [k[0], ...k.slice(1, 7).map(hex), k[7]]);

  function palette(p) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = smooth(a[0], b[0], p);
    const mix = (ca, cb) => [lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)];
    return { top: mix(a[1], b[1]), mid: mix(a[2], b[2]), low: mix(a[3], b[3]), hor: mix(a[4], b[4]), cl: mix(a[5], b[5]), cs: mix(a[6], b[6]), stars: lerp(a[7], b[7], t) };
  }
  function gradAt(pal, t) {
    const stops = [[0, pal.top], [0.38, pal.mid], [0.78, pal.low], [1, pal.hor]];
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [ta, ca] = stops[i], [tb, cb] = stops[i + 1];
    const k = clamp((t - ta) / (tb - ta), 0, 1);
    return [lerp(ca[0], cb[0], k), lerp(ca[1], cb[1], k), lerp(ca[2], cb[2], k)];
  }
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  let SW = 0, SH = 0, PX = 4, skyImg = null, lastSkyP = -1, stars = [], clouds = [];
  let scrollP = 0, footH = 120;

  function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  function buildScene() {
    const r = rand(7);
    stars = Array.from({ length: Math.round(SW * SH / 260) }, () => ({ x: (r() * SW) | 0, y: (r() * SH * 0.72) | 0, ph: r() * 6.28, sp: 0.6 + r() * 2.2, big: r() > 0.93 }));
    clouds = Array.from({ length: Math.max(5, Math.round(SW / 55)) }, (_, i) => makeCloud(r, i));
  }
  function makeCloud(r, i) {
    const n = 3 + ((r() * 4) | 0);
    const circles = [];
    let x = 0;
    const base = 6 + r() * 6;
    for (let k = 0; k < n; k++) {
      const rad = base * (0.55 + r() * 0.75) * (k === 0 || k === n - 1 ? 0.7 : 1);
      circles.push([x + rad, rad]);
      x += rad * (1.1 + r() * 0.5);
    }
    const width = x + 4, maxR = Math.max(...circles.map(c => c[1]));
    const spans = [];
    for (let y = -Math.ceil(maxR); y <= 0; y++) {
      let x0 = Infinity, x1 = -Infinity;
      circles.forEach(([cx, rad]) => {
        const cy = 0;
        const dy = y - cy;
        if (Math.abs(dy) <= rad) { const w = Math.sqrt(rad * rad - dy * dy); x0 = Math.min(x0, cx - w); x1 = Math.max(x1, cx + w); }
      });
      if (x0 < x1) spans.push([y, Math.round(x0), Math.round(x1)]);
    }
    return { spans, width, x: r() * (SW + width) - width, y: 0.06 + r() * 0.62, depth: 0.4 + r() * 0.9, speed: 0.6 + r() * 1.8, alpha: 0.7 + r() * 0.3, i };
  }

  function resizeSky() {
    PX = innerWidth < 760 ? 3 : 4;
    SW = Math.ceil(innerWidth / PX);
    SH = Math.ceil(innerHeight / PX);
    sky.width = SW; sky.height = SH;
    skyImg = sctx.createImageData(SW, SH);
    lastSkyP = -1;
    buildScene();
    const f = $('.foot');
    footH = f ? f.offsetHeight : 120;
  }

  function paintGradient(pal) {
    const NB = 22;
    const bands = Array.from({ length: NB + 1 }, (_, b) => gradAt(pal, b / NB));
    const d = skyImg.data;
    for (let y = 0; y < SH; y++) {
      const tb = (y / (SH - 1)) * NB;
      const base = Math.floor(tb), frac = tb - base;
      const row = (y & 3) * 4;
      for (let x = 0; x < SW; x++) {
        const band = frac > BAYER[row + (x & 3)] ? Math.min(base + 1, NB) : base;
        const c = bands[band];
        const o = (y * SW + x) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
  }

  function disc(cx, cy, R, color) {
    sctx.fillStyle = color;
    for (let dy = -R; dy <= R; dy++) {
      const w = Math.floor(Math.sqrt(R * R - dy * dy));
      sctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
    }
  }

  function drawSky(now) {
    const p = scrollP;
    const pal = palette(p);
    if (Math.abs(p - lastSkyP) > 0.0015 || lastSkyP < 0) { paintGradient(pal); lastSkyP = p; }
    sctx.putImageData(skyImg, 0, 0);
    const time = now / 1000;

    // Estrelas
    if (pal.stars > 0.01) {
      for (const s of stars) {
        const a = pal.stars * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.sp + s.ph)));
        sctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        sctx.fillRect(s.x, s.y, 1, 1);
        if (s.big && a > 0.6) { sctx.fillStyle = `rgba(255,255,255,${(a * 0.45).toFixed(3)})`; sctx.fillRect(s.x - 1, s.y, 1, 1); sctx.fillRect(s.x + 1, s.y, 1, 1); sctx.fillRect(s.x, s.y - 1, 1, 1); sctx.fillRect(s.x, s.y + 1, 1, 1); }
      }
    }

    // Sol: desce do alto até se pôr por volta do meio da página
    const sp = p / 0.64;
    if (sp < 1.08) {
      const R = Math.max(6, Math.round(SW / 55));
      const sx = SW * lerp(0.8, 0.26, sp);
      const sy = SH * (0.14 + 0.8 * Math.pow(clamp(sp, 0, 1.08), 1.7));
      const warm = smooth(0.35, 1, sp);
      const core = [255, lerp(246, 150, warm), lerp(214, 96, warm)];
      sctx.globalAlpha = 0.12; disc(sx, sy, R * 2.6, rgb(core));
      sctx.globalAlpha = 0.18; disc(sx, sy, R * 1.7, rgb(core));
      sctx.globalAlpha = 1; disc(sx, sy, R, rgb(core));
      sctx.fillStyle = 'rgba(255,255,255,.55)'; sctx.fillRect(Math.round(sx - R * 0.45), Math.round(sy - R * 0.5), Math.max(1, R * 0.3 | 0), Math.max(1, R * 0.3 | 0));
    }

    // Lua: nasce quando o céu escurece
    const mp = smooth(0.66, 0.92, p);
    let moonX = 0, moonY = 0;
    if (mp > 0) {
      const R = Math.max(5, Math.round(SW / 70));
      moonX = SW * 0.78; moonY = SH * lerp(0.62, 0.17, mp);
      sctx.globalAlpha = 0.1 * mp; disc(moonX, moonY, R * 3, '#dfe6ff');
      sctx.globalAlpha = mp; disc(moonX, moonY, R, '#f3f0e2');
      const bg = gradAt(pal, clamp(moonY / SH, 0, 1));
      disc(moonX + R * 0.45, moonY - R * 0.3, R * 0.88, rgb(bg));
      sctx.globalAlpha = 1;
    }

    // Nuvens
    const scrollPx = scrollY / PX;
    const night = smooth(0.66, 0.9, p);
    for (const c of clouds) {
      if (!reduced) c.x += c.speed * c.depth * 0.016;
      if (c.x > SW + 4) c.x = -c.width - 4;
      const cy = Math.round(SH * c.y - (scrollPx * 0.06 * c.depth) % (SH * 1.2));
      const yy = cy < -20 ? cy + SH * 1.2 : cy;
      const cx = Math.round(c.x);
      const mid = Math.abs((cx + c.width / 2) / SW - 0.5) * 2; // 0 no centro, 1 nas bordas
      const a = c.alpha * (1 - night * 0.55) * (0.18 + 0.82 * smooth(0.35, 0.95, mid));
      sctx.fillStyle = rgb(pal.cs, a);
      for (const [y, x0, x1] of c.spans) sctx.fillRect(cx + x0, yy + y + 2, x1 - x0, 1);
      sctx.fillStyle = rgb(pal.cl, a);
      for (const [y, x0, x1] of c.spans) if (y < -1) sctx.fillRect(cx + x0, yy + y, x1 - x0, 1);
    }

    // Mar e areia no fim
    const seaT = smooth(0.82, 0.995, p);
    if (seaT > 0) {
      const sandH = Math.round(Math.min((footH + 64) / PX, SH * 0.34) * seaT);
      const seaH = Math.round(SH * 0.16 * seaT);
      const seaTop = SH - sandH - seaH;
      for (let y = 0; y < seaH; y++) {
        const k = y / Math.max(1, seaH);
        sctx.fillStyle = rgb([lerp(26, 8, k), lerp(42, 16, k), lerp(96, 48, k)]);
        sctx.fillRect(0, seaTop + y, SW, 1);
      }
      // brilho das ondas
      for (let y = 1; y < seaH; y += 3) {
        const off = (time * (6 + y)) % 18;
        sctx.fillStyle = `rgba(160,180,255,${0.12 + 0.1 * Math.sin(y)})`;
        for (let x = -18 + off; x < SW; x += 18) sctx.fillRect(Math.round(x + (y * 7) % 11), seaTop + y, 5, 1);
      }
      // reflexo da lua
      if (mp > 0) {
        for (let y = 1; y < seaH; y += 2) {
          const w = Math.max(1, Math.round((3 + y * 0.6) * (0.6 + 0.4 * Math.sin(time * 2 + y))));
          sctx.fillStyle = `rgba(243,240,226,${(0.55 - y / seaH * 0.35) * mp})`;
          sctx.fillRect(Math.round(moonX - w / 2), seaTop + y, w, 1);
        }
      }
      // areia ao luar
      const sandTop = SH - sandH;
      for (let y = 0; y < sandH; y++) {
        const k = y / Math.max(1, sandH);
        sctx.fillStyle = rgb([lerp(74, 44, k), lerp(70, 40, k), lerp(104, 66, k)]);
        sctx.fillRect(0, sandTop + y, SW, 1);
      }
      sctx.fillStyle = 'rgba(220,230,255,.5)';
      for (let x = 0; x < SW; x += 2) {
        const h = ((Math.sin(x * 0.3 + time * 1.4) + 1) * 0.8) | 0;
        sctx.fillRect(x, sandTop - h, 2, 1);
      }
      sctx.fillStyle = 'rgba(255,255,255,.08)';
      for (let i = 0; i < SW * sandH / 40; i++) { const x = (i * 97) % SW, y = sandTop + 2 + ((i * 53) % Math.max(1, sandH - 2)); sctx.fillRect(x, y, 1, 1); }
    }
  }

  /* ------------------------------------------------------------------
     Rolagem: progresso do mês
  ------------------------------------------------------------------ */
  const nav = $('[data-nav]');
  const dayEl = $('[data-day]');
  const monthBar = $('[data-month-bar]');
  function onScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    scrollP = clamp(scrollY / max, 0, 1);
    nav.classList.toggle('is-scrolled', scrollY > 24);
    const day = clamp(Math.round(1 + scrollP * 29), 1, 30);
    dayEl.textContent = String(day).padStart(2, '0');
    monthBar.style.width = (scrollP * 100).toFixed(1) + '%';
    updateTrail();
  }

  /* ------------------------------------------------------------------
     Janela do app (escala) e contadores
  ------------------------------------------------------------------ */
  const mac = $('[data-mac]');
  const macFit = $('[data-fit]');
  function fitWin() {
    if (!macFit || !macFit.clientWidth) return;
    mac.style.setProperty('--s', (macFit.clientWidth / 1180).toFixed(4));
  }

  function countUp(el, delay = 0) {
    const target = parseFloat(el.dataset.count);
    const fmt = el.dataset.fmt;
    const pre = el.dataset.prefix || '';
    const show = v => { el.textContent = pre + (fmt === 'dec1' ? v.toFixed(1).replace('.', ',') : Math.round(v).toLocaleString('pt-BR')); };
    if (reduced) { show(target); return; }
    const t0 = performance.now() + delay, dur = 1700;
    const step = now => {
      const k = clamp((now - t0) / dur, 0, 1);
      show(target * easeOut(k));
      if (k < 1) requestAnimationFrame(step);
    };
    show(0);
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------
     Cartões flutuantes do hero
  ------------------------------------------------------------------ */
  $$('[data-pop]').forEach((p, i) => setTimeout(() => p.classList.add('is-on'), reduced ? 0 : 1500 + i * 380));

  // Segure para marcar como pago
  const hold = $('[data-hold]');
  const holdLabel = hold && $('.hold-label', hold);
  const billChip = $('[data-bill-chip]');
  const payLight = $('[data-pay-light]');
  const rowLight = $('[data-row-light]');
  const paidTotal = $('[data-paid-total]');
  const leftTotal = $('[data-left-total]');
  const holdState = { p: 0, holding: false, auto: false, done: false, lastUser: 0 };
  function setHold(p) { holdState.p = p; hold.style.setProperty('--p', p.toFixed(3)); }
  function billPaid(paid) {
    holdState.done = paid;
    if (!paid) holdState.holding = false;
    setHold(paid ? 1 : 0);
    hold.classList.toggle('is-done', paid);
    holdLabel.textContent = paid ? 'Pago! Tartaruga feliz' : 'Segure para marcar como pago';
    billChip.className = 'chip ' + (paid ? 'chip--ok' : 'chip--wait');
    billChip.innerHTML = paid ? '<svg><use href="#i-check"/></svg><span>pago agora</span>' : '<svg><use href="#i-clock"/></svg><span>vence amanhã</span>';
    payLight.classList.toggle('is-paid', paid);
    $('span', payLight).textContent = paid ? 'Pago' : 'Pagar';
    $('small', rowLight).textContent = paid ? 'Moradia · pago hoje' : 'Moradia · vence amanhã';
    paidTotal.textContent = paid ? 'R$ 3.238' : 'R$ 3.096';
    leftTotal.textContent = paid ? 'R$ 1.142' : 'R$ 1.284';
    if (paid) { rowLight.classList.add('is-flash'); setTimeout(() => rowLight.classList.remove('is-flash'), 1200); }
  }
  if (hold) {
    const start = e => { e.preventDefault(); if (holdState.done) return; holdState.holding = true; holdState.lastUser = performance.now(); };
    const stop = () => { holdState.holding = false; };
    hold.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => hold.addEventListener(ev, stop));
    hold.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
    hold.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(); });
    hold.addEventListener('contextmenu', e => e.preventDefault());
  }
  function tickHold(dt) {
    if (!hold || holdState.done) return;
    const up = holdState.holding;
    let p = holdState.p + (up ? dt / 1100 : -dt / 500);
    p = clamp(p, 0, 1);
    setHold(p);
    if (p >= 1) {
      billPaid(true);
      setTimeout(() => billPaid(false), 4200);
    }
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const tween = (ms, fn) => new Promise(res => {
    const t0 = performance.now();
    const step = now => { const k = clamp((now - t0) / ms, 0, 1); fn(k); if (k < 1) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
  const press = el => { el.classList.add('is-pressed'); setTimeout(() => el.classList.toggle('is-pressed', false), 180); };
  const offsetIn = (el, root) => { let x = 0, y = 0, n = el; while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return [x, y]; };

  /* ------------------------------------------------------------------
     MacBook: a tampa abre, o Compasso liga e um cursor usa o app
  ------------------------------------------------------------------ */
  if (mac) {
    const ui = $('[data-mac-ui]');
    const app = $('[data-app]');
    const cursor = $('[data-cursor]');
    const tip = $('[data-tip]');
    const importBtn = $('.app-btn', app);
    const turtleCv = $('.app-hero__turtle canvas', app);
    const sheetBar = $('[data-sheet-bar]');
    const sheetStatus = $('[data-sheet-status]');
    const sheetSave = $('[data-sheet-save]');
    const rowInvoice = $('[data-row-invoice]');
    let opened = false, on = false, visible = false, looping = false;

    // Ponto de um elemento em coordenadas do app (1180 × 744), independente da escala
    const ptOf = (el, fx = 0.5, fy = 0.5) => {
      const [x, y] = offsetIn(el, ui);
      return [x + el.offsetWidth * fx, y + el.offsetHeight * fy];
    };
    const moveTo = ([x, y], ms = 1000) => {
      cursor.style.transitionDuration = ms + 'ms, .4s';
      cursor.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      return wait(ms + 60);
    };
    const click = async el => {
      cursor.classList.toggle('is-click', false); void cursor.offsetWidth; cursor.classList.add('is-click');
      if (el) press(el);
      await wait(240);
    };

    async function loop() {
      if (looping) return;
      looping = true;
      await wait(900);
      while (visible) {
        // 1. Marca a conta de luz como paga
        await moveTo(ptOf(payLight, 0.45, 0.55), 1200);
        await wait(250); await click(payLight); billPaid(true);
        await wait(1500);
        // 2. Passa na tartaruga e lê o humor do mês
        await moveTo(ptOf(turtleCv, 0.55, 0.7), 1100);
        tip.classList.add('is-on'); await wait(2600); tip.classList.toggle('is-on', false);
        // 3. Importa uma fatura
        await moveTo(ptOf(importBtn, 0.4, 0.55), 1000);
        await wait(200); await click(importBtn);
        app.dataset.sheet = '1'; await wait(1100);
        app.dataset.sheet = '2';
        await tween(2300, k => {
          sheetBar.style.setProperty('--p', k.toFixed(3));
          sheetStatus.textContent = k < 1 ? `Lendo lançamentos… ${Math.round(k * 38)} de 38` : 'Pronto · total R$ 1.284,90';
        });
        app.dataset.sheet = '3'; await wait(700);
        await moveTo(ptOf(sheetSave, 0.5, 0.55), 900);
        await click(sheetSave); await wait(250);
        app.dataset.sheet = '0';
        rowInvoice.classList.add('is-flash'); setTimeout(() => rowInvoice.classList.toggle('is-flash', false), 1300);
        sheetBar.style.setProperty('--p', '0');
        // 4. Descansa e recomeça
        await moveTo([1010, 640], 1300);
        await wait(1800);
        billPaid(false);
        await wait(700);
      }
      looping = false;
    }

    function powerOn() {
      if (opened) return;
      opened = true;
      mac.classList.toggle('is-closed', false);
      if (reduced) { mac.classList.add('is-on'); on = true; $$('[data-count]', app).forEach(el => countUp(el)); return; }
      setTimeout(() => mac.classList.add('is-booting'), 1100);
      setTimeout(() => {
        mac.classList.toggle('is-booting', false); mac.classList.add('is-on'); on = true;
        $$('[data-count]', app).forEach((el, i) => countUp(el, 300 + i * 90));
        if (visible) loop();
      }, 2700);
    }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { powerOn(); if (on && !reduced) loop(); }
    }, { threshold: 0.12 }).observe(mac);
  }

  /* ------------------------------------------------------------------
     Celular: a Dynamic Island lê a fatura, um toque paga a conta e chega um aviso
  ------------------------------------------------------------------ */
  const phone = $('[data-phone]');
  if (phone && !reduced) {
    const screen = $('[data-phone-screen]');
    const island = $('[data-island]');
    const islTitle = $('[data-isl-title]');
    const islSub = $('[data-isl-sub]');
    const banner = $('[data-banner]');
    const row = $('[data-ps-row]');
    const when = $('[data-ps-when]');
    const touch = $('[data-touch]');
    const bar = $('[data-ps-bar]');
    const paidTxt = $('[data-ps-paid]');
    const bal = $('[data-ps-bal]');
    let visible = false, looping = false, counted = false;
    const brl2 = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const setPaid = paid => {
      row.classList.toggle('is-paid', paid);
      when.textContent = paid ? 'pago agora' : 'amanhã';
      bar.style.setProperty('--w', paid ? '74%' : '71%');
      paidTxt.textContent = (paid ? '74' : '71') + '% das contas já pagas';
    };

    async function loop() {
      if (looping) return;
      looping = true;
      if (!counted) { counted = true; tween(1600, k => { bal.textContent = brl2(1820 * easeOut(k)); }); }
      while (visible) {
        await wait(1000);
        islTitle.textContent = 'Lendo fatura'; islSub.textContent = 'novembro · PDF';
        island.classList.add('is-open');
        await wait(500);
        await tween(2200, k => island.style.setProperty('--p', k.toFixed(3)));
        island.classList.add('is-done');
        islTitle.textContent = 'Fatura lida'; islSub.textContent = '38 lançamentos · total confere';
        await wait(1900);
        island.classList.toggle('is-open', false); island.classList.toggle('is-done', false);
        await wait(500);
        island.style.setProperty('--p', '0');
        await wait(700);
        // toque na conta de luz
        const [x, y] = offsetIn(row, screen);
        touch.style.setProperty('--tx', (x + row.offsetWidth * 0.55) + 'px');
        touch.style.setProperty('--ty', (y + row.offsetHeight * 0.5) + 'px');
        touch.classList.toggle('is-on', false); void touch.offsetWidth; touch.classList.add('is-on');
        row.classList.add('is-press');
        await wait(260);
        row.classList.toggle('is-press', false);
        setPaid(true);
        await wait(1800);
        banner.classList.add('is-on');
        await wait(3200);
        banner.classList.toggle('is-on', false);
        await wait(1500);
        setPaid(false);
      }
      looping = false;
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0.3 }).observe(phone);
  }

  // Fatura importada (laço)
  const invBar = $('[data-inv-bar]');
  const invStatus = $('[data-inv-status]');
  const invOk = $('[data-inv-ok]');
  let invT = 0;
  function tickInvoice(dt) {
    if (!invBar) return;
    invT = (invT + dt) % 8200;
    const read = clamp((invT - 600) / 2800, 0, 1);
    invBar.style.setProperty('--p', read.toFixed(3));
    if (read < 1) {
      invStatus.textContent = read === 0 ? 'Na fila…' : `Lendo lançamentos… ${Math.round(read * 38)} de 38`;
      invOk.classList.remove('is-on');
    } else {
      invStatus.textContent = 'Pronto · total R$ 1.284,90';
      invOk.classList.add('is-on');
    }
  }

  // Notificações empilhadas
  const pushes = $$('[data-pushes] .push');
  let pushOrder = pushes.map((_, i) => i);
  function layoutPushes() {
    pushOrder.forEach((idx, pos) => {
      const el = pushes[idx];
      el.style.zIndex = String(10 - pos);
      el.style.transform = `translateY(${pos * 11}px) scale(${1 - pos * 0.05})`;
      el.style.opacity = pos === 0 ? '1' : pos === 1 ? '.8' : '.5';
      el.classList.toggle('is-back', pos !== 0);
    });
  }
  if (pushes.length) {
    layoutPushes();
    if (!reduced) setInterval(() => {
      const front = pushes[pushOrder[0]];
      front.style.transform = 'translateY(-26px) scale(1.02)';
      front.style.opacity = '0';
      setTimeout(() => { pushOrder.push(pushOrder.shift()); layoutPushes(); }, 420);
    }, 3600);
  }

  /* ------------------------------------------------------------------
     Calendário (novembro de 2026 começa num domingo)
  ------------------------------------------------------------------ */
  const cal = $('[data-cal]');
  if (cal) {
    const due = new Set([5, 10, 21, 25, 28]);
    let html = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<span class="is-empty">${d}</span>`).join('');
    for (let d = 1; d <= 30; d++) {
      const cls = [due.has(d) ? 'is-due' : '', d === 20 ? 'is-today' : '', d === 21 ? 'ping' : ''].filter(Boolean).join(' ');
      html += `<span class="${cls}">${d}</span>`;
    }
    cal.innerHTML = html;
  }

  /* ------------------------------------------------------------------
     Brilho que segue o cursor nos cartões
  ------------------------------------------------------------------ */
  $$('[data-spot]').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  /* ------------------------------------------------------------------
     Simulação do humor da tartaruga
  ------------------------------------------------------------------ */
  const spend = $('[data-spend]');
  if (spend) {
    const income = 6200;
    const pond = $('[data-pond-water]');
    const pt = $('[data-pond-turtle]')._turtle;
    const out = { spend: $('[data-spend-out]'), bal: $('[data-balance-out]'), slack: $('[data-slack-out]'), msg: $('[data-pond-msg]'), status: $('[data-pond-status]') };
    const MSG = {
      calm: ['Calma', 'Mês tranquilo. Que tal mandar parte da sobra para a reserva?'],
      alert: ['Atenta', 'Apertou. Revise os gastos flexíveis antes do fim do mês.'],
      stress: ['Aflita', 'As despesas passaram da receita. Hora de adiar o que não é essencial.'],
    };
    const update = () => {
      const v = +spend.value;
      const bal = income - v;
      const slack = bal / income;
      const mood = slack >= 0.15 ? 'calm' : slack >= 0 ? 'alert' : 'stress';
      out.spend.textContent = money(v);
      out.bal.innerHTML = '<span class="cur">' + (bal < 0 ? '−R$' : 'R$') + '</span>' + Math.abs(bal).toLocaleString('pt-BR');
      out.slack.textContent = Math.round(slack * 100) + '%';
      out.status.innerHTML = '<i></i>' + MSG[mood][0];
      out.msg.textContent = MSG[mood][1];
      pond.classList.toggle('is-alert', mood === 'alert');
      pond.classList.toggle('is-stress', mood === 'stress');
      setMood(pt, mood);
      $$('[data-mood-li]').forEach(li => li.classList.toggle('is-on', li.dataset.moodLi === mood));
      const fill = (v - spend.min) / (spend.max - spend.min) * 100;
      spend.style.setProperty('--fill', fill + '%');
    };
    spend.addEventListener('input', update);
    update();
  }

  /* ------------------------------------------------------------------
     Leitura de fatura (sequência em laço quando visível)
  ------------------------------------------------------------------ */
  const imp = $('[data-imp]');
  if (imp) {
    const STEPS = [2400, 1700, 3000, 1700, 2800];
    const rail = $$('[data-rail] li');
    const label = $('[data-imp-label]');
    const drop = $('[data-imp-drop]');
    const items = $$('.imp-list li', imp);
    const docLines = $$('.doc-lines p', imp);
    const count = $('[data-imp-count]');
    let step = 0, timers = [], running = false;
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    function go(n) {
      step = n;
      imp.dataset.step = String(n);
      label.textContent = `Passo ${n} de 5`;
      rail.forEach((li, i) => {
        li.classList.toggle('is-done', i < n - 1);
        li.classList.toggle('is-now', i === n - 1);
        li.style.setProperty('--dur', STEPS[i] + 'ms');
      });
      if (n === 1) {
        items.forEach(li => li.classList.remove('is-on'));
        docLines.forEach(p => p.classList.remove('is-read'));
        count.textContent = '0 de 6';
        drop.classList.remove('is-hover');
        later(() => drop.classList.add('is-hover'), 900);
      }
      if (n === 3) {
        items.forEach((li, i) => later(() => {
          li.classList.add('is-on');
          docLines[i] && docLines[i].classList.add('is-read');
          count.textContent = `${i + 1} de 6`;
        }, 300 + i * 400));
      }
      later(() => go(n === 5 ? 1 : n + 1), STEPS[n - 1]);
    }
    if (reduced) {
      imp.dataset.step = '5'; items.forEach(li => li.classList.add('is-on')); count.textContent = '6 de 6'; label.textContent = 'Passo 5 de 5';
      rail.forEach(li => li.classList.add('is-done'));
    } else {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !running) { running = true; go(1); }
        else if (!e.isIntersecting && running) { running = false; clear(); }
      }, { threshold: 0.35 }).observe(imp);
    }
  }

  /* ------------------------------------------------------------------
     Trilha da academia
  ------------------------------------------------------------------ */
  const trail = $('[data-trail]');
  const trailSvg = trail && $('.trail-path', trail);
  const trailBase = trail && $('.trail-base', trail);
  const trailDone = trail && $('.trail-done', trail);
  const trailTurtle = trail && $('[data-trail-turtle]', trail);
  const courses = trail ? $$('[data-course]', trail) : [];
  let trailLen = 0, trailStops = [];

  function layoutTrail() {
    if (!trail) return;
    const cols = getComputedStyle(trail).gridTemplateColumns.split(' ').length;
    // Caminho em serpentina: em 3 colunas a segunda linha volta da direita para a esquerda
    courses.forEach((c, i) => {
      c.style.gridColumn = ''; c.style.gridRow = '';
      if (cols === 3 && i >= 3) { c.style.gridRow = '2'; c.style.gridColumn = String(3 - (i - 3)); }
      if (cols === 2) {
        const row = Math.floor(i / 2), pos = i % 2;
        c.style.gridRow = String(row + 1);
        c.style.gridColumn = String(row % 2 === 0 ? pos + 1 : 2 - pos);
      }
    });
    const tr = trail.getBoundingClientRect();
    const pts = courses.map(c => {
      const r = c.getBoundingClientRect();
      return [r.left - tr.left + r.width / 2, r.top - tr.top + r.height / 2];
    });
    perches = courses.map(c => {
      const r = c.getBoundingClientRect();
      return [r.left - tr.left + r.width * 0.62, r.top - tr.top];
    });
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (Math.abs(y1 - y0) < 4) d += ` C ${lerp(x0, x1, 0.35)} ${y0 - 40}, ${lerp(x0, x1, 0.65)} ${y1 + 40}, ${x1} ${y1}`;
      else d += ` C ${x0} ${lerp(y0, y1, 0.7)}, ${x1} ${lerp(y0, y1, 0.3)}, ${x1} ${y1}`;
    }
    trailSvg.setAttribute('viewBox', `0 0 ${tr.width} ${tr.height}`);
    trailBase.setAttribute('d', d);
    trailDone.setAttribute('d', d);
    trailLen = trailDone.getTotalLength();
    trailDone.style.strokeDasharray = `${trailLen} ${trailLen}`;
    // fração do caminho em que cada curso é alcançado
    trailStops = pts.map(([x, y]) => {
      let best = 0, bestD = Infinity;
      for (let l = 0; l <= trailLen; l += trailLen / 200) {
        const q = trailDone.getPointAtLength(l);
        const dd = (q.x - x) ** 2 + (q.y - y) ** 2;
        if (dd < bestD) { bestD = dd; best = l; }
      }
      return best / trailLen;
    });
    updateTrail();
  }
  // A tartaruga pousa na borda de cima de cada curso e salta para o próximo
  let perches = [];
  function updateTrail() {
    if (!trail || !trailLen) return;
    const r = trail.getBoundingClientRect();
    const prog = clamp((innerHeight * 0.7 - r.top) / (r.height * 0.9), 0, 1);
    const n = courses.length;
    const f = prog * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const t = smooth(0, 1, f - i);
    // linha acompanha o mesmo ritmo dos saltos
    const lineProg = lerp(trailStops[i], trailStops[i + 1], t);
    trailDone.style.strokeDashoffset = String(trailLen * (1 - lineProg));
    if (perches.length === n) {
      const [x0, y0] = perches[i], [x1, y1] = perches[i + 1];
      const x = lerp(x0, x1, t);
      const y = lerp(y0, y1, t) - Math.sin(Math.PI * t) * 54;
      const dir = x1 < x0 - 1 ? -1 : x1 > x0 + 1 ? 1 : (trailTurtle._dir || 1);
      trailTurtle._dir = dir;
      trailTurtle.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, calc(-100% + 5px)) scaleX(${dir})`;
    }
    courses.forEach((c, k) => c.classList.toggle('is-reached', f >= k - 0.02));
  }

  /* ------------------------------------------------------------------
     Preços: mensal × anual
  ------------------------------------------------------------------ */
  const priceEl = $('[data-price]');
  const priceOld = $('[data-price-old]');
  const priceNote = $('[data-price-note]');
  $$('[data-period]').forEach(btn => btn.addEventListener('click', () => {
    $$('[data-period]').forEach(b => b.classList.toggle('is-on', b === btn));
    const yearly = btn.dataset.period === 'y';
    priceEl.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    priceEl.textContent = yearly ? 'R$ 16,58' : 'R$ 19,90';
    priceOld.hidden = !yearly;
    priceNote.innerHTML = yearly ? 'R$ 199 por ano. <b>Economize R$ 39,80.</b>' : 'Cobrado mês a mês. Cancele quando quiser.';
  }));

  /* ------------------------------------------------------------------
     Laço principal
  ------------------------------------------------------------------ */
  let last = performance.now(), skyAcc = 0;
  function loop(now) {
    const dt = Math.min(64, now - last);
    last = now;
    tickTurtles(now);
    tickHold(dt);
    tickInvoice(dt);
    skyAcc += dt;
    if (skyAcc >= 33) { drawSky(now); skyAcc = 0; }
    requestAnimationFrame(loop);
  }

  function onResize() { resizeSky(); fitWin(); layoutTrail(); onScroll(); drawSky(performance.now()); }
  addEventListener('resize', () => { clearTimeout(onResize._t); onResize._t = setTimeout(onResize, 120); });
  addEventListener('scroll', () => { onScroll(); if (reduced) drawSky(performance.now()); }, { passive: true });
  resizeSky(); fitWin(); onScroll();
  // A trilha depende das fontes carregadas para medir os cartões
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fitWin(); layoutTrail(); });
  addEventListener('load', layoutTrail);
  drawSky(performance.now());
  if (reduced) { turtles.forEach(drawTurtle); }
  else requestAnimationFrame(loop);
})();
