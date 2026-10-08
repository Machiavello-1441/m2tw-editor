import React, { useState } from 'react';
import CharacterRecordRow from '@/components/map/CharacterRecordRow';
import { Button } from '@/components/ui/button';

export default function FamilyMemberCreateForm({ request, faction, anchor, rules, onSubmit }) {
  const difference = rules?.values?.parent_to_child_min_age_diff ?? 14;
  const age = request.kind === 'parent' ? Number(anchor?.age || 0) + Number(anchor?.deadYears || 0) + difference : request.kind === 'child' ? Math.max(0, Math.min(10, Number(anchor?.age || 0) - difference)) : Number(anchor?.age ?? 30);
  const [draft, setDraft] = useState({ name: '', surname: '', sex: request.sex || 'male', age, status: 'alive', deadYears: 0, recordRole: 'never_a_leader' });
  return <form onSubmit={event => { event.preventDefault(); onSubmit({ ...draft, name: draft.name.trim(), surname: draft.surname.trim(), id: -Date.now(), category: 'character', charType: 'family', faction, traits: [], ancillaries: [], army: [], _isNew: false }); }} className="space-y-2">
    <CharacterRecordRow rec={draft} factionName={faction} fixedSex={request.sex} initialExpanded onUpdate={setDraft} />
    <p className="text-xs text-muted-foreground">Creates an in-game family character record, not an active map agent. After adding, use character details to configure an active character if needed.</p>
    <Button type="submit" size="sm" disabled={!draft.name.trim()}>Create and link character</Button>
  </form>;
}