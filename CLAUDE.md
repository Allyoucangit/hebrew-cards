# Notes for Claude

Owner is not a programmer: Claude owns all technical decisions; explain things in plain language.
Learner: English speaker, learning Hebrew via Duolingo (course "Hebrew from English"), reads **without nikkud**, practices on **iPhone**.

- Vanilla JS + Vite, no framework. Entry `src/main.js`; practice logic `src/practice.js`; cards/queue `src/deck.js`; FSRS + storage `src/store.js`.
- Word data: `data/src/*.txt` → `npm run data` → `public/data/words.json`. Keep example sentences simple, present tense where possible, no nikkud.
  Source list of Duolingo vocabulary by unit: duome.eu/vocabulary/en/he/skills. Verify verb forms against Pealim.
- Audio keys: FNV-1a hash of the unvocalized text (`audioKey` in `src/audio.js` and `scripts/generate-audio.mjs` must match).
- Card ids are `${type}:${hebrew}|${kind}`; renaming a Hebrew headword resets its progress.
- Before pushing: `npm run build` and test at iPhone size with Playwright.
- Roadmap: extra everyday words (owner must approve the list), Duolingo units 32+, past/future tense, sync between devices.
