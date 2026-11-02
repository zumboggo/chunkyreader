// Family-inspired styling; preserve the shared body rig and stage positions.
export function styleFamilyCharacter(character, id) {
  if (!['Anna', 'Sarah'].includes(id)) return character
  character.rig.palette = {...character.rig.palette, hair: id === 'Anna' ? '#604332' : '#73503a', shirt: id === 'Anna' ? '#efa8bd' : '#b69cdb', trim: '#fff0dd'}
  character.rig.appearance = {...character.rig.appearance, age: 'child', hair: id === 'Anna' ? 'long' : 'bob', face: 'child', eyes: 'default', hairBow: id === 'Anna' ? '#b976a8' : '#d95855'}
  character.provenance = 'Family-inspired storybook character styling, guided by David’s supplied family watercolor; original animated illustration.'
  return character
}
