import fs from 'fs';
import path from 'path';

// Raw data for Lessons 50-70. Each lesson uses the same repeatable
// interaction structure rendered by InteractiveHundredLesson.tsx.
const rawLessons = [
  {
    number: 50,
    sounds: ['ch', 'p', 'sh', 'th', 'f', 'h'],
    words: ['to', 'us', 'seat', 'hear', 'ran', 'sand', 'hope', 'pot', 'dog'],
    story: [
      "The old man said, 'I need a tiger coat. So I will hunt for a tiger.'",
      "The girl said, 'But you can not see. How can you hunt for a tiger?'",
      "The old man said, 'I can hear. Tigers make sounds. I will hear those sounds and take a shot.'",
      "The girl said, 'The shot may miss.'",
      "'No,' the old man said. 'When I hear something I will take a good shot.'",
      "So the man went out with his gun. He did not see well. So he fell over a log. Then he fell over a rock.",
      "Then he walked up a hill. When he got to the top he stopped. 'I hear something,' he said. 'I have found a tiger.'",
      "The man did hear the sound of a tiger. It was a big tiger. And it was very near. The old man picked up his gun. 'Blam.'",
      "The shot did not hit the tiger. It hit a nut in a tree. The nut fell on a mouse.",
      "The mouse yelled, 'Stop hitting me with nuts.'",
      "This Is Not the End."
    ]
  },
  {
    number: 51,
    sounds: ['ch', 'sh', 'p', 'th', 'v', 'k'],
    words: ['to', 'fog', 'log'],
    story: [
      "I am a log.",
      "I can not run.",
      "I can not sit on an ant.",
      "An ant will sit on me."
    ]
  },
  {
    number: 52,
    sounds: ['e', 'ch', 'p', 'v', 'e', 'o', 'k'],
    words: ['shop', 'chop', 'came', 'cars', 'park', 'are', 'dog', 'cops', 'fog', 'log', 'to', 'goat'],
    story: [
      "The pet shop.",
      "A girl said to a man, 'let us go to the pet shop.'",
      "So the man and the girl went down the road.",
      "The man and the girl went in the pet shop.",
      "The girl said to the man in the pet shop, 'I need a dog.'",
      "The man said, 'no. I do not have dogs.",
      "I have a red cat. let me get that cat.'",
      "So he did. and the girl went home with the red cat."
    ]
  },
  {
    number: 53,
    sounds: ['e', 'e', 'a', 'a', 'o', 'o'],
    words: ['girl'],
    story: [
      "The bugs.",
      "A big bug met a little bug. the big bug said, 'let's go eat.'",
      "So the big bug ate a leaf and a nut and a rock.",
      "The big bug said, 'that is how big bugs eat.'",
      "The little bug said, 'now I will eat.'",
      "So the little bug ate a leaf and a nut and a rock. then the little bug went to a log and ate the log.",
      "Then she ate ten more logs.",
      "'Wow,' the big bug said. 'that little bug can eat a lot.'",
      "The little bug said, 'now let's eat more.'"
    ]
  },
  {
    number: 54,
    sounds: ['e', 'p', 'b', 'ch', 'o', 'v'],
    words: ['of'],
    story: [
      "Going to the toy shop.",
      "A boy and his mother went shopping for toys.",
      "The boy said, 'I love big toys.' but his mother said, 'I like little toys.'",
      "The man in the toy shop said, 'I have toys that you will like. they are big and little.'",
      "The boy said, 'toys can not be big and little.'",
      "The man said, 'this toy is big and little.'",
      "He got a little toy duck and he made it big.",
      "This is the end."
    ]
  },
  {
    number: 55,
    sounds: ['ch', 'b', 'v', 'p', 'k', 'o'],
    words: ['go', 'no'],
    story: [
      "The old man did not hear well.",
      "An old man lived with a little girl. the old man did not hear well.",
      "The little girl said to that man, 'I will see you soon.'",
      "The man did not hear her. he said, 'no, I do not see the moon.'",
      "The girl said, 'I did not say that. I told you when we will meet.'",
      "The man said, 'no, I am not on my seat.'",
      "The girl said, 'if you can read, I will make a note.' and she did.",
      "Here is that note: 'I will see you soon.'"
    ]
  },
  {
    number: 56,
    sounds: ['ing', 'b', 'e', 'ch', 'ing', 'p', 'v'],
    words: ['cow', 'how'],
    story: [
      "The fat eagle.",
      "There was an eagle that was fat, fat, fat.",
      "The other eagles made fun of the fat eagle. they said, 'you do not look like an eagle. you look like a fat rock.'",
      "The fat eagle was sitting in a tree when a tiger came hunting for eagles.",
      "That tiger was going to get a little white eagle.",
      "The little white eagle was under the fat eagle's tree.",
      "The other eagles yelled, but the little white eagle did not hear them.",
      "The fat eagle looked at the tiger getting near the white eagle.",
      "Then the fat eagle said, 'I must save that white eagle.'",
      "So he jumped down. he came down on the tiger like a fat rock.",
      "That tiger ran far away. the little white eagle was saved.",
      "When the other eagles came over to the fat eagle, they said, 'we will never make fun of you now.'",
      "The end."
    ]
  },
  {
    number: 57,
    sounds: ['g', 'ing', 'v', 'ch', 'k', 'b'],
    words: ['there', 'then', 'this', 'sent', 'well', 'park', 'farm', 'pet', 'duck', 'girl'],
    story: [
      "A home for an ant.",
      "An ant lived in a hole. the ant said, 'this hole is no good. when it rains, the rain comes in this hole. and I get wet.",
      "When the days are hot, the hole gets hot. when the hole gets hot, I get hot.'",
      "But when the days got cold, the hole did not get hot. the hole got cold.",
      "And so did that ant.",
      "The ant said, 'this hole gets hot and this hole gets cold. and when it rains, this hole gets wet. I will leave this hole.'",
      "So the ant did that.",
      "The ant went up the hill to the home of an eagle. 'can I stay in this home?' the ant said.",
      "The eagle did not say a thing. the eagle picked up the ant and said, 'I will take you from this hill. do not come back. go dig a hole and live like other ants.'",
      "But the ant did not dig a hole. that ant went to the home of a ram.",
      "'Can I live in this home?' the ant said. the ram said, 'we do not like ants. go dig a hole and live like other ants.'"
    ]
  },
  {
    number: 58,
    sounds: ['i', 'b', 'e', 'i', 'ch', 'o'],
    words: ['be', 'big', 'bit', 'eating', 'getting', 'leaf', 'bugs'],
    story: [
      "A home for an ant part 2.",
      "An ant was looking for a good home. an eagle made the ant leave and a ram made the ant leave.",
      "But that ant did not give up. so the ant went to the home of a cow.",
      "That home was a big barn. the ant said, 'I will be a good ant if you let me live here.'",
      "The cow said, 'a horse can live here and sheep can live here. we will let a chick live here and a pig live here. but no ants can live in this barn. so go dig a hole and live like other ants.'",
      "'No,' the ant said. 'I like barns. and I will make an ant barn.'",
      "So the ant got logs and rocks. then the ant made a barn. it was a good barn. it was too little for cows, and pigs, and dogs, and deers.",
      "But it was not too little for rats. so a rat came to the barn and said 'can I live in this barn with you?'",
      "The ant looked at the rat and said, 'go dig a hole and live like other rats.'",
      "The end."
    ]
  },
  {
    number: 59,
    sounds: ['i', 'ch', 'a', 'e', 'o', 'i'],
    words: ['fishing', 'bed', 'tub', 'but', 'bite', 'sleep', 'like'],
    story: [
      "The bed bugs.",
      "A mouse had a house that shined. every day, that mouse got a rag and went from room to room.",
      "The mouse picked up every bit of dust. the mouse was very proud.",
      "'This is how I like my house.'",
      "But on a cold day that mouse found something bad. the mouse was going to dust in the bed room.",
      "The mouse looked at the bed and said, 'I see bugs in that bed.'",
      "There were ten red bugs in the bed. 'get out of that bed,' the mouse yelled.",
      "'No,' a bug said. 'we must stay in a bed. we are bed bugs.'",
      "'My house shines,' the mouse said. 'I can not have bugs in here.'",
      "A bug came near the mouse. that bug said, 'if we are bed bugs, we must live in beds. we are not grass bugs, so we can not live in the grass. we are not barn bugs, so we can not live in a barn.'",
      "Stop."
    ]
  },
  {
    number: 60,
    sounds: ['m', 's', 'a', 't', 'p'],
    words: ['mat', 'sat', 'tap', 'pat', 'map', 'sap', 'Sam'],
    imageScene: 'Sam sitting on a cozy mat with a paper map while a sleepy cat naps beside the mat',
    story: [
      "Sam sat on a mat.",
      "Sam had a map.",
      "Sam saw a path on the map.",
      "Sam said, 'I can tap, tap, tap on the path.'",
      "A cat sat by Sam.",
      "Sam said, 'This map is for us.'",
      "The cat did not tap.",
      "The cat sat and had a nap.",
      "Sam said, 'That cat likes my mat.'",
      "The end."
    ]
  },
  {
    number: 61,
    sounds: ['n', 'r', 'i', 'd', 'c'],
    words: ['ran', 'rid', 'did', 'can', 'cat', 'din', 'in'],
    imageScene: 'Nick sitting calmly near a cute cat wearing a red cap under a small cot',
    story: [
      "A cat ran in.",
      "Nick ran in too.",
      "The cat had a red cap.",
      "Nick said, 'Can I see it?'",
      "The cat ran under a cot.",
      "Nick did not get mad.",
      "Nick sat and said, 'I can wait.'",
      "The cat came back.",
      "Nick said, 'That is a nice red cap.'",
      "The end."
    ]
  },
  {
    number: 62,
    sounds: ['f', 'b', 'h', 'g', 'o'],
    words: ['fog', 'hog', 'big', 'bag', 'hot', 'hop', 'Bob'],
    imageScene: 'Bob holding a big bag while a friendly hog peeks out from soft fog without wearing a hat',
    story: [
      "Bob had a big bag.",
      "The bag had a hat.",
      "The hat was hot.",
      "Bob put the hat on a hog.",
      "The hog did not like the hot hat.",
      "The hog ran into fog.",
      "Bob said, 'I can not see that hog.'",
      "The hog came back with no hat.",
      "Bob said, 'Good hog.'",
      "The end."
    ]
  },
  {
    number: 63,
    sounds: ['l', 'k', 'e', 'u', 'w'],
    words: ['leg', 'let', 'wet', 'web', 'cup', 'cut', 'Ken'],
    imageScene: 'Ken gently helping a tiny bug climb from a wet cup onto a green leaf',
    story: [
      "Ken had a cup.",
      "The cup was wet.",
      "Ken set the cup on a log.",
      "A bug ran up the log.",
      "The bug went in the cup.",
      "Ken said, 'Let that bug out.'",
      "Ken put a leaf by the cup.",
      "The bug went up the leaf.",
      "Ken said, 'Run, little bug.'",
      "The end."
    ]
  },
  {
    number: 64,
    sounds: ['j', 'y', 'v', 'z', 'q'],
    words: ['jam', 'yes', 'van', 'zip', 'quiz', 'quack', 'yak'],
    imageScene: 'Jill smiling beside a small toy van while a fluffy yak happily looks at a jar of jam',
    story: [
      "Jill had jam.",
      "A yak saw the jam.",
      "The yak said, 'Yes, yes.'",
      "Jill put the jam in a van.",
      "The yak ran to the van.",
      "Zip went the bag.",
      "Jill said, 'This is a quiz.'",
      "The yak said, 'Quack?'",
      "Jill laughed and gave the yak a bit of jam.",
      "The end."
    ]
  },
  {
    number: 65,
    sounds: ['sh', 'ch', 'th', 'ng', 'oo'],
    words: ['ship', 'shop', 'chin', 'thin', 'ring', 'moon', 'soon'],
    imageScene: 'Chip finding a tiny shiny ring on a dish near a moon-shaped lamp in a cozy shop with blank walls',
    story: [
      "The ship was at the shop.",
      "Chip had a thin ring.",
      "The ring went ping.",
      "Chip said, 'Where did my ring go?'",
      "The ring was on a dish.",
      "The dish was by the moon lamp.",
      "Chip said, 'I will get it soon.'",
      "Then the ring went ping again.",
      "Chip said, 'This ring can sing.'",
      "The end."
    ]
  },
  {
    number: 66,
    sounds: ['ar', 'or', 'er', 'ay', 'ee'],
    words: ['car', 'star', 'corn', 'her', 'day', 'see', 'tree'],
    imageScene: 'May standing by a friendly little car decorated with a simple star shape near a tree and corn plants',
    story: [
      "May saw a car.",
      "The car had a star on it.",
      "The car went by a tree.",
      "May said, 'I see corn.'",
      "Her dad said, 'It is a good day.'",
      "May ran to the tree.",
      "A bird sat in the tree.",
      "The bird did not get in the car.",
      "May said, 'The bird likes the tree.'",
      "The end."
    ]
  },
  {
    number: 67,
    sounds: ['ai', 'oa', 'ow', 'oy', 'igh'],
    words: ['rain', 'boat', 'cow', 'toy', 'light', 'night', 'road'],
    imageScene: 'a child rescuing a toy boat from a rainy road while a gentle cow watches under a warm light',
    story: [
      "It was night.",
      "Rain fell on the road.",
      "A toy boat sat by the road.",
      "A cow saw the toy boat.",
      "The cow said, 'Moo.'",
      "A light came on.",
      "The boy ran out.",
      "The boy got the toy boat.",
      "The cow went back to bed.",
      "The end."
    ]
  },
  {
    number: 68,
    sounds: ['ck', 'wh', 'ph', 'ea', 'oi'],
    words: ['back', 'duck', 'when', 'whip', 'phone', 'leaf', 'coin'],
    imageScene: 'a duck sitting beside a pond while a child picks up a shiny coin from a leaf',
    story: [
      "A duck went back to the pond.",
      "When the duck got there, it saw a coin.",
      "The coin was on a leaf.",
      "A boy had a phone.",
      "The boy said, 'That coin is not for a duck.'",
      "The duck did not pick up the coin.",
      "The duck sat by the leaf.",
      "The boy took the coin back.",
      "The duck said, 'Quack.'",
      "The end."
    ]
  },
  {
    number: 69,
    sounds: ['ir', 'ur', 'aw', 'au', 'ou'],
    words: ['bird', 'turn', 'saw', 'paw', 'haul', 'out', 'loud'],
    imageScene: 'a small bird and a child helping a gentle puppy with a soft bandage on one paw',
    story: [
      "A bird saw a paw print.",
      "The print was by the barn.",
      "The bird said, 'Turn back.'",
      "A pup came out.",
      "The pup was not loud.",
      "The pup had a sore paw.",
      "The bird sat by the pup.",
      "A girl came to help.",
      "The pup got a soft band on its paw.",
      "The end."
    ]
  },
  {
    number: 70,
    sounds: ['tion', 'sion', 'le', 'ed', 'all'],
    words: ['action', 'mission', 'little', 'jumped', 'called', 'ball', 'fall'],
    imageScene: 'a little dog and a smiling child working together to get a colorful ball by a low wall',
    story: [
      "The little dog had a mission.",
      "The mission was to get the ball.",
      "The ball rolled by the wall.",
      "The dog jumped.",
      "The dog missed the ball.",
      "A little girl called, 'Come here.'",
      "The dog ran back.",
      "Then the girl and the dog got the ball together.",
      "That was good action.",
      "The end."
    ]
  }
];

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

