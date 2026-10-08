import React from 'react';
import { Button } from '@/components/ui/button';

export default function FamilyRelationActions({ character, onRequest }) {
  if (!character) return null;
  const actions = [
    ['Son', 'child', 'male'], ['Daughter', 'child', 'female'],
    ['Father', 'parent', 'male'], ['Mother', 'parent', 'female'],
    [character.sex === 'female' ? 'Husband' : 'Wife', 'spouse', character.sex === 'female' ? 'male' : 'female'],
  ];
  return <div className="p-2 border-b border-border space-y-1 shrink-0">
    <p className="text-xs">Add a relative to <strong>{[character.name, character.surname].filter(Boolean).join(' ')}</strong></p>
    <div className="flex flex-wrap gap-1">{actions.map(([label, kind, sex]) => <Button key={label} size="sm" variant="outline" onClick={() => onRequest({ anchorId: character.id, kind, sex, label })}>+ {label}</Button>)}</div>
  </div>;
}