// Logic self-check + pacing sim: `node test.js` (`quick` skips the sim, `assert` enforces pacing targets)
import assert from 'node:assert/strict';
import * as G from './js/game.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const C = str => str.split(' ').map(t => ({ r: '..23456789TJQKA'.indexOf(t[0]), s: 'shdc'.indexOf(t[1]) }));
const hand = str => G.pokerHand(C(str)).name;
const lv = (s, id, n) => { s.g[G.NODE[id].game].lv[id] = n; };

// dice combos + poker hands
assert.equal(G.combo([2, 2, 3, 3]).name, 'Two Pair');
assert.equal(G.combo([4, 4, 4, 2, 2]).name, 'Full House');
assert.equal(G.combo([6, 2, 3, 4, 5, 6]).name, 'Straight');
assert.equal(G.combo([3, 3, 3, 3, 3]).name, 'JACKPOT');
assert.equal(hand('As Ks Qs Js Ts'), 'Royal Flush');
assert.equal(hand('9h Kh Qh Jh Th 2c 2d'), 'Straight Flush');
assert.equal(hand('Ac 2d 3h 4s 5c'), 'Straight');
assert.equal(hand('2h 7h 9h Jh Kh Kc Kd'), 'Flush');
assert.equal(hand('Kh Kc Kd 7s 7c 7d 2h'), 'Full House');
assert.equal(G.pokerHand(C('4h 4c 8d 8s Ah 2c 3d')).used.length, 4);

// hold strategies
const hc = C('4h 4c 9h Jh 2h');
assert.deepEqual(G.holds(hc, 'pairs'), [0, 1]);
assert.deepEqual(G.holds(hc, 'flush').sort(), [0, 2, 3, 4]);
assert.equal(G.holds(C('5c 6d 7h 8s Kc'), 'straight').length, 4);
assert.equal(G.holds(C('5c 6d 7h 8s 9c'), 'pairs').length, 5); // made straight is kept by any strategy

// dice: rng .99 → face 6, stats from tree, forge material ×2^t, gilded 6s ×3
const s = G.newState(0);
assert.equal(G.play(s, 'dice', seq(0.99), Infinity).gold, 6);
lv(s, 'd_pip', 2);
assert.equal(G.play(s, 'dice', seq(0.99), Infinity).gold, 8);
s.g.dice.sys.mat[0] = 3; s.g.dice.sys.ench[0] = 'g';
assert.equal(G.play(s, 'dice', seq(0.99), Infinity).gold, 8 * 8 * 3);
s.buffs.frenzy = 100;
assert.equal(G.play(s, 'dice', seq(0.99), 50).gold, 8 * 8 * 3 * 7);

// coin pot & bank: pot = (pot + v) * growth on heads, banks at target, tails wipes (insurance keeps part)
const c = G.newState(0), cs = c.g.coin.sys;
cs.target = 2;
assert.equal(G.play(c, 'coin', seq(0.9, 0.1), Infinity).gold, 0);   // heads → pot 1.25
assert.equal(cs.pot, 1.25);
assert.equal(G.play(c, 'coin', seq(0.9, 0.1), Infinity).gold, (1.25 + 1) * 1.25); // banks at 2
assert.equal(cs.pot, 0);
G.play(c, 'coin', seq(0.9, 0.1), Infinity);
G.play(c, 'coin', seq(0.9, 0.9), Infinity);                               // tails
assert.equal(cs.pot, 0);
lv(c, 'c_ins', 2); cs.target = 9;
for (let i = 0; i < 4; i++) G.play(c, 'coin', seq(0.9, 0.1), Infinity);
G.play(c, 'coin', seq(0.9, 0.9), Infinity);
assert.equal(cs.streak, 2);
assert.ok(G.bankNow(c) > 0 && cs.pot === 0);

