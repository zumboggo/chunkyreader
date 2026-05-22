# Chunky Reader

Chunky Reader is a cute, low-friction reading and pre-reading app for young children. It was built from the Chunky Chinese Vite/React app shape: a static web app, bundled deck assets under `public/`, CSV/manifest-based clip packs, and three simple learning flows.

The app follows the Chunky Chinese pocket-lesson rhythm: 4-minute lessons, 5 cards at a time, audio-first introductions, and no more than two answer choices on screen.

Earliest Reader Level 1 uses a phonics-first order instead of alphabetical order: `m s a t p`, `c r n d i`, `f b h g o`, `l k e u w`, then a final tricky-sounds review with `j y v z q x`. Each group turns into a richer activity sequence with listen-and-look intros, sound-to-letter questions, uppercase/lowercase matches, beginning-sound picture questions, and mixed review questions.

## What Was Reused From Chunky Chinese

- React + Vite build setup.
- Public `clip-packs/` deck layout.
- `vocab.csv` plus `clips_manifest.json` as a reusable pack format.
- The three learning-mode ids from the original app are preserved internally:
  - `listeningMode` -> Explore
  - `activeRecall` -> Practice
  - `readerMode` -> Quiz

The original Chunky Chinese project was not modified. This app is in `C:\Users\LENOVO\Documents\New project`.

## Current Decks And Stories

Decks are registered in `public/decks/index.json`.

- Growing Reader words: `public/clip-packs/annas-reading-deck`
- Growing Reader Anne stories: `public/stories/anne-stories.json`
- Earliest Reader Level 1: `public/decks/sarah-letters-level-1.json`
- Earliest Reader Level 2: `public/decks/sarah-phonemes-level-2.json`

Earliest Reader's sound model is documented as General American English.

## Adding Growing Reader Word Cards

Growing Reader's first word deck uses the existing Chunky clip-pack format.

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

## Adding Growing Reader Stories

Anne story content lives in `public/stories/anne-stories.json`. Each story has exactly three pages with text, image path, image prompt, negative prompt, and alt text.

Story page images should go in:

```text
public/stories/anne/images/<story-id>-page-<page-number>.webp
```

Future read-aloud audio can go in:

```text
public/stories/anne/audio/<story-id>-page-<page-number>.mp3
```

The app resolves story image paths through the Vite base URL, so JSON should use public-relative paths such as:

```json
"image": "stories/anne/images/anne-red-hat-page-1.webp"
```

Missing story illustrations show a storybook-style placeholder instead of breaking the reader.

## Adding Earliest Reader Letter Cards

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
  "audio": "audio/letters/b-sound.mp3",
  "letterNameAudio": "audio/letters/b-name.mp3",
  "speechCue": "b, ball",
  "category": "consonants",
  "difficulty": 1
}
```

Earliest Reader Level 1 assets default to:

```text
public/decks/sarah-levels/images/
public/decks/sarah-levels/audio/letters/
public/decks/sarah-levels/ssml/audio/letters/
```

## Adding Earliest Reader Phoneme Cards

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
  "audio": "audio/phonemes/sh.mp3",
  "exampleAudio": "audio/words/shoe.mp3",
  "speechCue": "sh, shoe",
  "category": "digraphs",
  "difficulty": 1
}
```

Earliest Reader Level 2 assets default to:

```text
public/decks/sarah-levels/images/
public/decks/sarah-levels/audio/phonemes/
public/decks/sarah-levels/audio/words/
public/decks/sarah-levels/ssml/audio/phonemes/
public/decks/sarah-levels/ssml/audio/words/
```

## Generating And Installing Audio

Earliest Reader sounds, Older Reader story narration, and short kid-facing UI prompts are generated through Azure TTS. Each logical text unit gets a stable clip id in `public/clip-packs/chunky-reader-audio/clips_manifest.json`; story pages use ids like `story:anne-red-hat:page:1`, and reusable prompts use ids like `older-reader:prompt:pictureToWord`.

```bash
npm run generate:audio
```

