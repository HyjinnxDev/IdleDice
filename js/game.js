// Pure game logic. No DOM — `node test.js` exercises everything here.
// ponytail: plain Number caps ~1e308; swap to break_infinity.js if late game exceeds it.
import { TREES } from './trees.js';
export { TREES };

export const NODE = {};
for (const t in TREES) for (const node of TREES[t]) NODE[node.id] = { ...node, tree: t };

// p = node id prefix, iv = base auto interval (ms), unlock = perm node that opens the game.
export const GAMES = {
  dice:  { name: 'Dice',     icon: '🎲', verb: 'ROLL', p: 'd', iv: 2500, unlock: null },
  coin:  { name: 'Coinflip', icon: '🪙', verb: 'FLIP', p: 'c', iv: 2000, unlock: 'p_coin' },
  cards: { name: 'Cards',    icon: '🃏', verb: 'DEAL', p: 'k', iv: 4000, unlock: 'p_cards' },
};
export const TIERS = ['Wood', 'Stone', 'Bronze', 'Silver', 'Gold', 'Crystal', 'Obsidian', 'Cosmic'];
export const PRESTIGE_AT = 1e7;
export const MAX_TICKETS = 10;

export const L = (s, id) => s.lv[id] || 0;
export const gameOn = (s, g) => !GAMES[g].unlock || L(s, GAMES[g].unlock) > 0;
export const hasAuto = (s, g) => gameOn(s, g) && L(s, GAMES[g].p + '_auto') > 0;
export function isUnlocked(s, id) {
  const nd = NODE[id];
  return (nd.tree === 'perm' || gameOn(s, nd.tree)) && (!nd.req.length || nd.req.some(r => L(s, r) > 0));
}

export function newState(now = Date.now()) {
  const s = { v: 2, view: 'dice', chips: 0, totalChips: 0, tickets: 0, last: now, lv: {}, autoOff: {},
    buffs: { frenzy: 0, overdrive: 0 }, stats: { plays: 0, jackpots: 0, prestiges: 0, earned: 0, best: '' } };
  return newRun(s);
}

// Reset run: gold + every non-perm node.
export function newRun(s) {
  for (const id in s.lv) if (NODE[id]?.tree !== 'perm') delete s.lv[id];
  if (L(s, 'p_autop')) for (const g in GAMES) s.lv[GAMES[g].p + '_auto'] = 1;
  s.gold = L(s, 'p_head') ? 100 * 10 ** L(s, 'p_head') : 0;
  s.runEarned = 0;
  s.coin = { streak: 0 };
  return s;
}

export const incomeMult = (s, now) => (1 + 0.1 * L(s, 'p_bonus')) * (now < s.buffs.frenzy ? 7 : 1);
export const offlineCapH = s => 2 + 2 * L(s, 'p_off');
export const goldenRate = s => 1 + 0.25 * L(s, 'p_gold');

// Pass now = Infinity to ignore timed buffs (estimates).
export function autoIv(s, g, now = Infinity) {
  const p = GAMES[g].p;
  const iv = Math.max(200, GAMES[g].iv * 0.9 ** L(s, p + '_speed') * 0.85 ** L(s, p + '_over'));
  return now < s.buffs.overdrive ? iv / 5 : iv;
}

// ---------- dice ----------
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

function playDice(s, rng, now) {
  const d6 = () => 1 + Math.floor(rng() * 6);
  const faces = Array.from({ length: 1 + L(s, 'd_die') + L(s, 'd_six') }, d6);
  const low = faces.map((_, i) => i).sort((a, b) => faces[a] - faces[b]).slice(0, L(s, 'd_load'));
  for (const i of low) faces[i] = Math.max(faces[i], d6());
  const cb = combo(faces);
  let mult = 1 + (cb.mult - 1) * (1 + 0.25 * L(s, 'd_combo'));
  if (cb.name === 'JACKPOT') mult *= 2 ** L(s, 'd_jack');
  const crit = rng() < 0.02 * L(s, 'd_crit');
  const per = 2 ** L(s, 'd_mat') * 1.15 ** L(s, 'd_rush') * incomeMult(s, now);
  const values = faces.map(f => (f + L(s, 'd_pip')) * per);
  const gold = values.reduce((a, b) => a + b, 0) * mult * (crit ? 2 + 0.5 * L(s, 'd_critx') : 1);
  return { g: 'dice', faces, values, combo: cb, crit, gold, rare: cb.name === 'JACKPOT',
    label: cb.mult > 1 ? `${cb.name} ×${+mult.toFixed(1)}` : '' };
}

// ---------- coinflip ----------
export const streakGrowth = s => 1.2 + 0.04 * L(s, 'c_pow');
export const streakCap = s => 10 + 2 * L(s, 'c_cap');

