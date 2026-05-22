// Phonics-first Level 1 source data.
// These entries intentionally teach the beginner sound before the letter name.
export const PHONICS_LEVEL_1 = [
  sound(1, 'm', '/m/', 'm', 'moon', 'mmm', 'Lips together. Hum through your nose.'),
  sound(1, 's', '/s/', 's', 'sun', 'sss', 'Teeth close. Air slides out like a snake.'),
  sound(1, 'a', '/ă/', 'æ', 'apple', 'short a', 'Mouth open wide. Tongue low.'),
  sound(1, 't', '/t/', 't', 'turtle', 't', 'Tongue taps behind your teeth.'),
  sound(1, 'p', '/p/', 'p', 'pig', 'p', 'Lips together. Quiet pop.'),
  sound(2, 'c', '/k/', 'k', 'cat', 'k', 'Back of tongue jumps up.'),
  sound(2, 'r', '/r/', 'ɹ', 'rainbow', 'rrr', 'Lift your tongue a little. Keep the sound warm.'),
  sound(2, 'n', '/n/', 'n', 'nose', 'nnn', 'Tongue touches up. Hum through your nose.'),
  sound(2, 'd', '/d/', 'd', 'dog', 'd', 'Tongue taps and pops down.'),
  sound(2, 'i', '/ĭ/', 'ɪ', 'igloo', 'short i', 'Small smile. Tongue high.'),
  sound(3, 'f', '/f/', 'f', 'fish', 'fff', 'Top teeth touch bottom lip. Blow.'),
  sound(3, 'b', '/b/', 'b', 'ball', 'b', 'Lips together, then pop them open.'),
  sound(3, 'h', '/h/', 'h', 'hat', 'h', 'Open mouth. Soft breath out.'),
  sound(3, 'g', '/g/', 'g', 'goat', 'g', 'Back of tongue jumps up with voice.'),
  sound(3, 'o', '/ŏ/', 'ɑ', 'octopus', 'short o', 'Mouth open round. Tongue low.'),
  sound(4, 'l', '/l/', 'l', 'leaf', 'lll', 'Tongue touches behind your teeth.'),
  sound(4, 'k', '/k/', 'k', 'kite', 'k', 'Back of tongue jumps up.'),
  sound(4, 'e', '/ĕ/', 'ɛ', 'egg', 'short e', 'Mouth open a little. Smile softly.'),
  sound(4, 'u', '/ŭ/', 'ʌ', 'umbrella', 'short u', 'Mouth relaxed. Tongue in the middle.'),
  sound(4, 'w', '/w/', 'w', 'whale', 'www', 'Round your lips, then open.'),
  sound(5, 'j', '/j/', 'dʒ', 'jam', 'j', 'Lips forward. Tongue pops into the sound.'),
  sound(5, 'y', '/y/', 'j', 'yak', 'yyy', 'Smile and slide into the sound.'),
  sound(5, 'v', '/v/', 'v', 'van', 'vvv', 'Top teeth touch bottom lip. Turn your voice on.'),
  sound(5, 'z', '/z/', 'z', 'zebra', 'zzz', 'Teeth close. Buzz the air out.'),
  sound(5, 'q', '/kw/', 'kw', 'queen', 'qu', 'Round lips for k-w together.'),
  sound(5, 'x', '/ks/', 'ks', 'fox', 'ks', 'Make k then s at the end of fox.'),
]

function sound(lessonGroup, letter, primarySoundLabel, ipa, exampleWord, spokenSound, mouthCue) {
  const uppercase = letter.toUpperCase()
  const lowercase = letter.toLowerCase()
  const isVowel = ['a', 'e', 'i', 'o', 'u'].includes(lowercase)
  return {
    id: `letter-${lowercase}`,
    type: 'letter',
    displayText: `${uppercase} ${lowercase}`,
    uppercase,
    lowercase,
    sound: primarySoundLabel,
    primarySoundLabel,
    ipa,
    exampleWord,
    image: `images/${exampleWord}.png`,
    audio: `audio/letters/phonics-v2/${lowercase}-sound.mp3`,
    speechCue: `${spokenSound} like ${exampleWord}`,
    ttsText: `This is the ${spokenSound} sound, as in ${exampleWord}.`,
    ssmlSound: `<phoneme alphabet="ipa" ph="${ipa}">${spokenSound}</phoneme>`,
    mouthCue,
    avoidTtsLetterName: true,
    category: isVowel ? 'vowels' : 'consonants',
    difficulty: 1,
    lessonGroup,
  }
}
