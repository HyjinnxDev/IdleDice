// Per-game rules + unique systems. Pure: each play gets (gs, S, rng, inc), where
// gs = that game's state, S = its stats (from tree levels), inc = income multiplier.
const A = (S, k) => S[k] || 0;     // additive stat, default 0
const M = (S, k) => S[k] ?? 1;     // multiplicative stat, default 1
const sum = a => a.reduce((x, y) => x + y, 0);

export const SYS = {
  dice: () => ({ mat: [], ench: [], n: 0 }),
  coin: () => ({ pot: 0, streak: 0, target: 3 }),
  cards: () => ({ strat: 'pairs' }),
  slots: () => ({ lvl: [], add: [], free: 0 }),
  plinko: () => ({ bk: {}, tilt: 0 }),
};
// What a rebirth clears from the workshop state (the rest is kept).
export const RESET = { coin: sys => { sys.pot = 0; sys.streak = 0; }, slots: sys => { sys.free = 0; } };

// ================= DICE =================
export const TIERS = ['Wood', 'Stone', 'Bronze', 'Silver', 'Gold', 'Crystal', 'Obsidian', 'Cosmic'];
export const ENCH = { w: ['🪶', 'Weighted', '1s and 2s reroll once'], g: ['✨', 'Gilded', '6s pay ×3'], l: ['🍀', 'Lucky', '+5% crit chance'] };
export const diceCount = S => 1 + A(S, 'dice');

export function combo(faces) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const f of faces) c[f]++;
  const [a, b] = c.slice(1).sort((x, y) => y - x);
  const run = (lo, hi) => { for (let i = lo; i <= hi; i++) if (!c[i]) return false; return true; };
  if (a >= 5) return { name: 'JACKPOT', mult: 20 };
  if (a >= 4) return { name: 'Four of a Kind', mult: 8 };
  if (run(1, 5) || run(2, 6)) return { name: 'Straight', mult: 5 };
  if (a >= 3 && b >= 2) return { name: 'Full House', mult: 4 };
  if (a >= 3) return { name: 'Triple', mult: 3 };
  if (a >= 2 && b >= 2) return { name: 'Two Pair', mult: 2 };
  if (a >= 2) return { name: 'Pair', mult: 1.5 };
  return { name: '', mult: 1 };
}

function playDice(gs, S, rng, inc) {
  const d6 = () => 1 + Math.floor(rng() * 6), { mat, ench } = gs.sys;
  const faces = Array.from({ length: diceCount(S) }, (_, i) => { const f = d6(); return ench[i] === 'w' && f <= 2 ? d6() : f; });
  const low = faces.map((_, i) => i).sort((a, b) => faces[a] - faces[b]).slice(0, A(S, 'load'));
  for (const i of low) faces[i] = Math.max(faces[i], d6());
  const cb = combo(faces);
  let mult = 1 + (cb.mult - 1) * (1 + A(S, 'combo'));
  if (cb.name === 'JACKPOT') mult *= M(S, 'jack');
  if (cb.name === 'Four of a Kind') mult *= M(S, 'quad');
  if (cb.mult > 1) mult *= M(S, 'fate');
  const lucky = faces.filter((_, i) => ench[i] === 'l').length;
  const crit = rng() < A(S, 'crit') + 0.05 * lucky;
  const echo = A(S, 'echo') > 0 && rng() < A(S, 'echo');
  gs.sys.n++;
  const burst = A(S, 'burst') > 0 && gs.sys.n % 10 === 0;
  const values = faces.map((f, i) => (f + A(S, 'val') + (f === 1 ? A(S, 'one') : 0)) * 2 ** (mat[i] || 0)
    * (f === 6 ? M(S, 'six') * (ench[i] === 'g' ? 3 : 1) : 1) * inc);
  const gold = sum(values) * mult * (crit ? (2 + A(S, 'critx')) * M(S, 'ocrit') : 1)
    * (echo ? 2 + A(S, 'reson') : 1) * (burst ? 1 + A(S, 'burst') : 1);
  const feats = [cb.mult > 1 && cb.name, crit && 'crit', echo && 'echo'].filter(Boolean);
  const label = [cb.mult > 1 && `${cb.name} ×${+mult.toFixed(1)}`, echo && 'ECHO', burst && 'BURST'].filter(Boolean).join(' · ');
  return { g: 'dice', faces, values, combo: cb, crit, gold, feats, label, rare: cb.name === 'JACKPOT',
    big: cb.mult >= 20 ? 3 : cb.mult >= 5 ? 2 : cb.mult >= 3 ? 1 : 0 };
}

