import './style.css';
import { loadDeck, units, items, cards, dueCards, newCardsAvailable, newLeftToday, itemStatus, weakItems, CATEGORY } from './deck.js';
import { settings, updateSettings, dayStats, allDays, exportBackup, importBackup, resetProgress, isStarted, audioFlags, toggleAudioFlag } from './store.js';
import { initAudio, speak, hasAnyHebrewAudio } from './audio.js';
import { startSession, infoBlock, V, handleFlagClick } from './practice.js';
import { canListen } from './speech.js';

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const he = (s, cls = '') => `<span class="he ${cls}" dir="rtl" lang="he">${esc(s)}</span>`;
const STATUS_LABEL = { new: 'not started', learning: 'learning', good: 'good', known: 'known' };

let view = 'home';

function shell(content) {
  app.innerHTML = `
    <main id="view">${content}</main>
    <nav class="tabs">
      ${[
        ['home', '🏠', 'Today'],
        ['words', '📖', 'Words'],
        ['settings', '⚙️', 'Settings'],
      ]
        .map(([v, i, l]) => `<button data-view="${v}" class="${view === v ? 'active' : ''}"><span>${i}</span>${l}</button>`)
        .join('')}
    </nav>`;
  app.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => go(b.dataset.view)));
}

function go(v) {
  view = v;
  window.scrollTo(0, 0);
  ({ home, words, settings: settingsView })[v]();
}

// ------------------------------------------------------------------ Today

function home() {
  const due = dueCards();
  const newToday = Math.min(newLeftToday(), newCardsAvailable().length);
  const t = dayStats();
  const statusCount = { new: 0, learning: 0, good: 0, known: 0 };
  items.forEach((it) => statusCount[itemStatus(it)]++);
  const started = cards.filter((c) => isStarted(c.id)).length;
  const days = Object.entries(allDays()).sort().slice(-14);
  const maxR = Math.max(10, ...days.map(([, d]) => d.reviews));
  const weak = weakItems(8);

  const catButtons = Object.entries(CATEGORY)
    .filter(([k]) => k !== 'all')
    .map(([k, c]) => {
      const n = dueCards(new Date(), c.match).length + Math.min(newLeftToday(), newCardsAvailable(c.match).length);
      return `<button class="chip" data-cat="${k}" ${n ? '' : 'disabled'}>${c.label} <b>${n}</b></button>`;
    })
    .join('');

  shell(`
    <header class="page-head"><h1>${he('עברית')} Hebrew Cards</h1></header>
    <section class="card">
      <div class="stats3">
        <div><b>${due.length}</b><span>due for review</span></div>
        <div><b>${newToday}</b><span>new today</span></div>
        <div><b>${t.reviews}</b><span>answers today</span></div>
      </div>
      <button class="btn primary wide big" data-cat="all" ${due.length + newToday ? '' : 'disabled'}>Start practice</button>
      <div class="muted small center">${due.length + newToday ? '' : 'All done for today ✓'}</div>
    </section>
    <section class="card">
      <h3>Practice only…</h3>
      <div class="chips">${catButtons}</div>
    </section>
    <section class="card">
      <h3>Your words</h3>
      <div class="bar">${['known', 'good', 'learning', 'new']
        .map((s) => `<div class="seg s-${s}" style="flex:${statusCount[s] || 0}"></div>`)
        .join('')}</div>
      <div class="legend">${['known', 'good', 'learning', 'new']
        .map((s) => `<span><i class="dot s-${s}"></i>${STATUS_LABEL[s]} ${statusCount[s]}</span>`)
        .join('')}</div>
      <p class="muted small">${items.length} words from Duolingo units 1–31 · ${started} of ${cards.length} practice cards started</p>
    </section>
    ${
      days.length
        ? `<section class="card"><h3>Last 14 days</h3><div class="spark">${days
            .map(([d, v]) => `<div title="${d}: ${v.reviews} answers"><i style="height:${Math.round((v.reviews / maxR) * 100)}%"></i><span>${d.slice(8)}</span></div>`)
            .join('')}</div></section>`
        : ''
    }
    ${
      weak.length
        ? `<section class="card"><h3>Trickiest words</h3><ul class="list">${weak
            .map(([it, n]) => `<li data-item="${esc(it.id)}">${he(it.he)} <span>${esc(it.en)}</span><span class="muted small">${n}× missed</span></li>`)
            .join('')}</ul></section>`
        : ''
    }
    ${
      hasAnyHebrewAudio()
        ? ''
        : `<section class="card warn">No Hebrew voice found on this device yet. On iPhone: Settings → Accessibility → Spoken Content → Voices → Hebrew → download “Carmit”.</section>`
    }
  `);
  app.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => practice(b.dataset.cat)));
  app.querySelectorAll('[data-item]').forEach((li) => (li.onclick = () => showItem(li.dataset.item)));
}

