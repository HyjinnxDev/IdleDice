// Per-game stage rendering (build / animate / land) + workshop panel. DOM only; rules live in game.js/modes.js.
import * as G from './game.js';

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
// cube rotation [x, y] that shows each face to the viewer
const SHOW = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
const RANKS = '..23456789TJQKA', SUITS = '♠♥♦♣';
export const DUR = { dice: 420, coin: 600, cards: 650, slots: 900, plinko: 1100 };
const STAGGER = 140; // ms between plinko balls

let stageKey = '';
export const resetStage = () => { stageKey = ''; };

function sig(s, g, S) {
  const sys = s.g[g].sys;
  if (g === 'dice') return `${G.diceCount(S)}|${sys.mat.join()}|${sys.ench.join()}`;
  if (g === 'coin') return `${G.coinCount(S)}|${Math.min(7, G.L(s, 'c_mint'))}`;
  if (g === 'cards') return `${5 + (S.extra || 0)}|${G.L(s, 'k_foil')}`;
  if (g === 'slots') return `${G.reelCount(S)}`;
  const R = G.rowCount(S);
  return `${R}|${Array.from({ length: R + 1 }, (_, k) => G.bucketMult(S, sys, R, k).toFixed(1)).join()}`;
}

export function buildStage(s) {
  const g = s.view, S = G.stats(s, g), key = g + sig(s, g, S);
  if (key === stageKey) return;
  stageKey = key;
  const t = $('table'), sys = s.g[g].sys, many = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  t.className = `g-${g}${g === 'cards' && G.L(s, 'k_foil') ? ' foil' : ''}`;
  $('app').style.setProperty('--hue', G.GAMES[g].hue);
  if (g === 'dice') {
    const faces = [1, 2, 3, 4, 5, 6].map(f => `<div class="face f${f}">${'<i></i>'.repeat(f)}</div>`).join('');
    t.innerHTML = many(G.diceCount(S), i => `<div class="die t${sys.mat[i] || 0}"><div class="cube">${faces}</div><span class="val"></span>${sys.ench[i] ? `<span class="ench">${G.ENCH[sys.ench[i]][0]}</span>` : ''}</div>`);
  } else if (g === 'coin') {
    const tier = Math.min(7, G.L(s, 'c_mint'));
    t.innerHTML = many(G.coinCount(S), () => `<div class="coin3d t${tier}"><div class="spin"><div class="cface h">♛</div><div class="cface tl">✦</div></div></div>`);
  } else if (g === 'cards') {
    t.innerHTML = many(5 + (S.extra || 0), () => '<div class="pcard"><div class="in"><div class="fr"></div><div class="bk"></div></div></div>');
  } else if (g === 'slots') {
    t.innerHTML = `<div class="reels">${many(G.reelCount(S), () => `<div class="reel">${many(3, () => `<div class="sym">${G.SYMS[Math.floor(Math.random() * 7)]}</div>`)}</div>`)}</div>`;
  } else {
    const R = G.rowCount(S), sp = 92 / (R + 1);
    const pegs = many(R, r => many(r + 2, i => `<i class="peg" style="left:${50 + (i - (r + 1) / 2) * sp}%;top:${((r + 0.5) / R) * 100}%"></i>`));
    const bks = many(R + 1, k => { const m = G.bucketMult(S, sys, R, k); return `<span class="bk${m >= 5 ? ' hot' : m >= 1 ? ' warm' : ''}" style="left:${50 + (k - R / 2) * sp}%;width:${sp}%">${m >= 10 ? Math.round(m) : m.toFixed(1)}</span>`; });
    t.innerHTML = `<div class="board" style="--sp:${sp}%">${pegs}</div><div class="buckets">${bks}</div>`;
  }
}

// How long a play's animation runs (ms).
export const animLen = (r, dur) => (r.g === 'plinko' ? dur + STAGGER * (r.balls.length - 1) : dur);

export const ANIM = {
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
  slots(r, dur) {
    const reels = [...$('table').querySelectorAll('.reel')];
    reels.forEach((reel, c) => {
      for (const el of reel.children) el.classList.remove('hl');
      reel.classList.add('spin');
      setTimeout(() => {
        reel.classList.remove('spin');
        [...reel.children].forEach((el, row) => { el.textContent = G.GLYPH[r.grid[c]?.[row]] ?? ''; });
        restart(reel, 'stop');
      }, dur * (0.45 + (0.55 * c) / Math.max(1, reels.length - 1)) - 40);
    });
  },
  plinko(r, dur) {
    const board = $('table').querySelector('.board'), bks = $('table').querySelectorAll('.bk');
    if (!board) return;
    const sp = 92 / (r.R + 1);
    r.balls.forEach((b, j) => {
      const el = document.createElement('i');
      el.className = 'ball' + (b.golden ? ' gold' : '');
      board.append(el);
      const pts = [{ left: '50%', top: '-6%' }];
      let x = 0;
      b.path.forEach((d, row) => { pts.push({ left: `${50 + (x - row / 2) * sp}%`, top: `${((row + 0.5) / r.R) * 100 - 3}%` }); x += d; });
      pts.push({ left: `${50 + (b.k - r.R / 2) * sp}%`, top: '104%' });
      const a = el.animate(pts, { duration: dur, delay: j * STAGGER, easing: 'cubic-bezier(.4,0,.9,.7)', fill: 'backwards' });
      a.onfinish = () => { el.remove(); if (bks[b.k]) restart(bks[b.k], 'hit'); };
    });
  },
};