function playCoin(s, rng, now) {
  const pHead = 0.5 + 0.015 * L(s, 'c_weight'), cap = streakCap(s), gr = streakGrowth(s);
  const v = (1 + L(s, 'c_shiny')) * 2 ** L(s, 'c_mint') * 1.15 ** L(s, 'c_rush') * incomeMult(s, now);
  const flips = [];
  let gold = 0, rare = false;
  for (let i = 1 + L(s, 'c_twin'); i > 0; i--) {
    if (rng() < 0.002 * (1 + L(s, 'c_edge'))) { flips.push('E'); gold += v * 250; continue; }
    if (rng() < pHead) {
      const prev = s.coin.streak;
      s.coin.streak = Math.min(cap, prev + 1);
      if (prev < 10 && s.coin.streak >= 10) rare = true;
      gold += v * gr ** s.coin.streak;
      flips.push('H');
    } else {
      s.coin.streak = Math.floor(s.coin.streak * 0.25 * L(s, 'c_ins'));
      flips.push('T');
    }
  }
  const st = s.coin.streak;
  return { g: 'coin', flips, streak: st, gold, rare,
    label: flips.includes('E') ? 'EDGE!' : st >= 2 ? `${st} streak ×${+(gr ** st).toFixed(1)}` : '' };
}

// ---------- cards ----------
export const HANDS = [['High Card', 1], ['Pair', 1.5], ['Two Pair', 2.5], ['Three of a Kind', 4], ['Straight', 6],
  ['Flush', 8], ['Full House', 12], ['Four of a Kind', 30], ['Straight Flush', 75], ['Royal Flush', 250]];

// Best 5-card hand from 5–7 cards {r: 2..14, s: 0..3}. `used` = indices that make the hand.
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

function playCards(s, rng, now) {
  const deck = [];
  for (let r = 2 + L(s, 'k_thin'); r <= 14; r++) for (let su = 0; su < 4; su++) deck.push({ r, s: su });
  const n = 5 + L(s, 'k_extra');
  for (let i = 0; i < n; i++) { const j = i + Math.floor(rng() * (deck.length - i)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const cards = deck.slice(0, n), h = pokerHand(cards);
  let mult = 1 + (h.mult - 1) * (1 + 0.25 * L(s, 'k_power'));
  if (h.rank >= 4) mult *= 1 + L(s, 'k_royal');
  const base = h.used.reduce((a, i) => a + cards[i].r, 0) * (1 + 0.25 * L(s, 'k_sharp'));
  const gold = base * mult * 2 ** L(s, 'k_foil') * 1.15 ** L(s, 'k_rush') * incomeMult(s, now);
  return { g: 'cards', cards, hand: h, gold, rare: h.rank >= 7, label: h.rank ? `${h.name} ×${+mult.toFixed(1)}` : '' };
}

const PLAY = { dice: playDice, coin: playCoin, cards: playCards };
// Rolls one round. Mutates only s.coin (streak). Use collect() to bank it.
export const play = (s, g, rng = Math.random, now = Date.now()) => PLAY[g](s, rng, now);

export function earn(s, gold) { s.gold += gold; s.runEarned += gold; s.stats.earned += gold; }
export function collect(s, r) {
  earn(s, r.gold);
  s.stats.plays++;
  if (r.rare) s.tickets = Math.min(MAX_TICKETS, s.tickets + 1);
  if (r.combo?.name === 'JACKPOT') s.stats.jackpots++;
}

// ---------- tree shop ----------
export function priceOf(s, id) {
  const nd = NODE[id], lvl = L(s, id);
  if (lvl >= nd.max) return null;
  const perm = nd.tree === 'perm';
  return { cost: Math.ceil(nd.cost * nd.k ** lvl * (perm ? 1 : 0.95 ** L(s, 'p_disc'))), cur: perm ? 'chips' : 'gold' };
}

export function buy(s, id) {
  const p = isUnlocked(s, id) && priceOf(s, id);
  if (!p || s[p.cur] < p.cost) return false;
  s[p.cur] -= p.cost;
  s.lv[id] = L(s, id) + 1;
  return true;
}

// ---------- prestige ----------
export const chipGain = s => (s.runEarned >= PRESTIGE_AT ? Math.floor(3 * Math.sqrt(s.runEarned / PRESTIGE_AT)) : 0);

export function ascend(s) {
  const gain = chipGain(s);
  if (!gain) return 0;
  s.chips += gain; s.totalChips += gain; s.stats.prestiges++;
  newRun(s);
  return gain;
}

// ---------- estimates / offline ----------
// Monte-Carlo gold/sec from auto play across all games, no timed buffs.
export function gps(s, n = 300, rng = Math.random) {
  let t = 0;
  for (const g in GAMES) {
    if (!hasAuto(s, g)) continue;
    const c = { ...s, coin: { ...s.coin } };
    let sum = 0;
    for (let i = 0; i < n; i++) sum += play(c, g, rng, Infinity).gold;
    t += sum / n / (autoIv(s, g) / 1000);
  }
  return t;
}

export function offlineGold(s, now) {
  const secs = Math.min(Math.max(0, (now - s.last) / 1000), offlineCapH(s) * 3600);
  return secs < 60 ? { gold: 0, secs } : { gold: Math.floor(gps(s) * secs), secs };
}

// Hi-Lo: ties lose; payout scales with odds and is slightly in the player's favour (tickets are scarce).
export function hiloMult(cur, dir) {
  const wins = dir > 0 ? 6 - cur : cur - 1;
  return wins ? (1.05 * 6) / wins : 0;
}

const SUF = ['', 'K', 'M', 'B', 'T'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return String(Math.floor(Math.max(0, n)));
  const e = Math.floor(Math.log10(n) / 3), v = n / 1000 ** e;
  const suf = e < SUF.length ? SUF[e] : String.fromCharCode(97 + Math.floor((e - 5) / 26)) + String.fromCharCode(97 + ((e - 5) % 26));
  return v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + suf;
}
