import { useCallback, useEffect, useState } from 'react';
import { fetchEntries, toggleEntryVote, ruleBroken } from './daily.js';
import { partFromText } from './parts.js';
import { inventDefinition } from './spelling.js';

const literally = (e) =>
  inventDefinition(partFromText('prefix', e.prefix), partFromText('root', e.root), partFromText('suffix', e.suffix));

// Today's entries, ranked by votes, with voting.
export default function DailyBoard({ day, refreshKey }) {
  const [status, setStatus] = useState('loading');
  const [entries, setEntries] = useState([]);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setEntries(await fetchEntries(day));
      setStatus('ready');
    } catch (error) {
      console.error('Loading entries failed', error);
      setStatus('error');
    }
  }, [day]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleVote = async (entry) => {
    const bump = entry.voted ? -1 : 1;
    setNotice('');
    setEntries((list) =>
      list.map((e) => (e.id === entry.id ? { ...e, voted: !e.voted, votes: e.votes + bump } : e))
    );
    try {
      const count = await toggleEntryVote(entry.id);
      setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, votes: count } : e)));
    } catch (error) {
      console.error('Voting failed', error);
      setEntries((list) =>
        list.map((e) => (e.id === entry.id ? { ...e, voted: entry.voted, votes: entry.votes } : e))
      );
      setNotice(
        ruleBroken(error) === 'voting_closed'
          ? 'Voting for that day has closed.'
          : 'That vote didn’t go through. Try again.'
      );
    }
  };

  return (
    <section className="daily-board" aria-labelledby="entries-heading">
      <div className="daily-board-head">
        <h2 id="entries-heading">Today’s entries</h2>
        <button className="text-btn" onClick={load}>Refresh</button>
      </div>

      {status === 'loading' && <p className="board-empty">Loading entries…</p>}
      {status === 'error' && (
        <p className="board-empty">
          Entries didn’t load. <button className="text-btn" onClick={load}>Try again</button>
        </p>
      )}
      {status === 'ready' && entries.length === 0 && (
        <p className="board-empty">No entries yet. Make up a word and be the first.</p>
      )}
      {notice && <p className="board-empty">{notice}</p>}

      {status === 'ready' && entries.length > 0 && (
        <ol className="board">
          {entries.map((e, i) => (
            <li key={e.id} className={`board-row ${e.mine ? 'is-mine' : ''}`}>
              <div className="board-cell board-rank">
                <span className="board-label">ranking</span>
                <span className="rank-tile">{i + 1}</span>
              </div>
              <div className="board-cell board-votes">
                <span className="board-label">votes</span>
                <span className="vote-count">{e.votes.toLocaleString()}</span>
                {e.mine ? (
                  <span className="mine-tag">Yours</span>
                ) : (
                  <button
                    className={`vote-btn ${e.voted ? 'is-voted' : ''}`}
                    aria-pressed={e.voted}
                    onClick={() => handleVote(e)}
                  >
                    {e.voted ? 'Voted' : 'Vote'}
                    <span className="visually-hidden"> for {e.word}</span>
                  </button>
                )}
              </div>
              <div className="board-cell board-word">
                <span className="board-label">word</span>
                <span className="board-term">{e.word}</span>
                <span className="board-parts">
                  {[e.prefix && `${e.prefix}-`, e.root, e.suffix && `-${e.suffix}`].filter(Boolean).join(' + ')}
                </span>
              </div>
              <div className="board-cell board-def">
                <span className="board-label">literally</span>
                <p>{literally(e)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