export const LAND = {
  dice(r) {
    const els = $('table').children;
    r.values.forEach((v, i) => {
      const el = els[i];
      if (!el) return;
      el.classList.toggle('hl', !!el._hl);
      el.querySelector('.val').textContent = G.fmt(v);
      restart(el.querySelector('.val'), 'show');
    });
  },
  coin() { for (const el of $('table').children) { el.classList.toggle('hl', el._f === 'H'); el.classList.toggle('edge', el._f === 'E'); } },
  cards(r) { const els = $('table').children; r.hand.used.forEach(i => els[i]?.classList.add('hl')); },
  slots(r) {
    const reels = $('table').querySelectorAll('.reel');
    for (const w of r.wins) for (const [c, row] of w.cells) reels[c]?.children[row]?.classList.add('hl');
  },
  plinko() {},
};

export function infoText(s, g) {
  const S = G.stats(s, g), sys = s.g[g].sys, auto = G.hasAuto(s, g) ? ` · auto ${(G.autoIv(s, g) / 1000).toFixed(2)}s` : '';
  if (g === 'dice') { const n = G.diceCount(S); return `${n} ${n > 1 ? 'dice' : 'die'}${auto}`; }
  if (g === 'coin') return `🔥 ${sys.streak}/${Math.min(sys.target, G.streakCap(S))} streak · pot ${G.GAMES.coin.ci}${G.fmt(sys.pot)} · ${Math.round(G.headChance(S) * 100)}% heads${auto}`;
  if (g === 'cards') return `${5 + (S.extra || 0)} cards · ${G.deckSize(S)}-card deck · ${G.STRATS[sys.strat][1]}${auto}`;
  if (g === 'slots') return `${G.reelCount(S)} reels · ${G.lineCount(S)} line${G.lineCount(S) > 1 ? 's' : ''}${sys.free ? ` · 🎁 ${sys.free} free` : ''}${auto}`;
  const R = G.rowCount(S);
  return `${R} rows · ${1 + (S.balls || 0)} ball${S.balls ? 's' : ''} · tilt ${['◀', '●', '▶'][sys.tilt + 1]}${auto}`;
}

// ---------- workshop panel ----------
const rowSig = rows => rows.map(r => r.name + r.desc + r.btns.map(b => b.id + b.cost + b.sel + b.disabled).join()).join('|');
let wsSig = '';
export function wsHtml(s, g) {
  const rows = G.wsRows(s, g), ci = G.GAMES[g].ci;
  wsSig = rowSig(rows);
  let extra = '';
  if (g === 'coin') { // expected value per flip for nearby bank targets
    const gs = s.g.coin, S = G.stats(s, 'coin'), t = Math.min(gs.sys.target, G.streakCap(S));
    const ts = [t - 2, t - 1, t, t + 1, t + 2].filter(x => x >= 1 && x <= G.streakCap(S));
    extra = `<div class="ev">${ts.map(x => `<span class="${x === t ? 'on' : ''}"><b>${x}</b>${G.fmt(G.coinEV(gs, S, x, 2000) * G.incomeMult(s, 'coin', Infinity, S))}/flip</span>`).join('')}</div>
      <p class="note">Average payout per flip at each bank target. Higher targets pay more when they land but fail more often.</p>`;
  }
  return `<p class="note">${G.WS_NAME[g]} · upgrades here are kept when you rebirth.</p>` + rows.map(r => `<div class="row wsrow"><span class="ico">${r.icon}</span>
    <div class="info"><b>${r.name}</b><p>${r.desc}</p></div><div class="wsb">${r.btns.map(b =>
      `<button class="buy${b.sel ? ' sel' : ''}" data-ws="${b.id}" data-cost="${b.cost || 0}" ${b.disabled || b.cost == null ? 'disabled' : ''}>${b.label}${b.cost ? `<small>${ci}${G.fmt(b.cost)}</small>` : ''}</button>`).join('')}</div></div>`).join('') + extra;
}
// True when the rows changed and the panel needs a rebuild; otherwise just refreshes affordability.
export function wsUpdate(el, s, g) {
  if (rowSig(G.wsRows(s, g)) !== wsSig) return true;
  const cash = s.g[g].cash;
  for (const b of el.querySelectorAll('[data-ws]')) b.classList.toggle('ok', +b.dataset.cost > 0 && cash >= +b.dataset.cost);
  return false;
}
