// Core economy. No DOM — `node test.js` exercises everything here.
// Five separate games, each with its own currency, upgrade tree, stage ladder, workshop and rebirth.
// ponytail: plain Number caps ~1e308; swap to break_infinity.js if late game exceeds it.
import { TREES, RTREES } from './trees.js';
import * as Mo from './modes.js';
export * from './modes.js';

// p = node id prefix, iv = base auto interval (ms), ci = currency icon, B/K = stage goal base/growth.
export const GAMES = {
  dice:   { name: 'Dice',     icon: '🎲', verb: 'ROLL', p: 'd', iv: 2500, cur: 'Pips',   ci: '⚀',  B: 100, K: 3, hue: 260 },
  coin:   { name: 'Coinflip', icon: '🪙', verb: 'FLIP', p: 'c', iv: 2000, cur: 'Coins',  ci: '🪙', B: 100, K: 2.4, hue: 35 },
  cards:  { name: 'Cards',    icon: '🃏', verb: 'DEAL', p: 'k', iv: 4000, cur: 'Marks',  ci: '♠️', B: 300, K: 6, hue: 150 },
  slots:  { name: 'Slots',    icon: '🎰', verb: 'SPIN', p: 's', iv: 2500, cur: 'Tokens', ci: '🎟️', B: 100, K: 16, hue: 320 },
  plinko: { name: 'Plinko',   icon: '🔵', verb: 'DROP', p: 'l', iv: 3000, cur: 'Drops',  ci: '💧', B: 100, K: 2.5, hue: 200 },
};
export const MAX_STAGE = 60, REBIRTH_AT = 10;
export const TIER_ST = [0, 0, 0, 3, 3, 8, 8, 15, 15]; // stage needed per tree row

// Stage feats (every 5th stage): [tag counted from play results, count, label].
export const FEATS = {
  dice: [['Triple', 1, 'Roll a Triple'], ['Four of a Kind', 1, 'Roll Four of a Kind'], ['Full House', 1, 'Roll a Full House'],
    ['Straight', 10, 'Roll 10 Straights'], ['JACKPOT', 1, 'Roll a JACKPOT'], ['echo', 100, 'Get 100 Echo rolls'],
    ['JACKPOT', 5, 'Roll 5 JACKPOTs'], ['crit', 1000, 'Land 1,000 crits'], ['Four of a Kind', 100, 'Roll 100 Four of a Kinds'],
    ['JACKPOT', 25, 'Roll 25 JACKPOTs'], ['Straight', 1000, 'Roll 1,000 Straights'], ['JACKPOT', 100, 'Roll 100 JACKPOTs']],
  coin: [['s5', 1, 'Reach a 5 streak'], ['edge', 1, 'Land a coin on its edge'], ['s10', 1, 'Reach a 10 streak'],
    ['bank', 500, 'Bank 500 pots'], ['s15', 1, 'Reach a 15 streak'], ['edge', 25, 'Land 25 edges'], ['s20', 1, 'Reach a 20 streak'],
    ['bank', 5000, 'Bank 5,000 pots'], ['s25', 1, 'Reach a 25 streak'], ['edge', 250, 'Land 250 edges'], ['s30', 1, 'Reach a 30 streak'],
    ['bank', 50000, 'Bank 50,000 pots']],
  cards: [['Three of a Kind', 1, 'Make Three of a Kind'], ['Straight', 1, 'Make a Straight'], ['Flush', 1, 'Make a Flush'],
    ['Full House', 1, 'Make a Full House'], ['Four of a Kind', 1, 'Make Four of a Kind'], ['Flush', 100, 'Make 100 Flushes'],
    ['Straight Flush', 1, 'Make a Straight Flush'], ['Full House', 500, 'Make 500 Full Houses'], ['Four of a Kind', 100, 'Make 100 Four of a Kinds'],
    ['Royal Flush', 1, 'Make a Royal Flush'], ['Straight Flush', 25, 'Make 25 Straight Flushes'], ['Royal Flush', 10, 'Make 10 Royal Flushes']],
  slots: [['x3', 5, 'Hit 5 three-in-a-rows'], ['s4x3', 1, 'Hit three ⭐'], ['s6x3', 1, 'Hit three 7️⃣'], ['free', 1, 'Trigger free spins'],
    ['x4', 1, 'Hit four in a row'], ['s5x3', 10, 'Hit three 💎 ten times'], ['x5', 1, 'Hit five in a row'], ['free', 25, 'Trigger free spins 25 times'],
    ['s6x4', 1, 'Hit four 7️⃣'], ['x5', 25, 'Hit five in a row 25 times'], ['s6x5', 1, 'Hit five 7️⃣'], ['s6x5', 5, 'Hit five 7️⃣ five times']],
  plinko: [['edge', 1, 'Hit an edge bucket'], ['gold', 1, 'Hit a golden peg'], ['same3', 1, 'Land 3 balls in one bucket'],
    ['edge', 25, 'Hit 25 edge buckets'], ['edge12', 1, 'Hit an edge on a 12+ row board'], ['gold', 100, 'Hit 100 golden pegs'],
    ['edge14', 1, 'Hit an edge on a 14+ row board'], ['same3', 100, 'Land 3 in a bucket 100 times'], ['edge16', 1, 'Hit an edge on a 16-row board'],
    ['gold', 1000, 'Hit 1,000 golden pegs'], ['edge16', 10, 'Hit 10 edges on a 16-row board'], ['same3', 1000, 'Land 3 in a bucket 1,000 times']],
};

