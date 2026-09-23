import DailyBoard from './DailyBoard.jsx';
import { RESET_TIME } from './config.js';

// Today's prompt and every entry for it, with voting.
export default function Vote({ today }) {
  const data = today.data;

  if (data.offline) {
    // For whoever runs the site: the real reason is in the console.
    if (today.reason === 'setup') console.warn('Supabase keys are missing. See SETUP.md.');
    return (
      <section className="panel empty">
        <h2>Voting is taking a break</h2>
        <p>Today’s entries didn’t load. Check back in a bit, or keep playing in the meantime.</p>
        <div className="empty-actions">
          <button className="pill-link" onClick={today.refresh}>Try again</button>
          <a className="pill-link pill-link--quiet" href="#play">Keep playing</a>
        </div>
      </section>
    );
  }

  return (
    <div className="vote">
      <section className="prompt-card" aria-label="Today’s prompt">
        <p className="prompt-kicker">Today’s prompt</p>
        <p className="prompt-text">{data.prompt}</p>
        <p className="prompt-meta">
          {data.my_word ? (
            <>Your entry: <strong>{data.my_word}</strong>. </>
          ) : (
            <><a href="#play">Make up a word for it</a>. </>
          )}
          Voting closes at {RESET_TIME}.
        </p>
      </section>
      <DailyBoard day={data.day} />
    </div>
  );
}
