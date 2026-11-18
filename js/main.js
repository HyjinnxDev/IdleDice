import * as G from './game.js';
import { load, save, exportSave, importSave, wipe } from './save.js';
import { renderHilo, hiloAct, hiloSig } from './hilo.js';

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// cube rotation [x, y] that shows each face to the viewer
const SHOW = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
const DUR = { dice: 420, coin: 600, cards: 650 };
const HUE = { dice: 260, coin: 35, cards: 150 };
const RANKS = '..23456789TJQKA', SUITS = '♠♥♦♣';

let s = load();
let busy = false, nextGolden = Date.now() + rand(40, 90) * 1000, rate = 0;
let tab = 'tree', stageKey = '', hiloResult = '', sheetSig = '', onConfirm = null, floats = 0;
const nextAuto = {}, sel = {};

// ---------- small DOM helpers ----------
const setText = (el, t) => { t = String(t); if (el.textContent !== t) el.textContent = t; };
const setHtml = (el, h) => { if (el._h !== h) { el.innerHTML = h; el._h = h; } };
function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

// ---------- FX ----------
const cv = $('fx'), ctx = cv.getContext('2d');
let parts = [], flash = 0, fxDirty = false;
function resize() {
  const d = devicePixelRatio || 1;
  cv.width = innerWidth * d; cv.height = innerHeight * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
}
addEventListener('resize', resize); resize();

function burst(x, y, n, colors) {
  if (reduced) n = Math.min(n, 6);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(2, 9);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 1, c: colors[i % colors.length], r: rand(2, 5) });
  }
  if (parts.length > 500) parts.splice(0, parts.length - 500);
}

function drawFx(dt) {
  if (!parts.length && flash <= 0) {
    if (fxDirty) { ctx.clearRect(0, 0, innerWidth, innerHeight); fxDirty = false; }
    return;
  }
  fxDirty = true;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const k = dt * 60;
  parts = parts.filter(p => (p.life -= dt * 1.4) > 0);
  for (const p of parts) {
    p.vy += 0.35 * k; p.vx *= 0.98; p.x += p.vx * k; p.y += p.vy * k;
    ctx.globalAlpha = p.life; ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
  }
  if (flash > 0) { ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, innerWidth, innerHeight); flash -= dt * 2; }
  ctx.globalAlpha = 1;
}

function floatText(txt, x, y, cls = '') {
  if (floats > 30 && !cls) return;
  const el = document.createElement('div');
  el.className = 'float ' + cls; el.textContent = txt;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  floats++;
  el.addEventListener('animationend', () => { el.remove(); floats--; });
  document.body.append(el);
}
const toast = (msg, cls = 'info') => floatText(msg, innerWidth / 2, innerHeight * 0.4, cls);

function coinFly(x, y, n) {
  if (reduced) return;
  const [tx, ty] = center($('goldstat'));
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'coin'; c.textContent = '🪙';
    Object.assign(c.style, { left: x - 9 + 'px', top: y - 9 + 'px' });
    document.body.append(c);
    c.animate([
      { transform: 'translate(0,0)' },
      { transform: `translate(${rand(-60, 60)}px, ${rand(-70, -20)}px)`, offset: 0.35 },
      { transform: `translate(${tx - x - 30}px, ${ty - y}px) scale(.6)`, opacity: 0.6 },
    ], { duration: 650 + i * 45, easing: 'cubic-bezier(.5,0,.8,.6)' }).onfinish = () => { c.remove(); restart($('goldstat'), 'pulse'); };
  }
}

function shake(big) {
  if (reduced) return;
  $('app').classList.remove('shake', 'bigshake');
  restart($('app'), big ? 'bigshake' : 'shake');
}

// ---------- stage (one renderer per game) ----------
const count = g => (g === 'dice' ? 1 + G.L(s, 'd_die') + G.L(s, 'd_six') : g === 'coin' ? 1 + G.L(s, 'c_twin') : 5 + G.L(s, 'k_extra'));
const tierOf = g => Math.min(7, G.L(s, { dice: 'd_mat', coin: 'c_mint', cards: 'k_foil' }[g]));

