import * as G from './game.js';
import * as V from './view.js';
import { load, save, exportSave, importSave, wipe } from './save.js';
import { renderHilo, hiloAct, hiloSig } from './hilo.js';

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GK = Object.keys(G.GAMES);

let s = load();
let busy = false, nextGolden = Date.now() + rand(40, 90) * 1000;
let tab = 'tree', hiloResult = '', sheetSig = '', onConfirm = null, floats = 0;
const nextAuto = {}, sel = {}, rate = {}, lastTotal = {};

// ---------- small DOM helpers ----------
const setText = (el, t) => { t = String(t); if (el.textContent !== t) el.textContent = t; };
const setHtml = (el, h) => { if (el._h !== h) { el.innerHTML = h; el._h = h; } };
function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const gs = () => s.g[s.view];
const ci = (g = s.view) => G.GAMES[g].ci;
const bar = (id, frac, text) => { $(id + 'f').style.width = Math.min(100, frac * 100) + '%'; setText($(id + 't'), text); };

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
    c.className = 'coin'; c.textContent = ci();
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
  const dur = reduced ? 120 : auto ? Math.min(V.DUR[g], iv * 0.75) : V.DUR[g];
  const r = G.play(s, g, Math.random, now), len = V.animLen(r, dur);
  if (auto) nextAuto[g] = now + Math.max(iv, len);
  V.buildStage(s);
  V.ANIM[g](r, dur);
  setTimeout(() => { busy = false; land(r); }, len);
}

function payout(x, x0, y0, big) {
  setText($('payout'), x ? `+${ci()} ${G.fmt(x)}` : '');
  restart($('payout'), 'show');
  if (big >= 2) { shake(big >= 3); coinFly(x0, y0, big >= 3 ? 10 : 4); }
  if (big >= 3) { if (!reduced) flash = 0.7; burst(x0, y0, 90, ['#ff5ea8', '#7a5cff', '#3ad1ff', '#ffd000', '#fff']); }
  else if (big >= 1) burst(x0, y0, big * 12 + 6, ['#ffc94a', '#fff', '#ff8f3d']);
}

