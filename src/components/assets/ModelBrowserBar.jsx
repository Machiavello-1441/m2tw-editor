import React, { useRef } from 'react';
import { FolderOpen, Upload, Shirt, Box } from 'lucide-react';

/**
 * Top bar of the model viewer: pick the unit_models folder once, then choose
 * which modeldb entry to preview and which faction skin to wear. Manual file
 * uploads live here too.
 */
export default function ModelBrowserBar({
  folder, onPickFolder,
  db, entryName, onEntryChange,
  entry, factionIdx, onFactionChange,
  accept, onFiles,
}) {
  const folderRef = useRef(null);
  const fileRef = useRef(null);

  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px]">
      <button
        onClick={() => folderRef.current?.click()}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
      >
        <FolderOpen className="w-3 h-3" />
        {folder ? 'Pick another unit_models folder…' : 'Pick the unit_models folder…'}
      </button>
      <input ref={folderRef} type="file" className="hidden" multiple webkitdirectory="" directory=""
        onChange={(e) => { if (e.target.files.length) onPickFolder(e.target.files); e.target.value = ''; }} />

      {folder && (
        <span className="text-[9px] text-slate-500">
          {folder.models} models · {folder.textures} textures · {folder.modeldbFile ? 'modeldb found' : 'no modeldb'}
        </span>
      )}

      {db?.entries?.length > 0 && (
        <>
          <div className="h-4 w-px bg-slate-700 mx-1" />
          <label className="flex items-center gap-1 text-slate-400">
            <Box className="w-3 h-3" />
            <select
              value={entryName}
              onChange={(e) => onEntryChange(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-slate-200 text-[11px] max-w-[240px]"
            >
              <option value="">— pick a model ({db.entries.length}) —</option>
              {db.entries.map(en => <option key={en.name} value={en.name}>{en.name}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-1 text-slate-400">
            <Shirt className="w-3 h-3" />
            <select
              value={factionIdx}
              onChange={(e) => onFactionChange(Number(e.target.value))}
              disabled={!entry?.factions?.length}
              className="bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-slate-200 text-[11px] max-w-[160px] disabled:opacity-40"
            >
              {(entry?.factions || []).map((f, i) => (
                <option key={f.faction + i} value={i}>{f.faction}</option>
              ))}
              {!entry?.factions?.length && <option value={0}>— faction skin —</option>}
            </select>
          </label>
        </>
      )}

      <div className="h-4 w-px bg-slate-700 mx-1" />

      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-slate-200 transition-colors"
      >
        <Upload className="w-3 h-3" /> Add {accept.split(',').join(' / ')}
      </button>
      <input ref={fileRef} type="file" className="hidden" multiple accept={accept}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}