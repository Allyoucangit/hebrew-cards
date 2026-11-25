// Practice session: picks cards, renders exercises, grades answers.
import { items, dueCards, newCardsAvailable, newLeftToday, CATEGORY, isAvailable } from './deck.js';
import { getCard, review, preview, settings, Rating, audioFlags, toggleAudioFlag } from './store.js';
import { check, alternatives, PERSONS, PRESENT_PRONOUNS, FORM_LABELS } from './hebrew.js';
import { speak, stop } from './audio.js';
import { hebrewInput } from './keyboard.js';
import { canListen, listenOnce } from './speech.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const he = (s, cls = '') => `<span class="he ${cls}" dir="rtl" lang="he">${esc(s)}</span>`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// Vowel-marked versions (for the voice only; the screen shows plain text).
const PRON_V = { 'את': 'אַתְּ' }; // only את is ambiguous (et / at)
export const V = {
  he: (it) => it.heV || it.he,
  pl: (it) => it.plV || it.pl,
  form: (it, i) => (it.formsV || it.forms)[i],
  pres: (it, i) => (it.presentV || it.present)[i],
  pron: (p) => PRON_V[p] || p,
};
const TYPE_LABEL = { n: 'noun', a: 'adjective', v: 'verb', p: 'preposition', x: '' };

