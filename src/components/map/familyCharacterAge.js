// Compare birth years at the campaign's current date, not ages at death.
export default function familyCharacterAge(character) {
  const age = Number(character?.age ?? 0);
  return age + (character?.status === 'dead' ? Math.max(0, Number(character.deadYears) || 0) : 0);
}

export function familyAgeDescription(character) {
  if (character?.status !== 'dead') return String(character?.age ?? 0);
  const yearsDead = Math.max(0, Number(character.deadYears) || 0);
  return `${character.age ?? 0} at death + ${yearsDead} years dead = ${familyCharacterAge(character)}`;
}

// Saved tree nodes must use the latest age / death data after record edits.
export function syncFamilyTreeAges(trees, characters) {
  const byId = new Map(characters.map(character => [String(character.id), character]));
  const name = character => [character?.name, character?.surname].filter(Boolean).join(' ').toLowerCase();
  const byName = new Map(characters.map(character => [name(character), character]));
  const sync = character => {
    if (!character) return character;
    const current = byId.get(String(character.id)) || byName.get(name(character));
    return current ? { ...character, ...current } : character;
  };
  return trees.map(tree => ({
    ...tree,
    father: sync(tree.father), mother: sync(tree.mother),
    children: (tree.children || []).map(sync),
    spouses: Object.fromEntries(Object.entries(tree.spouses || {}).map(([id, spouse]) => [id, sync(spouse)])),
    nestedChildren: Object.fromEntries(Object.entries(tree.nestedChildren || {}).map(([id, children]) => [id, children.map(sync)])),
  }));
}