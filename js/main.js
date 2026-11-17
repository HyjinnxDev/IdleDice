import * as G from './game.js';
import { load, save, exportSave, importSave, wipe } from './save.js';
import { renderHilo, hiloAct, hiloSig } from './hilo.js';

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const MONSTERS = [['🐀', 'Cellar Rat'], ['🦇', 'Cave Bat'], ['🐍', 'Pit Viper'], ['🕷️', 'Crypt Spider'], ['🦂', 'Bone Scorpion'],
  ['🐺', 'Dire Wolf'], ['🧟', 'Shambler'], ['👺', 'Goblin Chief'], ['🧌', 'Troll'], ['👻', 'Wraith'], ['🗿', 'Living Statue'],
  ['🦑', 'Deep Horror'], ['🧛', 'Vampire'], ['🐲', 'Drake']];
const BOSSES = [['👹', 'Oni Warlord'], ['💀', 'Lich King'], ['🐉', 'Elder Dragon'], ['👁️', 'The Watcher'], ['🦖', 'Tyrant Rex'],
  ['🌋', 'Magma Titan'], ['☄️', 'Star Eater']];
const monsterFor = f => (G.isBoss(f) ? BOSSES[(f / 10 - 1) % BOSSES.length] : MONSTERS[(f - 1 - Math.floor(f / 10)) % MONSTERS.length]);
// cube rotation [x, y] that shows each face to the viewer
const SHOW = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

let s = load();
let rolling = false, nextAuto = 0, nextGolden = Date.now() + rand(40, 90) * 1000;
let tab = 'up', trayKey = '', shownFloor = 0, hiloResult = '', sheetSig = '', onConfirm = null, floats = 0;

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

// Fading copy of the old monster so kills read even when the next one appears instantly.
function ghost() {
  const m = $('monster'), r = m.getBoundingClientRect(), g = m.cloneNode(true);
  g.removeAttribute('id'); g.className = '';
  Object.assign(g.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', textAlign: 'center',
    fontSize: getComputedStyle(m).fontSize, lineHeight: 1, zIndex: 9, pointerEvents: 'none', animation: 'dead .4s forwards' });
  document.body.append(g);
  setTimeout(() => g.remove(), 450);
}

// ---------- arena ----------
function setMonster() {
  shownFloor = s.floor;
  const [emo, name] = monsterFor(s.floor), boss = G.isBoss(s.floor), m = $('monster');
  m.textContent = emo;
  m.classList.toggle('boss', boss);
  restart(m, 'enter');
  setText($('mname'), boss ? `⚠ Boss · ${name}` : name);
  $('mname').classList.toggle('boss', boss);
  $('app').style.setProperty('--hue', (260 + Math.floor((s.floor - 1) / 10) * 47) % 360);
}
$('monster').addEventListener('animationend', e => { if (e.animationName !== 'bob') e.target.classList.remove('hit', 'enter'); });

function buildTray() {
  const dice = G.activeDice(s);
  const key = dice.map(d => d.tier + (d.phantom ? 'p' : '')).join();
  if (key === trayKey) return;
  trayKey = key;
  const faces = [1, 2, 3, 4, 5, 6].map(n => `<div class="face f${n}">${'<i></i>'.repeat(n)}</div>`).join('');
  $('tray').innerHTML = dice.map(d => `<div class="die t${d.tier}${d.phantom ? ' phantom' : ''}"><div class="cube">${faces}</div><span class="val"></span></div>`).join('');
}

function animateDice(r, dur) {
  buildTray();
  const els = $('tray').children, counts = [0, 0, 0, 0, 0, 0, 0];
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
}

function showCombo(cb) {
  const el = $('combo'), jp = cb.name === 'JACKPOT';
  el.textContent = jp ? 'JACKPOT!!!' : `${cb.name} ×${cb.mult}`;
  el.classList.toggle('jackpot', jp);
  restart(el, 'show');
}

// ---------- rolling ----------
function doRoll(auto) {
  if (rolling || s.boonChoice) return;
  rolling = true;
  const now = Date.now(), iv = G.autoInterval(s, now);
  const dur = reduced ? 120 : auto ? Math.min(520, iv * 0.75) : 420;
  if (auto) nextAuto = now + iv;
  const r = G.roll(s, Math.random, now);
  animateDice(r, dur);
  setTimeout(() => { rolling = false; land(r); }, dur);
}