function distractors(correct, pool, n = 3) {
  const seen = new Set([correct]);
  const out = [];
  for (const p of shuffle(pool)) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

function similarItems(it) {
  const same = items.filter((x) => x !== it && x.type === it.type && isAvailable(x));
  const near = same.filter((x) => Math.abs(x.unit - it.unit) <= 6);
  return near.length >= 6 ? near : same;
}

const MEDIAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const toMedial = (s) => s.replace(/[ךםןףץ]$/, (c) => MEDIAL[c]);

function fakePlurals(it) {
  const base = toMedial(it.he.replace(/[הת]$/, ''));
  const stem = it.pl.replace(/(ים|ות)$/, '');
  return [stem + 'ים', stem + 'ות', base + 'ים', base + 'ות', it.he];
}

function answerMode(card) {
  const s = settings().answerMode;
  if (s !== 'mix') return s === 'self' ? 'self' : s === 'choice' ? 'choice' : 'type';
  const c = getCard(card.id);
  if (!c || c.stability < 4) return 'choice';
  return Math.random() < 0.7 ? 'type' : 'choice';
}

/** Full info block about a word, shown after answering. */
/** Handles the report button inside an info block (used by the word list too). */
export function handleFlagClick(e) {
  const fl = e.target.closest('[data-flag]');
  if (fl) fl.textContent = toggleAudioFlag(fl.dataset.flag) ? '⚑ Reported – tap to undo' : '⚐ Audio sounds wrong?';
  return !!fl;
}

export function infoBlock(it) {
  const tr = (t) => `<span class="tr">${esc(t)}</span>`;
  let extra = '';
  if (it.type === 'n') {
    extra = `<div class="meta">${it.g === 'm' ? 'masculine' : 'feminine'}${it.pl ? ` · plural ${he(it.pl)} ${tr(it.pltr)} <button class="say mini" data-say="${esc(V.pl(it))}" aria-label="Play">🔊</button>` : ''}</div>`;
  } else if (it.type === 'a') {
    extra = `<table class="forms">${it.forms.map((f, i) => `<tr><td>${FORM_LABELS[i]}</td><td>${he(f)}</td><td>${tr(it.trs[i])}</td><td><button class="say mini" data-say="${esc(V.form(it, i))}" aria-label="Play">🔊</button></td></tr>`).join('')}</table>`;
  } else if (it.type === 'v') {
    extra = `<div class="meta">root ${he(it.root)} · ${it.binyan}</div><table class="forms">${it.present.map((f, i) => `<tr><td>${PRESENT_PRONOUNS[i].map((p) => p.he).slice(1).join(' / ')}</td><td>${he(f)}</td><td>${tr(it.presentTr[i])}</td><td><button class="say mini" data-say="${esc(V.pres(it, i))}" aria-label="Play">🔊</button></td></tr>`).join('')}</table>`;
  } else if (it.type === 'p') {
    extra = `<table class="forms">${it.forms.map((f, i) => `<tr><td>${he(PERSONS[i].he)}</td><td>${he(f)}</td><td>${tr(it.trs[i])}</td><td><button class="say mini" data-say="${esc(V.form(it, i))}" aria-label="Play">🔊</button></td></tr>`).join('')}</table>`;
  }
  return `
    <div class="info">
      <div class="info-head">${he(it.he, 'big')} <button class="say" data-say="${esc(V.he(it))}" aria-label="Play">🔊</button></div>
      <div>${tr(it.tr)} · <b>${esc(it.en)}</b>${TYPE_LABEL[it.type] ? ` <span class="tag">${TYPE_LABEL[it.type]}</span>` : ''}</div>
      ${extra}
      <div class="example">
        <div>${he(it.ex)} <button class="say mini" data-say="${esc(it.ex)}" aria-label="Play">🔊</button></div>
        <div class="muted">${esc(it.exEn)}</div>
      </div>
      <button class="link flag" data-flag="${esc(it.id)}">${audioFlags().includes(it.id) ? '⚑ Reported – tap to undo' : '⚐ Audio sounds wrong?'}</button>
    </div>`;
}

/** Builds the exercise for a card. */
function buildQuestion(card) {
  const it = card.item;
  const k = card.kind;
  const q = { card, mode: answerMode(card), reveal: infoBlock(it), sayAfter: V.he(it) };

  if (k === 'rec') {
    q.mode = 'self';
    q.prompt = `<div class="prompt-he" dir="rtl">${he(it.he, 'huge')}</div>${hint(it.tr)}`;
    q.autoplay = V.he(it);
    q.question = 'What does it mean?';
    return q;
  }
  if (k === 'listen') {
    q.mode = 'choice';
    q.prompt = `<button class="say huge-say" data-say="${esc(V.he(it))}" aria-label="Play again">🔊</button>`;
    q.autoplay = V.he(it);
    q.question = 'What did you hear?';
    q.answer = it.en;
    q.options = shuffle([it.en, ...distractors(it.en, similarItems(it).map((x) => x.en))]);
    q.optionsHebrew = false;
    return q;
  }
  if (k === 'prod') {
    const label = it.type === 'v' ? 'verb – infinitive' : it.type === 'a' ? 'adjective – masc. sg.' : TYPE_LABEL[it.type];
    q.prompt = `<div class="prompt-en">${esc(it.en)}</div>${label ? `<div class="muted">${label}</div>` : ''}`;
    q.question = 'In Hebrew?';
    q.answer = it.he;
    q.options = shuffle([it.he, ...distractors(it.he, similarItems(it).map((x) => x.he))]);
    return q;
  }
  if (k === 'pl') {
    q.prompt = `<div class="prompt-he" dir="rtl">${he(it.he, 'huge')}</div><div class="muted">${esc(it.en)} · ${it.g === 'm' ? 'masc.' : 'fem.'}</div>`;
    q.question = 'Plural?';
    q.answer = it.pl;
    q.options = shuffle([it.pl, ...distractors(it.pl, fakePlurals(it))]);
    q.sayAfter = V.pl(it);
    return q;
  }
  if (/^f\d$/.test(k)) {
    const n = Number(k[1]);
    const g = n === 1 || n === 3 ? 'f' : 'm';
    const plural = n >= 2;
    const nouns = items.filter((x) => x.type === 'n' && x.g === g && (!plural || x.pl) && !/\(pl\.\)/.test(x.en) && isAvailable(x) && x.unit <= Math.max(it.unit, 12));
    const noun = pick(nouns);
    const nounForm = plural ? noun.pl : noun.he;
    const phrase = `${nounForm} ${it.forms[n]}`;
    const phraseV = [plural ? V.pl(noun) : V.he(noun), V.form(it, n)];
    q.prompt = `<div class="prompt-he" dir="rtl">${he(nounForm, 'huge')} <span class="blank">___</span></div>
      <div class="muted">${esc(plural ? noun.en.split(',')[0] + ' (pl.)' : noun.en.split(',')[0])} – <b>${esc(it.en.split(',')[0])}</b></div>
      <div class="muted small">${noun.g === 'm' ? 'masculine' : 'feminine'} ${plural ? 'plural' : 'singular'} noun</div>`;
    q.question = 'Which form of the adjective?';
    q.answer = it.forms[n];
    q.options = shuffle([...new Set(it.forms)]).slice(0, 4);
    q.sayAfter = phraseV;
    q.extraReveal = `<div class="phrase">${he(phrase, 'big')} <button class="say" data-say="${esc(JSON.stringify(phraseV))}">🔊</button><div class="muted">${esc(plural ? noun.pltr : noun.tr)} ${esc(it.trs[n])}</div></div>`;
    return q;
  }
  if (/^v\d$/.test(k)) {
    const n = Number(k[1]);
    const pron = pick(PRESENT_PRONOUNS[n]);
    const phrase = `${pron.he} ${it.present[n]}`;
    const phraseV = `${V.pron(pron.he)} ${V.pres(it, n)}`;
    q.prompt = `<div class="prompt-he" dir="rtl">${he(pron.he, 'huge')} <span class="blank">___</span></div>
      <div class="muted">${he(it.he)} – ${esc(it.en)}${pron.note ? ` · <i>${pron.note}</i>` : ''}</div>`;
    q.question = 'Present tense?';
    q.answer = it.present[n];
    q.options = shuffle([...new Set(it.present)]);
    q.sayAfter = phraseV;
    q.extraReveal = `<div class="phrase">${he(phrase, 'big')} <button class="say" data-say="${esc(JSON.stringify(phraseV))}">🔊</button><div class="muted">${esc(it.presentTr[n])}</div></div>`;
    return q;
  }
  if (/^q\d$/.test(k)) {
    const n = Number(k[1]);
    q.prompt = `<div class="prompt-he" dir="rtl">${he(it.he, 'huge')} + ${he(PERSONS[n].he, 'huge')}</div><div class="muted">${esc(it.en)} + ${PERSONS[n].en}</div>`;
    q.question = 'Combined form?';
    q.answer = it.forms[n];
    q.options = shuffle([it.forms[n], ...distractors(it.forms[n], it.forms)]);
    q.sayAfter = V.form(it, n);
    q.extraReveal = `<div class="phrase">${he(it.forms[n], 'big')} <button class="say" data-say="${esc(V.form(it, n))}">🔊</button><div class="muted">${esc(it.trs[n])}</div></div>`;
    return q;
  }
  throw new Error(`Unknown card kind ${k}`);
}

function hint(tr) {
  if (!tr) return '';
  return settings().showTranslit
    ? `<div class="tr">${esc(tr)}</div>`
    : `<button class="link hint" data-hint="${esc(tr)}">show pronunciation</button>`;
}

function fmtInterval(date) {
  const mins = Math.max(1, Math.round((date - Date.now()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo` : `${(d / 365).toFixed(1)}y`;
}

// ---------------------------------------------------------------- session

export function startSession(root, { category = 'all', onExit }) {
  const filter = CATEGORY[category].match;
  const queue = [...dueCards(new Date(), filter), ...newCardsAvailable(filter).slice(0, newLeftToday())];
  const total = queue.length;
  let done = 0;
  let right = 0;

  if (!total) {
    root.innerHTML = `<section class="card center"><h2>Nothing to practice right now</h2>
      <p class="muted">All cards in “${CATEGORY[category].label}” are done for today. Come back later, or raise “new cards per day” in Settings.</p>
      <button class="btn" data-act="exit">Back</button></section>`;
    root.querySelector('[data-act=exit]').onclick = onExit;
    return;
  }

  const next = () => {
    stop();
    const card = queue.shift();
    if (!card) return finish();
    render(card);
  };

  const finish = () => {
    root.innerHTML = `<section class="card center"><h2>Session done</h2>
      <p>${done} answers · ${right} right</p><button class="btn primary" data-act="exit">Back to overview</button></section>`;
    root.querySelector('[data-act=exit]').onclick = onExit;
  };

  const grade = (card, rating) => {
    const updated = review(card.id, rating);
    done++;
    if (rating !== Rating.Again) right++;
    // Cards due again within this session (learning steps) go back into the queue.
    if (updated.due - Date.now() < 15 * 60000) queue.splice(Math.min(queue.length, 4), 0, card);
    next();
  };

  function render(card) {
    const q = buildQuestion(card);
    root.innerHTML = `
      <div class="session-top">
        <button class="link" data-act="exit">✕ Stop</button>
        <div class="progress"><div style="width:${Math.round((done / Math.max(total, done + queue.length + 1)) * 100)}%"></div></div>
        <span class="muted small">${queue.length + 1} left</span>
      </div>
      <section class="card exercise">
        <div class="question muted">${q.question}</div>
        <div class="prompt">${q.prompt}</div>
        <div class="answer-area"></div>
        <div class="feedback"></div>
        <div class="reveal" hidden></div>
        <div class="actions"></div>
      </section>`;
    root.querySelector('[data-act=exit]').onclick = () => {
      stop();
      onExit();
    };
    const area = root.querySelector('.answer-area');
    const actions = root.querySelector('.actions');
    const feedback = root.querySelector('.feedback');
    const reveal = root.querySelector('.reveal');
    if (q.autoplay && settings().autoplay) setTimeout(() => speak(q.autoplay), 150);

    const showReveal = () => {
      reveal.innerHTML = (q.extraReveal || '') + q.reveal;
      reveal.hidden = false;
      area.querySelectorAll('button').forEach((b) => (b.disabled = true));
    };

    const afterAnswer = (ok, note = '') => {
      feedback.innerHTML = ok
        ? `<div class="ok">✓ Correct${note ? ` <span class="small">${note}</span>` : ''}</div>`
        : `<div class="bad">✗ ${q.answer ? `Answer: ${/[֐-׿]/.test(q.answer) ? he(q.answer) : esc(q.answer)}` : ''}</div>`;
      showReveal();
      if (settings().autoplay && q.sayAfter && q.mode !== 'self') speak(q.sayAfter);
      actions.innerHTML = ok
        ? `<button class="btn primary" data-r="${Rating.Good}">Continue</button><button class="btn" data-r="${Rating.Easy}">Too easy</button>`
        : `<button class="btn primary" data-r="${Rating.Again}">Continue</button><button class="btn" data-r="${Rating.Hard}">I was right</button>`;
      actions.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => grade(card, Number(b.dataset.r))));
      actions.querySelector('.primary').focus();
    };

    const speakButton = () => {
      if (!(settings().speaking && canListen() && q.answer && /[֐-׿]/.test(q.answer))) return '';
      return `<button class="btn mic" data-act="mic">🎤 Say it</button>`;
    };
    const wireMic = () => {
      const b = area.querySelector('[data-act=mic]');
      if (!b) return;
      b.onclick = async () => {
        b.disabled = true;
        b.textContent = '🎤 Listening…';
        try {
          const heard = await listenOnce();
          const ok = heard.some((h) => check(h, alternatives(q.answer)).ok);
          const best = heard[0] || '(nothing)';
          if (ok) afterAnswer(true, '– pronunciation recognised');
          else {
            b.disabled = false;
            b.textContent = '🎤 Try again';
            feedback.innerHTML = `<div class="muted">Heard: ${he(best)} – try again, or answer another way.</div>`;
          }
        } catch (e) {
          b.textContent = '🎤 not available';
          feedback.innerHTML = `<div class="muted small">${esc(e.message)}</div>`;
        }
      };
    };

    if (q.mode === 'self') {
      area.innerHTML = `<button class="btn primary wide" data-act="show">Show answer</button>`;
      area.querySelector('[data-act=show]').onclick = () => {
        area.innerHTML = '';
        showReveal();
        const p = preview(card.id);
        const label = { [Rating.Again]: 'Again', [Rating.Hard]: 'Hard', [Rating.Good]: 'Good', [Rating.Easy]: 'Easy' };
        actions.innerHTML = `<div class="grades">${[Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]
          .map((r) => `<button class="btn grade g${r}" data-r="${r}">${label[r]}<span>${fmtInterval(p[r])}</span></button>`)
          .join('')}</div>`;
        actions.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => grade(card, Number(b.dataset.r))));
      };
    } else if (q.mode === 'choice') {
      const hebrewOpts = q.optionsHebrew !== false;
      area.innerHTML = `<div class="options">${q.options
        .map((o) => `<button class="btn option ${hebrewOpts ? 'he' : ''}" ${hebrewOpts ? 'dir="rtl"' : ''} data-o="${esc(o)}">${esc(o)}</button>`)
        .join('')}</div>${speakButton()}`;
      area.querySelectorAll('[data-o]').forEach(
        (b) =>
          (b.onclick = () => {
            const ok = b.dataset.o === q.answer || (hebrewOpts && check(b.dataset.o, alternatives(q.answer)).ok);
            b.classList.add(ok ? 'right' : 'wrong');
            if (!ok) area.querySelectorAll('[data-o]').forEach((x) => x.dataset.o === q.answer && x.classList.add('right'));
            afterAnswer(ok);
          }),
      );
      wireMic();
    } else {
      area.innerHTML = `<div class="kb-host"></div><div class="row">${speakButton()}<button class="link" data-act="dunno">I don't know</button></div>`;
      const input = hebrewInput(area.querySelector('.kb-host'), {
        onEnter: (v) => {
          if (!v.trim()) return;
          const res = check(v, alternatives(q.answer));
          input.disable();
          afterAnswer(res.ok, res.finalLetterSlip ? '(watch the final letter form)' : '');
        },
      });
      area.querySelector('[data-act=dunno]').onclick = () => {
        input.disable();
        afterAnswer(false);
      };
      wireMic();
    }

    root.querySelector('.exercise').addEventListener('click', (e) => {
      const s = e.target.closest('[data-say]');
      if (s) speak(s.dataset.say.startsWith('[') ? JSON.parse(s.dataset.say) : s.dataset.say);
      const fl = e.target.closest('[data-flag]');
      if (fl) fl.textContent = toggleAudioFlag(fl.dataset.flag) ? '⚑ Reported – tap to undo' : '⚐ Audio sounds wrong?';
      const h = e.target.closest('[data-hint]');
      if (h) h.outerHTML = `<div class="tr">${esc(h.dataset.hint)}</div>`;
    });
  }

  next();
}
