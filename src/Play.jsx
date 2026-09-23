import { useEffect, useMemo, useRef, useState } from 'react';
import Wheel from './Wheel.jsx';
import Burst from './Burst.jsx';
import { wordData } from './wordData.js';
import { buildWord, inventDefinition } from './spelling.js';
import { lookupWord } from './dictionary.js';
import { sameMeaningWords } from './similar.js';
import { submitEntry, ruleBroken } from './daily.js';
import { RESET_TIME } from './config.js';
import { readJSON, writeJSON } from './storage.js';
import {
  LISTS, KINDS, tidy, findPart, partStrings, linkFor,
} from './parts.js';

const randomItem = (list) => list[Math.floor(Math.random() * list.length)];
const dictionaryUrl = (word) => 'https://www.dictionary.com/browse/' + encodeURIComponent(word);

// Read ?p=ab&r=norm&s=al so a word can be shared as a link.
// Parts that aren't on a wheel are ignored.
function initialWheel() {
  const q = new URLSearchParams(window.location.search);
  const keys = { prefix: 'p', root: 'r', suffix: 's' };
  const wheel = { prefix: 'ab-', root: 'norm', suffix: '-al' };
  if (!q.has('r')) return wheel;

  const linked = {};
  for (const kind of KINDS) {
    const raw = tidy(q.get(keys[kind]) || '');
    linked[kind] = raw ? findPart(LISTS[kind], raw) : null;
    if (raw && !linked[kind]) return wheel; // an unknown part: fall back to the defaults
  }
  if (!linked.root) return wheel;
  return {
    prefix: linked.prefix?.part ?? '',
    root: linked.root.part,
    suffix: linked.suffix?.part ?? '',
  };
}

// The part objects for a set of wheel values ('' means no prefix or suffix).
const partsFor = (wheel) => ({
  prefix: findPart(LISTS.prefix, wheel.prefix),
  root: findPart(LISTS.root, wheel.root),
  suffix: findPart(LISTS.suffix, wheel.suffix),
});

function badgeFor(result) {
  if (result.type === 'found') return 'You found a word!';
  if (result.type === 'error') return 'Not checked';
  if (result.similar.status === 'done' && result.similar.same.length) return 'Almost a real word!';
  return 'You made up a word!';
}


