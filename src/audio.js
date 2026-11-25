// Audio: pre-generated Azure MP3s when available, otherwise the device's Hebrew voice.
import { stripNikkud } from './hebrew.js';
import { settings } from './store.js';

export function audioKey(text) {
  // FNV-1a 32-bit hash of the unvocalized text. Must match scripts/generate-audio.mjs.
  const s = stripNikkud(text).trim();
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(s)) {
    h ^= ch;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

let available = new Set();
let current = null;

export async function initAudio() {
  try {
    const res = await fetch('audio/index.json', { cache: 'no-cache' });
    if (res.ok) available = new Set(await res.json());
  } catch {
    /* no pre-generated audio yet */
  }
  // Voices load asynchronously in some browsers.
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
}

function hebrewVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('he')) || null;
}

export const hasAnyHebrewAudio = () => available.size > 0 || !!hebrewVoice();

export function speak(text) {
  if (!text) return;
  stop();
  const key = audioKey(text);
  const rate = settings().speechRate || 1;
  if (available.has(key)) {
    current = new Audio(`audio/${key}.mp3`);
    current.playbackRate = rate;
    current.play().catch(() => speakWithDevice(text, rate));
    return;
  }
  speakWithDevice(text, rate);
}

function speakWithDevice(text, rate) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(stripNikkud(text));
  u.lang = 'he-IL';
  const v = hebrewVoice();
  if (v) u.voice = v;
  u.rate = 0.9 * rate;
  speechSynthesis.speak(u);
}

export function stop() {
  if (current) {
    current.pause();
    current = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
