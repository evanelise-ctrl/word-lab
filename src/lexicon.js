// Talks to the Supabase database behind the public word board.
// Keys come from .env.local (see SETUP.md). Without them, the board
// shows setup instructions and the rest of the game still works.
import { createClient } from '@supabase/supabase-js';
import { getVoterId } from './storage.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const boardReady = Boolean(url && key);
const supabase = boardReady ? createClient(url, key) : null;

function check({ data, error }) {
  if (error) throw error;
  return data;
}

export async function fetchTopWords(limit = 50) {
  return check(
    await supabase
      .from('words')
      .select('id, word, definition, part_of_speech, votes, created_at')
      .order('votes', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

export async function fetchMyVotes() {
  const rows = check(await supabase.rpc('my_votes', { p_voter: getVoterId() }));
  return new Set((rows || []).map((r) => r.word_id));
}

export async function submitWord({ word, prefix, root, suffix, definition, partOfSpeech }) {
  return check(
    await supabase.rpc('submit_word', {
      p_word: word,
      p_prefix: prefix || '',
      p_root: root,
      p_suffix: suffix || '',
      p_definition: definition,
      p_part_of_speech: partOfSpeech || '',
      p_voter: getVoterId(),
    })
  );
}

export async function toggleVote(wordId) {
  return check(await supabase.rpc('toggle_vote', { p_word_id: wordId, p_voter: getVoterId() }));
}
