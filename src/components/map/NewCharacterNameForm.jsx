import React, { useState } from 'react';

export default function NewCharacterNameForm({ initialDisplay, onSave, onCancel, faction, section }) {
  const [display, setDisplay] = useState(initialDisplay);
  const [internal, setInternal] = useState(initialDisplay.trim().replace(/\s+/g, '_'));
  const [customInternal, setCustomInternal] = useState(false);
  const [error, setError] = useState('');
  const save = () => {
    try { onSave(internal, display); } catch (e) { setError(e.message); }
  };
  return <div className="space-y-1 rounded border border-border bg-card p-2 text-[10px] text-card-foreground">
    <p>Add to {faction}: {section === 'female' ? 'women' : section === '_surnames' ? 'surnames' : 'characters'}</p>
    <label className="block">Display name
      <input autoFocus value={display} onChange={e => {
        setDisplay(e.target.value);
        if (!customInternal) setInternal(e.target.value.trim().replace(/\s+/g, '_'));
      }} className="h-7 w-full rounded border border-input bg-background px-1.5 text-foreground" />
    </label>
    <label className="block">Internal name
      <input value={internal} onChange={e => { setCustomInternal(true); setInternal(e.target.value); }} className="h-7 w-full rounded border border-input bg-background px-1.5 font-mono text-foreground" />
    </label>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded border border-border px-2 py-1">Cancel</button>
      <button type="button" disabled={!display.trim() || !internal.trim()} onClick={save} className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-40">Add name</button>
    </div>
  </div>;
}