// Spelling engine for Made Up Words.
//
// buildWord(prefix, root, suffix) takes part objects from wordData
// (prefix and suffix may be null) and returns:
//   { word, notes }
// where notes is a list of plain-language explanations of each
// spelling change, e.g. "ad- becomes at- before t, as in attract."

const clean = (part = '') => part.replace(/-/g, '').toLowerCase();
const isVowel = (ch) => 'aeiou'.includes(ch);

// Treat ph, ch, th, sh, rh as one sound so "phon" doesn't trigger
// the rules for a root starting with p.
const onset = (root) => (/^[cprst]h/.test(root) ? root.slice(0, 2) : root[0]);

// Latin prefixes change their last letter to match the next sound.
// Rules are checked in order; the first match wins.
const PREFIX_RULES = {
  a: [
    { when: (r) => isVowel(r[0]), form: 'an', why: 'before a vowel', example: 'anarchy' },
  ],
  ab: [
    { when: (r) => /^[ct]$/.test(onset(r)), form: 'abs', example: 'abstract' },
    { when: (r) => onset(r) === 'v', form: 'a', example: 'avert' },
  ],
  ad: [
    { when: (r) => /^(sc|sp|st|gn)/.test(r), form: 'a', why: (r) => `before ${r.slice(0, 2)}`, example: 'ascribe' },
    { when: (r) => /^[ckq]$/.test(onset(r)), form: 'ac', example: 'accept' },
    { when: (r) => onset(r) === 'f', form: 'af', example: 'affect' },
    { when: (r) => onset(r) === 'g', form: 'ag', example: 'aggregate' },
    { when: (r) => onset(r) === 'l', form: 'al', example: 'allude' },
    { when: (r) => onset(r) === 'n', form: 'an', example: 'announce' },
    { when: (r) => onset(r) === 'p', form: 'ap', example: 'appear' },
    { when: (r) => onset(r) === 'r', form: 'ar', example: 'arrive' },
    { when: (r) => onset(r) === 's', form: 'as', example: 'assist' },
    { when: (r) => onset(r) === 't', form: 'at', example: 'attract' },
  ],
  com: [
    { when: (r) => /^[bmp]$/.test(onset(r)), form: 'com' },
    { when: (r) => onset(r) === 'l', form: 'col', example: 'collect' },
    { when: (r) => onset(r) === 'r', form: 'cor', example: 'correct' },
    { when: (r) => isVowel(r[0]) || /^[hw]$/.test(onset(r)) || r.startsWith('gn'),
      form: 'co', why: (r) => (isVowel(r[0]) ? 'before a vowel' : null), example: 'coauthor' },
    { when: () => true, form: 'con', why: 'before most consonants', example: 'conduct' },
  ],
  dis: [
    { when: (r) => onset(r) === 'f', form: 'dif', example: 'differ' },
  ],
  ex: [
    // ex + sp/st keeps one s: expect, expire
    { when: (r) => /^s[pt]/.test(r), form: 'ex', dropRootInitial: true, example: 'expect and expire' },
    { when: (r) => /^[bdgjlmnrv]$/.test(onset(r)), form: 'e', example: 'edict and emit' },
    { when: (r) => onset(r) === 'f', form: 'ef', example: 'effect' },
  ],
  in: [
    { when: (r) => onset(r) === 'l', form: 'il', example: 'illegal' },
    { when: (r) => onset(r) === 'r', form: 'ir', example: 'irregular' },
    { when: (r) => /^[bmp]$/.test(onset(r)), form: 'im', example: 'impossible' },
  ],
  sub: [
    { when: (r) => onset(r) === 'c', form: 'suc', example: 'succeed' },
    { when: (r) => onset(r) === 'f', form: 'suf', example: 'suffix' },
    { when: (r) => onset(r) === 'g', form: 'sug', example: 'suggest' },
    { when: (r) => onset(r) === 'p', form: 'sup', example: 'support' },
    { when: (r) => onset(r) === 'r', form: 'sur', example: 'surrogate' },
  ],
  trans: [
    // trans + s keeps one s: transcribe, transpire
    { when: (r) => r[0] === 's', form: 'trans', dropRootInitial: true, example: 'transcribe' },
  ],
};

// Suffixes that pull a Latin root into its past-participle ("supine") form.
const SUPINE_SUFFIXES = new Set(['ion', 'ive', 'or', 'ure']);

