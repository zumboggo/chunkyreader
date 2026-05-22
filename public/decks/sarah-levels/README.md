# Sarah Level Assets

This folder is the default asset base for Sarah's letter and phoneme decks.

Place future files here:

- Example pictures: `images/<example-word>.png`
- Level 1 phonics audio: `audio/letters/phonics-v2/<letter>-sound.mp3`
- Phoneme audio: `audio/phonemes/<sound-id>.mp3`
- Example word audio: `audio/words/<word>.mp3`
- Generated SSML: `ssml/audio/<type>/<clip>.ssml`

Level 1 teaches letter sounds before letter names. Do not add `letterNameAudio`
to Level 1 cards unless the learning flow is intentionally changed later.

The app keeps working when these files are missing. It shows a friendly placeholder and falls back to browser speech when possible.
