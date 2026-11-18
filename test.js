// Logic self-check + pacing sim: `node test.js`
import assert from 'node:assert/strict';
import * as G from './js/game.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const C = str => str.split(' ').map(t => ({ r: '..23456789TJQKA'.indexOf(t[0]), s: 'shdc'.indexOf(t[1]) }));
const hand = str => G.pokerHand(C(str)).name;

// dice combos
assert.equal(G.combo([1]).mult, 1);
assert.equal(G.combo([2, 2, 3, 3]).name, 'Two Pair');
assert.equal(G.combo([4, 4, 4, 2, 2]).name, 'Full House');
assert.equal(G.combo([6, 2, 3, 4, 5, 6]).name, 'Straight');
assert.equal(G.combo([3, 3, 3, 3, 3]).name, 'JACKPOT');

// poker hands (5–7 cards)
assert.equal(hand('As Ks Qs Js Ts'), 'Royal Flush');
assert.equal(hand('9h Kh Qh Jh Th 2c 2d'), 'Straight Flush');
assert.equal(hand('Ac 2d 3h 4s 5c'), 'Straight');
assert.equal(hand('Ac Kd Qh Js 9c'), 'High Card');
assert.equal(hand('2h 7h 9h Jh Kh Kc Kd'), 'Flush');
assert.equal(hand('Kh Kc Kd 7s 7c 7d 2h'), 'Full House');
assert.equal(hand('9h 9c 9d 9s Ah'), 'Four of a Kind');
assert.equal(hand('4h 4c 8d 8s Ah 2c 3d'), 'Two Pair');
assert.equal(G.pokerHand(C('4h 4c 8d 8s Ah 2c 3d')).used.length, 4);

// dice play: rng .99 → face 6, no crit
const s = G.newState(0);
assert.equal(G.play(s, 'dice', seq(0.99), Infinity).gold, 6);
s.lv.d_pip = 2; s.lv.d_mat = 1;
assert.equal(G.play(s, 'dice', seq(0.99), Infinity).gold, (6 + 2) * 2);
s.buffs.frenzy = 100;
assert.equal(G.play(s, 'dice', seq(0.99), 50).gold, 16 * 7);

// new branches: echo doubles, gilded sixes, suit purge deck, every path has its own capstone (no merges)
const e = G.newState(0);
e.lv.d_echo = 10; e.lv.d_reson = 1;
assert.equal(G.play(e, 'dice', seq(0.99, 0.99, 0.01), Infinity).gold, 6 * 3); // no crit, echo → ×(2+1)
e.lv.d_echo = 0; e.lv.d_alch = 1;
assert.ok(Math.abs(G.play(e, 'dice', seq(0.99), Infinity).gold - 6 * 1.2) < 1e-9);
e.lv.k_thin = 4; e.lv.k_suit = 1;
assert.equal(G.deckSize(e), 27);
for (const t in G.TREES) {
  const kids = {};
  for (const nd of G.TREES[t]) { assert.ok(nd.req.length <= 1, `${nd.id} merges paths`); for (const r of nd.req) kids[r] = 1; }
  if (t !== 'perm') assert.ok(G.TREES[t].filter(nd => !kids[nd.id]).length >= 6, `${t} needs 6 distinct endpoints`);
}

// coin: streak grows on heads, resets on tails, insurance keeps part
const c = G.newState(0);
c.lv.p_coin = 1;
G.play(c, 'coin', seq(0.9, 0.1), Infinity); // no edge, heads
G.play(c, 'coin', seq(0.9, 0.1), Infinity);
assert.equal(c.coin.streak, 2);
G.play(c, 'coin', seq(0.9, 0.9), Infinity); // tails
assert.equal(c.coin.streak, 0);
c.coin.streak = 8; c.lv.c_ins = 2;
G.play(c, 'coin', seq(0.9, 0.9), Infinity);
assert.equal(c.coin.streak, 4);

// tree: locked until parent owned, game trees gated by unlock, max respected
const t = G.newState(0);
t.gold = 1e9;
assert.equal(G.buy(t, 'd_auto'), false);
assert.ok(G.buy(t, 'd_pip') && G.buy(t, 'd_auto'));
assert.equal(G.buy(t, 'd_auto'), false);
assert.equal(G.priceOf(t, 'd_auto'), null);
assert.equal(G.buy(t, 'c_shiny'), false);
t.lv.p_coin = 1;
assert.ok(G.buy(t, 'c_shiny'));
assert.equal(G.priceOf(t, 'd_pip').cost, Math.ceil(10 * 1.4));
t.lv.p_disc = 2;
assert.equal(G.priceOf(t, 'd_pip').cost, Math.ceil(10 * 1.4 * 0.95 ** 2));

// prestige: gain needs PRESTIGE_AT, resets run nodes, keeps perm + chips
t.runEarned = G.PRESTIGE_AT - 1;
assert.equal(G.chipGain(t), 0);
t.runEarned = G.PRESTIGE_AT * 4;
assert.equal(G.ascend(t), 6);
assert.equal(t.chips, 6);
assert.equal(G.L(t, 'd_pip'), 0);
assert.equal(G.L(t, 'p_coin'), 1);
assert.equal(t.runEarned, 0);
t.lv.p_autop = 1; G.newRun(t);
assert.ok(G.hasAuto(t, 'dice') && G.hasAuto(t, 'coin') && !G.hasAuto(t, 'cards'));

// offline: needs auto, capped
const o = G.newState(0);
assert.equal(G.offlineGold(o, 3600e3).gold, 0);
o.lv.d_auto = 1;
assert.ok(G.offlineGold(o, 3600e3).gold > 0);
assert.equal(G.offlineGold(o, 100 * 3600e3).secs, 2 * 3600);

// Hi-Lo + fmt
assert.equal(G.hiloMult(6, 1), 0);
assert.ok(Math.abs(G.hiloMult(3, 1) - 2.1) < 1e-9);
assert.equal(G.fmt(999), '999');
assert.equal(G.fmt(1500), '1.50K');
assert.equal(G.fmt(1e15), '1.00aa');

// Pacing sim: greedy bot taps dice 2×/s until it owns Auto, then idles; buys the cheapest affordable node.
function simRun(s, maxMin = 300) {
  const dt = 0.25, timers = {};
  let t = 0;
  for (; t < maxMin * 60 && !G.chipGain(s); t += dt) {
    for (const g in G.GAMES) {
      if (!G.gameOn(s, g)) continue;
      const iv = G.hasAuto(s, g) ? G.autoIv(s, g) / 1000 : g === 'dice' ? 0.5 : Infinity;
      timers[g] = (timers[g] || 0) + dt;
      while (timers[g] >= iv) { timers[g] -= iv; G.collect(s, G.play(s, g, Math.random, Infinity)); }
    }
    for (;;) {
      const best = Object.keys(G.NODE).filter(id => G.NODE[id].tree !== 'perm' && G.isUnlocked(s, id))
        .map(id => [id, G.priceOf(s, id)]).filter(([, p]) => p).sort((a, b) => a[1].cost - b[1].cost)[0];
      if (!best || best[1].cost > s.gold) break;
      G.buy(s, best[0]);
    }
  }
  return t / 60;
}
const p = G.newState(0);
const m1 = simRun(p);
G.ascend(p); G.buy(p, 'p_coin');
const m2 = simRun(p);
console.log(`pacing: 1st prestige ${m1.toFixed(0)} min, 2nd ${m2.toFixed(0)} min (idle bot)`);
assert.ok(m1 > 45 && m1 < 80, 'first prestige should take ~1h');
assert.ok(m2 < m1, 'second run with coinflip should be faster');

console.log('ok');
