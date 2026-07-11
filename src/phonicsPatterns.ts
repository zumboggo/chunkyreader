// Explicitly taught sound-spelling patterns for the Words section.
//
// Every "chunk" question in Word Mode must come from this registry — never
// from arbitrary letter slices — so Anna is only ever quizzed on patterns
// that were explicitly introduced with their sound first. The array order IS
// the teaching order (simple short-vowel families → digraphs → silent-e
// families → vowel teams → r-controlled → diphthongs).

export interface PhonicsPattern {
  id: string
  /** Letters shown to the child, e.g. "at", "sh", "ake". */
  grapheme: string
  /** Family patterns match at the END of a word; digraphs match anywhere. */
  kind: 'family' | 'digraph'
  /** What the sound "says", written for TTS fallback, e.g. "aaat", "shh". */
  soundTts: string
  /** Short child-facing cue shown under the pattern tile. */
  cue: string
  /** Deck words that carry this pattern (used for teaching examples). */
  teachWords: string[]
  /** Optional word chain for tile-building play, e.g. cat → hat → bat. */
  chain?: string[]
  /** Tiny decodable payoff sentence that uses the pattern. */
  sentence: string
  /**
   * For ambiguous graphemes (the two /oo/ sounds), restrict matching to this
   * explicit word list instead of matching by position alone.
   */
  onlyWords?: string[]
}

// Words that do not follow the patterns Anna is taught (or not yet). They are
// learned "by heart" through listening questions and sentences, and must never
// be forced into pattern/chunk questions.
export const HEART_WORDS = new Set([
  'a', 'i', 'the', 'are', 'you', 'they', 'there', 'here', 'anywhere',
  'would', 'could', 'should', 'said', 'was', 'one', 'two', 'of', 'to', 'do',
  'want', 'some', 'come', 'your', 'what', 'who',
])