function land(r) {
  const now = Date.now();
  s.stats.rolls++;
  s.gold += r.gold;
  const els = $('tray').children;
  r.values.forEach((v, i) => {
    const el = els[i];
    if (!el) return;
    el.classList.toggle('hl', !!el._hl);
    el.lastChild.textContent = G.fmt(v);
    restart(el.lastChild, 'show');
  });
  const [cx, cy] = center($('monster'));
  floatText((r.crit ? 'CRIT ' : '') + G.fmt(r.damage), cx + rand(-50, 50), cy + rand(-25, 10), r.crit ? 'crit' : '');
  $('monster').classList.remove('enter');
  restart($('monster'), 'hit');
  restart($('goldstat'), 'pulse');
  if (r.combo.mult > 1) showCombo(r.combo);
  if (r.combo.mult >= 3) shake(r.combo.mult >= 8);
  if (r.combo.name === 'JACKPOT') {
    s.stats.jackpots++;
    if (!reduced) flash = 0.7;
    burst(cx, cy, 90, ['#ff5ea8', '#7a5cff', '#3ad1ff', '#ffd000', '#fff']);
  } else if (r.crit) burst(cx, cy, 16, ['#ff8f3d', '#fff', '#ffd000']);

  const res = G.applyDamage(s, r.damage, now);
  if (res) {
    ghost();
    setMonster();
    burst(cx, cy, res.wasBoss ? 70 : 22, res.wasBoss ? ['#ff5d73', '#ffc94a', '#fff'] : ['#ffc94a', '#fff3b0', '#a874ff']);
    coinFly(cx, cy, res.wasBoss ? 12 : 5);
    if (res.wasBoss) { floatText('+1 🎟️ Hi-Lo ticket', cx, cy - 60, 'info'); shake(true); }
  }
  if (s.boonChoice && $('modal').hidden) showBoons();
  updateUi(now);
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
  const now = Date.now();
  let p = Math.random();
  if (!s.up.auto && p >= 0.75) p = 0.5;
  burst(x, y, 50, ['#ffd000', '#fff', '#ffe680']);
  if (p < 0.4) { s.buffs.frenzy = now + 15000; floatText('FRENZY! ×7 damage', x, y, 'crit'); }
  else if (p < 0.75) {
    const g = Math.max(50, Math.floor(G.goldPerSec(s) * 600));
    s.gold += g;
    floatText(`LUCKY! +🪙${G.fmt(g)}`, x, y, 'gold');
    coinFly(x, y, 10);
  } else { s.buffs.overdrive = now + 10000; nextAuto = 0; floatText('OVERDRIVE! ×5 speed', x, y, 'info'); }
}

// ---------- modal ----------
function modal(html) { $('modalcard').innerHTML = html; $('modal').hidden = false; }
function closeModal() { $('modal').hidden = true; if (s.boonChoice) showBoons(); }
function confirmModal(html, label, fn) {
  onConfirm = fn;
  modal(`${html}<div class="cfg"><div class="btns"><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>${label}</button></div></div>`);
}

function showBoons() {
  modal(`<h2>Choose a Boon</h2><p class="muted">Floor ${s.boonFloor} cleared · lasts until you ascend</p>
    <div class="boonlist">${s.boonChoice.map(id => {
      const b = G.BOONS[id];
      return `<button class="boon" data-boon="${id}"><span class="ico">${b.icon}</span><span><b>${b.name}</b>${s.boons[id] ? ` <small>(have ${s.boons[id]})</small>` : ''}<p>${b.desc}</p></span></button>`;
    }).join('')}</div>
    ${s.rerolls ? `<button class="btn" data-reroll>🔁 Reroll (${s.rerolls} left)</button>` : ''}`);
}

$('modal').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.boon) {
    const [x, y] = center(t);
    G.pickBoon(s, t.dataset.boon);
    burst(x, y, 30, ['#ffd000', '#a874ff', '#fff']);
    closeModal(); renderSheet(); updateUi();
  } else if ('reroll' in t.dataset) { G.rerollBoons(s); showBoons(); }
  else if ('ok' in t.dataset) { const f = onConfirm; onConfirm = null; closeModal(); f?.(); }
  else if ('close' in t.dataset) closeModal();
});

// ---------- panel ----------
const row = (act, title, lvl, desc, label = '') =>
  `<div class="row"><div class="info"><b>${title}</b>${lvl ? ` <small>${lvl}</small>` : ''}<p>${desc}</p></div><button class="buy" data-act="${act}" data-l="${label}"></button></div>`;

