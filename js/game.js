// Pure game logic. No DOM — `node test.js` exercises everything here.
// ponytail: plain Number caps ~1e308; swap to break_infinity.js if late game exceeds it.

export const MAX_DICE = 8;
export const BOSS_TIME = 30000;
export const TIERS = ['Wood', 'Stone', 'Bronze', 'Silver', 'Gold', 'Crystal', 'Obsidian', 'Cosmic'];

export const UPGRADES = {
  auto:     { name: 'Auto-Roller',    desc: 'Dice roll themselves',   base: 25,  growth: 1,   max: 1 },
  speed:    { name: 'Quick Hands',    desc: 'Auto-roll 10% faster',   base: 60,  growth: 1.6, max: 20 },
  crit:     { name: 'Lucky Rolls',    desc: '+2% crit chance',        base: 100, growth: 1.5, max: 20 },
  critMult: { name: 'Critical Force', desc: '+0.5× crit damage',      base: 250, growth: 1.7 },
  combo:    { name: 'Combo Master',   desc: '+25% combo bonus',       base: 150, growth: 1.8 },
};

export const PERMS = {
  dmg:       { name: 'Sharpened Pips',  desc: '+25% damage',            base: 1,  growth: 1.4 },
  gold:      { name: 'Gilded Dice',     desc: '+25% gold',              base: 1,  growth: 1.4 },
  critMult:  { name: 'Deadly Edge',     desc: '+1× crit damage',        base: 2,  growth: 1.6 },
  startGold: { name: 'Inheritance',     desc: 'Start runs with gold',   base: 2,  growth: 2,   max: 10 },
  startAuto: { name: 'Clockwork Heart', desc: 'Start with Auto-Roller', base: 3,  growth: 1,   max: 1 },
  startDice: { name: 'Heirloom Dice',   desc: '+1 starting die',        base: 5,  growth: 4,   max: 3 },
  offline:   { name: 'Dream Rolling',   desc: '+2h offline cap',        base: 2,  growth: 2,   max: 11 },
  choices:   { name: 'Wider Path',      desc: '+1 boon choice',         base: 10, growth: 3,   max: 2 },
  reroll:    { name: 'Fate Twister',    desc: '+1 boon reroll per run', base: 5,  growth: 2,   max: 5 },
};

export const BOONS = {
  sixes:  { icon: '⚅', name: 'Lucky Sixes',   desc: '6s are worth double' },
  odd:    { icon: '⚀', name: 'Odd Fortune',   desc: 'Odd faces ×2' },
  even:   { icon: '⚁', name: 'Even Keel',     desc: 'Even faces ×2' },
  snake:  { icon: '🐍', name: 'Snake Eyes',    desc: '1s count as 7' },
  boss:   { icon: '⚔️', name: 'Giant Slayer',  desc: '×2 damage to bosses' },
  reroll: { icon: '🔁', name: 'Second Chance', desc: 'Lowest die rerolls once' },
  golden: { icon: '✨', name: 'Gilded Luck',   desc: 'Golden dice appear 2× as often' },
  die:    { icon: '👻', name: 'Phantom Die',   desc: '+1 die this run', stack: true },
  combo:  { icon: '🔥', name: 'Combo Fever',   desc: '+100% combo bonus', stack: true },
  crit:   { icon: '🎯', name: 'Keen Eye',      desc: '+5% crit chance', stack: true },
  gold:   { icon: '💰', name: 'Midas Touch',   desc: '+50% gold', stack: true },
  speed:  { icon: '⏱️', name: 'Clockwork',     desc: 'Auto-roll 25% faster', stack: true },
};

export const cost = (base, growth, lvl) => Math.ceil(base * growth ** lvl);
export const isBoss = f => f % 10 === 0;
export const floorHp = f => Math.ceil(10 * 1.38 ** (f - 1) * (isBoss(f) ? 5 : 1));

