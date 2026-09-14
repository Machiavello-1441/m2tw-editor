import React, { useRef } from 'react';
import { FolderOpen } from 'lucide-react';

/**
 * One picker for the whole mod folder — the modeldb, the models and the
 * textures all come from it, so nothing has to be uploaded twice.
 */
export default function ModFolderPicker({ folder, onPick }) {
  const ref = useRef(null);

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Mod Folder</p>
      <button
        onClick={() => ref.current?.click()}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
      >
        <FolderOpen className="w-3 h-3" /> {folder ? 'Pick another folder…' : 'Pick data folder…'}
      </button>
      <input
        ref={ref} type="file" className="hidden" multiple webkitdirectory="" directory=""
        onChange={(e) => { if (e.target.files.length) onPick(e.target.files); e.target.value = ''; }}
      />
      {folder && (
        <p className="text-[9px] text-slate-500">
          {folder.models} models · {folder.textures} textures ·{' '}
          {folder.modeldbFile ? 'modeldb found' : 'no battle_models.modeldb'}
        </p>
      )}
    </div>
  );
}