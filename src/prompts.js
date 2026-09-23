// Built-in daily prompts. The database (supabase/daily.sql) starts with this
// same list in the same order, so the prompt matches even when the database
// can't be reached. If you add prompts in Supabase, they only show up there.

export const PROMPTS = [
  'The moment you walk into a room and forget why you came in',
  "Pretending to text so you don't have to talk to someone",
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
  "Laughing at a joke you didn't hear",
  'Your foot falling asleep at the worst possible moment',
  'Leaving a party without saying goodbye',
  'A song stuck in your head that you only know one line of',
  'A jar lid that will not open',
  "Getting a notification and it's just a low battery warning",
  'Flipping your pillow to the cool side',
  "Forgetting someone's name right after they tell you",
  'A houseplant you keep alive out of pure stubbornness',
  'Expecting one more stair than there is',
  'A cat knocking something off a table while making eye contact',
  "Trying to guess the Wi-Fi password at a friend's house",
  'The sound of someone chewing ice',
  'The first sip of coffee in the morning',
  'Hitting snooze and dreaming an entire movie',
  'Staring into the pantry hoping for new food',
  'Tripping on nothing and then looking back at the floor',
  'A group chat that goes silent right after you send a message',
  'Remembering something embarrassing from ten years ago at bedtime',
  'Carrying every grocery bag in one trip',
  "A word you've said so many times it stops sounding real",
  "Microwave food that's lava outside and frozen inside",
  "Realizing you've been on mute the whole time",
  'Worrying that you left the stove on',
  'Rain that starts right after you wash your car',
  'The drawer full of mystery cables',
  "Hiccups that won't quit",
  'A houseguest who stays one day too long',
  "Pretending you've seen the movie everyone is talking about",
  'Finding the TV remote in the fridge',
  'Reading the same paragraph three times without absorbing it',
  'A pigeon that is not afraid of you at all',
  'Running for a bus that pulls away anyway',
  "The spot on your back you can't reach",
  'Smelling rain before it arrives',
  'Holding the door for someone who is still very far away',
  'A haircut that looked better in your head',
  'The last day of vacation',
  'Looking for your phone while holding it',
  'Autocorrect changing a word into something worse',
  'Waking from a nap not knowing what year it is',
  'The quiet right after the power goes out',
];

// Today's date in US Eastern, as YYYY-MM-DD. The daily game flips at midnight Eastern.
export function gameDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Same rotation as prompt_for() in daily.sql: day 0 is January 1, 2026.
export function fallbackPrompt(day) {
  const days = Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000);
  const n = PROMPTS.length;
  return PROMPTS[((days % n) + n) % n];
}
