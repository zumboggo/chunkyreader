# Chunky Reader

Chunky Reader is a cute, low-friction reading and pre-reading app for young children. It was built from the Chunky Chinese Vite/React app shape: a static web app, bundled deck assets under `public/`, CSV/manifest-based clip packs, and three simple learning flows.

## What Was Reused From Chunky Chinese

- React + Vite build setup.
- Public `clip-packs/` deck layout.
- `vocab.csv` plus `clips_manifest.json` as a reusable pack format.
- The three learning-mode ids from the original app are preserved internally:
  - `listeningMode` -> Explore
  - `activeRecall` -> Practice
  - `readerMode` -> Quiz

The original Chunky Chinese project was not modified. This app is in `C:\Users\LENOVO\Documents\New project`.

## Current Decks

Decks are registered in `public/decks/index.json`.

- Anna: `public/clip-packs/annas-reading-deck`
- Sarah Level 1: `public/decks/sarah-letters-level-1.json`
- Sarah Level 2: `public/decks/sarah-phonemes-level-2.json`

Sarah's sound model is documented as General American English.

## Adding Anna Word Cards

Anna's first deck uses the existing Chunky clip-pack format.

Edit:

- `public/clip-packs/annas-reading-deck/vocab.csv`
- `public/clip-packs/annas-reading-deck/clips_manifest.json`

Recommended CSV columns:

```csv
word,meaning,status,lessonNumber,tags,partOfSpeech,audioWordFilename,audioMeaningFilename,pinyin,source,notes,image,exampleSentence,category,difficulty
cat,cat,new,1,reading;Anna,,audio/words/cat.mp3,audio/words/cat.mp3,,Anna's Reading Deck,,images/cat.png,The cat is sleeping.,animals,1
```

Images should go in:

```text
public/clip-packs/annas-reading-deck/images/<word-slug>.png
```

Audio should go in:

```text
public/clip-packs/annas-reading-deck/audio/words/<word>.mp3
```

If an image or audio file is missing, the app shows a friendly placeholder and falls back to browser speech where possible.

## Adding Sarah Letter Cards

Edit `public/decks/sarah-letters-level-1.json`.

Letter card shape:

```json
{
  "id": "letter-b",
  "type": "letter",
  "displayText": "B b",
  "uppercase": "B",
  "lowercase": "b",
  "sound": "/b/",
  "exampleWord": "ball",
  "image": "images/ball.png",
  "mouthImage": "mouths/b.png",
  "audio": "audio/letters/b-sound.mp3",
  "letterNameAudio": "audio/letters/b-name.mp3",
  "speechCue": "b, ball",
  "category": "consonants",
  "difficulty": 1
}
```

Sarah Level 1 assets default to:

```text
public/decks/sarah-levels/images/
public/decks/sarah-levels/mouths/
public/decks/sarah-levels/audio/letters/
```

## Adding Sarah Phoneme Cards

Edit `public/decks/sarah-phonemes-level-2.json`.

Phoneme card shape:

```json
{
  "id": "phoneme-sh",
  "type": "phoneme",
  "displayText": "sh",
  "phoneme": "/ʃ/",
  "grapheme": "sh",
  "exampleWord": "shoe",
  "image": "images/shoe.png",
  "mouthImage": "mouths/sh.png",
  "audio": "audio/phonemes/sh.mp3",
  "exampleAudio": "audio/words/shoe.mp3",
  "speechCue": "sh, shoe",
  "category": "digraphs",
  "difficulty": 1
}
```

Sarah Level 2 assets default to:

```text
public/decks/sarah-levels/images/
public/decks/sarah-levels/mouths/
public/decks/sarah-levels/audio/phonemes/
public/decks/sarah-levels/audio/words/
```

## Adding Another Deck

Add an entry to `public/decks/index.json`.

For a JSON deck:

```json
{
  "id": "new-reading-deck",
  "title": "New Reading Deck",
  "description": "Simple words with pictures.",
  "type": "reading-words",
  "profile": "anna",
  "format": "json",
  "source": "decks/new-reading-deck.json",
  "language": "en-US"
}
```

For an existing Chunky Chinese-style pack:

```json
{
  "id": "my-chinese-pack",
  "title": "My Chinese Pack",
  "description": "Chinese vocabulary with audio.",
  "type": "chinese-vocab",
  "profile": "library",
  "format": "chunky-clip-pack",
  "baseUrl": "clip-packs/my-chinese-pack",
  "language": "zh-CN"
}
```

## Commands

```bash
npm install
npm run verify:decks
npm run build
npm run dev
```

On this Windows machine, use `npm.cmd` from PowerShell if script execution policy blocks `npm`.

## Progressive Web App

Chunky Reader includes a small service worker at `public/sw.js` and registers it from `src/registerServiceWorker.ts` in production builds. The PWA manifest lives at `public/manifest.webmanifest`.

The service worker pre-caches the app shell, mascot assets, deck registry, Sarah JSON decks, and Anna's core clip-pack files. Images, mouth illustrations, and audio are cached as the child uses them, so the app becomes more offline-friendly over time.

The expressive panda sheet lives at `public/assets/mascots/mascot-expressions.png`. The app uses it for curious, reading, happy, and try-again states.

For quick QA or sharing a direct path, Chunky Reader supports simple query parameters:

```text
/?profile=anna
/?profile=sarah&mode=activeRecall
```

For GitHub Pages builds, run:

```bash
$env:GITHUB_PAGES='true'; npm.cmd run build
```

That uses the `/chunkyreader/` base path configured in `vite.config.ts`.

The repository also includes `.github/workflows/pages.yml`, which verifies decks and builds the app for GitHub Pages on pushes to `main`. The deploy job runs when the repository is public; private-repo Pages requires a GitHub plan that supports it. In GitHub, set Pages to use GitHub Actions if you want the hosted PWA URL.
