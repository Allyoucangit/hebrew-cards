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
      item.id = `${item.type}:${item.he}`;
      if (ids.has(item.id)) throw new Error(`duplicate id ${item.id}`);
      ids.add(item.id);
      item.unit = unit;
      item.source = 'duolingo';
      items.push(item);
    } catch (e) {
      errors.push(`${where}: ${e.message}\n   ${line}`);
    }
  });
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'words.json'), JSON.stringify({ units, items }));
const counts = items.reduce((a, it) => ((a[it.type] = (a[it.type] || 0) + 1), a), {});
console.log(`OK: ${items.length} entries in ${units.length} units`, counts);