// One play screen. Today's prompt sits on top; any made-up word can be
// submitted for it from the result pop-up, or you can ignore it and play.
// today: { status, data, refresh } from App.
export default function Play({ dictionary, today }) {
  const startWheel = useMemo(initialWheel, []);
  const [wheel, setWheel] = useState(startWheel);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [entry, setEntry] = useState({ status: 'idle' });
  const [panel, setPanel] = useState(null); // 'spelling' | null
  const [promptOpen, setPromptOpen] = useState(() => readJSON('muw-prompt-open', true));

  const togglePrompt = () => {
    setPromptOpen((open) => {
      writeJSON('muw-prompt-open', !open);
      return !open;
    });
  };
  const [burstKey, setBurstKey] = useState(0);
  const dialogRef = useRef(null);
  const cardRef = useRef(null);
  const spinTimer = useRef(0);
  const runId = useRef(0);

  const parts = partsFor(wheel);
  const built = buildWord(parts.prefix, parts.root, parts.suffix);
  const todayData = today?.data;

  const clearResult = () => {
    runId.current += 1; // ignore any lookups still in flight
    setResult(null);
    setCopied(false);
    setEntry({ status: 'idle' });
    setPanel(null);
  };

  const handleSpin = (kind) => (value) => {
    setWheel((w) => ({ ...w, [kind]: value }));
    clearResult();
  };

  // Start checking a word as soon as the wheels come to rest, so the answer
  // is usually ready by the time Combine is pressed.
  useEffect(() => {
    if (spinning || !built.word) return;
    const word = built.word;
    const snapshot = parts;
    const timer = setTimeout(() => {
      lookupWord(word)
        .then((r) => !r.found && sameMeaningWords(snapshot, word))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [built.word, spinning]); // eslint-disable-line react-hooks/exhaustive-deps

  // The result opens as a pop-up.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (result && !dialog.open) dialog.showModal();
    if (!result && dialog.open) dialog.close();
  }, [result]);

  const closeResult = () => dialogRef.current?.close();

  useEffect(() => () => clearTimeout(spinTimer.current), []);

  const combine = async (wheelState) => {
    const p = partsFor(wheelState);
    const b = buildWord(p.prefix, p.root, p.suffix);
    if (!b.word || !p.root) return;

    clearResult();
    const run = runId.current;
    setIsLoading(true);
    window.history.replaceState(null, '', linkFor(partStrings(p), 'play'));

    const base = { word: b.word, notes: b.notes, parts: partStrings(p), literal: inventDefinition(p.prefix, p.root, p.suffix) };
    try {
      const found = await lookupWord(b.word);
      if (run !== runId.current) return;
      if (found.found) {
        setResult({ ...base, type: 'found', definition: found.definition, pos: found.partOfSpeech });
        return;
      }
      setResult({
        ...base,
        type: 'made',
        definition: base.literal,
        pos: p.suffix?.pos || '',
        similar: { status: 'checking', same: [] },
      });
      // Look for real words that mean the same thing (dis- vs de-, -ic vs -al...).
      const same = await sameMeaningWords(p, b.word).catch(() => []);
      if (run !== runId.current) return;
      setResult((r) => r && { ...r, similar: { ...r.similar, status: 'done', same } });
      if (!same.length) setBurstKey((k) => k + 1); // a brand-new word: celebrate
    } catch (error) {
      console.error('Dictionary lookup failed', error);
      if (run !== runId.current) return;
      setResult({
        ...base,
        type: 'error',
        notes: [],
        definition: 'The dictionary didn’t respond, so this word couldn’t be checked. Press Combine to try again.',
      });
    } finally {
      if (run === runId.current) setIsLoading(false);
    }
  };

  const handleSurprise = () => {
    const next = {
      prefix: Math.random() < 0.15 ? '' : randomItem(wordData.prefixes).part,
      root: randomItem(wordData.roots).part,
      suffix: Math.random() < 0.15 ? '' : randomItem(wordData.suffixes).part,
    };
    clearResult();
    setSpinning(true);
    setWheel(next);

    clearTimeout(spinTimer.current);
    const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
    spinTimer.current = setTimeout(() => {
      setSpinning(false);
      combine(next);
    }, delay);
  };

  const saved = result ? dictionary.get(result.word) : null;

  const saveToDictionary = (extra = {}) =>
    dictionary.add({
      word: result.word,
      type: 'made',
      definition: extra.entered ? todayData.prompt : result.definition,
      pos: result.pos,
      parts: result.parts,
      ...extra,
    });

  const handleSubmit = async () => {
    setEntry({ status: 'sending' });
    try {
      await submitEntry({ word: result.word, ...result.parts });
      saveToDictionary({ entered: todayData.day });
      setEntry({ status: 'done' });
      today.refresh();
    } catch (error) {
      console.error('Submitting failed', error);
      const rule = ruleBroken(error);
      const message =
        rule === 'word_taken'
          ? 'Someone already entered this exact word today. Give theirs a vote, or make another.'
          : rule === 'already_entered'
            ? 'You already have an entry today.'
            : 'That didn’t go through. Check your connection and try again.';
      setEntry({ status: 'error', message });
      if (rule === 'already_entered') today.refresh();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linkFor(result.parts, 'play'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const meaningFor = (kind) => parts[kind]?.meaning || `no ${kind}`;

  const similar = result?.similar;
  const isAlmost = similar?.status === 'done' && similar.same.length > 0;
  const myWord = todayData?.my_word;

  // What the "today's prompt" part of the pop-up should say or offer.
  let dailyAction = null;
  if (result?.type === 'made' && todayData) {
    if (entry.status === 'done') dailyAction = { note: `You’re in! Voting stays open until ${RESET_TIME}.`, link: true };
    else if (todayData.offline) dailyAction = { note: 'Entries are taking a quick break. You can still save this word to your dictionary.' };
    else if (myWord) dailyAction = { note: `You already entered “${myWord}” today.`, link: true };
    else if (similar?.status === 'checking') dailyAction = { note: 'Checking it isn’t too close to a real word…' };
    else if (isAlmost) dailyAction = { note: 'Too close to a real word to enter. Try changing a part.' };
    else dailyAction = { canSubmit: true };
  }

  return (
    <div className="play">
      {todayData && (
        <section className={`prompt-card ${promptOpen ? '' : 'is-collapsed'}`} aria-label="Today’s prompt">
          <button
            className="prompt-toggle"
            onClick={togglePrompt}
            aria-expanded={promptOpen}
            aria-controls="prompt-details"
          >
            {promptOpen ? 'Hide' : 'Show'}
          </button>

          {promptOpen ? (
            <div id="prompt-details">
              <p className="prompt-kicker">Today’s prompt</p>
              <p className="prompt-text">{todayData.prompt}</p>
              <p className="prompt-meta">
                {myWord ? (
                  <>Your entry: <strong>{myWord}</strong>. </>
                ) : (
                  'Make up a word for it and submit it from the pop-up, or just play. '
                )}
                {!todayData.offline && <a href="#vote">See entries and vote</a>}
              </p>
              {todayData.yesterday_word && (
                <p className="prompt-winner">
                  Yesterday’s winner: <strong>{todayData.yesterday_word}</strong>, for “{todayData.yesterday_prompt}”
                </p>
              )}
            </div>
          ) : (
            <p className="prompt-mini" id="prompt-details">
              <span className="prompt-mini-label">Today’s prompt</span>
              <span className="prompt-mini-text">{todayData.prompt}</span>
            </p>
          )}
        </section>
      )}

      <section className="machine" aria-label="Word parts">
        <div className="tray">
          <div className="payline" aria-hidden="true" />
          {KINDS.map((kind) => (
            <Wheel
              key={kind}
              label={kind}
              idBase={`play-${kind}`}
              options={LISTS[kind]}
              value={wheel[kind]}
              onChange={handleSpin(kind)}
              smooth={spinning}
            />
          ))}
        </div>

        <div className="captions">
          {KINDS.map((kind) => (
            <div key={kind} className="caption">
              <p className="caption-label">{kind}</p>
              <p className="caption-meaning">{meaningFor(kind)}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="builder">
        <p className="preview" aria-live="polite">{built.word}</p>
        <button
          className="combine"
          onClick={() => combine(wheel)}
          disabled={isLoading || spinning || !built.word}
        >
          {isLoading ? 'Checking…' : 'Combine'}
        </button>
        <button className="text-btn surprise" onClick={handleSurprise} disabled={isLoading || spinning}>
          or surprise me
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className={`result result--${result?.type || 'made'}`}
        aria-labelledby="result-word"
        onClose={clearResult}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeResult(); // click on the backdrop
        }}
      >
        {result?.type === 'made' && burstKey > 0 && <Burst key={burstKey} cardRef={cardRef} />}
        {result && (
          <div className="result-card" ref={cardRef}>
            <div className="result-inner">
              <button className="result-close" onClick={closeResult} aria-label="Close">
                ×
              </button>
              <span className="result-badge">{badgeFor(result)}</span>
              <h2 id="result-word" className="result-word">{result.word}</h2>
              {result.pos && <p className="result-pos">{result.pos}</p>}
              <p className="result-definition">{result.definition}</p>

              {isAlmost && (
                <p className="result-same">
                  Means the same as{' '}
                  {similar.same.map((s, i) => (
                    <span key={s.word}>
                      {i > 0 && ', '}
                      <a href={dictionaryUrl(s.word)} target="_blank" rel="noreferrer">{s.word}</a>
                      {s.from && <span className="result-same-why"> ({s.to} instead of {s.from})</span>}
                    </span>
                  ))}
                </p>
              )}

              {result.type !== 'error' && (
                <div className="result-actions">
                  {result.type === 'found' && (
                    <a className="is-solid" href={dictionaryUrl(result.word)} target="_blank" rel="noreferrer">
                      See it on Dictionary.com
                    </a>
                  )}
                  {result.type === 'made' && (
                    <button className="is-solid" onClick={() => saveToDictionary()} disabled={Boolean(saved)}>
                      {saved ? 'In your dictionary' : 'Add to my dictionary'}
                    </button>
                  )}
                  <button onClick={handleCopy}>{copied ? 'Link copied' : 'Copy link'}</button>
                </div>
              )}
            </div>

            {(dailyAction || result.notes.length > 0) && (
              <div className="result-footer">
                {dailyAction && (
                  <div className="result-daily">
                    <p className="result-daily-prompt">
                      <span className="result-daily-label">Today’s prompt</span>
                      {todayData.prompt}
                    </p>
                    {dailyAction.canSubmit && (
                      <button className="daily-submit" onClick={handleSubmit} disabled={entry.status === 'sending'}>
                        {entry.status === 'sending' ? 'Submitting…' : 'Submit for today'}
                      </button>
                    )}
                    {dailyAction.note && (
                      <p className="result-daily-note">
                        {dailyAction.note}{' '}
                        {dailyAction.link && <a href="#vote" onClick={closeResult}>See entries and vote</a>}
                      </p>
                    )}
                    {entry.status === 'error' && <p className="result-daily-note">{entry.message}</p>}
                  </div>
                )}

                {result.notes.length > 0 && (
                  <div className="result-more">
                    <button
                      className="more-toggle"
                      aria-expanded={panel === 'spelling'}
                      onClick={() => setPanel((v) => (v === 'spelling' ? null : 'spelling'))}
                    >
                      How it’s spelled
                    </button>
                  </div>
                )}

                {panel === 'spelling' && (
                  <ul className="more-panel">
                    {result.notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