function renderSheet() {
  const el = $('sheet');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  el._h = null;
  if (tab === 'up') {
    const iv = G.autoInterval(s, Infinity) / 1000;
    el.innerHTML = `<p class="note">Auto ${s.up.auto ? iv.toFixed(2) + 's' : 'locked'} · Crit ${Math.round(G.critChance(s) * 100)}% ×${G.critMult(s)} · Gold ×${G.goldMult(s).toFixed(2)} · Dmg ×${G.dmgMult(s).toFixed(2)}</p>`
      + (s.dice.length < G.MAX_DICE ? row('die', 'New Die', `${s.dice.length}/${G.MAX_DICE}`, 'More dice, bigger combos') : '')
      + Object.entries(G.UPGRADES).filter(([id]) => id !== 'speed' || s.up.auto)
        .map(([id, u]) => row('up:' + id, u.name, u.max === 1 ? '' : 'Lv ' + s.up[id], u.desc)).join('');
  } else if (tab === 'dice') {
    el.innerHTML = '<p class="note">Levels add pips to every face. Tiers double the die.</p>'
      + s.dice.map((d, i) => `<div class="row"><div class="info"><b><span class="swatch t${d.tier}"></span>${G.TIERS[d.tier]} #${i + 1}</b> <small>Lv ${d.lvl}</small>
        <p>Faces ${G.fmt((1 + d.lvl) * 2 ** d.tier)}–${G.fmt((6 + d.lvl) * 2 ** d.tier)}</p></div>
        <div class="buys"><button class="buy" data-act="lvl:${i}" data-l="Lv+"></button><button class="buy" data-act="tier:${i}" data-l="Tier+"></button></div></div>`).join('')
      + (s.dice.length < G.MAX_DICE ? row('die', 'New Die', `${s.dice.length}/${G.MAX_DICE}`, 'Starts as Wood Lv 0') : '');
  } else if (tab === 'hilo') {
    renderHilo(el, s, hiloResult);
    sheetSig = hiloSig(s);
  } else if (tab === 'asc') {
    el.innerHTML = `<div class="hero"><p class="muted">Max floor this run <b id="amax"></b> · Best ${s.bestFloor}</p>
      <div class="big">+✦ <span id="egain"></span></div>
      <button class="btn wide primary" data-cmd="ascend" id="ascbtn"></button>
      <p class="note">Resets gold, dice, upgrades and boons. Ether is permanent.</p></div>`
      + Object.entries(G.PERMS).map(([id, p]) => row('perm:' + id, p.name, p.max === 1 ? '' : 'Lv ' + s.perm[id], p.desc)).join('');
  } else {
    el.innerHTML = `<div class="cfg">
      <p class="note">Rolls ${s.stats.rolls} · Jackpots ${s.stats.jackpots} · Ascensions ${s.stats.ascends} · Lifetime ✦ ${G.fmt(s.totalEther)} · Best floor ${s.bestFloor}</p>
      <p class="note">Saves automatically. Home-screen apps on iPhone keep separate storage from Safari, so export to back up or move a save.</p>
      <textarea id="savebox" placeholder="Paste a save here, then Import"></textarea>
      <div class="btns"><button class="btn" data-cmd="export">Export</button><button class="btn" data-cmd="import">Import</button></div>
      <button class="btn danger" data-cmd="reset">Hard reset</button></div>`;
  }
  updateSheet();
}

