// Hi-Lo minigame: spend a ticket, bet gold, guess higher/lower, cash out any time.
import { fmt, hiloMult } from './game.js';

const FACES = '⚀⚁⚂⚃⚄⚅';
const d6 = () => 1 + Math.floor(Math.random() * 6);
let g = null; // { cur, pot, streak }

export const hiloSig = s => (g ? `${g.cur}|${g.pot}|${g.streak}` : `idle|${s.tickets}|${s.gold > 0}`);

export function renderHilo(el, s, lastResult = '') {
  if (!g) {
    const ok = s.tickets > 0 && s.gold >= 10;
    el.innerHTML = `<div class="hilo">
      ${lastResult}
      <p class="tickets">🎟️ <b>${s.tickets}</b> ticket${s.tickets === 1 ? '' : 's'} <small>· 1 per boss kill</small></p>
      <p class="muted">Guess if the next roll is higher or lower. Ties lose. Riskier guesses pay more. Cash out any time.</p>
      <div class="bets">${[0.1, 0.25, 0.5].map(p => `<button class="btn" data-hilo="start:${p}" ${ok ? '' : 'disabled'}>Bet ${p * 100}%</button>`).join('')}</div>
    </div>`;
    return;
  }
  const hi = hiloMult(g.cur, 1), lo = hiloMult(g.cur, -1);
  el.innerHTML = `<div class="hilo">
    ${lastResult}
    <div class="hdie" id="hdie">${FACES[g.cur - 1]}</div>
    <p>Pot 🪙 <b>${fmt(g.pot)}</b> · Streak ${g.streak}</p>
    <div class="bets">
      <button class="btn" data-hilo="dir:1" ${hi ? '' : 'disabled'}>▲ Higher<br><small>×${hi.toFixed(2)}</small></button>
      <button class="btn" data-hilo="dir:-1" ${lo ? '' : 'disabled'}>▼ Lower<br><small>×${lo.toFixed(2)}</small></button>
    </div>
    <button class="btn cash" data-hilo="cash">Cash out 🪙 ${fmt(g.pot)}</button>
  </div>`;
}

// Returns { msg, win } for the UI to show, or null.
export function hiloAct(s, act) {
  const [k, v] = act.split(':');
  if (k === 'start' && !g && s.tickets > 0) {
    const bet = Math.floor(s.gold * +v);
    if (bet < 1) return null;
    s.tickets--; s.gold -= bet;
    g = { cur: d6(), pot: bet, streak: 0 };
    return null;
  }
  if (k === 'dir' && g) {
    const dir = +v, mult = hiloMult(g.cur, dir);
    if (!mult) return null;
    const next = d6(), win = dir > 0 ? next > g.cur : next < g.cur;
    if (!win) {
      const lost = g.pot; g = null;
      return { win: false, msg: `Rolled ${FACES[next - 1]} — lost 🪙 ${fmt(lost)}` };
    }
    g.pot = Math.floor(g.pot * mult); g.cur = next; g.streak++;
    return { win: true, msg: `${FACES[next - 1]}!` };
  }
  if (k === 'cash' && g) {
    const won = g.pot; s.gold += won; g = null;
    return { win: true, msg: `Cashed out 🪙 ${fmt(won)}`, cashed: true };
  }
  return null;
}