function practice(category) {
  app.innerHTML = `<main id="view" class="session"></main>`;
  startSession(app.querySelector('#view'), { category, onExit: () => go('home') });
}

// ------------------------------------------------------------------ Words

let wordFilter = { q: '', type: 'all' };

function words() {
  shell(`
    <header class="page-head"><h1>Words</h1></header>
    <div class="filters">
      <input type="search" placeholder="Search Hebrew or English" value="${esc(wordFilter.q)}" id="q" autocomplete="off">
      <select id="type">
        ${[
          ['all', 'All types'],
          ['n', 'Nouns'],
          ['v', 'Verbs'],
          ['a', 'Adjectives'],
          ['p', 'Prepositions'],
          ['x', 'Other words & phrases'],
        ]
          .map(([v, l]) => `<option value="${v}" ${wordFilter.type === v ? 'selected' : ''}>${l}</option>`)
          .join('')}
      </select>
    </div>
    <div id="wordlist"></div>`);
  const renderList = () => {
    const q = wordFilter.q.trim().toLowerCase();
    const match = (it) =>
      (wordFilter.type === 'all' || it.type === wordFilter.type) &&
      (!q || it.he.includes(q) || it.en.toLowerCase().includes(q) || (it.tr || '').toLowerCase().includes(q));
    app.querySelector('#wordlist').innerHTML = units
      .map((u) => {
        const list = items.filter((it) => it.unit === u.unit && match(it));
        if (!list.length) return '';
        return `<section class="card unit"><h3>Unit ${u.unit} · ${esc(u.title)}</h3><ul class="list">${list
          .map(
            (it) => `<li data-item="${esc(it.id)}"><i class="dot s-${itemStatus(it)}" title="${STATUS_LABEL[itemStatus(it)]}"></i>${he(it.he)}<span>${esc(it.en)}</span>
              <button class="say mini" data-say="${esc(V.he(it))}" aria-label="Play">🔊</button></li>`,
          )
          .join('')}</ul></section>`;
      })
      .join('') || `<p class="muted center">No words found.</p>`;
  };
  renderList();
  app.querySelector('#q').oninput = (e) => {
    wordFilter.q = e.target.value;
    renderList();
  };
  app.querySelector('#type').onchange = (e) => {
    wordFilter.type = e.target.value;
    renderList();
  };
  app.querySelector('#wordlist').addEventListener('click', (e) => {
    const s = e.target.closest('[data-say]');
    if (s) return speak(s.dataset.say);
    const li = e.target.closest('[data-item]');
    if (li) showItem(li.dataset.item);
  });
}