// slots: line scoring with wilds, scatters give free spins
const sl = G.newState(0), sg = sl.g.slots;
let r = G.scoreSlots(sg, {}, [[6, 6, 6], [6, G.WILD, 0], [6, 6, 1]], 1);
assert.equal(r.wins[0].count, 3);
assert.equal(r.gold, 250 * 3);
r = G.scoreSlots(sg, {}, [[G.SCAT, 0, 0], [G.SCAT, 1, 1], [G.SCAT, 2, 2]], 1);
assert.ok(r.feats.includes('free') && sg.sys.free === 5);

// plinko: path → bucket, tilt biases, edges pay most
const pl = G.newState(0);
r = G.play(pl, 'plinko', seq(0.01), Infinity);
assert.equal(r.balls[0].k, 8);
assert.ok(r.feats.includes('edge'));
assert.ok(G.bucketMult({}, pl.g.plinko.sys, 8, 0) > G.bucketMult({}, pl.g.plinko.sys, 8, 4) * 10);
pl.g.plinko.sys.tilt = 1;
let right = 0;
for (let i = 0; i < 2000; i++) right += G.play(pl, 'plinko', Math.random, Infinity).balls[0].k;
assert.ok(right / 2000 > 4.1, 'tilt right pushes balls right');

// tree: parent + stage tier gating, max, rebirth tree uses essence
const t = G.newState(0), tg = t.g.dice;
tg.cash = 1e12;
assert.equal(G.buy(t, 'd_auto'), false);
assert.ok(G.buy(t, 'd_pip') && G.buy(t, 'd_auto') && G.buy(t, 'd_speed'));
assert.equal(G.buy(t, 'd_auto'), false);
lv(t, 'd_speed', 10);
assert.equal(G.buy(t, 'd_over'), false, 'row 3 needs stage 3');
tg.stage = 3;
assert.ok(G.buy(t, 'd_over'));
assert.equal(G.buy(t, 'dr_inc'), false);
tg.ess = 1;
assert.ok(G.buy(t, 'dr_inc'));
for (const k in G.ALL) {
  const kids = {};
  for (const nd of G.ALL[k]) { assert.ok(nd.req.length <= 1, `${nd.id} merges paths`); for (const p of nd.req) kids[p] = 1; assert.ok(G.NODE[nd.id].stat); }
  if (!k.endsWith('_r')) assert.ok(G.ALL[k].filter(nd => !kids[nd.id]).length >= 6, `${k} needs 6 endpoints`);
}

// workshop buys charge cash, settings are free
const w = G.newState(0);
assert.equal(G.wsBuy(w, 'dice', 'forge:0'), false);
w.g.dice.cash = 300;
assert.ok(G.wsBuy(w, 'dice', 'forge:0') && w.g.dice.sys.mat[0] === 1 && w.g.dice.cash === 0);
assert.ok(G.wsBuy(w, 'cards', 'strat:flush') && w.g.cards.sys.strat === 'flush');
assert.equal(G.wsBuy(w, 'cards', 'strat:smart'), false, 'smart locked until stage 15');
assert.ok(G.wsBuy(w, 'plinko', 'tilt:-1') && w.g.plinko.sys.tilt === -1);

// stages: earn goal + feat on every 5th
const st = G.newState(0), sd = st.g.dice;
assert.equal(G.claim(st, 'dice'), false);
sd.total = G.stageGoal('dice', 4).earn;
for (let i = 0; i < 4; i++) assert.ok(G.claim(st, 'dice'));
sd.total = G.stageGoal('dice', 5).earn;
assert.equal(G.claim(st, 'dice'), false, 'stage 5 needs its feat');
sd.feats.Triple = 1;
assert.ok(G.claim(st, 'dice'));
assert.equal(G.casinoLv(st), 5);

