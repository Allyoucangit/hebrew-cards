// Finds words whose pronunciation depends on the vowel marks: synthesizes each word/form
// once without and once with vowel marks and compares the audio. Different audio = the plain
// spelling is ambiguous, so those entries deserve a careful look (is the nikkud right?).
// Usage (Claude cloud session): NODE_USE_ENV_PROXY=1 node scripts/check-pronunciation.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const region = process.env.AZURE_REGION || 'germanywestcentral';
const key = process.env.AZURE_SPEECH_KEY || 'injected-by-proxy';
const voice = process.env.AZURE_VOICE || 'he-IL-HilaNeural';
const strip = (s) => s.replace(/[֑-ׇ]/g, '');
const clean = (s) => s.replace(/\s*\(.*?\)/g, '').replace(/\s+\/\s+/g, ', ');

const pcmDir = process.env.PCM_DIR || '/tmp/hebrew-pcm';
mkdirSync(pcmDir, { recursive: true });
let fileNo = 0;
/** Saves raw 16 kHz PCM and returns the file path. */
async function pcmFile(text) {
  const file = join(pcmDir, `${fileNo++}.pcm`);
  const ssml = `<speak version="1.0" xml:lang="he-IL"><voice name="${voice}">${clean(text).replace(/[<>&]/g, '')}</voice></speak>`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'raw-16khz-16bit-mono-pcm', 'User-Agent': 'hebrew-cards' },
      body: ssml,
    });
    if (res.ok) { writeFileSync(file, Buffer.from(await res.arrayBuffer())); return file; }
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
    throw new Error(`Azure TTS ${res.status}: ${await res.text()}`);
  }
  throw new Error('too many retries');
}

const { items } = JSON.parse(readFileSync(join(root, 'public', 'data', 'words.json'), 'utf8'));
const pairs = [];
for (const it of items) {
  const add = (plain, voc, tr, what) => voc && voc !== plain && pairs.push({ id: it.id, what, plain, voc, tr });
  add(it.he, it.heV, it.tr, 'word');
  if (it.pl) add(it.pl, it.plV, it.pltr, 'plural');
  (it.forms || []).forEach((f, i) => add(f, it.formsV?.[i], it.trs?.[i], `form ${i}`));
  (it.present || []).forEach((f, i) => add(f, it.presentV?.[i], it.presentTr?.[i], `present ${i}`));
}
console.log(`${pairs.length} words/forms to compare`);
let n = 0;
const queue = [...pairs];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    [p.plainFile, p.vocFile] = await Promise.all([pcmFile(p.plain), pcmFile(p.voc)]);
    if (++n % 200 === 0) console.log(`  ${n} synthesized`);
  }
}));
writeFileSync(join(pcmDir, 'pairs.json'), JSON.stringify(pairs));
console.log(`Audio saved. Now run: python3 scripts/compare-pronunciation.py ${pcmDir}`);