function buildStage() {
  const g = s.view, n = count(g), tier = tierOf(g), key = `${g}${n}|${tier}`;
  if (key === stageKey) return;
  stageKey = key;
  const t = $('table'), many = k => Array.from({ length: n }, () => k).join('');
  t.className = `g-${g}${g === 'cards' && tier ? ' foil' : ''}`;
  $('app').style.setProperty('--hue', HUE[g]);
  if (g === 'dice') {
    const faces = [1, 2, 3, 4, 5, 6].map(f => `<div class="face f${f}">${'<i></i>'.repeat(f)}</div>`).join('');
    t.innerHTML = many(`<div class="die t${tier}"><div class="cube">${faces}</div><span class="val"></span></div>`);
  } else if (g === 'coin') {
    t.innerHTML = many(`<div class="coin3d t${tier}"><div class="spin"><div class="cface h">♛</div><div class="cface tl">✦</div></div></div>`);
  } else {
    t.innerHTML = many('<div class="pcard"><div class="in"><div class="fr"></div><div class="bk"></div></div></div>');
  }
}

const ANIM = {
  dice(r, dur) {
    const els = $('table').children, counts = [0, 0, 0, 0, 0, 0, 0];
    r.faces.forEach(f => counts[f]++);
    r.faces.forEach((f, i) => {
      const el = els[i];
      if (!el) return;
      el._t = (el._t || 0) + 1 + Math.floor(Math.random() * 2);
      const [x, y] = SHOW[f], turns = el._t * 360;
      el.style.setProperty('--dur', dur + 'ms');
      el.firstChild.style.transform = `rotateZ(${rand(-14, 14)}deg) rotateX(${x + turns}deg) rotateY(${y + turns}deg)`;
      el.classList.remove('hl');
      restart(el, 'hop');
      el._hl = r.combo.mult > 1 && (counts[f] >= 2 || r.combo.name === 'Straight');
    });
  },
  coin(r, dur) {
    [...$('table').children].forEach((el, i) => {
      const f = r.flips[i];
      if (!f) return;
      el._t = (el._t || 0) + 3 + Math.floor(Math.random() * 2);
      el.style.setProperty('--dur', dur + 'ms');
      el.firstChild.style.transform = `rotateX(${el._t * 360 + (f === 'T' ? 180 : 0)}deg)`;
      el.classList.remove('hl', 'edge');
      restart(el, 'hop');
      el._f = f;
    });
  },
  cards(r, dur) {
    const els = [...$('table').children], fl = Math.min(250, dur * 0.35), step = Math.max(0, (dur - 2 * fl) / els.length);
    els.forEach((el, i) => {
      const c = r.cards[i];
      if (!c) return;
      el.style.setProperty('--fl', fl + 'ms');
      el.classList.remove('up', 'hl');
      setTimeout(() => {
        const fr = el.querySelector('.fr');
        fr.innerHTML = `${c.r === 10 ? '10' : RANKS[c.r]}<small>${SUITS[c.s]}</small>`;
        fr.classList.toggle('red', c.s === 1 || c.s === 2);
        el.classList.add('up');
      }, fl + i * step);
    });
  },
};

const LAND = {
  dice(r) {
    const els = $('table').children;
    r.values.forEach((v, i) => {
      const el = els[i];
      if (!el) return;
      el.classList.toggle('hl', !!el._hl);
      el.lastChild.textContent = G.fmt(v);
      restart(el.lastChild, 'show');
    });
  },
  coin() { for (const el of $('table').children) { el.classList.toggle('hl', el._f === 'H'); el.classList.toggle('edge', el._f === 'E'); } },
  cards(r) { const els = $('table').children; r.hand.used.forEach(i => els[i]?.classList.add('hl')); },
};

// 0 = plain … 3 = huge (jackpot / edge / straight flush+)
const bigness = r => (r.g === 'dice' ? (r.combo.mult >= 20 ? 3 : r.combo.mult >= 5 ? 2 : r.combo.mult >= 3 ? 1 : 0)
  : r.g === 'coin' ? (r.flips.includes('E') ? 3 : r.streak >= 8 ? 2 : r.streak >= 4 ? 1 : 0)
  : r.hand.rank >= 8 ? 3 : r.hand.rank >= 5 ? 2 : r.hand.rank >= 3 ? 1 : 0);

function showCombo(label, huge) {
  const el = $('combo');
  el.textContent = huge ? label.toUpperCase() + '!!' : label;
  el.classList.toggle('jackpot', huge);
  restart(el, 'show');
}