const forgeCost = (i, t) => Math.ceil(300 * 100 ** t * 1.6 ** i); // ×2 value per tier, ×100 cost (RHO 0.15)
const enchCost = t => Math.ceil(2000 * 4 ** t);
const wsDice = {
  rows: (gs, S) => Array.from({ length: diceCount(S) }, (_, i) => {
    const t = gs.sys.mat[i] || 0, e = gs.sys.ench[i] || '';
    return { icon: '🎲', name: `Die ${i + 1} · ${TIERS[t]}`, tier: t,
      desc: `×${2 ** t} value · ${e ? `${ENCH[e][1]}: ${ENCH[e][2]}` : t >= 2 ? 'pick an enchant' : 'enchants unlock at Bronze'}`,
      btns: [{ id: `forge:${i}`, label: t >= 7 ? 'MAX' : 'Forge', cost: t >= 7 ? null : forgeCost(i, t), buy: true },
        ...(t >= 2 ? Object.keys(ENCH).map(k => ({ id: `ench:${i}:${k}`, label: ENCH[k][0], sel: e === k, cost: e === k ? null : enchCost(t), buy: !e })) : [])] };
  }),
  act(gs, id) { const [k, i, e] = id.split(':'); if (k === 'forge') gs.sys.mat[i] = (gs.sys.mat[i] || 0) + 1; else gs.sys.ench[i] = e; },
};

// ================= COINFLIP: Pot & Bank =================
export const coinCount = S => 1 + A(S, 'coins');
export const headChance = S => Math.min(0.9, 0.5 + A(S, 'head'));
export const streakCap = S => 10 + A(S, 'cap');
export const growth = S => 1.25 + A(S, 'grow');
export const edgeChance = S => 0.001 + A(S, 'edge');
export const keepOnTails = S => Math.min(0.9, A(S, 'ins'));
const STREAK_FEATS = [5, 10, 15, 20, 25, 30];

// Pays the pot out and resets it. Returns gold.
export function bank(sys, S) {
  const g = sys.pot * M(S, 'hot') * (1 + A(S, 'bank'));
  sys.pot = 0; sys.streak = 0;
  return g;
}

function playCoin(gs, S, rng, inc) {
  const sys = gs.sys, v = (1 + A(S, 'val')) * inc, cap = streakCap(S), target = Math.min(sys.target, cap);
  const flips = [], feats = [];
  let gold = 0, bankedAt = 0;
  for (let i = coinCount(S); i > 0; i--) {
    if (rng() < edgeChance(S)) { flips.push('E'); gold += v * (250 + A(S, 'edgex')) * M(S, 'edgem'); feats.push('edge'); continue; }
    if (rng() < headChance(S)) {
      flips.push('H');
      sys.streak++;
      sys.pot = (sys.pot + v) * growth(S);
      if (STREAK_FEATS.includes(sys.streak)) feats.push('s' + sys.streak);
      if (sys.streak >= target) { bankedAt = sys.streak; gold += bank(sys, S); feats.push('bank'); }
    } else {
      flips.push('T');
      const k = keepOnTails(S);
      sys.pot *= k; sys.streak = Math.floor(sys.streak * k);
    }
  }
  const label = flips.includes('E') ? 'EDGE!' : bankedAt ? `BANKED ${bankedAt} streak` : sys.streak >= 2 ? `${sys.streak} streak` : '';
  return { g: 'coin', flips, streak: sys.streak, pot: sys.pot, gold, feats, label,
    rare: flips.includes('E') || feats.includes('s10'), big: flips.includes('E') ? 3 : bankedAt >= 8 ? 2 : bankedAt >= 4 ? 1 : 0 };
}

