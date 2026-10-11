// Tree nodes retain relationship snapshots; portraits come from current records.
export default function familyPortraitCharacters(characters) {
  const nameKey = character => `${character.faction || ''}:${[character.name, character.surname].filter(Boolean).join(' ').trim().replace(/\s+/g, ' ').toLowerCase()}`;
  const idKey = character => `${character.faction || ''}:${character.id}`;
  const byId = new Map(characters.filter(character => character.id != null).map(character => [idKey(character), character]));
  const byName = new Map(characters.map(character => [nameKey(character), character]));
  return character => {
    if (!character) return character;
    const idMatch = character.id != null ? byId.get(idKey(character)) : null;
    const nameMatch = byName.get(nameKey(character));
    // Prefer the name match if a reimport assigned this old ID to somebody else.
    if (idMatch && nameMatch && nameKey(idMatch) !== nameKey(character)) return nameMatch;
    return idMatch || nameMatch || character;
  };
}