// ---------- playing ----------
function doPlay(auto) {
  const g = s.view;
  if (busy) return;
  busy = true;
  const now = Date.now(), iv = G.autoIv(s, g, now);
  const dur = reduced ? 120 : auto ? Math.min(DUR[g], iv * 0.75) : DUR[g];
  if (auto) nextAuto[g] = now + iv;
  const r = G.play(s, g, Math.random, now);
  buildStage();
  ANIM[g](r, dur);
  setTimeout(() => { busy = false; land(r); }, dur);
}

function land(r) {
  const hadTickets = s.tickets;
  G.collect(s, r);
  const big = bigness(r), [cx, cy] = center($('table'));
  if (r.g === s.view) {
    LAND[r.g](r);
    setText($('payout'), '+🪙 ' + G.fmt(r.gold));
    restart($('payout'), 'show');
    if (r.crit) floatText('CRIT!', cx + rand(-40, 40), cy - 40, 'crit');
    if (r.label) showCombo(r.label, big >= 3);
    if (big >= 2) { shake(big >= 3); coinFly(cx, cy, big >= 3 ? 10 : 4); }
    if (big >= 3) { if (!reduced) flash = 0.7; burst(cx, cy, 90, ['#ff5ea8', '#7a5cff', '#3ad1ff', '#ffd000', '#fff']); }
    else if (big >= 1 || r.crit) burst(cx, cy, big * 12 + 6, ['#ffc94a', '#fff', '#ff8f3d']);
  } else if (big >= 3) toast(`${G.GAMES[r.g].icon} ${r.label}`, 'gold');
  restart($('goldstat'), 'pulse');
  if (s.tickets > hadTickets) floatText('+1 🎟️ Hi-Lo ticket', cx, cy - 70, 'info');
}

// ---------- golden die ----------
function spawnGolden() {
  const b = document.createElement('button');
  b.className = 'golden'; b.innerHTML = '<span>🎲</span>'; b.setAttribute('aria-label', 'Golden die');
  b.style.top = rand(15, 50) + '%';
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    const [x, y] = center(b);
    b.remove();
    goldenEffect(x, y);
  }, { once: true });
  b.addEventListener('animationend', e => { if (e.animationName === 'drift') b.remove(); });
  document.body.append(b);
}

function goldenEffect(x, y) {
  const now = Date.now(), anyAuto = Object.keys(G.GAMES).some(g => G.hasAuto(s, g));
  let p = Math.random();
  if (!anyAuto && p >= 0.75) p = 0.5;
  burst(x, y, 50, ['#ffd000', '#fff', '#ffe680']);
  if (p < 0.4) { s.buffs.frenzy = now + 15000; floatText('FRENZY! ×7 income', x, y, 'crit'); }
  else if (p < 0.75) {
    const g = Math.max(50, Math.floor(rate * 600));
    G.earn(s, g); lastEarned += g; // lumps don't inflate the /s readout
    floatText(`LUCKY! +🪙${G.fmt(g)}`, x, y, 'gold');
    coinFly(x, y, 10);
  } else {
    s.buffs.overdrive = now + 10000;
    for (const g in nextAuto) nextAuto[g] = 0;
    floatText('OVERDRIVE! ×5 speed', x, y, 'info');
  }
}

// ---------- modal ----------
function modal(html) { $('modalcard').innerHTML = html; $('modal').hidden = false; }
const closeModal = () => { $('modal').hidden = true; };
function confirmModal(html, label, fn) {
  onConfirm = fn;
  modal(`${html}<div class="cfg"><div class="btns"><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>${label}</button></div></div>`);
}
$('modal').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if ('ok' in t.dataset) { const f = onConfirm; onConfirm = null; closeModal(); f?.(); }
  else if ('close' in t.dataset) closeModal();
});

// ---------- upgrade trees ----------
const RH = 92; // row height px
const curTree = () => (tab === 'perm' ? 'perm' : s.view);
const curSel = () => sel[curTree()] ?? G.TREES[curTree()][0].id;

function treeHtml(id) {
  const nodes = G.TREES[id], h = (Math.max(...nodes.map(n => n.y)) + 1) * RH, X = x => (x + 0.5) * 20;
  const lines = nodes.flatMap(n => n.req.map(p => {
    const a = G.NODE[p];
    return `<line data-a="${p}" x1="${X(a.x)}" y1="${a.y * RH + 34}" x2="${X(n.x)}" y2="${n.y * RH + 34}"/>`;
  })).join('');
  return `<div class="infobar"><span class="ico" id="ii"></span><div class="info"><b id="in"></b> <small id="il"></small><p id="idesc"></p></div>
    <div class="buys"><button class="buy" data-buy id="ib"></button><button class="btn sm" data-max>Max</button></div></div>
    <div class="tree" style="height:${h}px"><svg viewBox="0 0 100 ${h}" preserveAspectRatio="none">${lines}</svg>
    ${nodes.map(n => `<button class="node" data-node="${n.id}" style="left:${X(n.x)}%;top:${n.y * RH + 2}px"><span class="ico">${n.icon}</span><span class="lv"></span><span class="nm">${n.name}</span></button>`).join('')}</div>`;
}

