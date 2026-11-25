// Converts data/src/*.txt into public/data/words.json.
// Run: node scripts/build-data.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'data', 'src');
const outDir = join(root, 'public', 'data');

const split = (s) => s.split(',').map((x) => x.trim());
const items = [];
const units = [];
const ids = new Set();
const errors = [];

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.txt')).sort()) {
  const lines = readFileSync(join(srcDir, file), 'utf8').split('\n');
  let unit = null;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const where = `${file}:${i + 1}`;
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('@unit')) {
      const [num, title] = line.slice(5).trim().split('|');
      unit = Number(num);
      units.push({ unit, title: title.trim(), source: 'duolingo' });
      return;
    }
    const f = line.split('|').map((x) => x.trim());
    const t = f[0];
    let item;
    try {
      if (t === 'n') {
        const [, he, tr, en, g, pl, pltr, ex, exEn] = f;
        if (!['m', 'f'].includes(g)) throw new Error('gender must be m/f');
        item = { type: 'n', he, tr, en, g, pl: pl === '-' ? null : pl, pltr: pltr === '-' ? null : pltr, ex, exEn };
      } else if (t === 'a') {
        const [, forms, trs, en, ex, exEn] = f;
        const fo = split(forms), tro = split(trs);
        if (fo.length !== 4 || tro.length !== 4) throw new Error('adjective needs 4 forms + 4 translits');
        item = { type: 'a', he: fo[0], tr: tro[0], forms: fo, trs: tro, en, ex, exEn };
      } else if (t === 'v') {
        const [, inf, tr, rootL, binyan, forms, trs, en, ex, exEn] = f;
        const fo = split(forms), tro = split(trs);
        if (fo.length !== 4 || tro.length !== 4) throw new Error('verb needs 4 present forms + 4 translits');
        item = { type: 'v', he: inf, tr, root: rootL, binyan, present: fo, presentTr: tro, en, ex, exEn };
      } else if (t === 'p') {
        const [, he, tr, en, forms, trs, ex, exEn] = f;
        const fo = split(forms), tro = split(trs);
        if (fo.length !== 10 || tro.length !== 10) throw new Error('preposition needs 10 forms + 10 translits');
        item = { type: 'p', he, tr, en, forms: fo, trs: tro, ex, exEn };
      } else if (t === 'x') {
        const [, tag, he, tr, en, ex, exEn] = f;
        item = { type: 'x', tag, he, tr, en, ex, exEn };
      } else {
        throw new Error(`unknown type "${t}"`);
      }
      if (unit == null) throw new Error('entry before any @unit line');
      if (!item.he || !item.en || !item.ex || !item.exEn) throw new Error('missing field');
      // Same spelling, different word (e.g. פועל po'el "worker" / po'al "verb"): later ones get #2, #3 …
      item.id = `${item.type}:${item.he}`;
      for (let k = 2; ids.has(item.id); k++) item.id = `${item.type}:${item.he}#${k}`;
      ids.add(item.id);
      item.unit = unit;
      item.source = 'duolingo';
      items.push(item);
    } catch (e) {
      errors.push(`${where}: ${e.message}\n   ${line}`);
    }
  });
}

// ---- Vowel marks (nikkud) for audio only: data/src/nikkud/*.txt, lines "id|vocalized,vocalized,..."
const NIKKUD = /[֑-ׇ]/g;
const strip = (s) => s.replace(NIKKUD, '');
// Positional: the vocalized list follows exactly this order (needed because e.g. רואה = ro'e / ro'a).
const alts = (he) => he.split('/').map((x) => x.trim());
const plainStrings = (it) =>
  it.type === 'a' ? [...it.forms]
  : it.type === 'v' ? [it.he, ...it.present]
  : it.type === 'p' ? [it.he, ...it.forms]
  : [...alts(it.he), ...(it.pl ? [it.pl] : [])];
