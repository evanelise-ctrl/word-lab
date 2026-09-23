import { useEffect, useRef, useState } from 'react';
import { buildWord } from './spelling.js';
import { partFromText, linkFor } from './parts.js';

const dictionaryUrl = (word) => 'https://www.dictionary.com/browse/' + encodeURIComponent(word);

const formatDay = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

// The result pop-up again, for a word saved in My dictionary. No celebration,
// and no "add" button since it's already saved.
export default function WordCard({ entry, onClose, onRemove }) {
  const ref = useRef(null);
  const [panel, setPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (entry && !dialog.open) dialog.showModal();
    if (!entry && dialog.open) dialog.close();
    setPanel(false);
    setCopied(false);
  }, [entry]);

  const close = () => ref.current?.close();

  // Rebuild the spelling notes from the saved parts.
  const notes = entry?.parts?.root
    ? buildWord(
        partFromText('prefix', entry.parts.prefix),
        partFromText('root', entry.parts.root),
        partFromText('suffix', entry.parts.suffix)
      ).notes
    : [];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linkFor(entry.parts, 'play'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const type = entry?.type === 'found' ? 'found' : 'made';

  return (
    <dialog
      ref={ref}
      className={`result result--${type}`}
      aria-labelledby="saved-word"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) close(); // click on the backdrop
      }}
    >
      {entry && (
        <div className="result-card">
          <div className="result-inner">
            <button className="result-close" onClick={close} aria-label="Close">
              ×
            </button>
            <span className="result-badge">
              {type === 'found' ? 'You found a word!' : 'You made up a word!'}
            </span>
            <h2 id="saved-word" className="result-word">{entry.word}</h2>
            {entry.pos && <p className="result-pos">{entry.pos}</p>}
            <p className="result-definition">{entry.definition}</p>

            <div className="result-actions">
              {type === 'found' && (
                <a className="is-solid" href={dictionaryUrl(entry.word)} target="_blank" rel="noreferrer">
                  See it on Dictionary.com
                </a>
              )}
              {entry.parts?.root && (
                <a className={type === 'made' ? 'is-solid' : ''} href={linkFor(entry.parts, 'play')}>
                  Put it on the wheels
                </a>
              )}
              {entry.parts?.root && (
                <button onClick={handleCopy}>{copied ? 'Link copied' : 'Copy link'}</button>
              )}
              <button
                onClick={() => {
                  onRemove(entry.word);
                  close();
                }}
              >
                Remove
              </button>
            </div>
          </div>

          {(entry.entered || notes.length > 0) && (
            <div className="result-footer">
              {entry.entered && (
                <div className="result-daily">
                  <p className="result-daily-prompt">
                    <span className="result-daily-label">Daily entry</span>
                    Entered for the {formatDay(entry.entered)} prompt
                  </p>
                </div>
              )}
              {notes.length > 0 && (
                <>
                  <div className="result-more">
                    <button className="more-toggle" aria-expanded={panel} onClick={() => setPanel((v) => !v)}>
                      How it’s spelled
                    </button>
                  </div>
                  {panel && (
                    <ul className="more-panel">
                      {notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