function updateTree() {
  const id = curSel(), cur = c => (c === 'chips' ? '🎰' : '🪙');
  for (const b of $('sheet').querySelectorAll('.node')) {
    const nd = G.NODE[b.dataset.node], lvl = G.L(s, nd.id), p = G.priceOf(s, nd.id), open = G.isUnlocked(s, nd.id);
    b.classList.toggle('lock', !open);
    b.classList.toggle('own', lvl > 0);
    b.classList.toggle('max', !p);
    b.classList.toggle('ok', open && !!p && s[p.cur] >= p.cost);
    b.classList.toggle('sel', nd.id === id);
    setText(b.children[1], nd.max === 1 ? (lvl ? '✓' : '') : nd.max >= 100 ? (lvl || '') : `${lvl}/${nd.max}`);
  }
  for (const l of $('sheet').querySelectorAll('line')) l.classList.toggle('on', G.L(s, l.dataset.a) > 0);
  const nd = G.NODE[id], lvl = G.L(s, id), p = G.priceOf(s, id), open = G.isUnlocked(s, id), ib = $('ib');
  setText($('ii'), nd.icon);
  setText($('in'), nd.name);
  setText($('il'), nd.max === 1 ? '' : nd.max >= 100 ? `Lv ${lvl}` : `Lv ${lvl}/${nd.max}`);
  setText($('idesc'), open ? nd.desc : 'Locked: buy a connected upgrade first');
  setText(ib, !p ? 'MAX' : `${cur(p.cur)}${G.fmt(p.cost)}`);
  ib.disabled = !p || !open;
  ib.classList.toggle('ok', open && !!p && s[p.cur] >= p.cost);
  ib.classList.toggle('chips', p?.cur === 'chips');
}

function buyFx(x, y, id) {
  burst(x, y, 14, G.NODE[id].tree === 'perm' ? ['#7ee0ff', '#fff'] : ['#ffc94a', '#fff']);
  updateUi();
}

// ---------- panel ----------
function renderSheet() {
  const el = $('sheet');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  el._h = null;
  if (tab === 'tree') el.innerHTML = treeHtml(s.view);
  else if (tab === 'perm') {
    el.innerHTML = `<div class="hero"><div class="prog"><div id="pfill"></div><span id="ptext"></span></div>
      <div class="big">+🎰 <span id="cgain"></span></div>
      <button class="btn wide primary" data-cmd="ascend" id="ascbtn"></button>
      <p class="note">Prestige resets gold and game upgrades. Chips and this tree are permanent.</p></div>` + treeHtml('perm');
  } else if (tab === 'hilo') {
    renderHilo(el, s, hiloResult);
    sheetSig = hiloSig(s);
  } else {
    el.innerHTML = `<div class="cfg">
      <p class="note">Plays ${s.stats.plays} · Jackpots ${s.stats.jackpots} · Prestiges ${s.stats.prestiges} · Lifetime 🪙 ${G.fmt(s.stats.earned)} · Lifetime 🎰 ${G.fmt(s.totalChips)}</p>
      <p class="note">Saves automatically. Home-screen apps on iPhone keep separate storage from Safari, so export to back up or move a save.</p>
      <textarea id="savebox" placeholder="Paste a save here, then Import"></textarea>
      <div class="btns"><button class="btn" data-cmd="export">Export</button><button class="btn" data-cmd="import">Import</button></div>
      <button class="btn" data-cmd="unlockall">🧪 Unlock all games (test)</button>
      <button class="btn danger" data-cmd="reset">Hard reset</button></div>`;
  }
  updateSheet();
}