function applyPrefix(prefixPart, rootStart) {
  const p = clean(prefixPart);
  const rules = PREFIX_RULES[p] || [];
  const rule = rules.find((r) => r.when(rootStart));
  if (!rule) return { form: p, rootStart, note: null };

  let note = null;
  let nextRoot = rootStart;

  if (rule.dropRootInitial) {
    nextRoot = rootStart.slice(1);
    note = `${p}- absorbs the ${rootStart[0]} that follows it, as in ${rule.example}.`;
  } else if (rule.form !== p) {
    const why = typeof rule.why === 'function' ? rule.why(rootStart) : rule.why;
    const context = why || `before ${onset(rootStart)}`;
    note = `${p}- becomes ${rule.form}- ${context}, as in ${rule.example}.`;
  }
  return { form: rule.form, rootStart: nextRoot, note };
}

function applyRootAndSuffix(root, suffixPart) {
  const notes = [];
  const part = clean(root.part);

  // No suffix: the root ends the word.
  if (!suffixPart) {
    if (root.bare && root.bare !== part) {
      notes.push(`${part} takes a silent e at the end of a word, as in ${root.bareExample}.`);
    }
    return { rootForm: root.bare || part, suffixForm: '', notes };
  }

  let s = clean(suffixPart);

  // -logy: Greek compounds link with an o (chronology, morphology).
  if (s === 'logy') {
    if (part.endsWith('o')) return { rootForm: part, suffixForm: s, notes };
    if (isVowel(part.at(-1))) {
      notes.push(`An o links ${part} to -logy, as in cardiology.`);
      return { rootForm: part + 'o', suffixForm: s, notes };
    }
    const base = root.stem || part;
    if (root.stem) notes.push(`${part} shortens to ${root.stem}- before -logy.`);
    notes.push(`An o links ${base} to -logy, as in chronology.`);
    return { rootForm: base + 'o', suffixForm: s, notes };
  }

  // Consonant suffixes (-ful, -less, -ment, -ness) attach to the whole word form.
  if (!isVowel(s[0])) {
    if (root.bare && root.bare !== part) {
      notes.push(`${part} keeps its silent e (${root.bare}) before -${s}, as in ${root.bareExample}.`);
    }
    return { rootForm: root.bare || part, suffixForm: s, notes };
  }

  // Vowel suffixes.
  let form = root.stem || part;
  if (root.stem) notes.push(`${part} becomes ${root.stem}- before a vowel, as in ${root.stemExample}.`);

  if (SUPINE_SUFFIXES.has(s) && root.supine) {
    form = root.supine;
    notes.push(`${part} switches to ${root.supine}- before -${s}, as in ${root.supineExample}.`);
  }

  if (s === 'able' && root.ible) {
    s = 'ible';
    notes.push(`-able becomes -ible after ${part}, as in ${root.ibleExample}.`);
  }

  // Two vowels meeting at the seam.
  const last = form.at(-1);
  if (isVowel(last)) {
    if (last === s[0]) {
      notes.push(`The two ${last}'s at the seam merge into one.`);
      form = form.slice(0, -1);
    } else if (last === 'o' && form.length > 3) {
      notes.push(`${form} drops its final o before a vowel, as in photic and autism.`);
      form = form.slice(0, -1);
    }
  }

  return { rootForm: form, suffixForm: s, notes };
}

export function buildWord(prefix, root, suffix) {
  if (!root) return { word: '', notes: [] };

  const notes = [];
  const rs = applyRootAndSuffix(root, suffix?.part);
  notes.push(...rs.notes);

  let rootForm = rs.rootForm;
  let prefixForm = '';

  if (prefix?.part) {
    const pr = applyPrefix(prefix.part, rootForm);
    prefixForm = pr.form;
    rootForm = pr.rootStart;
    if (pr.note) notes.unshift(pr.note);
  }

  return { word: (prefixForm + rootForm + rs.suffixForm).toLowerCase(), notes };
}

// A readable definition for a word the dictionary doesn't know.
export function inventDefinition(prefix, root, suffix) {
  if (!root) return '';
  let phrase = root.gloss || clean(root.part);
  if (prefix?.template) phrase = prefix.template.replace('{x}', phrase);
  if (suffix?.template) return suffix.template.replace('{x}', phrase);
  return prefix ? phrase : `the idea of ${phrase}`;
}
