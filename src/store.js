// Progress storage (on this device) + spaced repetition (FSRS).
import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs';

export { Rating, State };

const KEY = 'hebrew-cards.v1';
const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9 }));

const DEFAULT_SETTINGS = {
  newPerDay: 30,
  duolingoUnit: 31, // words unlock up to this Duolingo unit
  answerMode: 'mix', // mix | choice | typing | self
  autoplay: true,
  speechRate: 1,
  speaking: true,
  showTranslit: false,
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
      s.cards ||= {};
      s.days ||= {};
      return s;
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { cards: {}, days: {}, settings: { ...DEFAULT_SETTINGS } };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore; the backup export still works */
  }
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const revive = (c) => ({
  ...c,
  due: new Date(c.due),
  last_review: c.last_review ? new Date(c.last_review) : undefined,
});

/** Saved FSRS card, or null if never studied. */
export function getCard(id) {
  const c = state.cards[id];
  return c ? revive(c) : null;
}

export const isStarted = (id) => !!state.cards[id];

export function preview(id) {
  const card = getCard(id) || createEmptyCard(new Date());
  const rec = scheduler.repeat(card, new Date());
  return {
    [Rating.Again]: rec[Rating.Again].card.due,
    [Rating.Hard]: rec[Rating.Hard].card.due,
    [Rating.Good]: rec[Rating.Good].card.due,
    [Rating.Easy]: rec[Rating.Easy].card.due,
  };
}

export function review(id, rating) {
  const isNew = !state.cards[id];
  const card = getCard(id) || createEmptyCard(new Date());
  const { card: next } = scheduler.next(card, new Date(), rating);
  next.lapsesTotal = (state.cards[id]?.lapsesTotal || 0) + (rating === Rating.Again ? 1 : 0);
  next.firstSeen = state.cards[id]?.firstSeen || today();
  state.cards[id] = next;
  const d = (state.days[today()] ||= { reviews: 0, new: 0, correct: 0 });
  d.reviews++;
  if (isNew) d.new++;
  if (rating !== Rating.Again) d.correct++;
  save();
  return revive(JSON.parse(JSON.stringify(next)));
}

export const dayStats = (day = today()) => state.days[day] || { reviews: 0, new: 0, correct: 0 };

/** "+10 new words": raises today's new-card allowance. */
export function addExtraNew(n) {
  const d = (state.days[today()] ||= { reviews: 0, new: 0, correct: 0 });
  d.extraNew = (d.extraNew || 0) + n;
  save();
}
export const allDays = () => state.days;
export const allCards = () => state.cards;

// Words the learner marked as "audio sounds wrong".
export const audioFlags = () => (state.flags ||= []);
export function toggleAudioFlag(id) {
  const f = audioFlags();
  const i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1);
  else f.push(id);
  save();
  return i < 0;
}

export const settings = () => state.settings;
export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  save();
}

export function exportBackup() {
  return JSON.stringify({ app: 'hebrew-cards', version: 1, exported: new Date().toISOString(), state });
}

export function importBackup(text) {
  const data = JSON.parse(text);
  if (data.app !== 'hebrew-cards' || !data.state?.cards) throw new Error('Not a Hebrew Cards backup file');
  state = { ...data.state, settings: { ...DEFAULT_SETTINGS, ...data.state.settings } };
  save();
}

export function resetProgress() {
  state = { cards: {}, days: {}, settings: state.settings, flags: state.flags };
  save();
}
