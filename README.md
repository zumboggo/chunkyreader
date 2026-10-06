# Chunky Learner

Chunky Learner is a cute, low-friction learning and reading app for young children. It was built from the Chunky Chinese Vite/React app shape: a static web app, bundled deck assets under `public/`, CSV/manifest-based clip packs, and a shared section-based lesson engine.

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

## Parent Cloud Sync

Parent Settings includes optional Supabase login so progress can follow a child across devices. It reuses the ChunkyChineseVocab Supabase project by default, and can also be pointed at another project with:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Before using sync in a fresh Supabase project, run `supabase-reader-sync-schema.sql` in the Supabase SQL editor. The synced payload is one per-user JSON snapshot containing parent settings, lesson counters, Sarah letter position, Growing Reader card review state, story page positions, 100 Lessons progress, continue-state, and Panda Box reward progress. Audio and image assets are not uploaded.

## Current Decks And Stories

Decks are registered in `public/decks/index.json`.

- Growing Reader words: `public/clip-packs/annas-reading-deck`
- Growing Reader stories: `public/stories/anne-stories.json`
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
cat,cat,new,1,reading;Anna,,audio/words/anne-soft-female-v2/cat.mp3,audio/words/anne-soft-female-v2/cat.mp3,,Anna's Reading Deck,,images/cat.png,The cat is sleeping.,animals,1
```

Images should go in:

```text
public/clip-packs/annas-reading-deck/images/<word-slug>.png
```

Audio should go in:

```text
public/clip-packs/annas-reading-deck/audio/words/anne-soft-female-v2/<word-slug>.mp3
```

Growing Reader word clips use the same soft Jenny Neural voice as the Anne stories. Regenerate the word MP3s and update `vocab.csv`/`clips_manifest.json` with:

```bash
npm run generate:word-audio -- --force
```

If an image or audio file is missing, the app shows a friendly placeholder and falls back to browser speech where possible.

## Adding Growing Reader Stories

Growing Reader story content lives in `public/stories/anne-stories.json`. Early-reader stories have exactly three pages with text, image path, image prompt, negative prompt, and alt text. Older Reader stories can be longer, and PDF-imported stories can use extracted page images instead of image-generation prompts.

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

## Importing PDF Stories

Use the local importer to turn a PDF into normal Older Reader story pages with extracted text, rendered page images, and Azure narration paths. The original PDF is not committed.

```bash
npm run import:pdf-story:dry -- --pdf "C:\Users\LENOVO\Downloads\The Lava Girls' Tropical Adventure.pdf" --story-id lava-girls-tropical-adventure --title "The Lava Girls' Tropical Adventure"
npm run import:pdf-story -- --pdf "C:\Users\LENOVO\Downloads\The Lava Girls' Tropical Adventure.pdf" --story-id lava-girls-tropical-adventure --title "The Lava Girls' Tropical Adventure" --force
npm run generate:audio
```

The importer renders optimized WebP images into:

```text
public/stories/pdf/<story-id>/images/
```

It writes a source manifest and OCR review file beside the images:

```text
public/stories/pdf/<story-id>/source-manifest.json
public/stories/pdf/<story-id>/review-text.json
```

Review the extracted text before forcing audio regeneration if OCR confidence looks low or a word looks odd. The importer supports `--page-mode auto-pair|each-page`, `--ocr` to force OCR even when a text layer exists, `--dry-run`, and `--force`.

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
  "primarySoundLabel": "/b/",
  "ipa": "b",
  "exampleWord": "ball",
  "image": "images/ball.png",
  "audio": "audio/letters/phonics-v2/b-sound.mp3",
  "speechCue": "b like ball",
  "ttsText": "This is the b sound, as in ball.",
  "ssmlSound": "<phoneme alphabet=\"ipa\" ph=\"b\">b</phoneme>",
  "mouthCue": "Lips together, then pop them open.",
  "avoidTtsLetterName": true,
  "category": "consonants",
  "difficulty": 1
}
```

Level 1 is phonics-first: the app teaches the sound before the letter name. Do not send bare letters such as `A` or `B` to TTS for Level 1 sound clips; use the centralized phonics data in `scripts/phonics-level-1.mjs` and regenerate with `npm run generate:audio -- --force`.

Earliest Reader Level 1 assets default to:

