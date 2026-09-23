// Shared helpers for turning part strings ("ab", "norm", "al") into part objects.
import { wordData } from './wordData.js';

const NONE = { part: '' };

export const LISTS = {
  prefix: [NONE, ...wordData.prefixes],
  root: wordData.roots,
  suffix: [NONE, ...wordData.suffixes],
};
export const KINDS = ['prefix', 'root', 'suffix'];
export const EMPTY_TYPED = { prefix: '', root: '', suffix: '' };

export const strip = (p = '') => p.replace(/-/g, '');
export const tidy = (text) => text.toLowerCase().replace(/[^a-z-]/g, '');
export const findPart = (list, value) =>
  list.find((o) => o.part && strip(o.part) === strip(value)) || null;

// A part the player typed that isn't in wordData.
export function customPart(kind, text) {
  if (kind === 'prefix') return { part: `${text}-`, template: '{x}' };
  if (kind === 'root') return { part: text, gloss: `“${text}”` };
  return { part: `-${text}`, template: '{x}', pos: '' };
}

// A part object from plain text: known parts keep their spelling rules.
export function partFromText(kind, text) {
  const t = strip(text || '');
  if (!t) return null;
  return findPart(LISTS[kind], t) || customPart(kind, t);
}

// Typed text wins over the wheel.
export function resolvePart(kind, wheelValue, typedValue) {
  if (strip(typedValue)) return partFromText(kind, typedValue);
  return findPart(LISTS[kind], wheelValue);
}

export function resolveAll(wheel, typed) {
  return {
    prefix: resolvePart('prefix', wheel.prefix, typed.prefix),
    root: resolvePart('root', wheel.root, typed.root),
    suffix: resolvePart('suffix', wheel.suffix, typed.suffix),
  };
}

export function partStrings(parts) {
  return {
    prefix: parts.prefix ? strip(parts.prefix.part) : '',
    root: parts.root ? strip(parts.root.part) : '',
    suffix: parts.suffix ? strip(parts.suffix.part) : '',
  };
}

// A shareable link that reopens these parts in the given view.
export function linkFor({ prefix, root, suffix }, view = 'free') {
  const q = new URLSearchParams();
  if (prefix) q.set('p', prefix);
  q.set('r', root);
  if (suffix) q.set('s', suffix);
  return `${window.location.origin}${window.location.pathname}?${q}#${view}`;
}
