import { useState } from 'react';
import WordCard from './WordCard.jsx';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function MyDictionary({ dictionary }) {
  const [open, setOpen] = useState(null); // the entry shown in the pop-up
  const entries = [...dictionary.entries].sort((a, b) => a.word.localeCompare(b.word));
  const found = entries.filter((e) => e.type === 'found').length;
  const made = entries.length - found;

  if (entries.length === 0) {
    return (
      <section className="panel empty">
        <h2>Your dictionary is empty</h2>
        <p>When you make up a word you like, press “Add to my dictionary” to keep it here.</p>
        <a className="pill-link" href="#play">Start playing</a>
      </section>
    );
  }

  // Group entries under their first letter, like a printed dictionary.
  const groups = entries.reduce((acc, e) => {
    const letter = e.word[0].toUpperCase();
    (acc[letter] ||= []).push(e);
    return acc;
  }, {});

  return (
    <section className="panel">
      <p className="dict-summary">
        You’ve made up {plural(made, 'word', 'words')}
        {found > 0 ? ` and saved ${plural(found, 'real one', 'real ones')}` : ''}.
        Saved words live in this browser.
      </p>

      {Object.entries(groups).map(([letter, list]) => (
        <div key={letter} className="dict-group">
          <h2 className="dict-letter">{letter}</h2>
          {list.map((e) => (
            <article key={e.word} className="dict-entry">
              <div className="dict-head">
                <button className="dict-word" onClick={() => setOpen(e)}>{e.word}</button>
                {e.pos && <span className="dict-pos">{e.pos}</span>}
                <span className={`dict-tag dict-tag--${e.entered ? 'coined' : e.type}`}>
                  {e.entered ? 'daily entry' : e.type === 'found' ? 'real word' : 'made up'}
                </span>
              </div>
              <p className="dict-definition">{e.definition}</p>
              <button className="dict-remove" onClick={() => dictionary.remove(e.word)}>
                Remove <span className="visually-hidden">{e.word}</span>
              </button>
            </article>
          ))}
        </div>
      ))}

      <WordCard entry={open} onClose={() => setOpen(null)} onRemove={dictionary.remove} />
    </section>
  );
}
