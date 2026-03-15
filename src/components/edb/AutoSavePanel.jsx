import React, { useState, useEffect, useCallback } from 'react';
import { History, Save, RotateCcw, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listSnapshots, deleteSnapshot } from './useEDBAutoSave';
import { useEDB } from './EDBContext';

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMin = Math.round((now - d) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
}

export default function AutoSavePanel({ onSaveNow }) {
  const { restoreSnapshot } = useEDB();
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listSnapshots();
    setSnapshots(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleSaveNow = async () => {
    setSaving(true);
    await onSaveNow();
    await refresh();
    setSaving(false);
  };

  const handleRestore = async (snap) => {
    if (!window.confirm(`Restore snapshot from ${new Date(snap.timestamp).toLocaleString()}? Current unsaved changes will be lost.`)) return;
    restoreSnapshot(snap);
    setOpen(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteSnapshot(id);
    await refresh();
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost" className="text-slate-50 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-7 gap-1 shrink-0"

        onClick={() => setOpen((v) => !v)}
        title="Auto-save history">

        <History className="w-3 h-3" />
        <span className="hidden lg:block">History</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </Button>

      {open &&
      <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold text-foreground">Auto-save History</span>
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1 px-2" onClick={handleSaveNow} disabled={saving}>
                <Save className="w-3 h-3" />
                {saving ? 'Saving…' : 'Save Now'}
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading &&
            <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
            }
              {!loading && snapshots.length === 0 &&
            <p className="text-xs text-muted-foreground text-center py-4">No saved snapshots yet.</p>
            }
              {!loading && snapshots.map((snap) =>
            <div
              key={snap.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer group border-b border-border/50 last:border-0"
              onClick={() => handleRestore(snap)}>

                  <RotateCcw className="w-3 h-3 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{snap.fileName || 'edb'}</p>
                    <p className="text-[10px] text-muted-foreground">{formatTime(snap.timestamp)} &middot; {snap.edbData?.buildings?.length ?? 0} buildings</p>
                  </div>
                  <button
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-destructive transition-opacity"
                onClick={(e) => handleDelete(e, snap.id)}
                title="Delete snapshot">

                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
            )}
            </div>
            <div className="px-3 py-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">Auto-saves every 30 seconds. Up to 20 snapshots stored.</p>
            </div>
          </div>
        </>
      }
    </div>);

}