# Chunky Reader Agent Notes

Chunky Reader is a small, joyful reading app for young children. Keep it close to the Chunky Chinese flow: short lessons, audio-first cards, simple prompts, and very low friction.

## Learning Flow Rules

- Keep lessons to 4 minutes or less.
- Show only 5 words, letters, or sounds in a lesson pocket.
- Keep a maximum of two choices visible at any time.
- Always let the child hear and see the answer before any question.
- Autoplay audio every time a new word, letter, or sound is introduced.
- Questions should reinforce what was just shown, not ask the child to hold a lot in memory.
- Keep navigation obvious and child-sized. Avoid settings-heavy or LMS-style screens.

## Content Rules

- Anna uses image-backed word reading cards.
- Sarah uses Level 1 letters and Level 2 reading sounds.
- Do not add mouth-shape or articulation-vector UI. It was removed because the vector cues were not useful enough for this app.
- Missing images or audio must fall back gracefully.
- Future decks should stay reusable across English reading decks, phonics decks, audio-assisted decks, and the original Chinese vocabulary style.

## Audio Rules

- Prefer downloadable clip-pack style audio over relying on browser speech.
- Generate Sarah audio with Azure TTS SSML using `npm run generate:audio`.
- The generator reads credentials from environment variables or the local Azure config file, but credentials must never be committed, logged, copied into docs, or exposed in output.
- Keep SSML files with the generated audio so clips can be regenerated later.

## Visual Rules

- The opening page uses Anna and Sarah profile art in `public/assets/profiles/`.
- Preserve the cute, kawaii, pastel, phone-first direction.
- The panda mascot should feel expressive and respond to learning state: happy for success, sad for retry, curious for questions, reading/listening for guidance.
- Prefer Replicate FLUX Schnell for new generated deck images before trying another image source. Use `npm run generate:letter-images` with `REPLICATE_API_TOKEN` set in the environment. Never commit or print Replicate API tokens.
