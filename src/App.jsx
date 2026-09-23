import { useCallback, useEffect, useState } from 'react';
import './App.css';
import HowTo from './HowTo.jsx';
import Play from './Play.jsx';
import Vote from './Vote.jsx';
import MyDictionary from './MyDictionary.jsx';
import { dailyReady, fetchToday } from './daily.js';
import { fallbackPrompt, gameDay } from './prompts.js';
import { readJSON, writeJSON } from './storage.js';

const TABS = [
  { id: 'play', label: 'Play' },
  { id: 'vote', label: 'Vote' },
  { id: 'dictionary', label: 'My dictionary' },
];

// The logo: letter tiles set slightly askew, with UP lifted up.
const LOGO = [
  { word: 'MADE', tilts: [-4, 3, -2, 4] },
  { word: 'UP', tilts: [-6, 5], lifted: true },
  { word: 'WORDS', tilts: [3, -3, 2, -4, 3] },
];

function Logo() {
  return (
    <h1 className="logo">
      <a href="#play" className="logo-link">
        <span className="visually-hidden">Made Up Words</span>
        <span className="logo-tiles" aria-hidden="true">
          {LOGO.map(({ word, tilts, lifted }) => (
            <span key={word} className={`logo-word ${lifted ? 'logo-word--up' : ''}`}>
              {word.split('').map((letter, i) => (
                <span key={i} className="logo-tile" style={{ '--tilt': `${tilts[i]}deg` }}>
                  {letter}
                </span>
              ))}
            </span>
          ))}
        </span>
      </a>
    </h1>
  );
}

// #play (the default), #vote, or #dictionary. Older links used #today, #free, and #coined.
const viewFromHash = () => {
  const id = window.location.hash.slice(1);
  if (TABS.some((t) => t.id === id)) return id;
  if (id === 'coined') return 'vote';
  return 'play';
};

// Used when the database can't be reached: today's prompt from the built-in list.
// offline means entries and voting aren't available.
function offlineToday() {
  const day = gameDay();
  return { day, prompt: fallbackPrompt(day), entry_count: 0, my_word: null, offline: true };
}

// Today's prompt and the player's status, shared by every screen.
function useToday() {
  const [state, setState] = useState(() => ({
    status: 'ready',
    data: offlineToday(),
    reason: dailyReady ? 'loading' : 'setup',
  }));

  const refresh = useCallback(async () => {
    if (!dailyReady) return;
    try {
      const data = await fetchToday();
      if (!data) throw new Error('No row from get_today');
      setState({ status: 'ready', data: { ...data, offline: false }, reason: null });
    } catch (error) {
      console.error('Loading today failed, using the built-in prompt', error);
      setState((s) => (s.data && !s.data.offline ? s : { status: 'ready', data: offlineToday(), reason: 'error' }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}

// The player's saved words, kept in this browser.
function useDictionary() {
  const [entries, setEntries] = useState(() => readJSON('muw-dictionary', []));
  useEffect(() => writeJSON('muw-dictionary', entries), [entries]);

  return {
    entries,
    get: (word) => entries.find((e) => e.word === word) || null,
    add: (entry) =>
      setEntries((list) =>
        list.some((e) => e.word === entry.word)
          ? list.map((e) => (e.word === entry.word ? { ...e, ...entry } : e))
          : [{ ...entry, savedAt: Date.now() }, ...list]
      ),
    remove: (word) => setEntries((list) => list.filter((e) => e.word !== word)),
  };
}

export default function MadeUpWords() {
  const [view, setView] = useState(viewFromHash);
  const [visited, setVisited] = useState(() => new Set([viewFromHash()]));
  const dictionary = useDictionary();
  const today = useToday();
  // Show "How to play" automatically on a first visit.
  const [howToOpen, setHowToOpen] = useState(() => !readJSON('muw-seen-how-to', false));

  const closeHowTo = () => {
    setHowToOpen(false);
    writeJSON('muw-seen-how-to', true);
  };

  useEffect(() => {
    const onHash = () => {
      const next = viewFromHash();
      setView(next);
      setVisited((v) => new Set(v).add(next));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <main className="game">
      <header className="masthead">
        <Logo />
      </header>

      <div className="nav-row">
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            className={`tab ${view === t.id ? 'is-active' : ''}`}
            aria-current={view === t.id ? 'page' : undefined}
          >
            {t.label}
            {t.id === 'dictionary' && dictionary.entries.length > 0 && (
              <span className="tab-count">{dictionary.entries.length}</span>
            )}
          </a>
        ))}
      </nav>
        <button className="help-btn" onClick={() => setHowToOpen(true)} aria-label="How to play">
          ?
        </button>
      </div>

      {/* Play stays mounted once opened, so the wheels keep their place between tabs. */}
      {visited.has('play') && (
        <div hidden={view !== 'play'} className="view">
          <Play dictionary={dictionary} today={today} />
        </div>
      )}

      {view === 'vote' && (
        <div className="view">
          <Vote today={today} />
        </div>
      )}

      {view === 'dictionary' && (
        <div className="view">
          <MyDictionary dictionary={dictionary} />
        </div>
      )}
      <HowTo open={howToOpen} onClose={closeHowTo} />
    </main>
  );
}
