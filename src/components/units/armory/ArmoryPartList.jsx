import React from 'react';
import { Trash2 } from 'lucide-react';
import ArmoryPartTransform from '@/components/units/armory/ArmoryPartTransform';

export default function ArmoryPartList({ parts, sources, selected, onSelect, onChange, onRemove }) {
  const update = part => onChange(parts.map(item => item.id === part.id ? part : item));
  return <aside className="w-full shrink-0 space-y-3 overflow-y-auto border-border bg-card p-3 lg:w-64 lg:border-r">
    <h3 className="text-xs font-semibold">Assembly parts ({parts.length})</h3>
    <p className="text-[10px] text-muted-foreground">Keep a body, then choose heads, armour and weapons from donor models. Uncheck unwanted alternatives.</p>
    {!parts.length && <p className="text-xs text-muted-foreground">Add a unit model to start assembling.</p>}
    {Object.values(sources).map(source => <section key={source.id} className="space-y-1">
      <div className="flex items-start gap-1"><p className="min-w-0 flex-1 break-all text-[10px] font-semibold text-muted-foreground">{source.label}</p><button type="button" aria-label={`Remove ${source.label}`} onClick={() => onRemove(source.id)} className="p-1 hover:bg-accent"><Trash2 className="h-3 w-3" /></button></div>
      {source.warnings.map((warning, index) => <p key={index} className="text-[10px] text-muted-foreground">{warning}</p>)}
      {parts.filter(part => part.source === source.id).map(part => <div key={part.id} className={`flex items-center gap-2 rounded p-1 ${selected === part.id ? 'bg-accent text-accent-foreground' : ''}`}>
        <input type="checkbox" checked={part.visible} aria-label={`Include ${part.name}`} onChange={event => update({ ...part, visible: event.target.checked })} />
        <button type="button" onClick={() => onSelect(part.id)} className="min-w-0 flex-1 truncate text-left text-xs" title={part.name}>{part.name}</button>
      </div>)}
    </section>)}
    <ArmoryPartTransform part={parts.find(part => part.id === selected)} onChange={update} />
  </aside>;
}