export function newState(now = Date.now()) {
  const s = { v: 1, ether: 0, totalEther: 0, bestFloor: 1, tickets: 0, autoOn: true, last: now,
    perm: {}, stats: { rolls: 0, jackpots: 0, ascends: 0 } };
  for (const k in PERMS) s.perm[k] = 0;
  return newRun(s);
}

export function newRun(s) {
  s.gold = s.perm.startGold ? 50 * 5 ** s.perm.startGold : 0;
  s.floor = 1; s.maxFloor = 1; s.hp = floorHp(1); s.bossEnd = 0;
  s.dice = Array.from({ length: 1 + s.perm.startDice }, () => ({ lvl: 0, tier: 0 }));
  s.up = {};
  for (const k in UPGRADES) s.up[k] = 0;
  s.up.auto = s.perm.startAuto;
  s.boons = {}; s.boonChoice = null; s.boonFloor = 0; s.rerolls = s.perm.reroll;
  s.buffs = { frenzy: 0, overdrive: 0 };
  return s;
}

// Phantom dice copy your best die.
export function activeDice(s) {
  const extra = s.boons.die || 0;
  if (!extra) return s.dice;
  const best = s.dice.reduce((a, d) => (d.tier > a.tier || (d.tier === a.tier && d.lvl > a.lvl) ? d : a));
  return [...s.dice, ...Array.from({ length: extra }, () => ({ ...best, phantom: true }))];
}

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

export function dieValue(s, die, face) {
  let v = (s.boons.snake && face === 1 ? 7 : face) + die.lvl;
  if (s.boons.sixes && face === 6) v *= 2;
  if (s.boons.odd && face % 2) v *= 2;
  if (s.boons.even && !(face % 2)) v *= 2;
  return v * 2 ** die.tier;
}

export const critChance = s => Math.min(0.5, 0.02 * s.up.crit + 0.05 * (s.boons.crit || 0));
export const critMult = s => 3 + 0.5 * s.up.critMult + s.perm.critMult;
export const dmgMult = s => 1 + 0.25 * s.perm.dmg;
export const goldMult = s => (1 + 0.25 * s.perm.gold) * (1 + 0.5 * (s.boons.gold || 0));
export const offlineCapH = s => 2 + 2 * s.perm.offline;

// Pass now = Infinity to ignore timed buffs (used for estimates).
export function autoInterval(s, now) {
  const iv = Math.max(150, 2000 * 0.9 ** s.up.speed * 0.75 ** (s.boons.speed || 0));
  return now < s.buffs.overdrive ? Math.max(60, iv / 5) : iv;
}

export function roll(s, rng = Math.random, now = Date.now()) {
  const dice = activeDice(s);
  const d6 = () => 1 + Math.floor(rng() * 6);
  const faces = dice.map(d6);
  if (s.boons.reroll) {
    const i = faces.indexOf(Math.min(...faces));
    faces[i] = Math.max(faces[i], d6());
  }
  const values = faces.map((f, i) => dieValue(s, dice[i], f));
  const cb = combo(faces);
  const comboMult = 1 + (cb.mult - 1) * (1 + 0.25 * s.up.combo + (s.boons.combo || 0));
  const crit = rng() < critChance(s);
  let total = values.reduce((a, b) => a + b, 0) * comboMult * dmgMult(s);
  if (crit) total *= critMult(s);
  if (now < s.buffs.frenzy) total *= 7;
  const gold = Math.floor(total * goldMult(s));
  if (s.boons.boss && isBoss(s.floor)) total *= 2;
  return { faces, values, combo: cb, crit, damage: Math.floor(total), gold, dice };
}

