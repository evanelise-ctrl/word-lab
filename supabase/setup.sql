-- Made Up Words: database setup for the public word board.
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- It is safe to run more than once.

-- Words people have coined
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique check (word ~ '^[a-z]{2,30}$'),
  prefix text check (char_length(prefix) <= 20),
  root text not null check (char_length(root) <= 20),
  suffix text check (char_length(suffix) <= 20),
  definition text not null check (char_length(definition) <= 240),
  part_of_speech text check (char_length(part_of_speech) <= 20),
  votes integer not null default 0,
  hidden boolean not null default false, -- set to true in the Table Editor to remove a word from the board
  created_at timestamptz not null default now()
);

-- One row per vote. voter_id is a random id stored in each player's browser.
create table if not exists public.votes (
  word_id uuid not null references public.words (id) on delete cascade,
  voter_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (word_id, voter_id)
);

create index if not exists words_ranking_idx on public.words (votes desc, created_at desc) where not hidden;
create index if not exists votes_voter_idx on public.votes (voter_id);

-- Row level security: the public can read visible words and nothing else.
-- All writes go through the functions below.
alter table public.words enable row level security;
alter table public.votes enable row level security;

drop policy if exists "Anyone can read visible words" on public.words;
create policy "Anyone can read visible words"
  on public.words for select
  using (hidden = false);

-- Add a word (or return it if someone already coined it) and count the coiner's vote.
create or replace function public.submit_word(
  p_word text,
  p_prefix text,
  p_root text,
  p_suffix text,
  p_definition text,
  p_part_of_speech text,
  p_voter uuid
)
returns public.words
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.words;
begin
  insert into words (word, prefix, root, suffix, definition, part_of_speech)
  values (lower(p_word), nullif(p_prefix, ''), p_root, nullif(p_suffix, ''), p_definition, nullif(p_part_of_speech, ''))
  on conflict (word) do nothing;

  select * into w from words where word = lower(p_word);

  insert into votes (word_id, voter_id) values (w.id, p_voter)
  on conflict do nothing;

  update words
     set votes = (select count(*) from votes where word_id = w.id)
   where id = w.id
  returning * into w;

  return w;
end;
$$;

-- Vote for a word, or take the vote back if this voter already voted.
-- Returns the new vote count.
create or replace function public.toggle_vote(p_word_id uuid, p_voter uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if exists (select 1 from votes where word_id = p_word_id and voter_id = p_voter) then
    delete from votes where word_id = p_word_id and voter_id = p_voter;
  else
    insert into votes (word_id, voter_id) values (p_word_id, p_voter);
  end if;

  update words
     set votes = (select count(*) from votes where word_id = p_word_id)
   where id = p_word_id
  returning votes into n;

  return n;
end;
$$;

-- Which words has this voter voted for?
create or replace function public.my_votes(p_voter uuid)
returns table (word_id uuid)
language sql
security definer
set search_path = public
as $$
  select v.word_id from votes v where v.voter_id = p_voter;
$$;

-- Let visitors read the words table (row level security above still hides hidden words).
grant select on public.words to anon, authenticated;

grant execute on function public.submit_word(text, text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.toggle_vote(uuid, uuid) to anon, authenticated;
grant execute on function public.my_votes(uuid) to anon, authenticated;
