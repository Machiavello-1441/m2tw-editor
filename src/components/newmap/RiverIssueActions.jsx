import React from 'react';

export default function RiverIssueActions({ issue, editor, disabled }) {
  if (!editor) return null;
  const supported = ['source_water','inland_outlet'].includes(issue?.type);
  return <div className="space-y-1.5 text-[10px]">
    {supported && <div className="rounded border p-1.5 space-y-1.5">
      <p className="text-foreground">Review pixel ({issue.x}, {issue.y})</p>
      <button disabled={disabled || !!editor.pending} onClick={editor.remove} className="w-full rounded border bg-destructive text-destructive-foreground p-1.5">Delete flagged pixel only</button>
      <button disabled={disabled || !!editor.pending} onClick={editor.begin} className="w-full rounded border bg-primary text-primary-foreground p-1.5">Place replacement {issue.type === 'source_water' ? 'source' : 'outlet'} on map</button>
      <p className="text-muted-foreground">Replacement shortens this branch or extends it to your click; other branches stay unchanged.</p>
      {editor.pending && <button onClick={editor.cancel} className="w-full rounded border bg-secondary text-secondary-foreground p-1">Cancel placement</button>}
    </div>}
    {editor.error && <p role="alert" className="text-destructive">{editor.error}</p>}
    {editor.undo && <button disabled={disabled} onClick={editor.restore} className="w-full rounded border bg-secondary text-secondary-foreground p-1.5">Undo last river review edit</button>}
  </div>;
}