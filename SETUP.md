# Made Up Words: setup

## 1. Add the new files

Copy everything from this zip into your `word-lab` folder, replacing files when asked:

- `src/` files go into `word-lab/src/`
- `index.html`, `SETUP.md`, `.env.example`, and the `supabase/` folder go into `word-lab/`

Leave your existing `main.jsx` and `assets` folder alone.

## 2. Install the database library

In the terminal, inside `word-lab`:

    npm install @supabase/supabase-js

Then run `npm run dev` as usual. Play and My dictionary work right away.
The board tab shows a "not connected yet" message until you finish step 3.

## 3. Turn on the public board (Supabase, free tier)

1. Create a free account and a new project at supabase.com. Any name and region is fine.
2. In the project, open **SQL Editor**, click **New query**, paste all of
   `supabase/daily.sql`, and click **Run** (then **Run query** on the warning).
   You should see "Success. No rows returned." (`supabase/setup.sql` was for the
   old Freshly Coined board and isn't needed anymore.)
3. Open **Project Settings > API**. Copy the **Project URL** and the **anon** (or
   **publishable**) key.
4. In `word-lab`, make a copy of `.env.example` named `.env.local` and paste those two
   values in. `.env.local` is ignored by git, so the keys stay off GitHub.
5. Stop the dev server (Ctrl+C) and run `npm run dev` again. Vite only reads
   `.env.local` when it starts.

The anon key is meant to be public. The database only lets visitors read words and
call the voting functions; they can't edit or delete anything directly.

## 4. When you deploy to Vercel

In your Vercel project, open **Settings > Environment Variables** and add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values, then redeploy.

## Daily prompts

Prompts live in **Table Editor > prompts**. The game rotates through them in order,
one per day, switching at midnight US Eastern.

- To add a prompt, insert a row and leave `scheduled_for` empty.
- To run a specific prompt on a specific date (a holiday, say), put that date in
  `scheduled_for`. It takes that day's slot, and the rotation carries on around it.
- Edits show up the next time someone loads the page.

## Removing an entry

In **Table Editor > daily_entries**, find the entry and set `hidden` to `true`.
It disappears from the board immediately.

## Renaming things

`src/config.js` holds the daily game's name ("Today's word") and the reset time
shown to players.
