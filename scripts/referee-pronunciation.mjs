// Tie-breaker for words whose plain and vowel-marked audio differ: synthesizes a third version from
// the transliteration (converted to IPA) and saves it next to the others. Then compare-referee.py
// decides which version sounds closer to the transliteration.
// Usage: PCM_DIR=... NODE_USE_ENV_PROXY=1 node scripts/referee-pronunciation.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const pcmDir = process.env.PCM_DIR || '/tmp/hebrew-pcm';
const region = process.env.AZURE_REGION || 'germanywestcentral';
const pairs = JSON.parse(readFileSync(join(pcmDir, 'pairs.json'), 'utf8'));

/** Transliteration (as used in the app) -> IPA for Azure. */
export function toIpa(tr) {
  return tr
    .toLowerCase()
    .replace(/[()…/\-]/g, ' ')
    .replace(/kh/g, 'χ').replace(/sh/g, 'ʃ').replace(/zh/g, 'ʒ').replace(/ch/g, 'tʃ')
    .replace(/j/g, 'dʒ').replace(/y/g, 'j').replace(/r/g, 'ʁ').replace(/g/g, 'ɡ')
    .replace(/[’'`]/g, 'ʔ')
    .replace(/\s+/g, ' ')
    .trim();
}

const strip = (s) => s.replace(/[֑-ׇ]/g, '').replace(/\s*\(.*?\)/g, '').replace(/\s+\/\s+/g, ' ');
async function synth(plain, ipa, file) {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="he-IL"><voice name="he-IL-HilaNeural"><phoneme alphabet="ipa" ph="${ipa}">${strip(plain)}</phoneme></voice></speak>`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': 'injected-by-proxy', 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'raw-16khz-16bit-mono-pcm', 'User-Agent': 'hebrew-cards' },
      body: ssml,
    });
    if (res.ok) return writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
    throw new Error(`Azure ${res.status}: ${await res.text()}`);
  }
  throw new Error('too many retries');
}

const only = new Set(JSON.parse(process.env.ONLY || 'null') || []);
const todo = pairs.filter((p, i) => (p.idx = i, (!only.size || only.has(i)) && p.tr));
let n = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    p.ipa = toIpa(p.tr);
    p.ipaFile = join(pcmDir, `ipa_${p.idx}.pcm`);
    if (!existsSync(p.ipaFile)) await synth(p.plain, p.ipa, p.ipaFile);
    if (++n % 50 === 0) console.log(`  ${n}/${todo.length}`);
  }
}));
writeFileSync(join(pcmDir, 'pairs-ipa.json'), JSON.stringify(todo));
console.log(`done: ${todo.length} reference recordings`);