export const PHONICS_PATTERNS: PhonicsPattern[] = [
  // --- Short a families ---
  { id: 'at', grapheme: 'at', kind: 'family', soundTts: 'at', cue: 'at like cat', teachWords: ['cat', 'hat', 'sat', 'bat', 'rat'], chain: ['cat', 'hat', 'rat', 'bat'], sentence: 'The cat sat on a hat.' },
  { id: 'an', grapheme: 'an', kind: 'family', soundTts: 'an', cue: 'an like pan', teachWords: ['ran', 'tan', 'pan', 'van'], chain: ['ran', 'tan', 'pan'], sentence: 'The van is tan.' },
  { id: 'ap', grapheme: 'ap', kind: 'family', soundTts: 'ap', cue: 'ap like map', teachWords: ['map', 'nap', 'lap', 'gap', 'sap'], chain: ['map', 'nap', 'lap'], sentence: 'A nap on my lap.' },
  { id: 'ad', grapheme: 'ad', kind: 'family', soundTts: 'ad', cue: 'ad like dad', teachWords: ['dad', 'mad', 'bad', 'had'], chain: ['dad', 'mad', 'bad'], sentence: 'Dad is not mad.' },
  { id: 'am', grapheme: 'am', kind: 'family', soundTts: 'am', cue: 'am like ham', teachWords: ['ham', 'sam', 'swam'], chain: ['ham', 'sam'], sentence: 'Sam has the ham.' },
  { id: 'ag', grapheme: 'ag', kind: 'family', soundTts: 'ag', cue: 'ag like bag', teachWords: ['bag', 'flag', 'brag', 'drag'], sentence: 'The flag is in the bag.' },
  // --- Short i families ---
  { id: 'it', grapheme: 'it', kind: 'family', soundTts: 'it', cue: 'it like sit', teachWords: ['sit', 'bit', 'hit', 'kit'], chain: ['sit', 'bit', 'hit'], sentence: 'I sit a bit.' },
  { id: 'ig', grapheme: 'ig', kind: 'family', soundTts: 'ig', cue: 'ig like pig', teachWords: ['big', 'dig', 'pig', 'wig'], chain: ['big', 'dig', 'pig'], sentence: 'The pig is big.' },
  { id: 'in', grapheme: 'in', kind: 'family', soundTts: 'in', cue: 'in like pin', teachWords: ['fin', 'pin', 'tin', 'chin', 'skin'], chain: ['pin', 'tin', 'fin'], sentence: 'A pin is in the tin.' },
  { id: 'ip', grapheme: 'ip', kind: 'family', soundTts: 'ip', cue: 'ip like lip', teachWords: ['lip', 'tip', 'sip', 'hip'], chain: ['lip', 'tip', 'sip'], sentence: 'A sip on my lip.' },
  // --- Short o families ---
  { id: 'ot', grapheme: 'ot', kind: 'family', soundTts: 'ot', cue: 'ot like hot', teachWords: ['hot', 'dot', 'got', 'lot', 'cot'], chain: ['hot', 'dot', 'lot'], sentence: 'It is not hot.' },
  { id: 'op', grapheme: 'op', kind: 'family', soundTts: 'op', cue: 'op like top', teachWords: ['hop', 'mop', 'top', 'pop'], chain: ['hop', 'top', 'mop'], sentence: 'Hop on top!' },
  { id: 'ox', grapheme: 'ox', kind: 'family', soundTts: 'ox', cue: 'ox like fox', teachWords: ['box', 'fox'], chain: ['box', 'fox'], sentence: 'A fox is in a box.' },
  // --- Short u families ---
  { id: 'un', grapheme: 'un', kind: 'family', soundTts: 'un', cue: 'un like sun', teachWords: ['sun', 'fun', 'run'], chain: ['sun', 'fun', 'run'], sentence: 'Run in the sun.' },
  { id: 'ug', grapheme: 'ug', kind: 'family', soundTts: 'ug', cue: 'ug like bug', teachWords: ['bug', 'rug', 'mug', 'jug'], chain: ['bug', 'rug', 'mug'], sentence: 'A bug is on the rug.' },
  { id: 'ub', grapheme: 'ub', kind: 'family', soundTts: 'ub', cue: 'ub like tub', teachWords: ['tub', 'cub'], chain: ['tub', 'cub'], sentence: 'A cub is in the tub.' },
  { id: 'up-family', grapheme: 'up', kind: 'family', soundTts: 'up', cue: 'up like cup', teachWords: ['cup', 'pup'], chain: ['cup', 'pup'], sentence: 'The pup has a cup.' },
  { id: 'ud', grapheme: 'ud', kind: 'family', soundTts: 'ud', cue: 'ud like mud', teachWords: ['bud', 'mud'], sentence: 'A bud in the mud.' },
  // --- Short e families ---
  { id: 'et', grapheme: 'et', kind: 'family', soundTts: 'et', cue: 'et like pet', teachWords: ['jet', 'net', 'set', 'wet', 'pet', 'get'], chain: ['jet', 'net', 'pet'], sentence: 'The pet got wet.' },
  { id: 'en', grapheme: 'en', kind: 'family', soundTts: 'en', cue: 'en like hen', teachWords: ['hen', 'ten', 'pen', 'men'], chain: ['hen', 'ten', 'pen'], sentence: 'The hen is in the pen.' },
  { id: 'ed', grapheme: 'ed', kind: 'family', soundTts: 'ed', cue: 'ed like red', teachWords: ['bed', 'red'], chain: ['bed', 'red'], sentence: 'The bed is red.' },
  // --- Digraphs ---
  { id: 'sh', grapheme: 'sh', kind: 'digraph', soundTts: 'shh', cue: 'sh — quiet sound', teachWords: ['shop', 'ship', 'shed', 'fish', 'dish', 'wish'], sentence: 'The fish is in the shop.' },
  { id: 'ch', grapheme: 'ch', kind: 'digraph', soundTts: 'ch', cue: 'ch like chip', teachWords: ['chip', 'chop', 'chin', 'chat', 'much', 'rich'], sentence: 'I chat and chop a chip.' },
  { id: 'th', grapheme: 'th', kind: 'digraph', soundTts: 'th', cue: 'th — tongue tickles', teachWords: ['thin', 'then', 'bath', 'math', 'that', 'them', 'with'], sentence: 'That bath is fun.' },
  { id: 'wh', grapheme: 'wh', kind: 'digraph', soundTts: 'wh', cue: 'wh like when', teachWords: ['when', 'whip', 'whiz'], sentence: 'When did it whiz?' },
  { id: 'ck', grapheme: 'ck', kind: 'family', soundTts: 'k', cue: 'ck like duck', teachWords: ['back', 'duck', 'luck', 'rock', 'sock', 'lock', 'kick', 'pick'], chain: ['rock', 'sock', 'lock'], sentence: 'The duck has a sock.' },
  { id: 'ng', grapheme: 'ng', kind: 'family', soundTts: 'ng', cue: 'ng like ring', teachWords: ['sing', 'ring', 'king', 'wing', 'song', 'long'], chain: ['sing', 'ring', 'king', 'wing'], sentence: 'The king can sing a song.' },
  // --- Silent-e families ---
  { id: 'ake', grapheme: 'ake', kind: 'family', soundTts: 'ake', cue: 'ake like cake', teachWords: ['cake', 'make', 'take', 'lake', 'bake'], chain: ['cake', 'make', 'take'], sentence: 'Make a cake at the lake.' },
  { id: 'ame', grapheme: 'ame', kind: 'family', soundTts: 'aim', cue: 'ame like name', teachWords: ['game', 'name', 'same'], chain: ['game', 'name', 'same'], sentence: 'The game has my name.' },
  { id: 'ike', grapheme: 'ike', kind: 'family', soundTts: 'ike', cue: 'ike like bike', teachWords: ['like', 'bike', 'hike'], chain: ['like', 'bike', 'hike'], sentence: 'I like my bike.' },
  { id: 'ime', grapheme: 'ime', kind: 'family', soundTts: 'ime', cue: 'ime like time', teachWords: ['time', 'lime'], sentence: 'It is time for a lime.' },
  { id: 'ine', grapheme: 'ine', kind: 'family', soundTts: 'ine', cue: 'ine like line', teachWords: ['line', 'pine'], sentence: 'A pine in a line.' },
  { id: 'ide', grapheme: 'ide', kind: 'family', soundTts: 'ide', cue: 'ide like ride', teachWords: ['side', 'ride'], sentence: 'Ride side by side.' },
  { id: 'one', grapheme: 'one', kind: 'family', soundTts: 'own', cue: 'one like bone', teachWords: ['bone', 'cone', 'tone', 'phone'], chain: ['bone', 'cone', 'tone'], sentence: 'A bone in a cone.' },
  // --- Vowel teams ---
  { id: 'ee', grapheme: 'ee', kind: 'digraph', soundTts: 'ee', cue: 'ee like tree', teachWords: ['see', 'tree', 'green', 'feet', 'seed', 'feed', 'week'], sentence: 'I see a green tree.' },
  { id: 'ay', grapheme: 'ay', kind: 'family', soundTts: 'ay', cue: 'ay like say', teachWords: ['say', 'may'], chain: ['say', 'may'], sentence: 'You may say it.' },
  { id: 'ai', grapheme: 'ai', kind: 'digraph', soundTts: 'ay', cue: 'ai like rain', teachWords: ['rain', 'train', 'tail', 'mail', 'sail', 'wait'], chain: ['tail', 'mail', 'sail'], sentence: 'The train is in the rain.' },
  { id: 'oa', grapheme: 'oa', kind: 'digraph', soundTts: 'oh', cue: 'oa like boat', teachWords: ['boat', 'goat', 'coat', 'road', 'toad', 'soap'], chain: ['boat', 'goat', 'coat'], sentence: 'The goat is on the boat.' },
  { id: 'oo-moon', grapheme: 'oo', kind: 'digraph', soundTts: 'oo', cue: 'oo like moon', teachWords: ['soon', 'moon', 'food', 'roof', 'pool', 'tool'], chain: ['moon', 'soon'], sentence: 'The moon is up soon.', onlyWords: ['soon', 'moon', 'food', 'roof', 'root', 'pool', 'tool'] },
  { id: 'oo-book', grapheme: 'oo', kind: 'digraph', soundTts: 'uh', cue: 'oo like book', teachWords: ['book', 'look', 'cook', 'hook', 'good', 'wood', 'foot'], chain: ['book', 'look', 'cook'], sentence: 'Look at the book.', onlyWords: ['book', 'look', 'cook', 'hook', 'foot', 'wood', 'good'] },
  // --- R-controlled ---
  { id: 'ar', grapheme: 'ar', kind: 'digraph', soundTts: 'ar', cue: 'ar like star', teachWords: ['car', 'star', 'bark', 'farm', 'park', 'dark', 'hard'], chain: ['bark', 'park', 'dark'], sentence: 'The car is in the dark park.' },
  { id: 'or', grapheme: 'or', kind: 'digraph', soundTts: 'or', cue: 'or like corn', teachWords: ['corn', 'fork', 'form', 'pork', 'storm'], sentence: 'Corn on a fork.' },
  { id: 'ir', grapheme: 'ir', kind: 'digraph', soundTts: 'er', cue: 'ir like bird', teachWords: ['bird', 'girl', 'dirt', 'first', 'third'], sentence: 'The first bird sings.' },
  { id: 'ur', grapheme: 'ur', kind: 'digraph', soundTts: 'er', cue: 'ur like turn', teachWords: ['burn', 'turn', 'hurt', 'curb'], sentence: 'Turn, turn, turn.' },
  // --- Diphthongs ---
  { id: 'ow', grapheme: 'ow', kind: 'digraph', soundTts: 'ow', cue: 'ow like cow', teachWords: ['owl', 'now', 'cow', 'how', 'down', 'town', 'crown'], chain: ['now', 'cow', 'how'], sentence: 'How now, brown cow?' },
  { id: 'oy', grapheme: 'oy', kind: 'family', soundTts: 'oy', cue: 'oy like toy', teachWords: ['boy', 'toy', 'joy'], chain: ['boy', 'toy', 'joy'], sentence: 'The boy has a toy.' },
  { id: 'oi', grapheme: 'oi', kind: 'digraph', soundTts: 'oy', cue: 'oi like coin', teachWords: ['coin', 'join', 'soil'], sentence: 'Join me, I found a coin.' },
  { id: 'ou', grapheme: 'ou', kind: 'digraph', soundTts: 'ow', cue: 'ou like mouse', teachWords: ['house', 'mouse', 'found', 'sound', 'round', 'mouth', 'cloud'], chain: ['found', 'sound', 'round'], sentence: 'A mouse is in the house.' },
]

