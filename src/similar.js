// Finds real words that mean (pretty much) the same thing as a made-up word.
//
// Two checks, both strict on purpose:
// 1. Swap one part for another part with the same meaning (dis- for de-,
//    -al for -ic, graph for scrib) and see if the result is a real word.
//    "disstructive" -> swap dis- for de- -> "destructive".
// 2. Ask a reverse dictionary for words matching the made-up definition,
//    and keep only close ones: among the top matches, containing the same
//    root, ending the same way, and the same part of speech. That catches
//    respellings the swaps miss, without loose matches like "law" for "antinormal".
import { buildWord, inventDefinition } from './spelling.js';
import { findPart, LISTS, KINDS, strip } from './parts.js';
import { wordExists, wordsMeaning } from './dictionary.js';

// Parts that mean (nearly) the same thing. Edit freely.
// Left out on purpose: in- (means both "not" and "into"), pre-/pro-, and
// roots like port/fer or vis/spect, where swapping them turns one real word
// into a different real word (report/refer, revise/respect).
const SAME_MEANING = {
  prefix: [
    ['a', 'dis', 'non', 'un'], // not
    ['ab', 'de', 'dis', 'ex'], // away, off
    ['sub', 'hypo'], // under
  ],
  root: [
    ['graph', 'scrib'], // write
    ['phon', 'son'], // sound
    ['luc', 'photo'], // light
    ['form', 'morph'], // shape
  ],
  suffix: [
    ['al', 'ic', 'ive', 'ent'], // relating to
    ['ful', 'ous'], // full of
    ['ance', 'ity', 'ness', 'ment', 'ion', 'ation', 'ure'], // state, act
    ['ize', 'ify'], // make
    ['ist', 'or'], // one who
  ],
};

function alternatives(kind, part) {
  if (!part) return [];
  const key = strip(part.part);
  const alts = new Set();
  for (const group of SAME_MEANING[kind]) {
    if (group.includes(key)) group.forEach((p) => p !== key && alts.add(p));
  }
  return [...alts].map((p) => findPart(LISTS[kind], p)).filter(Boolean);
}

const POS_TAG = { adjective: 'adj', noun: 'n', verb: 'v' };

// The spellings a root takes inside real words: norm; duc, duct, duce; scrib, script.
function rootForms(root) {
  const forms = [root.part, root.stem, root.supine, root.bare && root.bare.replace(/e$/, '')]
    .filter(Boolean)
    .map(strip);
  return [...new Set(forms)].filter((f) => f.length >= 3);
}

async function swapMatches(parts, word) {
  const candidates = new Map();
  for (const kind of KINDS) {
    for (const alt of alternatives(kind, parts[kind])) {
      const next = { ...parts, [kind]: alt };
      const built = buildWord(next.prefix, next.root, next.suffix).word;
      if (built && built !== word && !candidates.has(built)) {
        candidates.set(built, { word: built, kind, from: parts[kind].part, to: alt.part });
      }
    }
  }
  const list = [...candidates.values()];
  const real = await Promise.all(list.map((c) => wordExists(c.word)));
  return list.filter((_, i) => real[i]);
}

async function meaningMatches(parts, word) {
  const forms = rootForms(parts.root);
  if (!forms.length) return [];
  const phrase = inventDefinition(parts.prefix, parts.root, parts.suffix);
  const pos = POS_TAG[parts.suffix?.pos];
  const ending = word.slice(-3); // same suffix family: -ive, -ion, -ity...
  const results = await wordsMeaning(phrase, { max: 15 }); // only the strongest matches
  return results
    .filter((r) => r.word !== word)
    .filter((r) => forms.some((f) => r.word.includes(f)))
    .filter((r) => r.word.endsWith(ending))
    .filter((r) => !pos || r.pos === pos)
    .slice(0, 3)
    .map((r) => ({ word: r.word }));
}

async function findSame(parts, word) {
  const [swaps, meanings] = await Promise.all([
    swapMatches(parts, word).catch(() => []),
    meaningMatches(parts, word).catch(() => []),
  ]);
  const seen = new Set(swaps.map((s) => s.word));
  return [...swaps, ...meanings.filter((m) => !seen.has(m.word))];
}

// Returns [{ word, kind?, from?, to? }]: real words that mean the same thing.
// Cached per word, including checks still in progress.
const cache = new Map();

export function sameMeaningWords(parts, word) {
  if (!cache.has(word)) cache.set(word, findSame(parts, word));
  return cache.get(word);
}
