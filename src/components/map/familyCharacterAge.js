import familyPortraitCharacters from '@/components/map/familyPortraitCharacters';

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
  const sync = familyPortraitCharacters(characters);
  return trees.map(tree => {
    const members = [tree.father, tree.mother, ...(tree.children || []), ...Object.values(tree.spouses || {}), ...Object.values(tree.nestedChildren || {}).flat()].filter(Boolean);
    const currentIds = new Map(members.map(character => [String(character.id), String(sync(character).id)]));
    return {
      ...tree,
      father: sync(tree.father), mother: sync(tree.mother),
      children: (tree.children || []).map(sync),
      spouses: Object.fromEntries(Object.entries(tree.spouses || {}).map(([id, spouse]) => [currentIds.get(id) || id, sync(spouse)])),
      nestedChildren: Object.fromEntries(Object.entries(tree.nestedChildren || {}).map(([id, children]) => [currentIds.get(id) || id, children.map(sync)])),
    };
  });
}