const lessons = rawLessons.map(lesson => {
  const chunks = [];

  // Add sound discovery chunk
  chunks.push({
    type: 'sound-discovery',
    items: lesson.sounds
  });

  // Add blending bridge chunk
  chunks.push({
    type: 'blending-bridge',
    items: lesson.words
  });

  // Determine rhyming words based on lesson words, or fallback
  const allWords = lesson.words.join(' ');
  let rhymes = [];
  if (allWords.includes('cat')) rhymes = ['cat', 'bat', 'rat', 'mat'];
  else if (allWords.includes('dog')) rhymes = ['dog', 'log', 'fog', 'hog'];
  else if (allWords.includes('to')) rhymes = ['to', 'do', 'zoo', 'moo'];
  else if (allWords.includes('see')) rhymes = ['see', 'tree', 'bee', 'free'];
  else if (allWords.includes('car')) rhymes = ['car', 'star', 'far', 'jar'];
  else if (allWords.includes('boy')) rhymes = ['boy', 'toy', 'joy'];
  else if (allWords.includes('cow')) rhymes = ['cow', 'how', 'now', 'bow'];
  else if (allWords.includes('mat')) rhymes = ['mat', 'sat', 'pat', 'cat'];
  else if (allWords.includes('ran')) rhymes = ['ran', 'can', 'man', 'pan'];
  else if (allWords.includes('fog')) rhymes = ['fog', 'hog', 'log', 'dog'];
  else if (allWords.includes('wet')) rhymes = ['wet', 'let', 'pet', 'net'];
  else if (allWords.includes('jam')) rhymes = ['jam', 'Sam', 'ram', 'ham'];
  else if (allWords.includes('ship')) rhymes = ['ship', 'chip', 'lip', 'dip'];
  else if (allWords.includes('car')) rhymes = ['car', 'star', 'far', 'jar'];
  else if (allWords.includes('boat')) rhymes = ['boat', 'coat', 'goat', 'float'];
  else if (allWords.includes('duck')) rhymes = ['duck', 'luck', 'truck', 'stuck'];
  else if (allWords.includes('bird')) rhymes = ['bird', 'word', 'heard'];
  else if (allWords.includes('ball')) rhymes = ['ball', 'fall', 'wall', 'call'];
  else rhymes = ['cat', 'bat', 'rat', 'mat']; // Default fallback

  // Add rhyme puzzle chunk
  chunks.push({
    type: 'rhyme-puzzle',
    items: rhymes
  });

  // Map story to story-gauntlet
  chunks.push({
    type: 'story-gauntlet',
    items: lesson.story,
    imagePath: `images/lesson-${lesson.number}-story.webp`,
    imagePrompt: `Original cute kawaii children's storybook illustration with warm pastel colors and expressive child-friendly characters. Simple clean composition, blank background areas only, no text, no letters, no signs, no captions, no watermark. Scene: ${lesson.imageScene || `${lesson.story[0]} ${lesson.story[1] || ''}`}`
  });

  return {
    id: `lesson-${lesson.number}`,
    lessonNumber: lesson.number,
    chunks
  };
});

const outDir = path.resolve('public/100-lessons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

lessons.forEach(lesson => {
  const outPath = path.join(outDir, `${lesson.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(lesson, null, 2));
});

// Also create an index file
const indexFile = path.join(outDir, 'index.json');
fs.writeFileSync(indexFile, JSON.stringify(lessons.map(l => ({ id: l.id, lessonNumber: l.lessonNumber })), null, 2));

console.log('Successfully generated 100-lessons JSON files.');
