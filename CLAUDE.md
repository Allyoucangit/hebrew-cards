# Notes for Claude

Owner is not a programmer: Claude owns all technical decisions; explain things in plain language.
Learner: English speaker, learning Hebrew via Duolingo (course "Hebrew from English", 84 units), reads **without nikkud**, practices on **iPhone**.

- Vanilla JS + Vite, no framework. Entry `src/main.js`; practice logic `src/practice.js`; cards/queue `src/deck.js`; FSRS + storage `src/store.js`.
- Word data: `data/src/*.txt` → `npm run data` → `public/data/words.json`. Keep example sentences simple, present tense where possible, no nikkud.
  - All 84 Duolingo units + `extras.txt` (unit 100 = "Everyday extras", always available, introduced after unit 16).
  - Words unlock up to Settings → "My Duolingo unit" (`settings.duolingoUnit`, default 31).
  - Source list of Duolingo vocabulary by unit: `data/duolingo_by_skill.json` (from duome.eu/vocabulary/en/he/skills). Verify verb forms against Pealim.
  - Same spelling, different word → second entry gets id suffix `#2` (e.g. `n:פועל#2`).
  - Verbs: infinitive + 4 present forms only. Past/future forms of להיות exist as `x` entries; full past/future drills are a roadmap item.
- Vowel marks: `data/src/nikkud/*.txt`, positional per entry, validated letter by letter by `npm run data`.
  Used for audio ONLY where the spelling is ambiguous (HOMOGRAPHS in `scripts/build-data.mjs` + same spelling with 2+ readings in the data);
  Azure reads plain unambiguous words more naturally (vowel marks shift stress). When adding words that share a spelling with an existing one, add nikkud lines for both.
- Audio: Azure TTS `he-IL-HilaNeural`, region `germanywestcentral` (key injected by the cloud proxy: `NODE_USE_ENV_PROXY=1 npm run audio`; F0 tier is rate-limited, re-run until done – existing files are skipped, unused ones removed).
  Key = FNV-1a hash of the exact text the app plays (`audioKey` in `src/audio.js` and `scripts/generate-audio.mjs` must match).
  Check tools: `scripts/check-pronunciation.mjs` + `scripts/compare-pronunciation.py`. The learner can flag audio in the app (Settings shows the list).
  Wikimedia/Wiktionary refuses requests from cloud sessions (429).
- Card ids are `${type}:${hebrew}|${kind}`; renaming a Hebrew headword resets its progress.
- Hosting: Netlify (private GitHub repo), config in `netlify.toml`, deploys on push to main.
- Before pushing: `npm run build` and test at iPhone size with Playwright.
- Roadmap: past/future tense drills, sync between devices, native-speaker review of audio.