const PATTERN_BY_ID = new Map(PHONICS_PATTERNS.map((pattern) => [pattern.id, pattern]))

export function getPattern(id: string): PhonicsPattern | undefined {
  return PATTERN_BY_ID.get(id)
}

export function isHeartWord(word: string): boolean {
  return HEART_WORDS.has(word.trim().toLowerCase())
}

export interface PatternMatch {
  pattern: PhonicsPattern
  before: string
  match: string
  after: string
}

/** Split a word around a taught pattern, or null if the pattern isn't in it. */
export function matchPattern(word: string, pattern: PhonicsPattern): PatternMatch | null {
  const clean = word.trim().toLowerCase()
  if (!clean || isHeartWord(clean)) return null
  // A spelling match is not automatically a phonics match: for example,
  // "boat" ends in "at" but is not an -at family word. Limit pattern work
  // to the registry's deliberately chosen examples (or the narrower list
  // for patterns with ambiguous pronunciations) so we never recreate the
  // old arbitrary-suffix quiz under a friendlier label.
  const permittedWords = pattern.onlyWords ?? pattern.teachWords
  if (!permittedWords.includes(clean)) return null
  const grapheme = pattern.grapheme
  if (pattern.kind === 'family') {
    if (clean.length > grapheme.length && clean.endsWith(grapheme)) {
      return { pattern, before: clean.slice(0, clean.length - grapheme.length), match: grapheme, after: '' }
    }
    return null
  }
  const index = clean.indexOf(grapheme)
  if (index < 0 || clean.length <= grapheme.length) return null
  return {
    pattern,
    before: clean.slice(0, index),
    match: grapheme,
    after: clean.slice(index + grapheme.length),
  }
}

/** All taught patterns found in a word, in teaching order. */
export function patternsForWord(word: string): PatternMatch[] {
  const matches: PatternMatch[] = []
  for (const pattern of PHONICS_PATTERNS) {
    const match = matchPattern(word, pattern)
    if (match) matches.push(match)
  }
  return matches
}

/**
 * Two tap targets for "tap the part that says X": [chunk, rest].
 * Returns null when the pattern sits mid-word (no clean 2-way split).
 */
export function patternTapSegments(match: PatternMatch): { segments: [string, string]; correctIndex: 0 | 1 } | null {
  if (match.before && match.after) return null
  if (!match.before) return { segments: [match.match, match.after], correctIndex: 0 }
  return { segments: [match.before, match.match], correctIndex: 1 }
}
