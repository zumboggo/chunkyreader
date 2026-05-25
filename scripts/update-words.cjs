const fs = require('fs');
const path = require('path');

const wordMap = {
  M: "mountain", S: "snake", A: "arrow", T: "tree", P: "pelican",
  C: "caterpillar", R: "ribbon", N: "necklace", D: "dinosaur", I: "inchworm",
  F: "flamingo", B: "butterfly", H: "horse", G: "goose", O: "orange",
  L: "lizard", K: "kangaroo", E: "eel", U: "umbrella", W: "worm",
  J: "jellyfish", Y: "yak", V: "valley", Z: "zebra", Q: "quail", X: "xylophone"
};

const p = path.join(__dirname, '../public/decks/sarah-letters-level-1.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

data.cards.forEach(c => {
  const w = wordMap[c.uppercase];
  c.exampleWord = w;
  c.image = `images/${w}.png`;
  c.speechCue = c.speechCue.replace(/like \w+$/, `like ${w}`);
  c.ttsText = c.ttsText.replace(/as in \w+\./, `as in ${w}.`);
});

fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
console.log("Updated sarah-letters-level-1.json successfully.");