// Trees keyed 'dice' (main) and 'dice_r' (rebirth). NODE[id] adds tree/game/rb/st and parsed fx.
export const ALL = {};
for (const g in GAMES) { ALL[g] = TREES[g]; ALL[g + '_r'] = RTREES[g]; }
// Balance rule: a multiplier node's cost growth k is at least effect^(1/RHO), so each level buys log-income at
// RHO × its log-cost. With ~6 such nodes live at once, growth stays exponential instead of running away.
export const RHO = 0.15;
export const NODE = {};
for (const t in ALL) for (const nd of ALL[t]) {
  const rb = t.endsWith('_r'), [, stat, op, v] = /^(\w+)([+*])(-?[\d.e]+)$/.exec(nd.fx);
  // Endless (max ≥ 100) multipliers stack additively (×1.15 → +15%/lvl) so they can never run away.
  const lin = op === '*' && nd.max >= 100 && !rb, eff = op === '*' && !rb && !lin ? Math.max(+v, 1 / +v) : 0;
  NODE[nd.id] = { ...nd, k: eff ? Math.max(nd.k, eff ** (1 / RHO)) : nd.k, tree: t, game: rb ? t.slice(0, -2) : t, rb, lin,
    st: rb ? 0 : TIER_ST[nd.y], stat, op, v: +v };
}
const factor = (nd, l) => !nd.lin ? nd.v ** l : nd.v > 1 ? 1 + (nd.v - 1) * l : 1 / (1 + (1 / nd.v - 1) * l);

export const L = (s, id) => s.g[NODE[id].game].lv[id] || 0;

// All stats for a game from its main + rebirth tree levels. '+' stats default 0, '*' stats default 1.
export function stats(s, g) {
  const S = {}, lv = s.g[g].lv;
  for (const id in lv) {
    const nd = NODE[id];
    if (!nd || nd.game !== g || !lv[id]) continue;
    S[nd.stat] = nd.op === '+' ? (S[nd.stat] || 0) + nd.v * lv[id] : (S[nd.stat] ?? 1) * factor(nd, lv[id]);
  }
  return S;
}

const newGame = g => ({ cash: 0, earned: 0, total: 0, lv: {}, ess: 0, stage: 0, rebirths: 0, feats: {}, sys: Mo.SYS[g]() });
export function newState(now = Date.now()) {
  return { v: 3, view: 'dice', last: now, tickets: 0, autoOff: {}, buffs: { frenzy: 0, overdrive: 0 }, stats: { plays: 0 },
    g: Object.fromEntries(Object.keys(GAMES).map(g => [g, newGame(g)])) };
}

export const hasAuto = (s, g) => (stats(s, g).auto || 0) > 0;
export const casinoLv = s => Object.values(s.g).reduce((a, gs) => a + gs.stage, 0);
export const offlineCapH = s => 2 + 0.1 * casinoLv(s);
export const goldenRate = s => (1 + 0.01 * casinoLv(s)) * (1 + (stats(s, 'dice').gold || 0));
export const luckyMult = s => 1 + (stats(s, 'dice').lucky || 0);
export const maxTickets = s => 10 + Math.floor(casinoLv(s) / 10);
export const stageMult = (s, g, S = stats(s, g)) => (1.05 + (S.stg || 0)) ** s.g[g].stage;
export const incomeMult = (s, g, now, S = stats(s, g)) => (S.mul ?? 1) * stageMult(s, g, S) * (now < s.buffs.frenzy ? 7 : 1);

// Pass now = Infinity to ignore timed buffs (estimates).
export function autoIv(s, g, now = Infinity, S = stats(s, g)) {
  const iv = Math.max(100, GAMES[g].iv * (S.spd ?? 1));
  return now < s.buffs.overdrive ? iv / 5 : iv;
}

// One round of game g. Mutates only that game's system state (streaks, pots, free spins). collect() banks it.
export function play(s, g, rng = Math.random, now = Date.now()) {
  const S = stats(s, g), r = Mo.PLAY[g](s.g[g], S, rng, incomeMult(s, g, now, S));
  if ((S.flurry || 0) > 0 && rng() < S.flurry) { r.gold *= 2; r.label = [r.label, '×2 TURBO'].filter(Boolean).join(' · '); }
  return r;
}

