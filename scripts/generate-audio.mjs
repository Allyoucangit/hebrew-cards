// Generates MP3 audio for all words, forms and example sentences with Azure Text-to-Speech.
// Usage: AZURE_REGION=westeurope AZURE_SPEECH_KEY=... node scripts/generate-audio.mjs
// Existing files are skipped, so it can be re-run after adding words.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'audio');
const region = process.env.AZURE_REGION || 'westeurope';
const key = process.env.AZURE_SPEECH_KEY || 'injected-by-proxy';
const voice = process.env.AZURE_VOICE || 'he-IL-HilaNeural';
const limit = Number(process.env.LIMIT || Infinity);

const stripNikkud = (s) => s.replace(/[֑-ׇ]/g, '');
// Must match audioKey() in src/audio.js
function audioKey(text) {
  const s = stripNikkud(text).trim();
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(s)) {
    h ^= ch;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const PRESENT_PRONOUNS = [['אני', 'אתה', 'הוא'], ['אני', 'את', 'היא'], ['אנחנו', 'אתם', 'הם'], ['אנחנו', 'אתן', 'הן']];

const { items } = JSON.parse(readFileSync(join(root, 'public', 'data', 'words.json'), 'utf8'));
const texts = new Set();
for (const it of items) {
  texts.add(it.he);
  texts.add(it.ex);
  if (it.pl) texts.add(it.pl);
  (it.forms || []).forEach((f) => texts.add(f));
  (it.present || []).forEach((f, i) => {
    texts.add(f);
    PRESENT_PRONOUNS[i].forEach((p) => texts.add(`${p} ${f}`));
  });
}

const escXml = (s) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

async function synth(text) {
  const spoken = stripNikkud(text).replace(/\s+\/\s+/g, ', ');
  const ssml = `<speak version="1.0" xml:lang="he-IL"><voice name="${voice}"><prosody rate="-5%">${escXml(spoken)}</prosody></voice></speak>`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'hebrew-cards',
      },
      body: ssml,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    throw new Error(`Azure TTS ${res.status}: ${await res.text()}`);
  }
  throw new Error('Azure TTS: too many retries');
}

mkdirSync(outDir, { recursive: true });
const todo = [...texts].filter((t) => !existsSync(join(outDir, `${audioKey(t)}.mp3`))).slice(0, limit);
console.log(`${texts.size} texts, ${todo.length} to generate (voice ${voice}, region ${region})`);

let done = 0;
let chars = 0;
const worker = async () => {
  while (todo.length) {
    const t = todo.shift();
    const buf = await synth(t);
    writeFileSync(join(outDir, `${audioKey(t)}.mp3`), buf);
    chars += t.length;
    if (++done % 50 === 0) console.log(`  ${done} done`);
  }
};
await Promise.all(Array.from({ length: 4 }, worker));

const all = readdirSync(outDir).filter((f) => /^[0-9a-f]{8}\.mp3$/.test(f)).map((f) => f.slice(0, 8)).sort();
writeFileSync(join(outDir, 'index.json'), JSON.stringify(all));
console.log(`Generated ${done} files (${chars} characters). ${all.length} audio files in total.`);