function updateSheet() {
  if (tab === 'tree' || tab === 'perm') updateTree();
  if (tab === 'perm') {
    const gain = G.chipGain(s), btn = $('ascbtn');
    const next = gain ? G.PRESTIGE_AT * ((gain + 1) / 3) ** 2 : G.PRESTIGE_AT;
    $('pfill').style.width = Math.min(100, (s.runEarned / next) * 100) + '%';
    setText($('ptext'), `${G.fmt(s.runEarned)} / ${G.fmt(next)} earned${gain ? ' (next chip)' : ''}`);
    setText($('cgain'), G.fmt(gain));
    setText(btn, gain ? 'Prestige' : `Earn 🪙${G.fmt(G.PRESTIGE_AT)} this run`);
    btn.disabled = !gain;
  }
  if (tab === 'hilo' && hiloSig(s) !== sheetSig) renderSheet();
}

$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  if (tab !== 'hilo') hiloResult = '';
  renderSheet();
  $('sheet').scrollTop = 0;
});

$('sheet').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.node) {
    const id = b.dataset.node;
    if (curSel() === id && G.buy(s, id)) buyFx(e.clientX, e.clientY, id); // tap again to buy
    sel[curTree()] = id;
    updateTree();
  } else if ('buy' in b.dataset) {
    if (G.buy(s, curSel())) buyFx(e.clientX, e.clientY, curSel());
  } else if ('max' in b.dataset) {
    let n = 0;
    while (G.buy(s, curSel())) n++;
    if (n) { buyFx(e.clientX, e.clientY, curSel()); floatText(`+${n}`, e.clientX, e.clientY - 20, 'gold'); }
  } else if (b.dataset.cmd) cmd(b.dataset.cmd);
  else if (b.dataset.hilo) {
    const r = hiloAct(s, b.dataset.hilo);
    hiloResult = r ? `<p class="result ${r.win ? 'win' : 'lose'}">${r.msg}</p>` : '';
    renderSheet(); updateUi();
    if (r?.cashed) coinFly(e.clientX, e.clientY, 8);
    else if (r?.win) burst(e.clientX, e.clientY, 20, ['#5dffa0', '#fff']);
    else if (r) shake(false);
  }
});

$('games').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.dataset.game === s.view) return;
  if (!G.gameOn(s, b.dataset.game)) { toast('Unlock it in the Prestige tree 🎰'); return; }
  s.view = b.dataset.game;
  if (tab === 'tree') renderSheet();
  updateUi();
});

const resetView = () => { stageKey = ''; for (const g in nextAuto) nextAuto[g] = 0; save(s); renderSheet(); updateUi(); };

async function cmd(c) {
  if (c === 'ascend') {
    confirmModal(`<h2>Prestige?</h2><p>Gain <b style="color:var(--ether)">🎰 ${G.fmt(G.chipGain(s))}</b> chips.<br>Gold and all game upgrades reset.</p>`, 'Prestige 🎰', () => {
      const g = G.ascend(s);
      flash = reduced ? 0 : 0.8;
      burst(innerWidth / 2, innerHeight / 2, 100, ['#7ee0ff', '#fff', '#a874ff']);
      resetView();
      toast(`+🎰 ${G.fmt(g)} chips`);
    });
  } else if (c === 'export') {
    const str = exportSave(s);
    $('savebox').value = str;
    try { await navigator.clipboard.writeText(str); toast('Save copied'); } catch { $('savebox').select(); toast('Copy the text above'); }
  } else if (c === 'import') {
    try { s = importSave($('savebox').value); resetView(); toast('Save loaded'); } catch { toast('Invalid save', 'bad'); }
  } else if (c === 'unlockall') { // ponytail: test helper, remove before real release
    for (const g in G.GAMES) if (G.GAMES[g].unlock) s.lv[G.GAMES[g].unlock] = 1;
    resetView(); toast('All games unlocked');
  } else if (c === 'reset') {
    confirmModal('<h2>Hard reset?</h2><p>Erases everything, including chips. Cannot be undone.</p>', 'Erase', () => {
      wipe(); s = G.newState(); resetView();
    });
  }
}

// ---------- HUD ----------
function infoText(g) {
  const auto = G.hasAuto(s, g) ? ` · auto ${(G.autoIv(s, g) / 1000).toFixed(2)}s` : '';
  if (g === 'dice') { const n = count(g); return `${n} ${G.TIERS[tierOf(g)]} ${n > 1 ? 'dice' : 'die'}${auto}`; }
  if (g === 'coin') {
    const cap = G.streakCap(s), st = s.coin.streak;
    return `🔥 ${st}/${cap} · next heads ×${(G.streakGrowth(s) ** Math.min(cap, st + 1)).toFixed(2)} · ${Math.round((0.5 + 0.015 * G.L(s, 'c_weight')) * 100)}% heads${auto}`;
  }
  return `${count(g)} cards · ${52 - 4 * G.L(s, 'k_thin')}-card deck${auto}`;
}

