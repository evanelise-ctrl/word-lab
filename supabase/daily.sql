-- Made Up Words: the daily game.
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Supabase will warn about destructive operations because the voting function
-- can remove a vote when a player takes it back. Running the file doesn't delete anything.
-- It is safe to run more than once.

-- Prompts. A row with a date in scheduled_for runs on that date. Every other day
-- rotates through the unscheduled prompts in order. Add or edit rows in the Table Editor.
create table if not exists public.prompts (
  id bigint generated always as identity primary key,
  prompt text not null check (char_length(prompt) between 5 and 200),
  scheduled_for date unique,
  created_at timestamptz not null default now()
);

-- One entry per player per day. creator is the random id stored in each player's browser.
create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  word text not null check (word ~ '^[a-z]{2,40}$'),
  prefix text check (char_length(prefix) <= 20),
  root text not null check (char_length(root) <= 20),
  suffix text check (char_length(suffix) <= 20),
  creator uuid not null,
  votes integer not null default 0,
  hidden boolean not null default false, -- set to true in the Table Editor to remove an entry
  created_at timestamptz not null default now(),
  unique (day, creator),
  unique (day, word)
);

create table if not exists public.entry_votes (
  entry_id uuid not null references public.daily_entries (id) on delete cascade,
  voter_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (entry_id, voter_id)
);

create index if not exists daily_entries_day_idx on public.daily_entries (day, votes desc, created_at);

-- No direct table access for visitors. Everything goes through the functions below,
-- which keeps player ids private and enforces the rules.
alter table public.prompts enable row level security;
alter table public.daily_entries enable row level security;
alter table public.entry_votes enable row level security;

-- The game day flips at midnight US Eastern for everyone.
create or replace function public.game_day()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/New_York')::date;
$$;

create or replace function public.prompt_for(p_day date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.prompt from prompts p where p.scheduled_for = p_day),
    (select p.prompt
       from prompts p
      where p.scheduled_for is null
      order by p.id
      offset (select (((p_day - date '2026-01-01') % count(*)) + count(*)) % count(*)
                from prompts where scheduled_for is null)
      limit 1)
  );
$$;

-- Today's prompt, the entry count, the player's own entry, and yesterday's winner.
create or replace function public.get_today(p_voter uuid)
returns table (
  day date,
  prompt text,
  entry_count integer,
  my_word text,
  yesterday_prompt text,
  yesterday_word text,
  yesterday_votes integer
)
language sql
stable
security definer
set search_path = public
as $$
  with d as (select game_day() as today)
  select
    d.today,
    prompt_for(d.today),
    (select count(*)::int from daily_entries e where e.day = d.today and not e.hidden),
    (select e.word from daily_entries e where e.day = d.today and e.creator = p_voter),
    prompt_for(d.today - 1),
    w.word,
    w.votes
  from d
  left join lateral (
    select e.word, e.votes
      from daily_entries e
     where e.day = d.today - 1 and not e.hidden
     order by e.votes desc, e.created_at asc
     limit 1
  ) w on true;
$$;