export function earn(s, g, x) { const gs = s.g[g]; gs.cash += x; gs.earned += x; gs.total += x; }
export function collect(s, r) {
  earn(s, r.g, r.gold);
  s.stats.plays++;
  const f = s.g[r.g].feats;
  for (const t of r.feats) f[t] = (f[t] || 0) + 1;
  if (r.rare) s.tickets = Math.min(maxTickets(s), s.tickets + 1);
}
export function bankNow(s) {
  const gs = s.g.coin;
  if (!gs.sys.pot) return 0;
  const x = Mo.bank(gs.sys, stats(s, 'coin'));
  earn(s, 'coin', x);
  return x;
}

// ---------- upgrade trees ----------
export function isUnlocked(s, id) {
  const nd = NODE[id];
  return s.g[nd.game].stage >= nd.st && (!nd.req.length || nd.req.some(r => L(s, r) > 0));
}
// Cost inflation: every main-tree level bought makes that game's tree + workshop BAL.infl× pricier.
// Damps the many-cheap-channels runaway; one knob for pacing.
export const BAL = { infl: 1.04 };
export function inflation(s, g) {
  let n = 0;
  for (const id in s.g[g].lv) if (!NODE[id]?.rb) n += s.g[g].lv[id];
  return BAL.infl ** n * (stats(s, g).disc ?? 1);
}
export function priceOf(s, id) {
  const nd = NODE[id], lvl = L(s, id);
  if (lvl >= nd.max) return null;
  return { cost: Math.ceil(nd.cost * nd.k ** lvl * (nd.rb ? 1 : inflation(s, nd.game))), cur: nd.rb ? 'ess' : 'cash' };
}
export function buy(s, id) {
  const p = isUnlocked(s, id) && priceOf(s, id), gs = s.g[NODE[id].game];
  if (!p || gs[p.cur] < p.cost) return false;
  gs[p.cur] -= p.cost;
  gs.lv[id] = L(s, id) + 1;
  return true;
}

// ---------- workshop ----------
export function wsRows(s, g) {
  const f = inflation(s, g), rows = Mo.WS[g].rows(s.g[g], stats(s, g));
  for (const r of rows) for (const b of r.btns) if (b.cost) b.cost = Math.ceil(b.cost * f);
  return rows;
}
export function wsBuy(s, g, id) {
  const gs = s.g[g], S = stats(s, g), b = wsRows(s, g).flatMap(r => r.btns).find(x => x.id === id);
  if (!b || b.cost == null || b.disabled || gs.cash < b.cost) return false;
  gs.cash -= b.cost;
  Mo.WS[g].act(gs, id, S);
  return true;
}

// ---------- stages ----------
export function stageGoal(g, i) {
  const { B, K } = GAMES[g];
  return { earn: B * K ** (i - 1), feat: i % 5 === 0 ? FEATS[g][i / 5 - 1] : null };
}
export const featCount = (s, g, f) => s.g[g].feats[f[0]] || 0;
export function canClaim(s, g) {
  const gs = s.g[g], i = gs.stage + 1;
  if (i > MAX_STAGE) return false;
  const goal = stageGoal(g, i);
  return gs.total >= goal.earn && (!goal.feat || featCount(s, g, goal.feat) >= goal.feat[1]);
}
export const claim = (s, g) => canClaim(s, g) && !!++s.g[g].stage;

// ---------- rebirth ----------
export function essGain(s, g) {
  const gs = s.g[g];
  if (gs.stage < REBIRTH_AT) return 0;
  return Math.floor(2 * Math.sqrt(gs.earned / stageGoal(g, REBIRTH_AT).earn) * (1 + (stats(s, g).essm || 0)));
}
export function rebirth(s, g) {
  const gain = essGain(s, g), gs = s.g[g];
  if (!gain) return 0;
  gs.ess += gain; gs.rebirths++;
  for (const id in gs.lv) if (!NODE[id]?.rb) delete gs.lv[id];
  const S = stats(s, g);
  gs.cash = S.start ? 100 * 10 ** S.start : 0;
  gs.earned = 0;
  Mo.RESET[g]?.(gs.sys);
  return gain;
}

// ---------- estimates / offline ----------
// Monte-Carlo gold/sec from auto play, no timed buffs. Plays on a copy so streaks/pots aren't touched.
export function gps(s, g, n = 300, rng = Math.random) {
  if (!hasAuto(s, g)) return 0;
  const c = { ...s, g: { ...s.g, [g]: structuredClone(s.g[g]) } };
  let t = 0;
  for (let i = 0; i < n; i++) t += play(c, g, rng, Infinity).gold;
  return t / n / (autoIv(s, g) / 1000);
}
export function offlineGold(s, now) {
  const secs = Math.min(Math.max(0, (now - s.last) / 1000), offlineCapH(s) * 3600), per = {};
  if (secs >= 60) for (const g in GAMES) { const x = Math.floor(gps(s, g) * secs); if (x > 0) per[g] = x; }
  return { per, secs };
}

// Hi-Lo: ties lose; payout scales with odds and is slightly in the player's favour (tickets are scarce).
export function hiloMult(cur, dir) {
  const wins = dir > 0 ? 6 - cur : cur - 1;
  return wins ? (1.05 * 6) / wins : 0;
}