const nikDir = join(srcDir, 'nikkud');
const byId = new Map(items.map((it) => [it.id, it]));
const missing = [];
try {
  for (const file of readdirSync(nikDir).filter((f) => f.endsWith('.txt')).sort()) {
    readFileSync(join(nikDir, file), 'utf8')
      .split('\n')
      .forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line.startsWith('#')) return;
        const where = `nikkud/${file}:${i + 1}`;
        const [id, list] = line.split('|');
        const it = byId.get(id.trim());
        if (!it) return errors.push(`${where}: unknown id ${id}`);
        if (it.voc) return errors.push(`${where}: ${id} listed twice`);
        const plain = plainStrings(it);
        const voc = list.split(',').map((x) => x.trim());
        if (voc.length !== plain.length) return errors.push(`${where}: expected ${plain.length} strings (${plain.join(', ')}), got ${voc.length}`);
        voc.forEach((v, k) => {
          if (strip(v) !== plain[k]) errors.push(`${where}: "${v}" → "${strip(v)}" should be "${plain[k]}"`);
        });
        it.voc = voc;
      });
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
// Vowel marks are used for audio ONLY where the plain spelling is ambiguous. Azure reads plain
// everyday words most naturally; with vowel marks it sometimes shifts stress (tested, see
// scripts/check-pronunciation.mjs). Ambiguous = (a) the same spelling has 2+ readings in our data
// (רואה ro'e/ro'a, לך lekha/lakh, ישן yashan/yashen …) or (b) a known homograph / very short word.
const HOMOGRAPHS = new Set(['חום', 'דבר', 'ספר', 'דוד', 'שער', 'מראה', 'נהג', 'שכן', 'חיה', 'דקה', 'את', 'ש', 'ל', 'ב', 'את (אות-)', 'עם (את-)', 'מן (מ-)',
  'עם', 'ברך', 'עור', 'פרס', 'סם', 'מטר', 'עצם', 'מורה', 'מדבר', 'שר', 'חמה', 'פה']);
const readings = new Map();
for (const it of items) {
  if (!it.voc) continue;
  plainStrings(it).forEach((p, k) => {
    if (!readings.has(p)) readings.set(p, new Set());
    readings.get(p).add(it.voc[k]);
  });
}
const needsMarks = (p) => HOMOGRAPHS.has(p) || readings.get(p)?.size > 1;
for (const it of items) {
  if (it.voc) it.voc = it.voc.map((v, k) => (needsMarks(plainStrings(it)[k]) ? v : plainStrings(it)[k]));
}
const marked = items.reduce((n, it) => n + (it.voc || []).filter((v) => /[֑-ׇ]/.test(v)).length, 0);
console.log(`Audio uses vowel marks for ${marked} ambiguous words/forms.`);

// Attach the audio versions in the same shape as the plain fields.
for (const it of items) {
  if (!it.voc) { missing.push(it.id); continue; }
  const v = it.voc;
  delete it.voc;
  if (it.type === 'a') { it.formsV = v; it.heV = v[0]; }
  else if (it.type === 'v') { it.heV = v[0]; it.presentV = v.slice(1); }
  else if (it.type === 'p') { it.heV = v[0]; it.formsV = v.slice(1); }
  else { const n = alts(it.he).length; it.heV = v.slice(0, n).join(' / '); if (it.pl) it.plV = v[n]; }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (missing.length) console.warn(`No vowel marks yet for ${missing.length} entries (audio will guess), e.g. ${missing.slice(0, 5).join(', ')}`);
// Keep units and entries in course order (file names would put extras.txt first).
units.sort((a, b) => a.unit - b.unit);
items.sort((a, b) => a.unit - b.unit);
units.find((u) => u.unit === 100) && (units.find((u) => u.unit === 100).source = 'extra');
items.forEach((it) => { if (it.unit === 100) it.source = 'extra'; });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'words.json'), JSON.stringify({ units, items }));
const counts = items.reduce((a, it) => ((a[it.type] = (a[it.type] || 0) + 1), a), {});
console.log(`OK: ${items.length} entries in ${units.length} units`, counts);
