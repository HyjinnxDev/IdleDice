// Logic self-check: `node test.js`
import assert from 'node:assert/strict';
import * as G from './js/game.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

// combos
assert.equal(G.combo([1]).mult, 1);
assert.equal(G.combo([2, 2]).name, 'Pair');
assert.equal(G.combo([2, 2, 3, 3]).name, 'Two Pair');
assert.equal(G.combo([4, 4, 4]).name, 'Triple');
assert.equal(G.combo([4, 4, 4, 2, 2]).name, 'Full House');
assert.equal(G.combo([1, 2, 3, 4, 5]).name, 'Straight');
assert.equal(G.combo([6, 2, 3, 4, 5, 6]).name, 'Straight');
assert.equal(G.combo([5, 5, 5, 5]).name, 'Four of a Kind');
assert.equal(G.combo([3, 3, 3, 3, 3]).name, 'JACKPOT');

// rolling: rng 0.99 → face 6, no crit
const s = G.newState(0);
let r = G.roll(s, seq(0.99), Infinity);
assert.deepEqual(r.faces, [6]);
assert.equal(r.damage, 6);
s.dice[0] = { lvl: 1, tier: 2 };
r = G.roll(s, seq(0.99), Infinity);
assert.equal(r.damage, (6 + 1) * 4);
s.boons.sixes = 1;
assert.equal(G.roll(s, seq(0.99), Infinity).damage, (6 + 1) * 2 * 4);
// frenzy ×7 only while active
s.buffs.frenzy = 100;
assert.equal(G.roll(s, seq(0.99), 50).damage, 56 * 7);
assert.equal(G.roll(s, seq(0.99), 150).damage, 56);
// combo bonus applies: two 6s = pair 1.5×
const p = G.newState(0); p.dice.push({ lvl: 0, tier: 0 });
assert.equal(G.roll(p, seq(0.99), Infinity).damage, Math.floor(12 * 1.5));
// phantom die copies best die
p.dice[1].tier = 3; p.boons.die = 1;
assert.equal(G.activeDice(p).length, 3);
assert.equal(G.activeDice(p)[2].tier, 3);

// shop
const b = G.newState(0);
assert.equal(G.buy(b, 'die'), false);
b.gold = 10;
assert.ok(G.buy(b, 'die'));
assert.equal(b.dice.length, 2);
assert.equal(b.gold, 0);
b.gold = 1e9;
assert.ok(G.buy(b, 'up:auto'));
assert.equal(G.priceOf(b, 'up:auto'), null);
assert.equal(G.buy(b, 'up:auto'), false);

// floors, boons, boss
const f = G.newState(0);
G.applyDamage(f, G.floorHp(1), 0);
assert.equal(f.floor, 2);
f.floor = 5; f.hp = 1;
G.applyDamage(f, 1, 0);
assert.equal(f.boonChoice.length, 3);
assert.ok(G.pickBoon(f, f.boonChoice[0]));
assert.equal(f.boonChoice, null);
f.floor = 9; f.hp = 1;
G.applyDamage(f, 1, 1000);
assert.equal(f.floor, 10);
assert.equal(f.bossEnd, 1000 + G.BOSS_TIME);
assert.equal(G.checkBoss(f, 1000 + G.BOSS_TIME), false);
assert.ok(G.checkBoss(f, 1001 + G.BOSS_TIME));
assert.equal(f.floor, 9);
f.hp = 1; G.applyDamage(f, 1, 0);          // back to boss
f.hp = 1; const k = G.applyDamage(f, 1, 0); // kill boss
assert.ok(k.wasBoss);
assert.equal(f.tickets, 1);
assert.ok(f.boonChoice); // floor 10 gives boon

// prestige
f.maxFloor = 30;
assert.equal(G.etherGain(f), 125);
assert.equal(G.ascend(f), 125);
assert.equal(f.floor, 1);
assert.equal(f.ether, 125);
assert.equal(f.boonChoice, null);

// offline
const o = G.newState(0);
assert.equal(G.offlineGold(o, 3600e3).gold, 0); // no auto-roller
o.up.auto = 1;
const off = G.offlineGold(o, 3600e3);
assert.ok(off.gold > 0 && off.secs === 3600);
assert.equal(G.offlineGold(o, 100 * 3600e3).secs, 2 * 3600);

// hi-lo
assert.equal(G.hiloMult(6, 1), 0);
assert.equal(G.hiloMult(1, -1), 0);
assert.ok(G.hiloMult(1, 1) > 1);

// fmt
assert.equal(G.fmt(999), '999');
assert.equal(G.fmt(1500), '1.50K');
assert.equal(G.fmt(1e15), '1.00aa');

console.log('ok');