```text
public/decks/sarah-levels/images/
public/decks/sarah-levels/audio/letters/phonics-v2/
public/decks/sarah-levels/ssml/audio/letters/phonics-v2/
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

Voice settings are centralized in `scripts/tts-config.mjs`. Anne story narration currently uses `en-US-JennyNeural` with the `anne-soft-female-v2` voice version, so story MP3s are written under `audio/narration/stories/anne-soft-female-v2/` and do not reuse older narrator URLs.

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

In the PWA, tap **Save Audio** from the story screen or lesson menu to install the clip pack. The app reads the manifest, downloads each MP3 once, and stores the responses in Cache Storage under `chunky-audio-pack-v2`. That cache is intentionally separate from the service worker's app-shell caches, so normal PWA updates should not remove installed narration. If a clip is missing, the app keeps working and falls back to text/browser speech where possible.

To update audio after text changes, run `npm run generate:audio` again. Existing MP3 files are skipped unless you pass `--force`:

```bash
node scripts/generate-azure-reading-clips.mjs --force
```

For SSML-only inspection and phonics validation:

```bash
npm run generate:audio:ssml
npm run validate:phonics-audio
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

### Generate story covers with Google Flash

Story-library covers are portrait, text-free illustrations. Titles and reading details are rendered by the app so they stay crisp and accessible.

```powershell
npm run generate:story-covers:dry
npm run generate:story-covers:test
npm run generate:story-covers
```

Set either `GEMINI_API_KEY` for Google AI Studio, or set `GOOGLE_APPLICATION_CREDENTIALS`,
`GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION` for Vertex AI. The default model is
`gemini-3.1-flash-image-preview`; override it with `GOOGLE_IMAGE_MODEL`.

The generator supports `--story story-id`, `--limit N`, and `--force`. It stores optimized
WebP covers in `public/stories/covers/` and updates each story's `coverImage` and `coverPrompt`.

Useful options:

```bash
node scripts/generate-story-images.mjs --story anne-red-hat
node scripts/generate-story-images.mjs --limit 2
node scripts/generate-story-images.mjs --force
node scripts/generate-story-images.mjs --dry-run
```

Generated files are saved to `public/stories/anne/images/`. Existing images are skipped unless `--force` is passed.

## Sarah Letter Shape Cards

Sarah's mnemonic alphabet-card data lives in `public/decks/sarah-letter-images.json`. Each card keeps the AI-generated background separate from the teaching letter:

- backgrounds: `public/decks/sarah-letter-images/backgrounds/`
- final composited cards: `public/decks/sarah-letter-images/final/`

Generate background illustrations with Replicate / Ideogram 3 Balanced:

```bash
npm run generate:letter-backgrounds:dry
npm run generate:letter-backgrounds:test
npm run generate:letter-backgrounds
```

Then overlay the large black teaching letters in code:

```bash
npm run composite:letter-cards
npm run verify:letter-images -- --require-files
```

