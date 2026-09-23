// Small helpers for saving to the player's browser.
export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private browsing). The game still works.
  }
}

// A random id for this browser, used so each player gets one vote per word.
export function getVoterId() {
  let id = readJSON('muw-voter-id', null);
  if (!id) {
    id = crypto.randomUUID();
    writeJSON('muw-voter-id', id);
  }
  return id;
}