function land(r) {
  const hadTickets = s.tickets, couldClaim = G.canClaim(s, r.g);
  G.collect(s, r);
  const [cx, cy] = center($('table'));
  if (r.g === s.view) {
    V.LAND[r.g](r);
    payout(r.gold, cx, cy, r.big);
    if (r.crit) floatText('CRIT!', cx + rand(-40, 40), cy - 40, 'crit');
    if (r.label) showCombo(r.label, r.big >= 3);
  } else if (r.big >= 3) toast(`${G.GAMES[r.g].icon} ${r.label}`, 'gold');
  if (s.tickets > hadTickets) floatText('+1 🎟️ Hi-Lo ticket', cx, cy - 70, 'info');
  if (!couldClaim && G.canClaim(s, r.g)) toast(`${G.GAMES[r.g].icon} Stage ${s.g[r.g].stage + 1} ready to claim!`, 'gold');
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
  const now = Date.now(), anyAuto = GK.some(g => G.hasAuto(s, g));
  let p = Math.random();
  if (!anyAuto && p >= 0.75) p = 0.5;
  burst(x, y, 50, ['#ffd000', '#fff', '#ffe680']);
  if (p < 0.4) { s.buffs.frenzy = now + 15000; floatText('FRENZY! ×7 all games', x, y, 'crit'); }
  else if (p < 0.75) {
    const g = s.view, amt = Math.max(50, Math.floor((rate[g] || 0) * 600 * G.luckyMult(s)));
    G.earn(s, g, amt); lastTotal[g] += amt; // lumps don't inflate the /s readout
    floatText(`LUCKY! +${ci()}${G.fmt(amt)}`, x, y, 'gold');
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
const RH = 92, CW = 76; // row height, column width px
const curTree = () => (tab === 'rb' ? s.view + '_r' : s.view);
const curSel = () => sel[curTree()] ?? G.ALL[curTree()][0].id;

function treeHtml(id) {
  const nodes = G.ALL[id], h = (Math.max(...nodes.map(n => n.y)) + 1) * RH, X = x => (x + 0.5) * CW;
  const w = (Math.max(...nodes.map(n => n.x)) + 1) * CW;
  const lines = nodes.flatMap(n => n.req.map(p => {
    const a = G.NODE[p];
    return `<line data-a="${p}" x1="${X(a.x)}" y1="${a.y * RH + 34}" x2="${X(n.x)}" y2="${n.y * RH + 34}"/>`;
  })).join('');
  const tiers = id.endsWith('_r') ? '' : [3, 5, 7].map(y => `<div class="tier" style="top:${y * RH - 10}px"><span>Stage ${G.TIER_ST[y]}</span></div>`).join('');
  return `<div class="infobar"><span class="ico" id="ii"></span><div class="info"><b id="in"></b> <small id="il"></small><p id="idesc"></p></div>
    <div class="buys"><button class="buy" data-buy id="ib"></button><button class="btn sm" data-max>Max</button></div></div>
    <div class="treewrap"><div class="tree" style="width:${w}px;height:${h}px">${tiers}<svg viewBox="0 0 ${w} ${h}">${lines}</svg>
    ${nodes.map(n => `<button class="node" data-node="${n.id}" style="left:${X(n.x)}px;top:${n.y * RH + 2}px"><span class="ico">${n.icon}</span><span class="lv"></span><span class="nm">${n.name}</span></button>`).join('')}</div></div>`;
}

function updateTree() {
  const id = curSel(), cur = c => (c === 'ess' ? '✦' : ci());
  for (const b of $('sheet').querySelectorAll('.node')) {
    const nd = G.NODE[b.dataset.node], lvl = G.L(s, nd.id), p = G.priceOf(s, nd.id), open = G.isUnlocked(s, nd.id);
    b.classList.toggle('lock', !open);
    b.classList.toggle('own', lvl > 0);
    b.classList.toggle('max', !p);
    b.classList.toggle('ok', open && !!p && s.g[nd.game][p.cur] >= p.cost);
    b.classList.toggle('sel', nd.id === id);
    setText(b.children[1], nd.max === 1 ? (lvl ? '✓' : '') : nd.max >= 100 ? (lvl || '') : `${lvl}/${nd.max}`);
  }
  for (const l of $('sheet').querySelectorAll('line')) l.classList.toggle('on', G.L(s, l.dataset.a) > 0);
  const nd = G.NODE[id], lvl = G.L(s, id), p = G.priceOf(s, id), open = G.isUnlocked(s, id), ib = $('ib');
  setText($('ii'), nd.icon);
  setText($('in'), nd.name);
  setText($('il'), nd.max === 1 ? '' : nd.max >= 100 ? `Lv ${lvl}` : `Lv ${lvl}/${nd.max}`);
  setText($('idesc'), open ? nd.desc : s.g[nd.game].stage < nd.st ? `Unlocks at stage ${nd.st} · ${nd.desc}` : `Buy a connected upgrade first · ${nd.desc}`);
  setText(ib, !p ? 'MAX' : `${cur(p.cur)}${G.fmt(p.cost)}`);
  ib.disabled = !p || !open;
  ib.classList.toggle('ok', open && !!p && s.g[nd.game][p.cur] >= p.cost);
  ib.classList.toggle('chips', p?.cur === 'ess');
}

function buyFx(x, y, id) {
  burst(x, y, 14, G.NODE[id].rb ? ['#7ee0ff', '#fff'] : ['#ffc94a', '#fff']);
  updateUi();
}

// ---------- panel ----------
const progHtml = id => `<div class="prog"><div id="${id}f" class="pfill"></div><span id="${id}t" class="ptext"></span></div>`;

function stagesHtml() {
  const g = s.view, d = G.GAMES[g], st = gs().stage, i = st + 1;
  if (i > G.MAX_STAGE) return `<div class="hero"><h3>All ${G.MAX_STAGE} stages cleared!</h3></div>`;
  const goal = G.stageGoal(g, i), ms = [[3, 'Upgrade rows 4–5'], [8, 'Upgrade rows 6–7'], [G.REBIRTH_AT, 'Rebirth'], [15, 'Upgrade rows 8–9']];
  if (g === 'cards') ms.push([G.SMART_AT, 'Smart strategy']);
  const next = ms.filter(([n]) => n > st).sort((a, b) => a[0] - b[0]);
  const lv = G.casinoLv(s);
  return `<div class="hero stagehero"><h3>${d.icon} ${d.name} · Stage ${i} <small>/ ${G.MAX_STAGE}</small></h3>
      <p class="goal">Earn ${d.ci} ${G.fmt(goal.earn)} total</p>${progHtml('s1')}
      ${goal.feat ? `<p class="goal">${goal.feat[2]}</p>${progHtml('s2')}` : ''}
      <button class="btn wide primary" data-cmd="claim" id="claim">Claim stage ${i}</button>
      <p class="note">Each stage: +${Math.round((0.05 + (G.stats(s, g).stg || 0)) * 100)}% ${d.cur} income for good (now ×${G.stageMult(s, g).toFixed(2)}).</p></div>
    ${next.length ? `<p class="note"><b>Next unlocks:</b> ${next.map(([n, t]) => `stage ${n}: ${t}`).join(' · ')}</p>` : ''}
    <div class="row"><span class="ico">🏛️</span><div class="info"><b>Casino Lv ${lv}</b><p>Stages cleared in all games. Offline cap ${G.offlineCapH(s).toFixed(1)}h · golden dice +${lv}% · ${G.maxTickets(s)} ticket cap</p></div></div>
    ${GK.map(k => `<div class="row mini"><span class="ico">${G.GAMES[k].icon}</span><div class="info"><b>${G.GAMES[k].name}</b> <small>stage ${s.g[k].stage}${s.g[k].rebirths ? ` · ${s.g[k].rebirths} rebirths` : ''}</small></div>${G.canClaim(s, k) ? '<span class="ready">Claim!</span>' : ''}</div>`).join('')}`;
}

function rebirthHtml() {
  const g = s.view, d = G.GAMES[g], x = gs();
  if (x.stage < G.REBIRTH_AT) return `<div class="hero"><h3>🔒 Rebirth</h3><p class="note">Reach ${d.name} stage ${G.REBIRTH_AT} to unlock. Rebirth resets ${d.cur} and the upgrade tree for ✦ Essence, which buys permanent ${d.name} upgrades.</p>
    <p class="goal">Stage ${x.stage} / ${G.REBIRTH_AT}</p></div>`;
  return `<div class="hero"><p class="goal">✦ <b id="essv"></b> ${d.name} Essence</p>${progHtml('r1')}
    <div class="big">+✦ <span id="rgain"></span></div>
    <button class="btn wide primary" data-cmd="rebirth" id="rbbtn"></button>
    <p class="note">Resets ${d.cur} and ${d.name} upgrades. Keeps stages, workshop and this tree.</p></div>` + treeHtml(g + '_r');
}

function renderSheet() {
  const el = $('sheet');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  setText($('wstab'), G.WS_NAME[s.view]);
  el._h = null;
  if (tab === 'tree') el.innerHTML = treeHtml(s.view);
  else if (tab === 'ws') el.innerHTML = V.wsHtml(s, s.view);
  else if (tab === 'stages') el.innerHTML = stagesHtml();
  else if (tab === 'rb') el.innerHTML = rebirthHtml();
  else if (tab === 'hilo') { renderHilo(el, s, hiloResult); sheetSig = hiloSig(s); }
  else {
    el.innerHTML = `<div class="cfg">
      <p class="note">Plays ${s.stats.plays} · Casino Lv ${G.casinoLv(s)} · ${GK.map(g => `${G.GAMES[g].icon} ${G.fmt(s.g[g].total)}`).join(' · ')} lifetime</p>
      <p class="note">Saves automatically. Home-screen apps on iPhone keep separate storage from Safari, so export to back up or move a save.</p>
      <textarea id="savebox" placeholder="Paste a save here, then Import"></textarea>
      <div class="btns"><button class="btn" data-cmd="export">Export</button><button class="btn" data-cmd="import">Import</button></div>
      <button class="btn danger" data-cmd="reset">Hard reset</button></div>`;
  }
  if (tab === 'stages') sheetSig = `${s.view}|${gs().stage}`;
  if (tab === 'rb') sheetSig = `${s.view}|${gs().stage >= G.REBIRTH_AT}`;
  updateSheet();
}

function updateSheet() {
  const g = s.view, x = gs();
  if (tab === 'tree' || tab === 'rb') { if ($('ib')) updateTree(); }
  if (tab === 'ws' && V.wsUpdate($('sheet'), s, g)) renderSheet();
  if (tab === 'stages') {
    if (sheetSig !== `${g}|${x.stage}`) return renderSheet();
    const goal = G.stageGoal(g, x.stage + 1);
    if (x.stage >= G.MAX_STAGE) return;
    bar('s1', x.total / goal.earn, `${G.fmt(x.total)} / ${G.fmt(goal.earn)}`);
    if (goal.feat) { const c = G.featCount(s, g, goal.feat); bar('s2', c / goal.feat[1], `${Math.min(c, goal.feat[1])} / ${goal.feat[1]}`); }
    $('claim').disabled = !G.canClaim(s, g);
  }
  if (tab === 'rb') {
    if (sheetSig !== `${g}|${x.stage >= G.REBIRTH_AT}`) return renderSheet();
    if (x.stage >= G.REBIRTH_AT) {
      const gain = G.essGain(s, g), R = G.stageGoal(g, G.REBIRTH_AT).earn, m = 1 + (G.stats(s, g).essm || 0);
      const next = R * ((gain + 1) / (2 * m)) ** 2;
      bar('r1', x.earned / next, `${G.fmt(x.earned)} / ${G.fmt(next)} this run → next ✦`);
      setText($('essv'), G.fmt(x.ess));
      setText($('rgain'), G.fmt(gain));
      setText($('rbbtn'), gain ? `Rebirth for ✦${G.fmt(gain)}` : 'Earn more this run');
      $('rbbtn').disabled = !gain;
    }
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
  } else if (b.dataset.ws) {
    const paid = +b.dataset.cost > 0;
    if (G.wsBuy(s, s.view, b.dataset.ws)) { if (paid) burst(e.clientX, e.clientY, 14, ['#ffc94a', '#fff']); renderSheet(); updateUi(); }
  } else if (b.dataset.cmd) cmd(b.dataset.cmd, e);
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
  if (!b || b.dataset.game === s.view || busy) return;
  s.view = b.dataset.game;
  V.resetStage();
  setText($('payout'), '');
  renderSheet();
  updateUi();
});

$('alt').addEventListener('click', e => { // coinflip: bank the pot now
  const x = G.bankNow(s);
  if (!x) return;
  const [cx, cy] = center($('table'));
  payout(x, cx, cy, 1);
  showCombo('BANKED!', false);
  updateUi();
});

const resetView = () => { V.resetStage(); for (const g in nextAuto) nextAuto[g] = 0; save(s); renderSheet(); updateUi(); };

async function cmd(c, e) {
  const g = s.view;
  if (c === 'claim') {
    if (!G.claim(s, g)) return;
    flash = reduced ? 0 : 0.5;
    burst(e.clientX, e.clientY, 60, ['#ffd000', '#fff', '#7ee0ff']);
    toast(`Stage ${gs().stage} cleared!`, 'gold');
    resetView();
  } else if (c === 'rebirth') {
    confirmModal(`<h2>Rebirth ${G.GAMES[g].name}?</h2><p>Gain <b style="color:var(--ether)">✦ ${G.fmt(G.essGain(s, g))}</b> Essence.<br>${G.GAMES[g].cur} and ${G.GAMES[g].name} upgrades reset. Stages and workshop stay.</p>`, 'Rebirth ✦', () => {
      const x = G.rebirth(s, g);
      flash = reduced ? 0 : 0.8;
      burst(innerWidth / 2, innerHeight / 2, 100, ['#7ee0ff', '#fff', '#a874ff']);
      resetView();
      toast(`+✦ ${G.fmt(x)} Essence`);
    });
  } else if (c === 'export') {
    const str = exportSave(s);
    $('savebox').value = str;
    try { await navigator.clipboard.writeText(str); toast('Save copied'); } catch { $('savebox').select(); toast('Copy the text above'); }
  } else if (c === 'import') {
    try { s = importSave($('savebox').value); for (const k of GK) lastTotal[k] = s.g[k].total; resetView(); toast('Save loaded'); } catch { toast('Invalid save', 'bad'); }
  } else if (c === 'reset') {
    confirmModal('<h2>Hard reset?</h2><p>Erases everything in all five games. Cannot be undone.</p>', 'Erase', () => {
      wipe(); s = G.newState(); for (const k of GK) lastTotal[k] = 0; resetView();
    });
  }
}

// ---------- HUD ----------
function updateUi(now = Date.now()) {
  const g = s.view, x = gs();
  setText($('curi'), ci());
  setText($('gold'), G.fmt(x.cash));
  setText($('gps'), (rate[g] || 0) >= 1 ? G.fmt(rate[g]) + '/s' : '');
  setText($('clv'), G.casinoLv(s));
  setHtml($('games'), GK.map(k => `<button data-game="${k}" class="${k === g ? 'on' : ''}${G.canClaim(s, k) ? ' ready' : ''}">${G.GAMES[k].icon}<span>${G.GAMES[k].name}</span></button>`).join(''));
  V.buildStage(s);
  const chips = [];
  if (now < s.buffs.frenzy) chips.push(`🔥 Frenzy ${Math.ceil((s.buffs.frenzy - now) / 1000)}s`);
  if (now < s.buffs.overdrive) chips.push(`⚡ Overdrive ${Math.ceil((s.buffs.overdrive - now) / 1000)}s`);
  setHtml($('buffs'), chips.map(c => `<span class="chip">${c}</span>`).join(''));
  const ab = $('autobtn');
  ab.hidden = !G.hasAuto(s, g);
  ab.classList.toggle('on', !s.autoOff[g]);
  setText(ab.lastChild, s.autoOff[g] ? 'OFF' : 'ON');
  const alt = $('alt'), pot = g === 'coin' ? x.sys.pot : 0;
  alt.hidden = !pot;
  if (pot) setHtml(alt, `BANK<small>${ci()}${G.fmt(pot)}</small>`);
  setText($('go'), G.GAMES[g].verb);
  setText($('info'), V.infoText(s, g));
  document.querySelector('[data-tab=hilo]').classList.toggle('new', s.tickets > 0 && tab !== 'hilo');
  document.querySelector('[data-tab=stages]').classList.toggle('new', G.canClaim(s, g) && tab !== 'stages');
  updateSheet();
}

// ---------- offline ----------
const fmtTime = sec => (sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}m`);
function welcomeBack() {
  const now = Date.now(), { per, secs } = G.offlineGold(s, now);
  s.last = now;
  for (const g in nextAuto) nextAuto[g] = 0;
  const games = Object.keys(per);
  if (!games.length) return;
  for (const g of games) { G.earn(s, g, per[g]); lastTotal[g] += per[g]; }
  modal(`<h2>Welcome back!</h2><p class="muted">Your tables kept playing for ${fmtTime(secs)}${secs >= G.offlineCapH(s) * 3600 ? ' (max)' : ''}.</p>
    ${games.map(g => `<div class="big">${G.GAMES[g].ci} ${G.fmt(per[g])}</div>`).join('')}<button class="btn wide primary" data-close>Collect</button>`);
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
let lastT = performance.now(), lastUi = 0, lastRate = Date.now();
for (const g of GK) lastTotal[g] = s.g[g].total;
function frame(t) {
  const now = Date.now(), dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  s.last = now;
  for (const g of GK) {
    if (!G.hasAuto(s, g) || s.autoOff[g] || now < (nextAuto[g] || 0)) continue;
    if (g === s.view) { if (!busy) doPlay(true); continue; }
    nextAuto[g] = now + G.autoIv(s, g, now); // off-screen games play instantly
    land(G.play(s, g, Math.random, now));
  }
  if (now >= nextGolden) { spawnGolden(); nextGolden = now + (rand(60, 180) * 1000) / G.goldenRate(s); }
  if (now - lastRate >= 1000) { // measured income per game, smoothed
    for (const g of GK) {
      const r = (s.g[g].total - lastTotal[g]) / ((now - lastRate) / 1000);
      rate[g] = rate[g] ? rate[g] * 0.8 + r * 0.2 : r;
      lastTotal[g] = s.g[g].total;
    }
    lastRate = now;
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