The background prompt should never ask the image model to render the instructional letter. Add new cards by copying an existing entry in `public/decks/sarah-letter-images.json`, changing `letter`, `keyword`, paths, prompt, alt text, and `overlay.text`.

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
npm run verify:letter-images
npm run generate:story-images:dry
npm run generate:audio
npm run build
npm run dev
```

On this Windows machine, use `npm.cmd` from PowerShell if script execution policy blocks `npm`.

## Progressive Web App

Chunky Learner includes a small service worker at `public/sw.js` and registers it from `src/registerServiceWorker.ts` in production builds. The PWA manifest lives at `public/manifest.webmanifest`.

The service worker pre-caches the app shell, mascot/profile assets, deck registry, Earliest Reader JSON decks, Anne story registry, and Growing Reader's core clip-pack files. Images and audio are cached as the child uses them, so the app becomes more offline-friendly over time.

The expressive panda sheet lives at `public/assets/mascots/mascot-expressions.png`. The app uses it for curious, reading, happy, and try-again states.

For quick QA or sharing a direct path, Chunky Learner supports simple query parameters:

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

### Guided Words: 24 lessons and practice attempts

The built-in Growing Reader curriculum is in `src/content/guided-words.json`. Lessons 1–14 retain their numbers and content; 15–24 add ck, doubled endings, silent-e vowels, ee, ai, oa, and mixed reviews. Every pocket has four targets, two sentence variants, word meanings, and an oral meaning prompt. The code constructs 12 activities, or 13 with one previously taught due review word: welcome/helpers, optional quiet review, four combined models, two sound-by-sound spelling tasks, four shuffled quiet word checks, and one parent-confirmed sentence. Help and self-reports are practice records, never mastery scores.

`ReadingWord.sounds` explicitly maps each phoneme to spelling positions. For `cake`, the long-a unit covers positions 1 and 3; the ending e is not sounded separately. Doubled consonants share a single phoneme. `parts` is separate syllable/morpheme scaffolding, not a source for guessing pronunciation. The selected US-English pronunciations include schwa in cactus/velvet and /ɔ/ in moth/long/song; regional vowel variants are normal. Sentence transfer words use prerequisite short vowels or patterns already introduced, including plate after a_e. Function words a, an, can, is, and has have explicit support and pronunciation directions.

Version 3 cached plans include a unique attempt ID, stable shuffled checks, results, current activity, and whether help has already been used. Obsolete plans are rebuilt while history remains intact. Completed lesson IDs continue to gate first-completion rewards; a new replay attempt updates review dates and sentence records. The selected lesson is stored separately from legacy progress. Cache compaction keeps the most recently used guided plans, including early-lesson replays.

At David's request, new recordings use Replicate's `google/gemini-3.1-flash-tts`, Sulafat voice, `en-US`; earlier verified Azure word and phoneme clips are reused. New audio has saved model inputs and retained SSML regeneration sources. `generate-guided-audio.mjs` prepares the Azure SSML and catalog; `generate-guided-replicate-audio.mjs` fills missing clips using `REPLICATE_API_TOKEN` or `~/.claude/replicate-token` without logging credentials. `measure-guided-vowels.mjs` measures the first phoneme in the existing double-pronunciation clips. `package-guided-audio.mjs` produces compact AAC with macOS afconvert and a checksum manifest; lossless WAVs stay untracked. New compact clips are bundled under `public/guided-words/` because the local Supabase CLI has no authenticated upload session. The downloadable audio pack includes them. Isolated spellings never fall back to browser letter-name speech; failed audio offers retry.

Research-informed critique and remaining limits:

- **Sound–spelling precision:** spelling-based sound guessing was unsuitable for silent e, doubled consonants, and unstressed syllables. Explicit mappings connect the actual sounds with letters. This applies Ehri's account of orthographic mapping; it is not an endorsement of this app or proof of this exact lesson order. [Ehri (2022), What Teachers Need to Know and Do to Teach Letter–Sounds, Phonemic Awareness, Word Reading, and Phonics](https://ila.onlinelibrary.wiley.com/doi/10.1002/trtr.2095).
- **Practice after modeling:** a combined model saves time for spelling and delayed, shuffled checks. Spelling now requires each sound–spelling connection and a fresh attempt after feedback. Two choices remain useful scaffolding, so neither spelling accuracy nor a child's “I knew it” establishes independent reading proficiency. Genuine retention needs observations across days and settings.
- **Review and measurement:** one due word supplements rather than replaces the four targets. Helped words receive priority, review happens before modeling, and deliberate replays update practice without awarding the same lesson reward again. This improves the implementation's evidence quality; the chosen 1/3/7-day intervals are pragmatic, not a validated prescription for every child.
- **Connected reading and meaning:** short, mostly decodable sentences, explicit function-word support, and a same-screen oral meaning question connect word reading to understanding. The IES guide recommends daily connected-text reading alongside foundational skills. One app sentence is a supplement to shared reading and conversation, not a full reading program. [IES foundational-skills practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/21/).
- **Decodability has limits:** controlled text gives children opportunities to apply taught patterns, but it should not exclude richer language, knowledge, stories, or adult read-alouds. The exact amount of decodable text and the best sequence are not uniquely settled by the evidence. [Shanahan on decodable text](https://www.shanahanonliteracy.com/blog/should-we-teach-with-decodable-text).

Verify with `npm run verify:word-completion`, `npm run verify:guided-audio`, `npm run verify:accounts`, `node scripts/verify-controller.mjs`, `npm run verify:media`, `npm run verify:offline`, `npm run validate:phonics-audio`, `npm run build`, and `npm run lint`. Synthetic-audio transcript QA is available via `node scripts/audit-guided-recordings.mjs`; it is a generation check, not speech recognition in the child's learning flow.

Verification notes for the 24-lesson release: browser walkthroughs covered helped/independent completion, 14→15, 23→24, 24→1, alternate sentences on replay, assisted checks after reload, corrective spelling retries, and the a_e positions in cake. Words now keeps earned boxes in the reward inventory without putting a reward-navigation notice over lesson controls. Layout checks at 390×844 and 844×390 found no horizontal overflow; Words supports both orientations. Recorded narration plus an estimated 8–10 seconds per quiet word, 2–3 seconds per spelling choice, and 30–40 seconds for the parent finale puts a typical visit around 3–4 minutes. This is a pacing estimate, not a measured child-performance claim; no countdown is imposed.
