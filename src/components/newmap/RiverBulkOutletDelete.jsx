import React from 'react';

export default function RiverBulkOutletDelete({ result, editor, running }) {
  const count = result?.counts?.inland_outlet || 0;
  if (!editor || !count) return null;
  return <div className="space-y-1 text-[10px]">
    <button disabled={running || !!editor.pending} onClick={() => editor.removeAllOutlets(result.issues)} className="w-full rounded border bg-destructive text-destructive-foreground p-1.5">Delete all flagged inland outlet pixels ({count.toLocaleString()})</button>
    <p className="text-muted-foreground">One pixel per currently flagged outlet, one recheck, one Undo. Newly exposed endpoints may still be flagged; entire branches are not deleted.</p>
  </div>;
}