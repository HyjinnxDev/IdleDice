// Hi-Lo minigame: spend a ticket, bet the current game's cash, guess higher/lower, cash out any time.
import { fmt, hiloMult, GAMES } from './game.js';

const FACES = '⚀⚁⚂⚃⚄⚅';
const d6 = () => 1 + Math.floor(Math.random() * 6);
let h = null; // { g, cur, pot, streak } — g = game whose cash was bet

export const hiloSig = s => (h ? `${h.cur}|${h.pot}|${h.streak}` : `idle|${s.tickets}|${s.view}|${s.g[s.view].cash > 0}`);

export function renderHilo(el, s, lastResult = '') {
  if (!h) {
    const ok = s.tickets > 0 && s.g[s.view].cash >= 10, ci = GAMES[s.view].ci;
    el.innerHTML = `<div class="hilo">
      ${lastResult}
      <p class="tickets">🎟️ <b>${s.tickets}</b> ticket${s.tickets === 1 ? '' : 's'} <small>· from rare results in any game</small></p>
      <p class="muted">Bet your ${ci} ${GAMES[s.view].cur}. Guess if the next roll is higher or lower. Ties lose. Riskier guesses pay more. Cash out any time.</p>
      <div class="bets">${[0.1, 0.25, 0.5].map(p => `<button class="btn" data-hilo="start:${p}" ${ok ? '' : 'disabled'}>Bet ${p * 100}%</button>`).join('')}</div>
    </div>`;
    return;
  }
  const hi = hiloMult(h.cur, 1), lo = hiloMult(h.cur, -1), ci = GAMES[h.g].ci;
  el.innerHTML = `<div class="hilo">
    ${lastResult}
    <div class="hdie" id="hdie">${FACES[h.cur - 1]}</div>
    <p>Pot ${ci} <b>${fmt(h.pot)}</b> · Streak ${h.streak}</p>
    <div class="bets">
      <button class="btn" data-hilo="dir:1" ${hi ? '' : 'disabled'}>▲ Higher<br><small>×${hi.toFixed(2)}</small></button>
      <button class="btn" data-hilo="dir:-1" ${lo ? '' : 'disabled'}>▼ Lower<br><small>×${lo.toFixed(2)}</small></button>
    </div>
    <button class="btn cash" data-hilo="cash">Cash out ${ci} ${fmt(h.pot)}</button>
  </div>`;
}

// Returns { msg, win } for the UI to show, or null.
export function hiloAct(s, act) {
  const [k, v] = act.split(':');
  if (k === 'start' && !h && s.tickets > 0) {
    const gs = s.g[s.view], bet = Math.floor(gs.cash * +v);
    if (bet < 1) return null;
    s.tickets--; gs.cash -= bet;
    h = { g: s.view, cur: d6(), pot: bet, streak: 0 };
    return null;
  }
  if (k === 'dir' && h) {
    const dir = +v, mult = hiloMult(h.cur, dir);
    if (!mult) return null;
    const next = d6(), win = dir > 0 ? next > h.cur : next < h.cur;
    if (!win) {
      const lost = h.pot, ci = GAMES[h.g].ci; h = null;
      return { win: false, msg: `Rolled ${FACES[next - 1]} — lost ${ci} ${fmt(lost)}` };
    }
    h.pot = Math.floor(h.pot * mult); h.cur = next; h.streak++;
    return { win: true, msg: `${FACES[next - 1]}!` };
  }
  if (k === 'cash' && h) {
    const won = h.pot, ci = GAMES[h.g].ci;
    s.g[h.g].cash += won; h = null; // a won bet isn't "earned": doesn't count toward stages
    return { win: true, msg: `Cashed out ${ci} ${fmt(won)}`, cashed: true };
  }
  return null;
}
