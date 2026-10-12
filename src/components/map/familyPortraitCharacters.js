// Tree nodes retain relationship snapshots; portraits come from current records.
export default function familyPortraitCharacters(characters) {
  const nameKey = character => [character.name, character.surname].filter(Boolean).join(' ').trim().replace(/\s+/g, ' ').toLowerCase();
  const byId = new Map(characters.filter(character => character.id != null).map(character => [String(character.id), character]));
  return character => {
    if (!character) return character;
    const sameFaction = candidate => !character.faction || candidate.faction === character.faction;
    const names = characters.filter(candidate => sameFaction(candidate) && nameKey(candidate) === nameKey(character));
    const idMatch = byId.get(String(character.id));
    const current = idMatch && sameFaction(idMatch) && (!names.length || nameKey(idMatch) === nameKey(character))
      ? idMatch : names.length === 1 ? names[0] : null;
    return current ? { ...character, ...current } : character;
  };
}