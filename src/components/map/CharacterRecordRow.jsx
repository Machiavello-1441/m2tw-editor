import React, { useState } from 'react';
import { Archive, ChevronDown, ChevronRight } from 'lucide-react';

const ROLES = ['never_a_leader', 'past_leader', 'past_heir', 'leader', 'heir'];
const inputClass = 'h-6 w-full rounded border border-input bg-background px-1.5 text-[11px] text-foreground font-mono';
export default function CharacterRecordRow({ rec, factionName, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const set = (key, value) => onUpdate({ ...rec, [key]: value });
  const isDead = rec.status === 'dead';
  const role = rec.recordRole || (ROLES.includes(rec.status) ? rec.status : 'never_a_leader');
  return (
    <div className="rounded border border-border bg-card">
      <button type="button" className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}<Archive className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{[rec.name, rec.surname].filter(Boolean).join(' ') || '(unnamed)'}<span className="ml-1 text-muted-foreground">{rec.sex} · age {rec.age}{isDead ? ` · dead ${rec.deadYears || 0}yr` : ''}</span></span>
        <span className="text-[8px] text-muted-foreground">{factionName}</span>
      </button>
      {expanded && <div className="grid grid-cols-2 gap-1.5 border-t border-border p-2 text-[9px] text-muted-foreground">
        <label>Name<input value={rec.name || ''} onChange={event => set('name', event.target.value)} className={inputClass} /></label>
        <label>Surname<input value={rec.surname || ''} onChange={event => set('surname', event.target.value)} placeholder="optional" className={inputClass} /></label>
        <label>Sex<select value={rec.sex || 'male'} onChange={event => set('sex', event.target.value)} className={inputClass}><option value="male">male</option><option value="female">female</option></select></label>
        <label>Age<input type="number" min={0} value={rec.age ?? 0} onChange={event => set('age', Math.max(0, parseInt(event.target.value) || 0))} className={inputClass} /></label>
        <label>Alive / Dead<select value={isDead ? 'dead' : 'alive'} onChange={event => onUpdate({ ...rec, status: event.target.value, recordRole: role })} className={inputClass}><option value="alive">alive</option><option value="dead">dead</option></select></label>
        {isDead && <label>Years Dead<input type="number" min={0} value={rec.deadYears ?? 0} onChange={event => set('deadYears', Math.max(0, parseInt(event.target.value) || 0))} className={inputClass} /></label>}
        <label>Role<select value={role} onChange={event => set('recordRole', event.target.value)} className={inputClass}>{ROLES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <p className="col-span-2">Changes are applied immediately and included in campaign exports.</p>
      </div>}
    </div>
  );
}