// Average gold per flip at a given bank target (Monte Carlo, inc = 1). Used by the workshop and the pacing bot.
export function coinEV(gs, S, target, n = 3000, rng = Math.random) {
  const c = { sys: { pot: 0, streak: 0, target } };
  let g = 0;
  for (let i = 0; i < n; i++) g += playCoin(c, S, rng, 1).gold;
  return g / n;
}

const wsCoin = {
  rows(gs, S) {
    const t = Math.min(gs.sys.target, streakCap(S)), p = headChance(S), cap = streakCap(S);
    return [
      { icon: '🎯', name: `Bank target: ${t} streak`, desc: `Pot auto-banks at a ${t} streak. Chance to get there: ${(p ** t * 100).toFixed(t > 8 ? 2 : 1)}%. Max ${cap}.`,
        btns: [{ id: 'target:-1', label: '−', cost: 0, disabled: t <= 1 }, { id: 'target:1', label: '+', cost: 0, disabled: t >= cap }] },
      { icon: '📊', name: 'Odds', desc: `Heads ${(p * 100).toFixed(1)}% · pot ×${growth(S).toFixed(2)} per heads · tails keeps ${Math.round(keepOnTails(S) * 100)}% · edge ${(edgeChance(S) * 100).toFixed(2)}%`, btns: [] },
    ];
  },
  act(gs, id, S) { const d = +id.split(':')[1]; gs.sys.target = Math.max(1, Math.min(streakCap(S), Math.min(gs.sys.target, streakCap(S)) + d)); },
};

// ================= CARDS: Draw poker + strategy =================
export const HANDS = [['High Card', 1], ['Pair', 1.5], ['Two Pair', 2.5], ['Three of a Kind', 4], ['Straight', 6],
  ['Flush', 8], ['Full House', 12], ['Four of a Kind', 30], ['Straight Flush', 75], ['Royal Flush', 250]];

// Best 5-card hand from 5–8 cards {r: 2..14, s: 0..3}. `used` = indices that make the hand.
export function pokerHand(cards) {
  const H = (rank, used) => ({ rank, name: HANDS[rank][0], mult: HANDS[rank][1], used });
  const byR = {}, byS = {};
  cards.forEach((c, i) => { (byR[c.r] ??= []).push(i); (byS[c.s] ??= []).push(i); });
  const straight = idx => {
    const m = {};
    for (const i of idx) m[cards[i].r] ??= i;
    if (m[14] !== undefined) m[1] = m[14]; // A-2-3-4-5
    for (let hi = 14; hi >= 5; hi--) {
      const run = [];
      for (let r = hi; r > hi - 5 && m[r] !== undefined; r--) run.push(m[r]);
      if (run.length === 5) return { hi, run };
    }
    return null;
  };
  const flush = Object.values(byS).find(a => a.length >= 5);
  if (flush) { const sf = straight(flush); if (sf) return H(sf.hi === 14 ? 9 : 8, sf.run); }
  const [g1, g2] = Object.values(byR).sort((a, b) => b.length - a.length || cards[b[0]].r - cards[a[0]].r);
  if (g1.length >= 4) return H(7, g1.slice(0, 4));
  if (g1.length >= 3 && g2?.length >= 2) return H(6, [...g1.slice(0, 3), ...g2.slice(0, 2)]);
  if (flush) return H(5, flush.sort((a, b) => cards[b].r - cards[a].r).slice(0, 5));
  const st = straight(cards.map((_, i) => i));
  if (st) return H(4, st.run);
  if (g1.length === 3) return H(3, g1);
  if (g1.length === 2 && g2?.length === 2) return H(2, [...g1, ...g2]);
  if (g1.length === 2) return H(1, g1);
  return H(0, [g1[0]]);
}