// rebirth: needs stage 10, resets cash + main tree, keeps stages, essence, rebirth tree, forge
sd.stage = 10; sd.earned = G.stageGoal('dice', 10).earn * 4; sd.cash = 5;
lv(st, 'd_pip', 5); lv(st, 'dr_inc', 1); sd.sys.mat[0] = 2;
assert.equal(G.rebirth(st, 'dice'), 4);
assert.ok(sd.ess === 4 && sd.cash === 0 && !G.L(st, 'd_pip') && G.L(st, 'dr_inc') === 1 && sd.stage === 10 && sd.sys.mat[0] === 2);

// offline: needs auto, capped
const o = G.newState(0);
assert.deepEqual(G.offlineGold(o, 3600e3).per, {});
lv(o, 'd_auto', 1);
assert.ok(G.offlineGold(o, 3600e3).per.dice > 0);
assert.equal(G.offlineGold(o, 100 * 3600e3).secs, 2 * 3600);

assert.ok(Math.abs(G.hiloMult(3, 1) - 2.1) < 1e-9);
assert.equal(G.fmt(1500), '1.50K');
assert.equal(G.fmt(1e15), '1.00aa');
console.log('logic ok');

// ---------- pacing sim ----------
// Greedy idle bot per game: taps 2×/s until Auto, buys the cheapest tree node or workshop upgrade, claims stages.
function simGame(s, g, maxMin) {
  const gs = s.g[g], at = {}, dt = 0.5;
  let timer = 0, nextTune = 0;
  for (let t = 0; t < maxMin * 60 && gs.stage < 12; t += dt) {
    const iv = G.hasAuto(s, g) ? G.autoIv(s, g) / 1000 : 0.5;
    for (timer += dt; timer >= iv; timer -= iv) G.collect(s, G.play(s, g, Math.random, Infinity));
    while (G.claim(s, g)) at[gs.stage] = t / 60;
    if (t >= nextTune) { // bot settings
      nextTune = t + 120;
      if (g === 'cards') gs.sys.strat = gs.stage >= G.SMART_AT ? 'smart' : 'pairs';
      if (g === 'plinko') gs.sys.tilt = 1;
      if (g === 'coin') {
        const S = G.stats(s, 'coin'), f = G.stageGoal('coin', gs.stage + 1).feat, need = f && /^s(\d+)$/.exec(f[0]);
        let best = 1, bv = 0;
        for (let k = 1; k <= Math.min(15, G.streakCap(S)); k++) { const v = G.coinEV(gs, S, k, 1500); if (v > bv) { bv = v; best = k; } }
        gs.sys.target = need && G.featCount(s, g, f) < 1 ? +need[1] : best;
      }
    }
    for (;;) {
      const opts = G.ALL[g].filter(nd => G.isUnlocked(s, nd.id)).map(nd => [nd.id, G.priceOf(s, nd.id)?.cost])
        .concat(G.wsRows(s, g).flatMap(r => r.btns).filter(b => b.buy && b.cost).map(b => ['ws:' + b.id, b.cost]))
        .filter(o => o[1] != null).sort((a, b) => a[1] - b[1]);
      if (!opts.length || opts[0][1] > gs.cash) break;
      const [id] = opts[0];
      id.startsWith('ws:') ? G.wsBuy(s, g, id.slice(3)) : G.buy(s, id);
    }
  }
  return at;
}
if (!process.argv.includes('quick')) {
  for (const g in G.GAMES) {
    const at = simGame(G.newState(0), g, 150), m = i => at[i]?.toFixed(0) ?? '-';
    console.log(`${g.padEnd(7)} stage 1: ${m(1)}m  3: ${m(3)}m  5: ${m(5)}m  8: ${m(8)}m  10: ${m(10)}m  12: ${m(12)}m`);
    if (process.argv.includes('assert')) {
      assert.ok(at[1] < 3, `${g} stage 1 too slow`);
      assert.ok(at[5] > 5 && at[5] < 35, `${g} stage 5 at ${at[5]}`); // coinflip edge luck can rush early stages
      assert.ok(at[10] > 45 && at[10] < 120, `${g} stage 10 at ${at[10]}`);
    }
  }
}
console.log('ok');
