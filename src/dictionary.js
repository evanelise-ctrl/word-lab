// Checks whether a word exists, as fast as possible.
//
// Two dictionaries are asked at the same time:
//   Datamuse         usually answers in a fraction of a second
//   Free Dictionary  has nicer definitions but can be slow
// If Datamuse knows the word, we only wait a moment for Free Dictionary's
// definition. If Datamuse doesn't, Free Dictionary gets a short window to
// disagree before we call it a made-up word.
// Answers (and lookups still in progress) are cached, so checking the same
// word twice never waits twice.

const DATAMUSE_POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
const NICER_DEFINITION_WAIT_MS = 600; // real word: how long to wait for a nicer definition
const SECOND_OPINION_WAIT_MS = 1500; // not in Datamuse: how long Free Dictionary gets to disagree
const FREE_DICTIONARY_TIMEOUT_MS = 3500;

async function fetchWithTimeout(url, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Resolves with the promise's value, or with `fallback` after ms.
const within = (promise, ms, fallback) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);

async function freeDictionary(word) {
  const res = await fetchWithTimeout(
    'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word),
    FREE_DICTIONARY_TIMEOUT_MS
  );
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new Error('Free Dictionary returned ' + res.status);

  const data = await res.json();
  const meaning = data?.[0]?.meanings?.[0];
  return {
    found: true,
    definition: meaning?.definitions?.[0]?.definition ?? '',
    partOfSpeech: meaning?.partOfSpeech ?? '',
  };
}

// Datamuse only counts words that come with a definition, so names and typos don't slip through.
const datamuseCache = new Map();

function datamuse(word) {
  if (!datamuseCache.has(word)) {
    const request = (async () => {
      const res = await fetchWithTimeout(
        'https://api.datamuse.com/words?md=d&max=1&sp=' + encodeURIComponent(word),
        4000
      );
      if (!res.ok) throw new Error('Datamuse returned ' + res.status);
      const hit = (await res.json())?.[0];
      if (!hit || hit.word.toLowerCase() !== word || !hit.defs?.length) return { found: false };
      const [pos, definition] = hit.defs[0].split('\t');
      return { found: true, definition, partOfSpeech: DATAMUSE_POS[pos] || '' };
    })();
    request.catch(() => datamuseCache.delete(word)); // let a failed lookup be retried
    datamuseCache.set(word, request);
  }
  return datamuseCache.get(word);
}

async function checkWord(word) {
  const FAILED = { failed: true };
  const fd = freeDictionary(word).catch(() => FAILED);
  const dm = datamuse(word).catch(() => FAILED);

  const quick = await dm;
  if (quick.found) {
    // Real word. Use Free Dictionary's definition if it arrives quickly.
    const nicer = await within(fd, NICER_DEFINITION_WAIT_MS, null);
    return nicer?.found ? nicer : quick;
  }

  if (!quick.failed) {
    // Datamuse says it's not a word. Give Free Dictionary a short window to disagree.
    const second = await within(fd, SECOND_OPINION_WAIT_MS, null);
    return second?.found ? second : quick;
  }

  // Datamuse failed, so Free Dictionary is the only opinion. Wait for it.
  const slow = await fd;
  if (!slow.failed) return slow;
  throw new Error('Both dictionaries failed');
}

const lookupCache = new Map();

export function lookupWord(word) {
  if (!lookupCache.has(word)) {
    const request = checkWord(word);
    request.catch(() => lookupCache.delete(word));
    lookupCache.set(word, request);
  }
  return lookupCache.get(word);
}

// Is this a real dictionary word? (Datamuse only, shared cache.)
export async function wordExists(word) {
  try {
    return (await datamuse(word)).found;
  } catch {
    return false;
  }
}

// Real words whose meaning is close to a phrase ("reverse dictionary").
// Returns [{ word, pos }] where pos is Datamuse's tag: n, v, adj, adv.
export async function wordsMeaning(phrase, { max = 50 } = {}) {
  const res = await fetchWithTimeout(
    'https://api.datamuse.com/words?md=d&max=' + max + '&ml=' + encodeURIComponent(phrase),
    4000
  );
  if (!res.ok) throw new Error('Datamuse returned ' + res.status);
  return (await res.json())
    .filter((w) => /^[a-z]+$/.test(w.word) && w.defs?.length)
    .map((w) => ({ word: w.word, pos: w.defs[0].split('\t')[0] }));
}
