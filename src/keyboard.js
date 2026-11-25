// On-screen Hebrew keyboard (standard Israeli layout), so the phone keyboard never needs switching.
const ROWS = [
  ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
  ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
  ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ'],
];

/**
 * Renders a read-only answer field plus keyboard into `host`.
 * onEnter(value) is called when the check key is pressed.
 */
export function hebrewInput(host, { onEnter, placeholder = 'הקלד כאן' } = {}) {
  let value = '';
  host.innerHTML = `
    <div class="answer-field he" dir="rtl" aria-live="polite"><span class="val"></span><span class="caret"></span><span class="ph">${placeholder}</span></div>
    <div class="kb" dir="ltr">
      ${ROWS.map((r) => `<div class="kb-row">${r.map((k) => `<button type="button" class="key he" data-k="${k}">${k}</button>`).join('')}</div>`).join('')}
      <div class="kb-row">
        <button type="button" class="key wide" data-k="'">׳</button>
        <button type="button" class="key space" data-k=" ">space</button>
        <button type="button" class="key wide" data-act="back" aria-label="Delete">⌫</button>
        <button type="button" class="key enter" data-act="enter">Check</button>
      </div>
    </div>`;
  const val = host.querySelector('.val');
  const ph = host.querySelector('.ph');
  const render = () => {
    val.textContent = value;
    ph.style.display = value ? 'none' : '';
  };
  host.querySelector('.kb').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.k) value += b.dataset.k;
    else if (b.dataset.act === 'back') value = value.slice(0, -1);
    else if (b.dataset.act === 'enter') return onEnter?.(value);
    render();
  });
  // Physical keyboard support (desktop): accept Hebrew letters, backspace, enter.
  const onKey = (e) => {
    if (!host.isConnected) return document.removeEventListener('keydown', onKey);
    if (e.key === 'Enter') return onEnter?.(value);
    if (e.key === 'Backspace') value = value.slice(0, -1);
    else if (/^[א-ת' ]$/.test(e.key)) value += e.key;
    else return;
    e.preventDefault();
    render();
  };
  document.addEventListener('keydown', onKey);
  render();
  return {
    get value() {
      return value;
    },
    set value(v) {
      value = v;
      render();
    },
    disable() {
      host.querySelector('.kb').classList.add('disabled');
      document.removeEventListener('keydown', onKey);
    },
  };
}