export const STRATS = {
  pairs: ['👯', 'Keep Pairs', 'Hold matching ranks, redraw the rest'],
  flush: ['♥️', 'Chase Flush', 'Hold the biggest suit (3+), else pairs'],
  straight: ['📏', 'Chase Straight', 'Hold the longest run (3+), else pairs'],
  smart: ['🧠', 'Smart', 'Holds whatever is closest to a big hand (stage 15)'],
};
export const SMART_AT = 15;

const pairIdx = cards => { const c = {}; for (const x of cards) c[x.r] = (c[x.r] || 0) + 1; return cards.map((x, i) => i).filter(i => c[cards[i].r] >= 2); };
const suitIdx = cards => { const by = {}; cards.forEach((x, i) => (by[x.s] ??= []).push(i)); return Object.values(by).sort((a, b) => b.length - a.length)[0]; };
function runIdx(cards) {
  let best = [];
  for (let lo = 1; lo <= 10; lo++) {
    const got = [];
    for (let r = lo; r < lo + 5; r++) { const i = cards.findIndex(x => x.r === r || (r === 1 && x.r === 14)); if (i >= 0) got.push(i); }
    if (got.length > best.length) best = got;
  }
  return best;
}
// Indices to keep before a draw.
export function holds(cards, strat) {
  const h = pokerHand(cards);
  if (h.rank >= 4) return h.used;
  const pairs = pairIdx(cards), suit = suitIdx(cards), run = runIdx(cards);
  if (strat === 'flush') return suit.length >= 3 ? suit : pairs;
  if (strat === 'straight') return run.length >= 3 ? run : pairs;
  if (strat === 'smart') {
    if (suit.length >= 4) return suit;
    if (h.rank >= 1) return pairs;
    if (run.length >= 4) return run;
    if (suit.length >= 3) return suit;
    return cards.map((x, i) => i).filter(i => cards[i].r >= 11);
  }
  return pairs;
}
export const deckSize = S => (13 - A(S, 'thin')) * (4 - A(S, 'suit'));

function deal(gs, S, rng, inc) {
  const deck = [];
  for (let r = 2 + A(S, 'thin'); r <= 14; r++) for (let su = 0; su < 4 - A(S, 'suit'); su++) deck.push({ r, s: su });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const n = 5 + A(S, 'extra'), cards = deck.slice(0, n), strat = gs.sys.strat === 'smart' && gs.stage < SMART_AT ? 'pairs' : gs.sys.strat;
  let pos = n, drawn = 0;
  for (let d = 1 + A(S, 'draws'); d > 0; d--) {
    const keep = new Set(holds(cards, strat));
    for (let i = 0; i < n && pos < deck.length; i++) if (!keep.has(i)) { cards[i] = deck[pos++]; drawn++; }
  }
  const h = pokerHand(cards);
  let mult = 1 + (h.mult - 1) * (1 + A(S, 'power'));
  if (h.rank >= 4) mult *= (1 + A(S, 'royal')) * M(S, 'grand');
  if (h.rank >= 1 && h.rank <= 3) mult *= (1 + A(S, 'pairs')) * M(S, 'bread');
  if (h.rank === 5) mult *= M(S, 'flushm');
  if (h.rank === 3 || h.rank === 6) mult *= M(S, 'setm');
  const face = 1 + A(S, 'face');
  const base = sum(h.used.map(i => (cards[i].r === 14 ? 14 + A(S, 'ace') : cards[i].r) * (cards[i].r >= 11 ? face : 1))) * (1 + A(S, 'valp'));
  return { g: 'cards', cards, hand: h, drawn, gold: base * mult * inc, feats: h.rank ? [h.name] : [],
    label: h.rank ? `${h.name} ×${+mult.toFixed(1)}` : '', rare: h.rank >= 7, big: h.rank >= 8 ? 3 : h.rank >= 5 ? 2 : h.rank >= 3 ? 1 : 0 };
}
function playCards(gs, S, rng, inc) {
  const a = deal(gs, S, rng, inc);
  if (!(A(S, 'second') > 0 && rng() < A(S, 'second'))) return a;
  const b = deal(gs, S, rng, inc);
  return b.gold > a.gold ? b : a;
}

