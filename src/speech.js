// Speaking practice using the browser's built-in speech recognition (free, no key).
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const canListen = () => !!Recognition;

/** Listens once in Hebrew. Resolves with a list of possible transcripts (best first). */
export function listenOnce({ timeoutMs = 7000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('Speech recognition is not available in this browser.'));
    const r = new Recognition();
    r.lang = 'he-IL';
    r.interimResults = false;
    r.maxAlternatives = 5;
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      try {
        r.stop();
      } catch {
        /* already stopped */
      }
      fn(arg);
    };
    const t = setTimeout(() => finish(resolve, []), timeoutMs);
    r.onresult = (e) => {
      const alts = [];
      for (const res of e.results) for (const a of res) alts.push(a.transcript);
      finish(resolve, alts);
    };
    r.onerror = (e) => finish(reject, new Error(e.error === 'not-allowed' ? 'Microphone access was not allowed.' : `Speech recognition error: ${e.error}`));
    r.onend = () => finish(resolve, []);
    r.start();
  });
}
