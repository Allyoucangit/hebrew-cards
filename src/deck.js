// Turns word entries into practice cards and builds the daily queue.
import { getCard, isStarted, settings, dayStats, today, allCards } from './store.js';

export let units = [];
export let items = [];
export const itemById = new Map();
export let cards = [];
export const cardById = new Map();

// Card kinds per entry type. Order = the order they are introduced.
//  rec    Hebrew -> meaning (self-check)
//  listen audio -> meaning (multiple choice)
//  prod   meaning -> Hebrew (choice / typing / speaking)
//  pl     singular -> plural (nouns)
//  f1..f3 adjective agreement with a noun (fem. sg., masc. pl., fem. pl.)
//  v0..v3 verb present tense forms
//  q0..q9 preposition + pronoun
function kindsFor(it) {
  switch (it.type) {
    case 'n':
      return ['rec', 'listen', 'prod', ...(it.pl ? ['pl'] : [])];
    case 'a':
      return ['rec', 'listen', 'prod', 'f1', 'f2', 'f3'];
    case 'v':
      return ['rec', 'listen', 'prod', 'v0', 'v1', 'v2', 'v3'];
    case 'p':
      return ['rec', ...Array.from({ length: 10 }, (_, i) => `q${i}`)];
    default:
      return ['rec', 'listen', 'prod'];
  }
}

export const CATEGORY = {
  all: { label: 'Everything', match: () => true },
  verbs: { label: 'Verbs', match: (c) => c.item.type === 'v' },
  forms: { label: 'Verb forms only', match: (c) => /^v\d/.test(c.kind) },
  nounsAdj: { label: 'Nouns & adjectives', match: (c) => c.item.type === 'n' || c.item.type === 'a' },
  agreement: { label: 'Plurals & agreement', match: (c) => c.kind === 'pl' || /^f\d/.test(c.kind) },
  small: { label: 'Small words & phrases', match: (c) => c.item.type === 'x' || c.item.type === 'p' },
  listening: { label: 'Listening', match: (c) => c.kind === 'listen' },
};

export async function loadDeck() {
  const res = await fetch('data/words.json');
  const data = await res.json();
  units = data.units;
  items = data.items;
  items.forEach((it, idx) => {
    it.index = idx;
    itemById.set(it.id, it);
  });
  cards = [];
  for (const it of items) {
    kindsFor(it).forEach((kind, k) => {
      const c = { id: `${it.id}|${kind}`, item: it, kind, rank: k };
      cards.push(c);
      cardById.set(c.id, c);
    });
  }
}

export const cardsOf = (item) => cards.filter((c) => c.item === item);

/** A follow-up card (listen, prod, forms) only starts once the word's main card was seen on an earlier day. */
function unlocked(c) {
  if (c.kind === 'rec') return true;
  const rec = allCards()[`${c.item.id}|rec`];
  return !!rec && rec.firstSeen !== today();
}

export function dueCards(now = new Date(), filter = CATEGORY.all.match) {
  return cards
    .filter((c) => filter(c) && isStarted(c.id))
    .map((c) => ({ c, due: getCard(c.id).due }))
    .filter((x) => x.due <= now)
    .sort((a, b) => a.due - b.due)
    .map((x) => x.c);
}

export function newCardsAvailable(filter = CATEGORY.all.match) {
  return cards
    .filter((c) => filter(c) && !isStarted(c.id) && unlocked(c))
    .sort((a, b) => a.item.unit - b.item.unit || a.rank - b.rank || a.item.index - b.item.index);
}

export const newLeftToday = () => Math.max(0, settings().newPerDay - dayStats().new);

/** Status of a word, based on all of its cards. */
export function itemStatus(item) {
  const cs = cardsOf(item);
  const started = cs.map((c) => getCard(c.id)).filter(Boolean);
  if (!started.length) return 'new';
  const strong = started.filter((c) => c.stability >= 21).length;
  if (started.length === cs.length && strong === cs.length) return 'known';
  if (strong / cs.length >= 0.5) return 'good';
  return 'learning';
}

export function weakItems(limit = 15) {
  const score = new Map();
  for (const c of cards) {
    const s = allCards()[c.id];
    if (s?.lapsesTotal) score.set(c.item, (score.get(c.item) || 0) + s.lapsesTotal);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}