function showItem(id) {
  const it = items.find((x) => x.id === id);
  const dlg = document.createElement('div');
  dlg.className = 'modal';
  dlg.innerHTML = `<div class="sheet"><button class="link close">✕ Close</button>${infoBlock(it)}
    <p class="muted small">Unit ${it.unit} · status: ${STATUS_LABEL[itemStatus(it)]}</p></div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => {
    const s = e.target.closest('[data-say]');
    if (s) return speak(s.dataset.say);
    if (handleFlagClick(e)) return;
    if (e.target === dlg || e.target.closest('.close')) dlg.remove();
  });
}

// ------------------------------------------------------------------ Settings

function settingsView() {
  const s = settings();
  shell(`
    <header class="page-head"><h1>Settings</h1></header>
    <section class="card form">
      <label>New cards per day <input type="number" min="0" max="200" id="newPerDay" value="${s.newPerDay}"></label>
      <p class="muted small">Each word has several cards (meaning, listening, producing it, forms). Because you already know these words from Duolingo, 30–50 a day works well; press “Too easy”/“Easy” for words you know well.</p>
      <label>Answer style
        <select id="answerMode">
          <option value="mix" ${s.answerMode === 'mix' ? 'selected' : ''}>Mix (choice first, typing later)</option>
          <option value="choice" ${s.answerMode === 'choice' ? 'selected' : ''}>Multiple choice only</option>
          <option value="typing" ${s.answerMode === 'typing' ? 'selected' : ''}>Typing only</option>
          <option value="self" ${s.answerMode === 'self' ? 'selected' : ''}>Flip cards (rate yourself)</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" id="autoplay" ${s.autoplay ? 'checked' : ''}> Play audio automatically</label>
      <label class="check"><input type="checkbox" id="showTranslit" ${s.showTranslit ? 'checked' : ''}> Always show pronunciation (transliteration)</label>
      <label class="check"><input type="checkbox" id="speaking" ${s.speaking ? 'checked' : ''}> Speaking practice (🎤 button)${canListen() ? '' : ' – <i>not supported in this browser</i>'}</label>
      <label>Audio speed <select id="speechRate">
        ${[0.75, 0.9, 1, 1.15].map((r) => `<option value="${r}" ${Number(s.speechRate) === r ? 'selected' : ''}>${r}×</option>`).join('')}
      </select></label>
    </section>
    ${
      audioFlags().length
        ? `<section class="card form"><h3>Audio you reported (${audioFlags().length})</h3>
      <p class="muted small">Send this list to Claude to get the pronunciation checked and fixed.</p>
      <textarea id="flags" readonly rows="4" dir="rtl">${esc(audioFlags().map((id) => id.split(':').slice(1).join(':')).join(', '))}</textarea>
      <div class="row"><button class="btn" id="copyFlags">Copy list</button><button class="link danger" id="clearFlags">Clear list</button></div></section>`
        : ''
    }
    <section class="card form">
      <h3>Backup</h3>
      <p class="muted small">Your progress is saved on this device only. Make a backup now and then.</p>
      <div class="row"><button class="btn" id="export">Save backup file</button>
      <label class="btn">Restore backup<input type="file" id="import" accept=".json,application/json" hidden></label></div>
      <button class="link danger" id="reset">Reset all progress…</button>
    </section>
    <p class="muted small center">Hebrew Cards v0.2</p>`);
  const bind = (id, fn) => (app.querySelector(`#${id}`).onchange = (e) => updateSettings({ [id]: fn(e.target) }));
  bind('newPerDay', (el) => Math.max(0, Math.min(200, Number(el.value) || 0)));
  bind('answerMode', (el) => el.value);
  bind('autoplay', (el) => el.checked);
  bind('showTranslit', (el) => el.checked);
  bind('speaking', (el) => el.checked);
  bind('speechRate', (el) => Number(el.value));
  app.querySelector('#copyFlags')?.addEventListener('click', async () => {
    const t = app.querySelector('#flags');
    try {
      await navigator.clipboard.writeText(t.value);
    } catch {
      t.select();
      document.execCommand('copy');
    }
    alert('Copied.');
  });
  app.querySelector('#clearFlags')?.addEventListener('click', () => {
    if (confirm('Clear the list of reported audio?')) {
      [...audioFlags()].forEach((id) => toggleAudioFlag(id));
      settingsView();
    }
  });
  app.querySelector('#export').onclick = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `hebrew-cards-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  app.querySelector('#import').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      importBackup(await f.text());
      alert('Backup restored.');
      go('home');
    } catch (err) {
      alert(`Could not restore: ${err.message}`);
    }
  };
  app.querySelector('#reset').onclick = () => {
    if (confirm('Delete all learning progress on this device? This cannot be undone.')) {
      resetProgress();
      go('home');
    }
  };
}

// ------------------------------------------------------------------ start

(async () => {
  try {
    await Promise.all([loadDeck(), initAudio()]);
    go('home');
  } catch (e) {
    app.innerHTML = `<p class="card warn">Could not load the word list: ${esc(e.message)}</p>`;
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
