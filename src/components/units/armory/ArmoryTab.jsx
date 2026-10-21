import React from 'react';
import { Loader2 } from 'lucide-react';
import ModelViewer from '@/components/assets/ModelViewer';
import ModFolderPicker from '@/components/assets/ModFolderPicker';
import ArmorySources from '@/components/units/armory/ArmorySources';
import ArmoryPartList from '@/components/units/armory/ArmoryPartList';
import useArmoryWorkbench from '@/components/units/armory/useArmoryWorkbench';

export default function ArmoryTab({ unit, units = [], modeldb }) {
  const armory = useArmoryWorkbench(unit, modeldb);
  const button = 'rounded border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50';
  return <section className="flex min-h-0 flex-1 flex-col overflow-auto text-foreground" aria-label="Unit Armory">
    <header className="space-y-2 border-b border-border p-3">
      <h2 className="text-sm font-semibold">Armory · 3D viewer & part assembly</h2>
      <p className="text-xs text-muted-foreground">Preview the current unit or mix model groups from donor units. Files stay on this device; originals are not modified.</p>
      <ModFolderPicker folder={armory.folder} onPick={armory.pick} />
      {!armory.db && <p className="text-xs text-muted-foreground">Pick the mod data folder containing battle_models.modeldb, or load ModelDB from the unit toolbar.</p>}
      <ArmorySources db={armory.db} unit={unit} units={units} busy={armory.busy} onAdd={armory.add} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={armory.busy || !unit.soldier_model} onClick={() => armory.add({ entry: unit.soldier_model, lod: 0, faction: unit.ownership?.[0] || '' })}>View current unit</button>
        <input aria-label="Variation name" className="min-w-32 rounded border border-input bg-background p-1 text-xs" value={armory.name} onChange={event => armory.setName(event.target.value)} />
        <button type="button" className={button} disabled={armory.busy || !armory.parts.length} onClick={armory.save}>Save assembly</button>
        <button type="button" className={button} disabled={armory.busy || !armory.folder || !armory.db} onClick={armory.restore}>Restore saved</button>
        <button type="button" className={button} disabled={armory.busy || !armory.geometry.meshes.length} onClick={armory.exportDraft}>Export OBJ + textures</button>
      </div>
      <p className="text-[11px] text-muted-foreground">Assembly draft only: export is unrigged OBJ, not a game-ready .mesh. Rigging, game-format export and creating roster units are not included yet.</p>
      {armory.busy && <p role="status" className="flex items-center gap-1 text-xs"><Loader2 className="h-3 w-3 animate-spin" />Processing models…</p>}
      {armory.error && <p role="alert" className="text-xs text-destructive">{armory.error}</p>}
      {armory.status && <p role="status" className="text-xs text-muted-foreground">{armory.status}</p>}
    </header>
    <div className="flex min-h-96 flex-1 flex-col lg:flex-row">
      <ArmoryPartList parts={armory.parts} sources={armory.sources} selected={armory.selected} onSelect={armory.setSelected} onChange={armory.setParts} onRemove={armory.remove} />
      {armory.geometry.meshes.length ? <ModelViewer parsedMesh={armory.geometry} hideSidebar className="min-h-96 flex-1" /> : <div className="flex min-h-96 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">{armory.parts.length ? 'Select parts to include in the assembly.' : 'Pick the mod folder, then View current unit or add a donor model.'}</div>}
    </div>
    <p className="border-t border-border p-2 text-[10px] text-muted-foreground">Drag to rotate · Scroll to zoom · Select parts at left to move, rotate or scale them. Independent implementation; no code copied from the linked toolkit.</p>
  </section>;
}