function updateUi(now = Date.now()) {
  setText($('gold'), G.fmt(s.gold));
  setText($('gps'), rate >= 1 ? G.fmt(rate) + '/s' : '');
  setText($('chips'), G.fmt(s.chips));
  setHtml($('games'), Object.entries(G.GAMES).map(([g, d]) => {
    const on = G.gameOn(s, g);
    return `<button data-game="${g}" class="${g === s.view ? 'on' : ''}${on ? '' : ' lock'}">${on ? d.icon : '🔒'} ${d.name}</button>`;
  }).join(''));
  buildStage();
  const chips = [];
  if (now < s.buffs.frenzy) chips.push(`🔥 Frenzy ${Math.ceil((s.buffs.frenzy - now) / 1000)}s`);
  if (now < s.buffs.overdrive) chips.push(`⚡ Overdrive ${Math.ceil((s.buffs.overdrive - now) / 1000)}s`);
  setHtml($('buffs'), chips.map(c => `<span class="chip">${c}</span>`).join(''));
  const g = s.view, ab = $('autobtn');
  ab.hidden = !G.hasAuto(s, g);
  ab.classList.toggle('on', !s.autoOff[g]);
  setText(ab.lastChild, s.autoOff[g] ? 'OFF' : 'ON');
  setText($('go'), G.GAMES[g].verb);
  setText($('info'), infoText(g));
  document.querySelector('[data-tab=hilo]').classList.toggle('new', s.tickets > 0 && tab !== 'hilo');
  document.querySelector('[data-tab=perm]').classList.toggle('new', G.chipGain(s) > 0 && tab !== 'perm');
  updateSheet();
}

// ---------- offline ----------
const fmtTime = sec => (sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}m`);
function welcomeBack() {
  const now = Date.now(), { gold, secs } = G.offlineGold(s, now);
  s.last = now;
  for (const g in nextAuto) nextAuto[g] = 0;
  if (!gold) return;
  G.earn(s, gold); lastEarned += gold;
  modal(`<h2>Welcome back!</h2><p class="muted">Your tables kept playing for ${fmtTime(secs)}${secs >= G.offlineCapH(s) * 3600 ? ' (max)' : ''}.</p>
    <div class="big">🪙 ${G.fmt(gold)}</div><button class="btn wide primary" data-close>Collect</button>`);
}

// ---------- input ----------
$('go').addEventListener('pointerdown', e => { e.preventDefault(); doPlay(false); });
$('autobtn').addEventListener('click', () => { s.autoOff[s.view] = !s.autoOff[s.view]; nextAuto[s.view] = 0; updateUi(); });
addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); doPlay(false); }
});
document.addEventListener('gesturestart', e => e.preventDefault()); // iOS pinch zoom
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { s.last = Date.now(); save(s); } else welcomeBack();
});
addEventListener('pagehide', () => save(s));
setInterval(() => save(s), 10000);

// ---------- loop ----------
let lastT = performance.now(), lastUi = 0, lastRate = Date.now(), lastEarned = s.stats.earned;
function frame(t) {
  const now = Date.now(), dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  s.last = now;
  for (const g in G.GAMES) {
    if (!G.hasAuto(s, g) || s.autoOff[g] || now < (nextAuto[g] || 0)) continue;
    if (g === s.view) { if (!busy) doPlay(true); continue; }
    nextAuto[g] = now + G.autoIv(s, g, now); // off-screen games play instantly
    land(G.play(s, g, Math.random, now));
  }
  if (now >= nextGolden) { spawnGolden(); nextGolden = now + (rand(60, 180) * 1000) / G.goldenRate(s); }
  if (now - lastRate >= 1000) { // measured income, smoothed
    const r = (s.stats.earned - lastEarned) / ((now - lastRate) / 1000);
    rate = rate ? rate * 0.8 + r * 0.2 : r;
    lastRate = now; lastEarned = s.stats.earned;
  }
  if (now - lastUi >= 100) { updateUi(now); lastUi = now; }
  drawFx(dt);
  requestAnimationFrame(frame);
}

welcomeBack();
renderSheet();
updateUi();
requestAnimationFrame(frame);

// Service worker only over HTTPS (GitHub Pages); local http dev stays uncached.
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