-- All entries for a day, ranked, with whether each is the player's own
-- and whether the player voted for it.
create or replace function public.get_entries(p_day date, p_voter uuid)
returns table (
  id uuid,
  word text,
  prefix text,
  root text,
  suffix text,
  votes integer,
  created_at timestamptz,
  mine boolean,
  voted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.word, e.prefix, e.root, e.suffix, e.votes, e.created_at,
         e.creator = p_voter,
         exists (select 1 from entry_votes v where v.entry_id = e.id and v.voter_id = p_voter)
    from daily_entries e
   where e.day = p_day and p_day <= game_day() and not e.hidden
   order by e.votes desc, e.created_at asc
   limit 300;
$$;

-- Submit today's entry. Errors the app understands:
--   already_entered: this player already has an entry today
--   word_taken:      someone already entered this exact word today
create or replace function public.submit_entry(
  p_word text,
  p_prefix text,
  p_root text,
  p_suffix text,
  p_voter uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := game_day();
  new_id uuid;
begin
  if exists (select 1 from daily_entries e where e.day = today and e.creator = p_voter) then
    raise exception 'already_entered';
  end if;
  if exists (select 1 from daily_entries e where e.day = today and e.word = lower(p_word)) then
    raise exception 'word_taken';
  end if;

  insert into daily_entries (day, word, prefix, root, suffix, creator)
  values (today, lower(p_word), nullif(p_prefix, ''), p_root, nullif(p_suffix, ''), p_voter)
  returning id into new_id;

  return new_id;
end;
$$;

-- Vote for an entry, or take the vote back. Returns the new count. Errors:
--   own_entry:     players can't vote for their own entry
--   voting_closed: voting is only open on the entry's own day
create or replace function public.toggle_entry_vote(p_entry_id uuid, p_voter uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  entry daily_entries;
  n integer;
begin
  select * into entry from daily_entries e where e.id = p_entry_id and not e.hidden;
  if not found then
    raise exception 'not_found';
  end if;
  if entry.creator = p_voter then
    raise exception 'own_entry';
  end if;
  if entry.day <> game_day() then
    raise exception 'voting_closed';
  end if;

  if exists (select 1 from entry_votes v where v.entry_id = p_entry_id and v.voter_id = p_voter) then
    delete from entry_votes v where v.entry_id = p_entry_id and v.voter_id = p_voter;
  else
    insert into entry_votes (entry_id, voter_id) values (p_entry_id, p_voter);
  end if;

  update daily_entries e
     set votes = (select count(*) from entry_votes v where v.entry_id = p_entry_id)
   where e.id = p_entry_id
  returning e.votes into n;

  return n;
end;
$$;

grant execute on function public.get_today(uuid) to anon, authenticated;
grant execute on function public.get_entries(date, uuid) to anon, authenticated;
grant execute on function public.submit_entry(text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.toggle_entry_vote(uuid, uuid) to anon, authenticated;

-- Starter prompts, added only if the prompts table is empty.
insert into public.prompts (prompt)
select t.prompt
  from unnest(array[
    'The moment you walk into a room and forget why you came in',
    'Pretending to text so you don''t have to talk to someone',
    'The sound your fridge makes at 3 a.m.',
    'Waving back at someone who was waving at the person behind you',
    'The last bits of cereal too small to scoop',
    'Hearing your own voice on a recording',
    'Saying "you too" when the server says "enjoy your meal"',
    'Checking the fridge again even though nothing new appeared',
    'A sock that has lost its partner',
    'The urge to press a big red button',
    'Stepping on a wet spot while wearing socks',
    'Rereading a text you already sent to see how it sounds',
    'Two people in a hallway who keep stepping the same way',
    'Finding money in an old coat pocket',
    'Pushing a door that clearly says pull',
    'A very large dog who believes it is a lap dog',
    'The feeling of Sunday evening',
    'The one pen in the house that actually works',
    'Laughing at a joke you didn''t hear',
    'Your foot falling asleep at the worst possible moment',
    'Leaving a party without saying goodbye',
    'A song stuck in your head that you only know one line of',
    'A jar lid that will not open',
    'Getting a notification and it''s just a low battery warning',
    'Flipping your pillow to the cool side',
    'Forgetting someone''s name right after they tell you',
    'A houseplant you keep alive out of pure stubbornness',
    'Expecting one more stair than there is',
    'A cat knocking something off a table while making eye contact',
    'Trying to guess the Wi-Fi password at a friend''s house',
    'The sound of someone chewing ice',
    'The first sip of coffee in the morning',
    'Hitting snooze and dreaming an entire movie',
    'Staring into the pantry hoping for new food',
    'Tripping on nothing and then looking back at the floor',
    'A group chat that goes silent right after you send a message',
    'Remembering something embarrassing from ten years ago at bedtime',
    'Carrying every grocery bag in one trip',
    'A word you''ve said so many times it stops sounding real',
    'Microwave food that''s lava outside and frozen inside',
    'Realizing you''ve been on mute the whole time',
    'Worrying that you left the stove on',
    'Rain that starts right after you wash your car',
    'The drawer full of mystery cables',
    'Hiccups that won''t quit',
    'A houseguest who stays one day too long',
    'Pretending you''ve seen the movie everyone is talking about',
    'Finding the TV remote in the fridge',
    'Reading the same paragraph three times without absorbing it',
    'A pigeon that is not afraid of you at all',
    'Running for a bus that pulls away anyway',
    'The spot on your back you can''t reach',
    'Smelling rain before it arrives',
    'Holding the door for someone who is still very far away',
    'A haircut that looked better in your head',
    'The last day of vacation',
    'Looking for your phone while holding it',
    'Autocorrect changing a word into something worse',
    'Waking from a nap not knowing what year it is',
    'The quiet right after the power goes out'
  ]) with ordinality as t(prompt, n)
 where not exists (select 1 from public.prompts)
 order by t.n;

-- Make sure the API sees the new functions right away.
notify pgrst, 'reload schema';
