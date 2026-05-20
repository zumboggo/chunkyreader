# Sarah Level Assets

This folder is the default asset base for Sarah's letter and phoneme decks.

Place future files here:

- Example pictures: `images/<example-word>.png`
- Letter audio: `audio/letters/<letter>-sound.mp3`
- Letter name audio: `audio/letters/<letter>-name.mp3`
- Phoneme audio: `audio/phonemes/<sound-id>.mp3`
- Example word audio: `audio/words/<word>.mp3`
- Generated SSML: `ssml/audio/<type>/<clip>.ssml`

The app keeps working when these files are missing. It shows a friendly placeholder and falls back to browser speech when possible.
