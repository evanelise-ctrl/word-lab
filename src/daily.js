// Talks to the Supabase database behind the daily game.
// Keys come from .env.local (see SETUP.md). Without them, the daily game
// shows setup instructions and free play still works.
import { createClient } from '@supabase/supabase-js';
import { getVoterId } from './storage.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const dailyReady = Boolean(url && key);
const supabase = dailyReady ? createClient(url, key) : null;

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// { day, prompt, entry_count, my_word, yesterday_prompt, yesterday_word, yesterday_votes }
export async function fetchToday() {
  const rows = check(await supabase.rpc('get_today', { p_voter: getVoterId() }));
  return rows?.[0] ?? null;
}

// [{ id, word, prefix, root, suffix, votes, created_at, mine, voted }], ranked
export async function fetchEntries(day) {
  return check(await supabase.rpc('get_entries', { p_day: day, p_voter: getVoterId() })) || [];
}

export async function submitEntry({ word, prefix, root, suffix }) {
  return check(
    await supabase.rpc('submit_entry', {
      p_word: word,
      p_prefix: prefix || '',
      p_root: root,
      p_suffix: suffix || '',
      p_voter: getVoterId(),
    })
  );
}

export async function toggleEntryVote(entryId) {
  return check(await supabase.rpc('toggle_entry_vote', { p_entry_id: entryId, p_voter: getVoterId() }));
}

// Turns a database error into the rule it broke, if it's one the app knows.
export function ruleBroken(error) {
  const msg = String(error?.message || '');
  return ['already_entered', 'word_taken', 'own_entry', 'voting_closed'].find((r) => msg.includes(r)) || null;
}
