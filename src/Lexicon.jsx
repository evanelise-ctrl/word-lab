import { useCallback, useEffect, useState } from 'react';
import { boardReady, fetchMyVotes, fetchTopWords, toggleVote } from './lexicon.js';
import { BOARD_NAME } from './config.js';

export default function Lexicon() {
  const [status, setStatus] = useState(boardReady ? 'loading' : 'setup');
  const [words, setWords] = useState([]);
  const [myVotes, setMyVotes] = useState(new Set());

  const load = useCallback(async () => {
    if (!boardReady) return;
    setStatus('loading');
    try {
      const [list, votes] = await Promise.all([fetchTopWords(), fetchMyVotes()]);
      setWords(list);
      setMyVotes(votes);
      setStatus('ready');
    } catch (error) {
      console.error('Loading the board failed', error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async (id) => {
    const had = myVotes.has(id);
    const flip = (set) => {
      const next = new Set(set);
      had ? next.delete(id) : next.add(id);
      return next;
    };
    // Update right away, then correct with the server's count.
    setMyVotes(flip);
    setWords((list) => list.map((w) => (w.id === id ? { ...w, votes: w.votes + (had ? -1 : 1) } : w)));
    try {
      const count = await toggleVote(id);
      setWords((list) => list.map((w) => (w.id === id ? { ...w, votes: count } : w)));
    } catch (error) {
      console.error('Voting failed', error);
      setMyVotes((set) => flip(flip(set)));
      setWords((list) => list.map((w) => (w.id === id ? { ...w, votes: w.votes + (had ? 1 : -1) } : w)));
    }
  };

  if (status === 'setup') {
    return (
      <section className="panel empty">
        <h2>{BOARD_NAME} isn’t connected yet</h2>
        <p>
          The board needs a free Supabase database. Follow the steps in SETUP.md, restart
          <code> npm run dev</code>, and this page will fill in.
        </p>
      </section>
    );
  }

  if (status === 'loading') {
    return <section className="panel empty"><p>Loading words…</p></section>;
  }

  if (status === 'error') {
    return (
      <section className="panel empty">
        <h2>The board didn’t load</h2>
        <p>Check your connection, then try again.</p>
        <button className="pill-link" onClick={load}>Try again</button>
      </section>
    );
  }

  if (words.length === 0) {
    return (
      <section className="panel empty">
        <h2>No words yet</h2>
        <p>Make up a word, then press “Add to {BOARD_NAME}” to put it here first.</p>
        <a className="pill-link" href="#play">Make a word</a>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="board-intro">The most-loved made-up words. Vote for your favorites.</p>
      <ol className="board">
        {words.map((w, i) => {
          const voted = myVotes.has(w.id);
          return (
            <li key={w.id} className="board-row">
              <div className="board-cell board-rank">
                <span className="board-label">ranking</span>
                <span className="rank-tile">{i + 1}</span>
              </div>
              <div className="board-cell board-votes">
                <span className="board-label">votes</span>
                <span className="vote-count">{w.votes.toLocaleString()}</span>
                <button
                  className={`vote-btn ${voted ? 'is-voted' : ''}`}
                  aria-pressed={voted}
                  onClick={() => handleVote(w.id)}
                >
                  {voted ? 'Voted' : 'Vote'}
                  <span className="visually-hidden"> for {w.word}</span>
                </button>
              </div>
              <div className="board-cell board-word">
                <span className="board-label">word</span>
                <span className="board-term">{w.word}</span>
                {w.part_of_speech && <span className="board-pos">{w.part_of_speech}</span>}
              </div>
              <div className="board-cell board-def">
                <span className="board-label">definition</span>
                <p>{w.definition}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
