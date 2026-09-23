import DailyBoard from './DailyBoard.jsx';
import { RESET_TIME } from './config.js';

// Today's prompt and every entry for it, with voting.
export default function Vote({ today }) {
  const data = today.data;

  if (data.offline) {
    return (
      <section className="panel empty">
        <h2>Voting isn’t connected yet</h2>
        <p>
          {today.reason === 'setup'
            ? 'The daily game needs its database. Follow SETUP.md to turn it on.'
            : 'The daily game’s database didn’t respond. If you just set it up, make sure supabase/daily.sql has been run, then refresh.'}
        </p>
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
