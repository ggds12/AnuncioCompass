/* Compasso · página de vendas
   - Hero com uma tartaruga em 3D cujo casco (a reserva) protege dos imprevistos
   - MacBook (computador) e iPhone (celular) usando o app sozinhos
   - Simulação do saldo projetado, leitura de fatura e trilha da Academy
   Sem dependências. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
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
     Revelação na rolagem (desfoque → foco)
  ------------------------------------------------------------------ */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      setTimeout(() => e.target.classList.add('is-done'), 1400 + (parseInt(e.target.style.getPropertyValue('--rd')) || 0));
      $$('[data-split]', e.target).forEach(s => s.classList.add('is-split-in'));
      if (e.target.matches('[data-split]')) e.target.classList.add('is-split-in');
      $$('[data-count]', e.target).forEach(el => { if (!el.closest('[data-mac]')) countUp(el); });
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    const i = sibs.indexOf(el);
    if (sibs.length > 1 && i > 0) el.style.setProperty('--rd', Math.min(i, 4) * 110 + 'ms');
  });
  $$('.reveal').forEach(el => revealIO.observe(el));

  /* ------------------------------------------------------------------
     Carrossel de bancos: duplica a lista para o laço não ter emenda
  ------------------------------------------------------------------ */
  // Repete o conjunto até cobrir a tela e duplica o grupo: o laço desliza
  // exatamente meio trilho, então nunca sobra espaço vazio.
  const marquees = $$('[data-marquee]').map(track => ({ track, base: [...track.children] }));
  function fillMarquees() {
    marquees.forEach(({ track, base }) => {
      track.textContent = '';
      base.forEach(li => track.appendChild(li));
      const setW = track.getBoundingClientRect().width || 1;
      const sets = Math.max(1, Math.ceil((innerWidth + 120) / setW));
      for (let k = 1; k < sets; k++) base.forEach(li => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
      [...track.children].forEach(li => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
      track.style.setProperty('--dur', (setW * sets / 42).toFixed(1) + 's');
    });
  }
  fillMarquees();

  /* ------------------------------------------------------------------
     Cabeçalho: escurece sobre fundo claro e se esconde ao descer
  ------------------------------------------------------------------ */
  const nav = $('[data-nav]');
  const hero = $('.hero');
  let lastY = scrollY;
  function onScroll() {
    const y = scrollY;
    nav.classList.toggle('is-light', y > hero.offsetHeight - 80);
    nav.classList.toggle('is-hidden', y > 600 && y > lastY + 4);
    if (y < lastY - 4 || y < 600) nav.classList.remove('is-hidden');
    lastY = y;
    updateAcad();
    tiltMac();
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

  /* Teclado do MacBook (larguras em unidades de tecla; cada linha soma 15) */
  const keys = $('[data-keys]');
  if (keys) {
    const one = str => str.split(' ').map(l => [1, l]);
    const rows = [
      [[1.5, 'esc', 'm'], ...Array(12).fill([1, '']), [1.5, '', 'tid']],
      [...one("' 1 2 3 4 5 6 7 8 9 0 - ="), [2, 'delete', 'm r']],
      [[1.5, 'tab', 'm'], ...one('Q W E R T Y U I O P ´ ['), [1.5, '', 'ret']],
      [[1.8, 'caps lock', 'm'], ...one('A S D F G H J K L Ç ~'), [2.2, 'return', 'm r']],
      [[2.35, 'shift', 'm'], ...one('Z X C V B N M , . ;'), [2.65, 'shift', 'm r']],
      [[1, 'fn', 'm'], [1, 'control', 'm s'], [1, 'option', 'm s'], [1.25, 'command', 'm s'], [5.5, ''], [1.25, 'command', 'm s'], [1, 'option', 'm s'], 'arrows']
    ];
    const key = ([w, l, c = '']) => `<i class="${c}" style="flex:${w}">${l ? `<b>${l}</b>` : ''}</i>`;
    keys.innerHTML = rows.map((r, i) => `<div class="kr${i ? '' : ' kr--fn'}">` + r.map(k => k === 'arrows'
      ? '<span class="k-arrows" style="flex:3"><i><b>◀</b></i><span><i><b>▲</b></i><i><b>▼</b></i></span><i><b>▶</b></i></span>'
      : key(k)).join('') + '</div>').join('');
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
    holdLabel.textContent = paid ? 'Pago! Saldo atualizado' : 'Segure para marcar como pago';
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
    const turtleCv = $('.app-hero__turtle', app);
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
     Hero: o casco
     Uma tartaruga marinha gigante, vista de cima, nada atrás do título.
     - O casco é feito de placas de vidro que voam e se encaixam ao
       carregar: a reserva sendo montada.
     - As nadadeiras remam, o corpo inclina, o plâncton passa (ela avança).
     - De tempos em tempos um imprevisto bate no casco: a onda de luz
       corre pelas placas e um aviso mostra que a reserva cobriu.
     - O mouse inclina a cena; ao rolar, ela nada para cima e some.
  ------------------------------------------------------------------ */
  const hero3d = (() => {
    const cv = $('[data-hero3d]');
    const api = { resize() {} };
    if (!cv) return api;
    const ctx = cv.getContext('2d');
    const heroEl = cv.parentElement;
    const copy = $('.hero-copy', heroEl);
    const toast = $('[data-shield-toast]');
    const toastName = $('[data-st-name]'), toastVal = $('[data-st-val]');
    const EVENTS = [['Conserto do carro', 'R$ 640'], ['Dentista', 'R$ 380'], ['Geladeira nova', 'R$ 1.290'], ['Pneu furado', 'R$ 260'], ['Remédio', 'R$ 120']];
    const A = 1, B = 1.22, HH = 0.46, IN = 0.8; // semi-eixos do casco, altura e anel das placas da borda
    const T0 = performance.now();
    let W = 0, H = 0, dpr = 1, small = false, visible = true, running = false;
    let S = 300, cx = 0, cy = 0, yaw = 0, pitch = 0.55, roll = 0;
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    let cells = [], plankton = [];
    let impact = null, nextImpact = 3200, evI = 0, side = 1;

    const domeY = (x, z) => {
      const e = (x / A) ** 2 + (z / B) ** 2;
      return HH * Math.pow(Math.max(0, 1 - e), 0.62);
    };
    const rnd = (a, b) => a + Math.random() * (b - a);

    function makeCell(poly, rim) {
      // centro, leve recuo para abrir a junta entre as placas, e arestas subdivididas para curvar com o domo
      const c = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
      const shrink = rim ? 0.9 : 0.9;
      const pts = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        for (let s = 0; s < 4; s++) {
          let x = lerp(p[0], q[0], s / 4), z = lerp(p[1], q[1], s / 4);
          x = c[0] + (x - c[0]) * shrink; z = c[1] + (z - c[1]) * shrink;
          pts.push([x, domeY(x, z) + 0.012, z]);
        }
      }
      const cyy = domeY(c[0], c[1]);
      const n = [c[0] / (A * A), cyy / (HH * HH) * 0.35 + 0.4, c[1] / (B * B)];
      const nl = Math.hypot(...n);
      const e = Math.hypot(c[0] / A, c[1] / B);
      return {
        pts, c: [c[0], cyy, c[1]], n: n.map(v => v / nl), rim,
        delay: 0.15 + e * 0.9 + Math.random() * 0.35,
        from: [rnd(-2.4, 2.4), rnd(1.2, 3.2), rnd(-2, 2.6)],
        spin: rnd(-1.4, 1.4),
      };
    }

    function build() {
      cells = [];
      const r = 0.25, dx = 1.5 * r, dz = Math.sqrt(3) * r, full = 2.598 * r * r;
      for (let i = -4; i <= 4; i++) for (let j = -6; j <= 6; j++) {
        const x = i * dx, z = (j + (Math.abs(i) % 2 ? 0.5 : 0)) * dz;
        if (Math.hypot(x / (IN * A), z / (IN * B)) > 1.12) continue;
        const poly = [];
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3;
          let vx = x + r * Math.cos(a), vz = z + r * Math.sin(a);
          const e = Math.hypot(vx / (IN * A), vz / (IN * B));
          if (e > 1) { vx /= e; vz /= e; }
          poly.push([vx, vz]);
        }
        let area = 0;
        for (let k = 0; k < 6; k++) { const p = poly[k], q = poly[(k + 1) % 6]; area += p[0] * q[1] - q[0] * p[1]; }
        if (Math.abs(area / 2) < full * 0.28) continue;
        cells.push(makeCell(poly, false));
      }
      const N = small ? 26 : 34;
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
        cells.push(makeCell([
          [IN * A * Math.cos(a0), IN * B * Math.sin(a0)], [A * Math.cos(a0), B * Math.sin(a0)],
          [A * Math.cos(a1), B * Math.sin(a1)], [IN * A * Math.cos(a1), IN * B * Math.sin(a1)],
        ], true));
      }
      plankton = Array.from({ length: small ? 70 : 150 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.2, 1), s: rnd(0.6, 1.8) }));
    }

    function resize() {
      const r = cv.getBoundingClientRect();
      small = innerWidth < 760;
      dpr = Math.min(devicePixelRatio || 1, small ? 2 : 1.6);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    api.resize = resize;

    // mundo da tartaruga (x direita, y para cima, z para a cabeça) → tela
    function proj(x, y, z) {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const x2 = x1 * cr - y * sr, y2 = x1 * sr + y * cr;
      const up = z1 * Math.cos(pitch) + y2 * Math.sin(pitch);
      const depth = y2 * Math.cos(pitch) - z1 * Math.sin(pitch);
      const k = 7.5 / (7.5 - depth);
      return [cx + x2 * S * k, cy - up * S * k, depth];
    }
    const poly2d = pts => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); };

    // contorno de uma nadadeira no plano xz, girado no ombro
    const FRONT = [[0, 0.12], [-0.3, 0.2], [-0.7, 0.16], [-1.05, 0.02], [-1.32, -0.2], [-1.12, -0.2], [-0.72, -0.14], [-0.34, -0.12], [0, -0.12]];
    const REAR = [[0, 0.08], [-0.17, 0.06], [-0.32, -0.06], [-0.34, -0.24], [-0.19, -0.17], [0, -0.08]];
    function limb(shape, sx, ox, oz, ang, lift, sweepY) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      return shape.map(([x, z]) => {
        const rx = x * ca - z * sa, rz = x * sa + z * ca;
        const reach = -x;
        return proj(ox + rx * sx, sweepY + reach * lift, oz + rz);
      });
    }

    function draw(now) {
      const t = (now - T0) / 1000;
      mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
      const sp = clamp(scrollY / 800, 0, 1);
      ctx.clearRect(0, 0, W, H);

      /* plâncton passando: a tartaruga avança */
      for (const p of plankton) {
        const y = ((p.y + (reduced ? 0 : t * 0.018 * p.z)) % 1) * H;
        const x = p.x * W + mx * 30 * p.z;
        ctx.fillStyle = `rgba(200,215,245,${(0.06 + p.z * 0.3).toFixed(3)})`;
        const s = p.s * p.z * 1.6;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }

      /* posição e pose */
      const copyMid = copy ? copy.offsetTop + copy.offsetHeight * 0.5 : H * 0.35;
      S = (small ? Math.min(W * 0.4, 190) : Math.min(W * 0.19, 278)) * (1 - sp * 0.12);
      cx = W / 2 + mx * 16;
      cy = copyMid + (small ? 40 : 62) - sp * 220 + Math.sin(t * 0.9) * 5;
      const stroke = t * 1.15; // ritmo da remada
      yaw = Math.sin(t * 0.23) * 0.1 + mx * 0.28;
      pitch = 0.4 + my * 0.1;
      roll = Math.sin(stroke) * 0.035;
      const fade = 1 - sp * 0.6;
      const built = reduced ? 1 : clamp((t - 1.3) / 1.2, 0, 1); // cabeça e nadadeiras aparecem depois do casco

      /* sombra no fundo */
      const sh = proj(0, -0.35, -0.1);
      const g0 = ctx.createRadialGradient(sh[0], sh[1] + S * 0.25, 0, sh[0], sh[1] + S * 0.25, S * 1.6);
      g0.addColorStop(0, `rgba(91,128,192,${(0.18 * fade).toFixed(3)})`); g0.addColorStop(1, 'rgba(91,128,192,0)');
      ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);

      const limbFill = `rgba(180,205,245,${(0.06 * built * fade).toFixed(3)})`;
      const limbLine = `rgba(225,235,255,${(0.3 * built * fade).toFixed(3)})`;
      const drawLimb = pts => { poly2d(pts); ctx.fillStyle = limbFill; ctx.fill(); ctx.strokeStyle = limbLine; ctx.lineWidth = 1.1; ctx.stroke(); };

      if (built > 0) {
        /* nadadeiras traseiras e cauda */
        const rs = Math.sin(stroke + 1.2) * 0.25;
        drawLimb(limb(REAR, 1, -0.56, -0.92, 0.5 + rs, 0.04, 0.02));
        drawLimb(limb(REAR, -1, 0.56, -0.92, 0.5 + rs, 0.04, 0.02));
        drawLimb([proj(-0.09, 0.03, -B + 0.02), proj(0, 0.02, -B - 0.24), proj(0.09, 0.03, -B + 0.02)]);
        /* nadadeiras dianteiras: remada larga, com a ponta subindo e descendo */
        const fs = Math.sin(stroke) * 0.55, fl = Math.cos(stroke) * 0.22;
        drawLimb(limb(FRONT, 1, -0.7, 0.6, -0.05 + fs, fl, 0.03));
        drawLimb(limb(FRONT, -1, 0.7, 0.6, -0.05 + fs, fl, 0.03));
        /* cabeça */
        const head = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const hx = Math.cos(a) * 0.23, hz = B + 0.2 + Math.sin(a) * 0.3;
          head.push(proj(hx, 0.1 + 0.06 * Math.max(0, Math.sin(a)), hz));
        }
        drawLimb(head);
        [-1, 1].forEach(s => {
          const e = proj(s * 0.13, 0.17, B + 0.33);
          ctx.fillStyle = `rgba(255,255,255,${(0.85 * built * fade).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(e[0], e[1], Math.max(1.4, S * 0.009), 0, 6.29); ctx.fill();
        });
      }

      /* imprevistos: vêm de lado, batem no casco e voltam */
      let ripple = null;
      if (!reduced && t * 1000 > nextImpact && !impact && built >= 1) {
        side = -side;
        const a = side > 0 ? -0.12 : Math.PI + 0.12;
        impact = { t0: t, side, lx: A * 0.86 * Math.cos(a), lz: B * 0.86 * Math.sin(a), ev: EVENTS[evI++ % EVENTS.length], shown: false };
      }
      if (impact) {
        const k = t - impact.t0;
        const hit = proj(impact.lx, domeY(impact.lx, impact.lz) + 0.05, impact.lz);
        const IN_T = 1.0;
        let px, py, al;
        const sx0 = hit[0] + impact.side * Math.min(W * 0.5, 700), sy0 = hit[1] - 60;
        if (k < IN_T) {
          const e = k / IN_T, ee = e * e;
          px = lerp(sx0, hit[0], ee); py = lerp(sy0, hit[1], ee); al = Math.min(1, e * 3);
        } else {
          const e = (k - IN_T) / 1.1;
          px = hit[0] + impact.side * e * 300; py = hit[1] - Math.sin(e * Math.PI * 0.5) * 90; al = Math.max(0, 1 - e);
          ripple = { lx: impact.lx, lz: impact.lz, k: k - IN_T };
          if (!impact.shown && toast) {
            impact.shown = true;
            toastName.textContent = impact.ev[0]; toastVal.textContent = impact.ev[1];
            const tx = clamp(hit[0] + impact.side * Math.min(250, W * 0.17), 140, W - 140);
            toast.style.left = tx + 'px'; toast.style.top = (hit[1] + 40) + 'px';
            toast.classList.add('is-on');
            setTimeout(() => toast.classList.remove('is-on'), 2600);
          }
        }
        if (al > 0) {
          // cometa com rastro
          const dxv = k < IN_T ? hit[0] - sx0 : impact.side, dyv = k < IN_T ? hit[1] - sy0 : -1;
          const dl = Math.hypot(dxv, dyv) || 1;
          for (let j = 10; j >= 0; j--) {
            const qx = px - (dxv / dl) * j * 6, qy = py - (dyv / dl) * j * 6;
            const a2 = al * (1 - j / 11);
            ctx.fillStyle = j === 0 ? `rgba(255,255,255,${a2.toFixed(3)})` : `rgba(180,205,245,${(a2 * 0.5).toFixed(3)})`;
            const s = j === 0 ? 4 : 2;
            ctx.fillRect(qx - s / 2, qy - s / 2, s, s);
          }
          const g = ctx.createRadialGradient(px, py, 0, px, py, 18);
          g.addColorStop(0, `rgba(180,205,245,${(0.5 * al).toFixed(3)})`); g.addColorStop(1, 'rgba(180,205,245,0)');
          ctx.fillStyle = g; ctx.fillRect(px - 18, py - 18, 36, 36);
        }
        if (k > IN_T + 2) { impact = null; nextImpact = t * 1000 + 2600; }
      }

      /* o casco: placas em ordem de profundidade */
      const sweep = ((t * 0.32) % 3.4) - 1.7;
      const L = [-0.35, 0.85, 0.4]; // luz vinda de cima, à esquerda e à frente
      const list = cells.map(c => {
        const q = reduced ? 1 : easeOut(clamp((t - c.delay) / 1.25, 0, 1));
        const off = 1 - q;
        const ang = c.spin * off;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const pts = c.pts.map(([x, y, z]) => {
          const lx = x - c.c[0], lz = z - c.c[2];
          const rx = lx * ca - lz * sa, rz = lx * sa + lz * ca;
          return proj(c.c[0] + rx + c.from[0] * off, y + c.from[1] * off, c.c[2] + rz + c.from[2] * off);
        });
        const d = proj(c.c[0], c.c[1], c.c[2])[2];
        return { c, q, pts, d };
      }).sort((a, b) => a.d - b.d);

      for (const { c, q, pts } of list) {
        if (q <= 0) continue;
        const lit = clamp(c.n[0] * L[0] + c.n[1] * L[1] + c.n[2] * L[2], 0, 1);
        let glow = Math.exp(-((c.c[2] - sweep) ** 2) / 0.04) * 0.5;
        if (ripple) {
          const dist = Math.hypot(c.c[0] - ripple.lx, c.c[2] - ripple.lz);
          glow += Math.exp(-((dist - ripple.k * 1.7) ** 2) / 0.03) * Math.max(0, 1 - ripple.k / 1.5) * 1.2;
        }
        const a = q * fade;
        poly2d(pts);
        const gx = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[pts.length >> 1][0], pts[pts.length >> 1][1]);
        gx.addColorStop(0, `rgba(190,212,250,${((0.035 + lit * 0.1 + glow * 0.2) * a).toFixed(3)})`);
        gx.addColorStop(1, `rgba(120,150,210,${((0.01 + lit * 0.04 + glow * 0.1) * a).toFixed(3)})`);
        ctx.fillStyle = gx; ctx.fill();
        ctx.strokeStyle = `rgba(235,242,255,${(((c.rim ? 0.1 : 0.16) + lit * 0.3 + glow * 0.6) * a).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function loop(now) {
      if (!visible) { running = false; return; }
      draw(now);
      requestAnimationFrame(loop);
    }
    resize();
    if (reduced) { draw(performance.now()); return api; }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !running) { running = true; requestAnimationFrame(loop); }
    }).observe(cv);
    heroEl.addEventListener('pointermove', e => {
      const r = heroEl.getBoundingClientRect();
      tmx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      tmy = ((e.clientY - r.top) / Math.min(r.height, innerHeight) - 0.5) * 2;
      heroEl.style.setProperty('--gx', (e.clientX - r.left) + 'px');
      heroEl.style.setProperty('--gy', (e.clientY - r.top) + 'px');
    });
    addEventListener('load', resize);
    return api;
  })();

  /* MacBook: chega inclinado e se endireita conforme a rolagem */
  function tiltMac() {
    if (!mac || reduced || !mac.offsetParent) return;
    const r = mac.getBoundingClientRect();
    const p = clamp((innerHeight - r.top) / (innerHeight * 0.85), 0, 1);
    const e = easeOut(p);
    mac.style.setProperty('--tilt', ((1 - e) * 24).toFixed(2) + 'deg');
    mac.style.setProperty('--sc', (0.9 + e * 0.1).toFixed(3));
  }

  /* ------------------------------------------------------------------
     Saldo projetado: medidor, gráfico do mês e mensagens
  ------------------------------------------------------------------ */
  const spend = $('[data-spend]');
  if (spend) {
    const income = 6200;
    const sim = $('[data-sim]');
    const gauge = $('[data-gauge]');
    const line = $('[data-sc-line]'), area = $('[data-sc-area]'), zero = $('[data-sc-zero]'), dot = $('[data-sc-dot]');
    const out = { spend: $('[data-spend-out]'), bal: $('[data-balance-out]'), slack: $('[data-slack-out]'), save: $('[data-save-out]'), msg: $('[data-sim-msg]'), pill: $('[data-mood-pill]') };
    const MSG = {
      calm: ['Calma', 'Mês tranquilo. Que tal mandar parte da sobra para a reserva?'],
      alert: ['Atenção', 'Apertou. Revise os gastos flexíveis antes do fim do mês.'],
      stress: ['Alerta', 'As despesas passaram da receita. Hora de adiar o que não é essencial.'],
    };
    // Como as despesas saem ao longo do mês: contas fixas em dias marcados e o resto espalhado
    const BILLS = [[5, 0.31], [10, 0.21], [15, 0.12], [20, 0.1], [25, 0.08]];
    const SPREAD = 1 - BILLS.reduce((a, b) => a + b[1], 0);
    const W = 300, H = 100, TOP = 8, BOT = 92, MIN = -1800, MAX = income;
    const yOf = v => lerp(BOT, TOP, (v - MIN) / (MAX - MIN));
    const update = () => {
      const v = +spend.value;
      const bal = income - v;
      const slack = bal / income;
      const mood = slack >= 0.15 ? 'calm' : slack >= 0 ? 'alert' : 'stress';
      out.spend.textContent = money(v);
      out.bal.textContent = money(bal);
      out.slack.textContent = Math.round(slack * 100) + '%';
      out.save.textContent = money(Math.max(0, Math.round(bal * 0.4 / 10) * 10));
      out.pill.innerHTML = '<i></i>' + MSG[mood][0];
      out.msg.textContent = MSG[mood][1];
      sim.classList.toggle('is-alert', mood === 'alert');
      sim.classList.toggle('is-stress', mood === 'stress');
      $$('[data-mood-li]').forEach(li => li.classList.toggle('is-on', li.dataset.moodLi === mood));
      gauge.style.setProperty('--g', (clamp((slack + 0.2) / 0.6, 0.02, 1) * 100).toFixed(1));
      // saldo dia a dia
      let b = income, d = '';
      const pts = [];
      for (let day = 1; day <= 30; day++) {
        b -= v * SPREAD / 30;
        BILLS.forEach(([bd, share]) => { if (bd === day) b -= v * share; });
        pts.push([(day - 1) / 29 * W, yOf(b)]);
      }
      d = 'M ' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ');
      line.setAttribute('d', d);
      area.setAttribute('d', d + ` L ${W} ${BOT} L 0 ${BOT} Z`);
      const zy = yOf(0).toFixed(1);
      zero.setAttribute('y1', zy); zero.setAttribute('y2', zy);
      const last = pts[pts.length - 1];
      dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1].toFixed(1));
      const fill = (v - spend.min) / (spend.max - spend.min) * 100;
      spend.style.setProperty('--fill', fill + '%');
    };
    spend.addEventListener('input', update);
    update();
  }

  /* ------------------------------------------------------------------
     Academy: linha de progresso acompanha a rolagem
  ------------------------------------------------------------------ */
  const acad = $('[data-acad]');
  const acadFill = $('[data-acad-fill]');
  function updateAcad() {
    if (!acad) return;
    const r = acad.getBoundingClientRect();
    const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.2), 0, 1);
    acadFill.style.setProperty('--p', p.toFixed(3));
  }

  /* ------------------------------------------------------------------
     Preços: mensal × anual, com a pílula de vidro deslizando
  ------------------------------------------------------------------ */
  const period = $('.period');
  const thumb = $('.period-thumb');
  const priceEl = $('[data-price]');
  const priceOld = $('[data-price-old]');
  const priceNote = $('[data-price-note]');
  const placeThumb = () => {
    const on = $('[data-period].is-on', period);
    if (!on) return;
    thumb.style.setProperty('--tx', on.offsetLeft + 'px');
    thumb.style.setProperty('--tw', on.offsetWidth + 'px');
  };
  $$('[data-period]').forEach(btn => btn.addEventListener('click', () => {
    $$('[data-period]').forEach(b => b.classList.toggle('is-on', b === btn));
    placeThumb();
    const yearly = btn.dataset.period === 'y';
    priceEl.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    priceEl.textContent = yearly ? 'R$ 16,58' : 'R$ 19,90';
    priceOld.hidden = !yearly;
    priceNote.innerHTML = yearly ? 'R$ 199 por ano. <b>Economize R$ 39,80.</b>' : 'Cobrado mês a mês. Cancele quando quiser.';
  }));

  /* ------------------------------------------------------------------
     Laço principal
  ------------------------------------------------------------------ */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(64, now - last);
    last = now;
    tickHold(dt);
    tickInvoice(dt);
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
     Alto mar: o 3D do fim da página só carrega quando a pessoa chega perto
  ------------------------------------------------------------------ */
  const oceanEl = $('[data-ocean]');
  if (oceanEl && 'IntersectionObserver' in window) {
    const oceanIO = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      oceanIO.disconnect();
      const load = src => new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      load('vendor/three.min.js').then(() => load('ocean.js')).catch(() => {});
    }, { rootMargin: '900px 0px' });
    oceanIO.observe(oceanEl);
  }

  function onResize() { fitWin(); placeThumb(); fillMarquees(); hero3d.resize(); onScroll(); }
  addEventListener('resize', () => { clearTimeout(onResize._t); onResize._t = setTimeout(onResize, 120); });
  addEventListener('scroll', onScroll, { passive: true });
  fitWin(); placeThumb(); onScroll();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fitWin(); placeThumb(); fillMarquees(); });
  if (!reduced) requestAnimationFrame(frame);
  else tickInvoice(4000);
})();