const wsCards = {
  rows: (gs, S) => [
    { icon: '🂠', name: `${deckSize(S)}-card deck · ${5 + A(S, 'extra')} cards · ${1 + A(S, 'draws')} draw${A(S, 'draws') ? 's' : ''}`,
      desc: 'Each hand: deal, hold cards by your strategy, redraw the rest, then score the best 5.', btns: [] },
    ...Object.entries(STRATS).map(([k, [icon, name, desc]]) => {
      const on = gs.sys.strat === k, locked = k === 'smart' && gs.stage < SMART_AT;
      return { icon, name, desc, btns: [{ id: `strat:${k}`, label: on ? '✓ Active' : locked ? '🔒' : 'Use', cost: on ? null : 0, sel: on, disabled: locked }] };
    }),
  ],
  act(gs, id) { gs.sys.strat = id.split(':')[1]; },
};

// ================= SLOTS: Reel Workshop =================
export const SYMS = ['🍒', '🍋', '🔔', '🍀', '⭐', '💎', '7️⃣'];
export const SYMN = ['Cherry', 'Lemon', 'Bell', 'Clover', 'Star', 'Diamond', 'Seven'];
const PAY = [10, 15, 20, 30, 50, 100, 250], W = [8, 7, 6, 5, 4, 3, 2];
export const WILD = 7, SCAT = 8, GLYPH = [...SYMS, '🃏', '💠'];
export const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2]];
export const reelCount = S => Math.min(5, 3 + A(S, 'reels'));
export const lineCount = S => Math.min(5, 1 + A(S, 'lines'));
const runMult = (S, c) => (c === 2 ? 0.5 * (1 + A(S, 'pair')) : c === 3 ? 3 : c === 4 ? 15 * M(S, 'longm') : 75 * M(S, 'longm') * M(S, 'fivem'));

export function spinGrid(gs, S, rng) {
  const w = W.map((x, i) => x + (gs.sys.add[i] || 0)).concat(A(S, 'wild'), A(S, 'scatter'));
  const tot = sum(w), pick = () => { let x = rng() * tot, i = 0; while ((x -= w[i]) >= 0) i++; return i; };
  const grid = Array.from({ length: reelCount(S) }, () => [pick(), pick(), pick()]);
  if (A(S, 'expand')) for (const reel of grid) if (reel.includes(WILD)) reel.fill(WILD);
  return grid;
}