function updateSheet() {
  for (const b of $('sheet').querySelectorAll('[data-act]')) {
    const p = G.priceOf(s, b.dataset.act);
    setText(b, p ? `${b.dataset.l ? b.dataset.l + ' ' : ''}${p.cur === 'gold' ? '🪙' : '✦'}${G.fmt(p.cost)}` : 'MAX');
    b.disabled = !p;
    b.classList.toggle('ok', !!p && s[p.cur] >= p.cost);
    b.classList.toggle('ether', p?.cur === 'ether');
  }
  if (tab === 'asc') {
    const gain = G.etherGain(s), btn = $('ascbtn');
    setText($('amax'), s.maxFloor);
    setText($('egain'), G.fmt(gain));
    setText(btn, gain ? 'Ascend' : 'Reach floor 10 to Ascend');
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
  if (b.dataset.act) {
    if (G.buy(s, b.dataset.act)) {
      burst(e.clientX, e.clientY, 12, b.dataset.act.startsWith('perm') ? ['#7ee0ff', '#fff'] : ['#ffc94a', '#fff']);
      renderSheet(); updateUi();
    }
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

const resetView = () => { trayKey = ''; shownFloor = 0; save(s); renderSheet(); updateUi(); };

async function cmd(c) {
  if (c === 'ascend') {
    confirmModal(`<h2>Ascend?</h2><p>Gain <b style="color:var(--ether)">✦ ${G.fmt(G.etherGain(s))}</b> Ether.<br>Gold, dice, upgrades and boons reset.</p>`, 'Ascend ✦', () => {
      const g = G.ascend(s);
      flash = reduced ? 0 : 0.8;
      burst(innerWidth / 2, innerHeight / 2, 100, ['#7ee0ff', '#fff', '#a874ff']);
      resetView();
      toast(`+✦ ${G.fmt(g)} Ether`);
    });
  } else if (c === 'export') {
    const str = exportSave(s);
    $('savebox').value = str;
    try { await navigator.clipboard.writeText(str); toast('Save copied'); } catch { $('savebox').select(); toast('Copy the text above'); }
  } else if (c === 'import') {
    try { s = importSave($('savebox').value); resetView(); toast('Save loaded'); } catch { toast('Invalid save', 'bad'); }
  } else if (c === 'reset') {
    confirmModal('<h2>Hard reset?</h2><p>Erases everything, including Ether. Cannot be undone.</p>', 'Erase', () => {
      wipe(); s = G.newState(); resetView();
    });
  }
}

// ---------- HUD ----------
function updateUi(now = Date.now()) {
  setText($('gold'), G.fmt(s.gold));
  setText($('ether'), G.fmt(s.ether));
  setText($('floor'), s.floor);
  if (s.floor !== shownFloor) setMonster();
  const max = G.floorHp(s.floor);
  $('hpfill').style.width = Math.max(0, (s.hp / max) * 100) + '%';
  setText($('hptext'), `${G.fmt(Math.max(0, s.hp))} / ${G.fmt(max)}`);
  $('bosstimer').hidden = !s.bossEnd;
  if (s.bossEnd) $('bossfill').style.width = Math.max(0, ((s.bossEnd - now) / G.BOSS_TIME) * 100) + '%';
  const chips = [];
  if (now < s.buffs.frenzy) chips.push(`🔥 Frenzy ${Math.ceil((s.buffs.frenzy - now) / 1000)}s`);
  if (now < s.buffs.overdrive) chips.push(`⚡ Overdrive ${Math.ceil((s.buffs.overdrive - now) / 1000)}s`);
  setHtml($('buffs'), chips.map(c => `<span class="chip">${c}</span>`).join(''));
  setHtml($('boons'), Object.entries(s.boons).map(([id, n]) => `<span title="${G.BOONS[id].name}">${G.BOONS[id].icon}${n > 1 ? `<sup>${n}</sup>` : ''}</span>`).join(''));
  const ab = $('autobtn');
  ab.hidden = !s.up.auto;
  ab.classList.toggle('on', s.autoOn);
  setText(ab.lastChild, s.autoOn ? 'ON' : 'OFF');
  document.querySelector('[data-tab=hilo]').classList.toggle('new', s.tickets > 0 && tab !== 'hilo');
  document.querySelector('[data-tab=asc]').classList.toggle('new', G.etherGain(s) > 0 && tab !== 'asc');
  buildTray();
  updateSheet();
}

// ---------- offline ----------
const fmtTime = sec => (sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(sec / 60)}m`);
function welcomeBack() {
  const now = Date.now(), { gold, secs } = G.offlineGold(s, now);
  s.last = now;
  nextAuto = 0;
  if (!gold) return;
  s.gold += gold;
  modal(`<h2>Welcome back!</h2><p class="muted">Your dice kept rolling for ${fmtTime(secs)}${secs >= G.offlineCapH(s) * 3600 ? ' (max)' : ''}.</p>
    <div class="big">🪙 ${G.fmt(gold)}</div><button class="btn wide primary" data-close>Collect</button>`);
}

// ---------- input ----------
$('roll').addEventListener('pointerdown', e => { e.preventDefault(); doRoll(false); });
$('autobtn').addEventListener('click', () => { s.autoOn = !s.autoOn; nextAuto = 0; updateUi(); });
addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); doRoll(false); }
});
document.addEventListener('gesturestart', e => e.preventDefault()); // iOS pinch zoom
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { s.last = Date.now(); save(s); } else welcomeBack();
});
addEventListener('pagehide', () => save(s));
setInterval(() => save(s), 10000);

// ---------- loop ----------
let lastT = performance.now(), lastUi = 0;
function frame(t) {
  const now = Date.now(), dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  s.last = now;
  if (G.checkBoss(s, now)) { const [x, y] = center($('monster')); floatText('Boss escaped! Get stronger.', x, y - 40, 'bad'); }
  if (s.up.auto && s.autoOn && !rolling && now >= nextAuto) doRoll(true);
  if (now >= nextGolden) { spawnGolden(); nextGolden = now + (rand(60, 180) * 1000) / (s.boons.golden ? 2 : 1); }
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
