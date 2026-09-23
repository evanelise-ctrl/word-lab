const formatDay = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

// The start screen: today's prompt, voting, and yesterday's winner.
export default function Home({ today }) {
  const data = today.data;
  const count = data.entry_count;

  return (
    <section className="home">
      <a className="mode-card mode-card--daily" href="#play">
        <span className="mode-kicker">Today’s prompt · {formatDay(data.day)}</span>
        <span className="mode-prompt">{data.prompt}</span>
        <span className="mode-btn">{data.my_word ? 'Keep playing' : 'Make up a word'}</span>
        {!data.offline && (
          <span className="mode-meta">
            {data.my_word ? `Your entry: ${data.my_word}` : 'Or just spin the wheels and play.'}
          </span>
        )}
      </a>

      {!data.offline && (
        <a className="mode-card mode-card--free" href="#vote">
          <span className="mode-title">Vote on today’s words</span>
          <span className="mode-desc">
            {count === 0
              ? 'No entries yet. Yours could be the first.'
              : `${count} ${count === 1 ? 'word has' : 'words have'} been entered so far.`}
          </span>
        </a>
      )}

      {data.yesterday_word && (
        <p className="home-winner">
          Yesterday’s winner: <strong>{data.yesterday_word}</strong>
          <span className="home-winner-prompt">{data.yesterday_prompt}</span>
        </p>
      )}
    </section>
  );
}