// Scores a grid. Mutates gs.sys.free (free spins).
export function scoreSlots(gs, S, grid, inc) {
  const wins = [], feats = [], lvl = gs.sys.lvl;
  for (let l = 0; l < lineCount(S); l++) {
    const cells = LINES[l].slice(0, grid.length).map((row, c) => [c, row]), syms = cells.map(([c, row]) => grid[c][row]);
    if (syms[0] === SCAT) continue;
    let base = syms.find(x => x !== WILD);
    if (base === undefined) base = 6;
    if (base === SCAT) continue;
    let count = 0;
    while (count < syms.length && (syms[count] === base || syms[count] === WILD)) count++;
    let m = count >= 2 ? runMult(S, count) : base === 0 && A(S, 'cherry') ? 0.1 * A(S, 'cherry') : 0;
    if (!m) continue;
    m *= (1 + 0.5 * (lvl[base] || 0)) * (1 + A(S, 'sym')) * (base <= 2 ? 1 + A(S, 'low') : base >= 4 ? 1 + A(S, 'high') : 1)
      * (base === 6 ? M(S, 'seven') : 1) * (count >= 2 && syms.slice(0, count).includes(WILD) ? M(S, 'wildm') : 1);
    wins.push({ line: l, count, base, cells: cells.slice(0, Math.max(1, count)), pay: PAY[base] * m });
    if (count >= 3) feats.push('x' + count, `s${base}x${count}`);
  }
  let mult = wins.length > 1 ? (1 + A(S, 'lcomb')) ** (wins.length - 1) : 1, free = false;
  if (gs.sys.free > 0) { gs.sys.free--; free = true; mult *= (2 + A(S, 'freem')) * M(S, 'freex'); }
  if (grid.flat().filter(x => x === SCAT).length >= 3) { gs.sys.free += 5 + A(S, 'freen'); feats.push('free'); }
  const gold = sum(wins.map(w => w.pay)) * mult * (1 + A(S, 'val')) * inc, best = Math.max(0, ...wins.map(w => w.count));
  const top = wins.find(w => w.count === best);
  const label = [best >= 3 && `${best}× ${SYMS[top.base]}`, feats.includes('free') && 'FREE SPINS!', free && `FREE ${gs.sys.free} left`].filter(Boolean).join(' · ');
  const seven = wins.some(w => w.base === 6 && w.count >= 3);
  return { g: 'slots', grid, wins, gold, free: gs.sys.free, feats, label, rare: best >= 4 || seven,
    big: best >= 5 || (seven && best >= 4) ? 3 : best >= 4 || seven ? 2 : best >= 3 || feats.includes('free') ? 1 : 0 };
}
const playSlots = (gs, S, rng, inc) => scoreSlots(gs, S, spinGrid(gs, S, rng), inc);

const wsSlots = {
  rows: (gs, S) => SYMS.map((sym, i) => {
    const l = gs.sys.lvl[i] || 0, a = gs.sys.add[i] || 0;
    return { icon: sym, name: `${SYMN[i]} · Lv ${l}`, desc: `Pays ${PAY[i]}× base · +${50 * l}% · ${W[i] + a} on each reel`,
      btns: [{ id: `lvl:${i}`, label: 'Polish', cost: Math.ceil(PAY[i] * 10 * 2.6 ** l), buy: true },
        { id: `add:${i}`, label: '+1 copy', cost: Math.ceil(50 * PAY[i] * 5 ** a), buy: true }] };
  }),
  act(gs, id) { const [k, i] = id.split(':'); gs.sys[k][i] = (gs.sys[k][i] || 0) + 1; },
};

// ================= PLINKO: Board Workshop =================
export const rowCount = S => Math.min(16, 8 + A(S, 'rows'));
export const tiltBias = S => 0.03 + A(S, 'tiltp');

// Multiplier for bucket k (0..R) on an R-row board.
export function bucketMult(S, sys, R, k) {
  const off = k - R / 2, d = Math.abs(off) / (R / 2), a = 2.42 + 0.35 * (R - 8);
  return (0.5 * Math.exp(a * d * d) + (Math.abs(off) <= 1 ? A(S, 'centera') : 0))
    * (d === 1 ? M(S, 'edgem') : 1) * (Math.abs(off) >= R / 2 - 1 ? M(S, 'outerm') : 1)
    * (1 + A(S, 'bkt')) * (1 + 0.5 * (sys.bk[off] || 0));
}

function dropBall(S, sys, R, rng) {
  const q = Math.min(0.95, Math.max(0.05, 0.5 + sys.tilt * tiltBias(S))), path = [];
  let golden = 0;
  for (let r = 0; r < R; r++) { path.push(rng() < q ? 1 : 0); if (A(S, 'gpeg') > 0 && rng() < A(S, 'gpeg')) golden++; }
  return { path, k: sum(path), golden };
}

