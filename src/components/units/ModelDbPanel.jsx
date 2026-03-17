import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Plus, Trash2, ChevronDown, ChevronRight, Download } from 'lucide-react';

const INP = 'w-full h-6 px-1.5 text-[11px] font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary';

function FieldRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-14 shrink-0">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} className={`${INP} flex-1`} />
    </div>
  );
}

export default function ModelDbPanel({ soldierModel, modeldb, onUpdateEntry, onDownload }) {
  const entry = modeldb?.byName?.[soldierModel] || null;

  const [factions, setFactions] = useState([]);
  const [meshes, setMeshes] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (entry) {
      setFactions(entry.factions.map(f => ({ ...f })));
      setMeshes(entry.meshes.map(m => ({ ...m })));
      setDirty(false);
    }
  }, [soldierModel, entry?.name]);

  if (!modeldb) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto opacity-30" />
        <p className="text-sm text-muted-foreground">No battle_models.modeldb loaded.</p>
        <p className="text-xs text-muted-foreground">Use the <strong>Load ModelDB</strong> button in the toolbar above.</p>
      </div>
    );
  }

  if (!soldierModel) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Set a soldier model name in the Identity tab first.
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto opacity-60" />
        <p className="text-sm text-foreground">
          No entry found for <code className="bg-accent px-1 rounded font-mono text-xs">{soldierModel}</code>
        </p>
        <p className="text-xs text-muted-foreground">
          The <em>soldier_model</em> name (Identity tab) must exactly match a BMDB entry name.
        </p>
        <p className="text-xs text-muted-foreground">
          {Object.keys(modeldb.byName).length} entries loaded in ModelDB.
        </p>
      </div>
    );
  }

  const mutFactions = (fn) => { setFactions(fn); setDirty(true); };

  const setFactionField = (i, key, val) =>
    mutFactions(prev => { const n = [...prev]; n[i] = { ...n[i], [key]: val }; return n; });

  const setMeshField = (i, key, val) => {
    setMeshes(prev => { const n = [...prev]; n[i] = { ...n[i], [key]: val }; return n; });
    setDirty(true);
  };

  const addFaction = () =>
    mutFactions(prev => [...prev, { faction: 'new_faction', texture: '', normalTex: '', sprite: '' }]);

  const removeFaction = (i) =>
    mutFactions(prev => prev.filter((_, idx) => idx !== i));

  const save = () => {
    onUpdateEntry(entry.name, { ...entry, factions, meshes });
    setDirty(false);
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-5">

        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-sm font-semibold text-foreground font-mono">{entry.name}</span>
            <span className="text-xs text-muted-foreground">{factions.length} factions</span>
          </div>
          <div className="flex gap-2">
            {dirty && (
              <Button size="sm" onClick={save}
                className="h-7 text-[11px] bg-green-700 hover:bg-green-600 text-white gap-1.5">
                Save changes
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onDownload} className="h-7 text-[11px] gap-1.5">
              <Download className="w-3 h-3" /> Download ModelDB
            </Button>
          </div>
        </div>

        {/* Mesh LODs */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mesh LODs</p>
          <div className="space-y-1.5">
            {meshes.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-10 shrink-0 text-right">LOD {i}</span>
                <input value={m.path} onChange={e => setMeshField(i, 'path', e.target.value)} className={`${INP} flex-1`} />
                <input value={m.dist} onChange={e => setMeshField(i, 'dist', Number(e.target.value))}
                  type="number" className="w-16 h-6 px-1.5 text-[11px] font-mono bg-background border border-border rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Body Factions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Faction Textures</p>
            <button onClick={addFaction}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
              <Plus className="w-3 h-3" /> Add faction
            </button>
          </div>
          <div className="space-y-2">
            {factions.map((f, i) => (
              <div key={i} className="border border-border rounded-lg p-2.5 space-y-1.5 bg-card/40">
                <div className="flex items-center gap-2">
                  <input value={f.faction} onChange={e => setFactionField(i, 'faction', e.target.value)}
                    className="w-28 h-6 px-1.5 text-[11px] font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary font-bold" />
                  <button onClick={() => removeFaction(i)}
                    className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <FieldRow label="texture" value={f.texture} onChange={v => setFactionField(i, 'texture', v)} />
                <FieldRow label="normal" value={f.normalTex} onChange={v => setFactionField(i, 'normalTex', v)} />
                <FieldRow label="sprite" value={f.sprite} onChange={v => setFactionField(i, 'sprite', v)} />
              </div>
            ))}
          </div>
        </div>

        {/* AttachmentSets – collapsible read-only */}
        {entry.attachFactions?.length > 0 && (
          <div>
            <button onClick={() => setShowAttach(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              {showAttach ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              AttachmentSets <span className="text-muted-foreground">({entry.attachFactions.length} factions, read-only)</span>
            </button>
            {showAttach && (
              <div className="mt-2 pl-4 border-l border-border space-y-1">
                {entry.attachFactions.map((f, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground/70 font-mono">{f.faction}</span>{' '}
                    <span className="opacity-60">{f.diffTex.split('/').slice(-2).join('/')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </ScrollArea>
  );
}