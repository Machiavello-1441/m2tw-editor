import React from 'react';

export default function RiverEndpointPrompt({ editor }) {
  if (!editor.pending) return null;
  return <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] max-w-lg rounded border bg-card text-card-foreground p-2 shadow-lg text-[11px] space-y-1">
    <div className="flex items-center gap-2"><span>Click the map for the new {editor.pending.type === 'source_water' ? 'white source' : 'blue outlet'}.</span><button onClick={editor.cancel} className="rounded border bg-secondary text-secondary-foreground px-2 py-1">Cancel</button></div>
    <p className="text-muted-foreground">Click this branch to shorten it, or empty map to extend it. Escape cancels.</p>
    {editor.error && <p role="alert" className="text-destructive">{editor.error}</p>}
  </div>;
}