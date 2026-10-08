import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import FamilyMemberCreateForm from '@/components/map/FamilyMemberCreateForm';
import { fullName } from '@/components/map/familyTreeLogic';

export default function FamilyMemberPanel({ request, chars, faction, rules, error, onAssign, onCancel }) {
  const [mode, setMode] = useState('existing');
  const [search, setSearch] = useState('');
  const [id, setId] = useState('');
  const anchor = chars.find(c => String(c.id) === String(request.anchorId));
  const eligible = chars.filter(c => c.id !== anchor?.id && (!request.sex || c.sex === request.sex) && fullName(c).toLowerCase().includes(search.toLowerCase()));
  return <div className="h-full min-h-0 overflow-y-auto p-2 space-y-3">
    <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
    <h3 className="text-sm font-semibold">Add {request.label || request.slot || 'child'}{anchor ? ` to ${fullName(anchor)}` : ''}</h3>
    <div className="flex flex-wrap gap-1">{[['existing', 'Select existing'], ['new', 'Create new']].map(([value, label]) => <Button key={value} size="sm" variant={mode === value ? 'default' : 'outline'} onClick={() => setMode(value)}>{label}</Button>)}</div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {mode === 'existing' ? <div className="space-y-2">
      <input aria-label="Search existing characters" placeholder="Search characters…" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded border border-input bg-background p-2 text-xs" />
      <select aria-label="Existing family member" value={id} onChange={event => setId(event.target.value)} className="w-full rounded border border-input bg-background p-2 text-xs"><option value="">Select a character</option>{eligible.map(c => <option key={c.id} value={String(c.id)}>{fullName(c)} · {c.sex} · age {c.age}{c.status === 'dead' ? ' · dead' : ''}</option>)}</select>
      {!eligible.length && <p className="text-xs text-muted-foreground">No matching characters. Create a new one instead.</p>}
      <Button size="sm" disabled={!eligible.some(c => String(c.id) === id)} onClick={() => onAssign(eligible.find(c => String(c.id) === id), false)}>Link character</Button>
    </div> : <FamilyMemberCreateForm request={request} faction={faction} anchor={anchor} rules={rules} onSubmit={character => onAssign(character, true)} />}
  </div>;
}