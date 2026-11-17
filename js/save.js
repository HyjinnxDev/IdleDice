import { newState } from './game.js';

const KEY = 'dicedepths-v2';

// Fill keys missing from older saves with defaults.
function merge(def, s) {
  for (const k in def) {
    if (s[k] === undefined) s[k] = def[k];
    else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && typeof s[k] === 'object') merge(def[k], s[k]);
  }
  return s;
}

function hydrate(s) {
  if (!s || typeof s !== 'object' || s.v !== 2 || !s.lv || typeof s.lv !== 'object') throw new Error('Invalid save');
  return merge(newState(), s);
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return hydrate(JSON.parse(raw));
  } catch (e) { console.warn('Save unreadable, starting fresh', e); }
  return newState();
}

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('Save failed', e); }
}

export const exportSave = s => btoa(JSON.stringify(s));
export const importSave = str => hydrate(JSON.parse(atob(str.trim())));
export const wipe = () => localStorage.removeItem(KEY);
