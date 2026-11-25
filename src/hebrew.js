// Hebrew text helpers.
const NIKKUD = /[֑-ׇ]/g;
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export const stripNikkud = (s) => (s || '').replace(NIKKUD, '');

/** Loose form for comparing answers: no nikkud, no punctuation, final letters unified. */
export function normalize(s) {
  return stripNikkud(s)
    .replace(/[.,!?;:"״׳'’`\-–—()]/g, ' ')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stricter form: keeps final letters, so we can tell the learner about them. */
const strictForm = (s) =>
  stripNikkud(s).replace(/[.,!?;:"״׳'’`\-–—()]/g, ' ').replace(/\s+/g, ' ').trim();

/** "אחד / אחת" -> ["אחד", "אחת"] */
export const alternatives = (he) => he.split('/').map((x) => x.trim()).filter(Boolean);

/**
 * Compare a typed answer with the expected answer(s).
 * Returns { ok, finalLetterSlip }.
 */
export function check(given, expected) {
  const alts = Array.isArray(expected) ? expected : alternatives(expected);
  const g = normalize(given);
  if (!g) return { ok: false };
  for (const a of alts) {
    if (normalize(a) === g) {
      return { ok: true, finalLetterSlip: strictForm(a) !== strictForm(given) };
    }
  }
  return { ok: false };
}

export const isHebrew = (s) => /[֐-׿]/.test(s || '');

export const PERSONS = [
  { he: 'אני', en: 'I' },
  { he: 'אתה', en: 'you (m)' },
  { he: 'את', en: 'you (f)' },
  { he: 'הוא', en: 'he' },
  { he: 'היא', en: 'she' },
  { he: 'אנחנו', en: 'we' },
  { he: 'אתם', en: 'you (m pl)' },
  { he: 'אתן', en: 'you (f pl)' },
  { he: 'הם', en: 'they (m)' },
  { he: 'הן', en: 'they (f)' },
];

// Which pronouns go with each present-tense form (ms, fs, mp, fp).
export const PRESENT_PRONOUNS = [
  [{ he: 'אני', note: 'man speaking' }, { he: 'אתה' }, { he: 'הוא' }],
  [{ he: 'אני', note: 'woman speaking' }, { he: 'את' }, { he: 'היא' }],
  [{ he: 'אנחנו', note: 'men / mixed' }, { he: 'אתם' }, { he: 'הם' }],
  [{ he: 'אנחנו', note: 'women only' }, { he: 'אתן' }, { he: 'הן' }],
];

export const FORM_LABELS = ['masc. sg.', 'fem. sg.', 'masc. pl.', 'fem. pl.'];