function playPlinko(gs, S, rng, inc) {
  const R = rowCount(S), sys = gs.sys, balls = [];
  let n = 1 + A(S, 'balls'), extra = 0;
  for (let i = 0; i < n; i++) {
    balls.push(dropBall(S, sys, R, rng));
    if (extra < 3 && A(S, 'split') > 0 && rng() < A(S, 'split')) { n++; extra++; }
    if (extra < 3 && A(S, 'redrop') > 0 && rng() < A(S, 'redrop')) { n++; extra++; }
  }
  const per = {}, feats = [];
  for (const b of balls) per[b.k] = (per[b.k] || 0) + 1;
  const v = (1 + A(S, 'val') + A(S, 'rowv') * R) * inc;
  for (const b of balls) {
    b.gold = v * bucketMult(S, sys, R, b.k) * ((2 + A(S, 'gpm')) * M(S, 'gpx')) ** b.golden * (1 + A(S, 'same') * (per[b.k] - 1));
    if (b.k === 0 || b.k === R) { feats.push('edge'); for (const t of [12, 14, 16]) if (R >= t) feats.push('edge' + t); }
    if (b.golden) feats.push('gold');
  }
  if (Object.values(per).some(c => c >= 3)) feats.push('same3');
  const edge = feats.includes('edge'), gold = sum(balls.map(b => b.gold));
  const best = Math.max(...balls.map(b => bucketMult(S, sys, R, b.k)));
  return { g: 'plinko', R, balls, gold, feats, rare: edge,
    label: edge ? 'EDGE!' : balls.some(b => b.golden) ? 'GOLDEN PEG' : best >= 2 ? `×${best.toFixed(1)}` : '',
    big: edge ? 3 : balls.some(b => b.golden) ? 2 : best >= 2 ? 1 : 0 };
}

const wsPlinko = {
  rows(gs, S) {
    const R = rowCount(S), t = gs.sys.tilt;
    return [
      { icon: '↔️', name: `Tilt: ${['Left', 'Centre', 'Right'][t + 1]}`, desc: `Each bounce leans ${(tiltBias(S) * 100).toFixed(0)}% toward the tilted side. Pair it with upgraded buckets on that side.`,
        btns: [-1, 0, 1].map(d => ({ id: `tilt:${d}`, label: ['◀', '●', '▶'][d + 1], cost: d === t ? null : 0, sel: d === t })) },
      ...Array.from({ length: R + 1 }, (_, k) => {
        const off = k - R / 2, l = gs.sys.bk[off] || 0, d = Math.abs(off) / (R / 2);
        return { icon: d === 1 ? '🎯' : d >= 0.75 ? '🟣' : d >= 0.4 ? '🔵' : '⚪', name: `Bucket ${off > 0 ? '+' : ''}${off} · ×${bucketMult(S, gs.sys, R, k).toFixed(2)}`,
          desc: `Lv ${l} · +50% per level`, btns: [{ id: `bk:${off}`, label: 'Upgrade', cost: Math.ceil(20 * (1 + 9 * (1 - d)) * 2.5 ** l), buy: true }] };
      }),
    ];
  },
  act(gs, id) { const [k, v] = id.split(':'); if (k === 'tilt') gs.sys.tilt = +v; else gs.sys.bk[v] = (gs.sys.bk[v] || 0) + 1; },
};

export const PLAY = { dice: playDice, coin: playCoin, cards: playCards, slots: playSlots, plinko: playPlinko };
export const WS = { dice: wsDice, coin: wsCoin, cards: wsCards, slots: wsSlots, plinko: wsPlinko };
export const WS_NAME = { dice: 'Forge', coin: 'Bank', cards: 'Strategy', slots: 'Reels', plinko: 'Board' };

const SUF = ['', 'K', 'M', 'B', 'T'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 100 && n % 1 > 0.05) return n.toFixed(1); // small fractional payouts (plinko, EVs) shouldn't read as 0
  if (n < 1000) return String(Math.floor(Math.max(0, n)));
  const e = Math.floor(Math.log10(n) / 3), v = n / 1000 ** e;
  const suf = e < SUF.length ? SUF[e] : String.fromCharCode(97 + Math.floor((e - 5) / 26)) + String.fromCharCode(97 + ((e - 5) % 26));
  return v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + suf;
}
