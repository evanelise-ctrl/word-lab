import { useEffect, useRef } from 'react';
import { RESET_TIME } from './config.js';

// The "How to play" pop-up. Opens by itself on a first visit, and any time
// from the ? button next to the tabs.
export default function HowTo({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="howto"
      aria-labelledby="howto-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
    >
      <div className="howto-inner">
        <button className="howto-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="howto-title">How to play</h2>

        <div className="howto-example" aria-hidden="true">
          <span className="howto-tile">ab-</span>
          <span className="howto-plus">+</span>
          <span className="howto-tile">norm</span>
          <span className="howto-plus">+</span>
          <span className="howto-tile">-al</span>
          <span className="howto-plus">=</span>
          <span className="howto-result">abnormal</span>
        </div>

        <ol className="howto-steps">
          <li>
            <strong>Build a word.</strong> Scroll the three wheels to pick a prefix, a root, and a
            suffix. The game handles the spelling.
          </li>
          <li>
            <strong>Press Combine.</strong> If it’s already in the dictionary, you found a word. If
            not, you made one up, and it gets a definition built from its parts.
          </li>
          <li>
            <strong>Answer today’s prompt.</strong> Every day there’s a new prompt at the top. Make
            up a word that fits it and submit it from the result. One entry per day.
          </li>
          <li>
            <strong>Vote.</strong> On the Vote tab, vote for your favorite words. The top word wins
            the day, and a new prompt starts at {RESET_TIME}.
          </li>
          <li>
            <strong>Keep the good ones.</strong> Save made-up words you love to My dictionary.
          </li>
        </ol>

        <p className="howto-aside">Just want to play around? Hide the prompt and spin away.</p>

        <button className="howto-start" onClick={onClose} autoFocus>
          Start playing
        </button>
      </div>
    </dialog>
  );
}