// Returns null if guardian survives, else { killed, wasBoss }.
export function applyDamage(s, dmg, now = Date.now()) {
  s.hp -= dmg;
  if (s.hp > 0) return null;
  const killed = s.floor, wasBoss = isBoss(killed);
  if (wasBoss) s.tickets++;
  s.floor++;
  s.hp = floorHp(s.floor);
  s.bossEnd = isBoss(s.floor) ? now + BOSS_TIME : 0;
  s.maxFloor = Math.max(s.maxFloor, s.floor);
  s.bestFloor = Math.max(s.bestFloor, s.floor);
  if (killed % 5 === 0 && killed > s.boonFloor && !s.boonChoice) {
    s.boonFloor = killed;
    s.boonChoice = offerBoons(s);
  }
  return { killed, wasBoss };
}

// Boss timer ran out: drop back a floor. Returns true if that happened.
export function checkBoss(s, now) {
  if (!s.bossEnd || now <= s.bossEnd) return false;
  s.floor--;
  s.hp = floorHp(s.floor);
  s.bossEnd = 0;
  return true;
}

export function offerBoons(s, rng = Math.random) {
  const pool = Object.keys(BOONS).filter(k => BOONS[k].stack || !s.boons[k]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3 + s.perm.choices);
}

export function pickBoon(s, id) {
  if (!s.boonChoice?.includes(id)) return false;
  s.boons[id] = (s.boons[id] || 0) + 1;
  s.boonChoice = null;
  return true;
}

export function rerollBoons(s) {
  if (s.rerolls < 1 || !s.boonChoice) return false;
  s.rerolls--;
  s.boonChoice = offerBoons(s);
  return true;
}

// Shop actions: 'up:<id>', 'perm:<id>', 'die', 'lvl:<i>', 'tier:<i>'. Returns null when maxed.
export function priceOf(s, act) {
  const [k, id] = act.split(':');
  if (k === 'up' || k === 'perm') {
    const def = (k === 'up' ? UPGRADES : PERMS)[id], lvl = s[k][id];
    return lvl >= (def.max ?? Infinity) ? null : { cost: cost(def.base, def.growth, lvl), cur: k === 'up' ? 'gold' : 'ether' };
  }
  if (k === 'die') return s.dice.length >= MAX_DICE ? null : { cost: 10 * 12 ** (s.dice.length - 1), cur: 'gold' };
  const d = s.dice[+id];
  if (k === 'lvl') return { cost: cost(5, 1.15, d.lvl), cur: 'gold' };
  if (k === 'tier') return d.tier >= TIERS.length - 1 ? null : { cost: 200 * 15 ** d.tier, cur: 'gold' };
  return null;
}

export function buy(s, act) {
  const p = priceOf(s, act);
  if (!p || s[p.cur] < p.cost) return false;
  s[p.cur] -= p.cost;
  const [k, id] = act.split(':');
  if (k === 'up') s.up[id]++;
  else if (k === 'perm') { s.perm[id]++; if (id === 'startAuto') s.up.auto = 1; }
  else if (k === 'die') s.dice.push({ lvl: 0, tier: 0 });
  else if (k === 'lvl') s.dice[+id].lvl++;
  else if (k === 'tier') s.dice[+id].tier++;
  return true;
}

export const etherGain = s => (s.maxFloor >= 10 ? Math.floor((s.maxFloor - 5) ** 1.5) : 0);

export function ascend(s) {
  const gain = etherGain(s);
  if (!gain) return 0;
  s.ether += gain; s.totalEther += gain; s.stats.ascends++;
  newRun(s);
  return gain;
}

// Monte-Carlo average gold per roll, no timed buffs.
export function expectedGold(s, n = 300, rng = Math.random) {
  let t = 0;
  for (let i = 0; i < n; i++) t += roll(s, rng, Infinity).gold;
  return t / n;
}

export const goldPerSec = s => expectedGold(s) / (autoInterval(s, Infinity) / 1000);

export function offlineGold(s, now) {
  const secs = Math.min(Math.max(0, (now - s.last) / 1000), offlineCapH(s) * 3600);
  if (!s.up.auto || secs < 60) return { gold: 0, secs };
  return { gold: Math.floor(goldPerSec(s) * secs), secs };
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
