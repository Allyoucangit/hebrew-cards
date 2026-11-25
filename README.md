# Hebrew Cards

A personal app for practicing Hebrew vocabulary: the words from Duolingo (units 1–31 so far), with audio, spaced repetition, verb forms, plurals and adjective agreement.

Runs in the browser and can be added to the iPhone home screen (Safari → Share → “Add to Home Screen”). Progress is stored on the device; use Settings → “Save backup file” now and then.

## How it works

- **Words** live in `data/src/*.txt` (one line per word; format at the top of `units01-10.txt`).
  `npm run data` checks them and writes `public/data/words.json`.
- Every word becomes several **cards**: meaning (flip card), listening (multiple choice),
  producing the Hebrew (multiple choice → typing on an in-app Hebrew keyboard once you know it, or 🎤 speaking),
  plus plurals, adjective agreement with a noun, verb present-tense forms and preposition + pronoun forms.
- **Scheduling** uses FSRS (the algorithm modern Anki uses), via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs).
  A word's follow-up cards start the day after you first see it.
- **Audio**: `npm run audio` creates MP3s with Azure Text-to-Speech (`he-IL-HilaNeural`) into `public/audio/`.
  Without them the app uses the device's Hebrew voice (iPhone: Settings → Accessibility → Spoken Content → Voices → Hebrew).
- **Speaking** uses the browser's built-in speech recognition (Safari: needs Siri & Dictation enabled).

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # data + production build into dist/
```
