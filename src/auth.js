// Session lives in localStorage. Built so SMS verification can be slotted in
// later: only the login call would change; the rest of the app reads
// getCurrentUser().

const KEY = 'gamify.user';
const GAME_KEY = 'gamify.currentGameId';

const listeners = new Set();
function emit() { listeners.forEach(fn => fn()); }
export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}
export function setCurrentUser(user) {
  if (user) localStorage.setItem(KEY, JSON.stringify(user));
  else localStorage.removeItem(KEY);
  emit();
}
export function logout() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(GAME_KEY);
  emit();
}

export function getCurrentGameId() {
  return localStorage.getItem(GAME_KEY) || null;
}
export function setCurrentGameId(id) {
  if (id) localStorage.setItem(GAME_KEY, id);
  else localStorage.removeItem(GAME_KEY);
  emit();
}