The generator reads `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`, or the local Azure config file at `C:\Users\LENOVO\Documents\azure-tts-ssml\config.json`. Do not commit or paste Azure credentials.

Generated files are written to:

```text
public/decks/sarah-levels/audio/
public/decks/sarah-levels/ssml/
public/clip-packs/chunky-reader-audio/audio/narration/
public/clip-packs/chunky-reader-audio/ssml/audio/narration/
public/clip-packs/chunky-reader-audio/clips_manifest.json
```

In the PWA, tap **Save Audio** from the story screen or lesson menu to install the clip pack. The app reads the manifest, downloads each MP3 once, and stores the responses in Cache Storage under `chunky-audio-pack-v1`. That cache is intentionally separate from the service worker's app-shell caches, so normal PWA updates should not remove installed narration. If a clip is missing, the app keeps working and falls back to text/browser speech where possible.

To update audio after text changes, run `npm run generate:audio` again. Existing MP3 files are skipped unless you pass `--force`:

```bash
node scripts/generate-azure-reading-clips.mjs --force
```

## Generating Earliest Reader Images

New generated deck images should go through Replicate FLUX Schnell first.

```bash
$env:REPLICATE_API_TOKEN='your-token'
npm run generate:letter-images
```

By default this creates the first 10 Earliest Reader letter-word images in `public/decks/sarah-levels/images/` and writes `replicate-flux-schnell-test-manifest.json` beside them. Set `LETTER_IMAGE_COUNT=26` to generate the whole alphabet; existing images are kept unless you pass `--force`. Do not commit or paste Replicate credentials.

## Generating Anne Story Images

Anne story illustrations use Replicate FLUX Schnell. Put the token in your environment, never in committed files.

```bash
$env:REPLICATE_API_TOKEN='your-token'
npm run generate:story-images:dry
npm run generate:story-images:test
npm run generate:story-images
```

Useful options:

```bash
node scripts/generate-story-images.mjs --story anne-red-hat
node scripts/generate-story-images.mjs --limit 2
node scripts/generate-story-images.mjs --force
node scripts/generate-story-images.mjs --dry-run
```

Generated files are saved to `public/stories/anne/images/`. Existing images are skipped unless `--force` is passed.

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
npm run verify:stories
npm run generate:story-images:dry
npm run generate:audio
npm run build
npm run dev
```

On this Windows machine, use `npm.cmd` from PowerShell if script execution policy blocks `npm`.

## Progressive Web App

Chunky Reader includes a small service worker at `public/sw.js` and registers it from `src/registerServiceWorker.ts` in production builds. The PWA manifest lives at `public/manifest.webmanifest`.

The service worker pre-caches the app shell, mascot/profile assets, deck registry, Earliest Reader JSON decks, Anne story registry, and Growing Reader's core clip-pack files. Images and audio are cached as the child uses them, so the app becomes more offline-friendly over time.

The expressive panda sheet lives at `public/assets/mascots/mascot-expressions.png`. The app uses it for curious, reading, happy, and try-again states.

For quick QA or sharing a direct path, Chunky Reader supports simple query parameters:

```text
/?profile=anna
/?profile=anna&stories=true
/?profile=sarah&mode=activeRecall
```

For GitHub Pages builds, run:

```bash
$env:GITHUB_PAGES='true'; npm.cmd run build
```

That uses the `/chunkyreader/` base path configured in `vite.config.ts`.

## Layout QA

Before deploying layout changes, use `LAYOUT_CHECKLIST.md`. The short version: keep body scrolling available, prefer `min-height: 100dvh` over fixed viewport heights, add `min-height: 0` to shrinking flex/grid children, and test 390x844, 360x740, 412x915, 768x1024, 1366x768, and 1920x1080.

The repository also includes `.github/workflows/pages.yml`, which verifies decks and builds the app for GitHub Pages on pushes to `main`. The deploy job runs when the repository is public; private-repo Pages requires a GitHub plan that supports it. In GitHub, set Pages to use GitHub Actions if you want the hosted PWA URL.
