import { useState } from 'react';
import assignFamilyMember from '@/components/map/familyMemberOps';
import { fullName } from '@/components/map/familyTreeLogic';

export default function useFamilyMemberEditor(props, onSelect) {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const cancel = () => { setRequest(null); setOpen(false); setError(''); };
  const start = (next, showPanel = false) => { setRequest(next); setOpen(showPanel); setError(''); };
  const assign = (character, isNew) => {
    if (!character) return;
    if (isNew && (!fullName(character).trim() || /[,\r\n;]/.test(fullName(character)))) return setError('Enter a name without commas, semicolons or line breaks.');
    if (isNew && props.chars.some(c => fullName(c).toLowerCase() === fullName(character).toLowerCase())) return setError('A character with this name already exists in this faction. Select that character instead.');
    const result = assignFamilyMember(props.factionTrees, props.chars, request, character, props.rules);
    if (result.error) return setError(result.error);
    props.onCommitFamilyMember(character, result.trees, isNew);
    cancel(); onSelect(String(character.id));
  };
  return { request, open, error, cancel, start, assign, showPanel: () => setOpen(true) };
}