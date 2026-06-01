import fs from 'node:fs';

const p = 'public/decks/anna-phonemes-level-1.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
d.cards.forEach(c => {
  const ipa = c.adultIpa?.replace(/\//g, '');
  const l = c.childSoundName?.replace(' sound', '');
  if (!ipa || !l) return;
  c.ssmlSound = `<phoneme alphabet="ipa" ph="${ipa}">${l}</phoneme>`;
});
fs.writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
