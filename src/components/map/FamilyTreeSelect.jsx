import React from 'react';

export default function FamilyTreeSelect({ forest, value, onChange }) {
  return <label className="flex items-center gap-2 text-xs text-foreground min-w-0">
    <span className="shrink-0">Family tree</span>
    <select aria-label="Family tree" value={value} onChange={event => onChange(event.target.value)} disabled={!forest.length}
      className="h-8 w-full sm:w-80 min-w-0 rounded border border-input bg-background text-foreground px-2">
      {!forest.length && <option value="">No family trees</option>}
      {forest.map((tree, index) => <option key={tree.rootId} value={String(tree.rootId)}>{index + 1}. {tree.title}</option>)}
    </select>
  </label>;
}