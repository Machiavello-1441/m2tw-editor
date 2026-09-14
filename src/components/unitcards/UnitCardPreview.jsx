import React, { useState, useEffect } from 'react';
import { parseMeshFile } from '@/lib/m2MeshCodec';
import { indexFolder, getFolderIndex, loadFolderModeldb, resolveFile } from '@/lib/modFolderStore';
import ModFolderPicker from '@/components/assets/ModFolderPicker';
import ModelViewer from '@/components/assets/ModelViewer';
import { Box, AlertTriangle } from 'lucide-react';

/**
 * 3D preview of the model a unit-card entry points at. The entry only stores a
 * model stem (e.g. "peasant_crossbowmen"), so the LOD0 mesh is resolved out of
 * the picked mod folder — the same index the model viewer uses, which also lets
 * the viewer's skin panel find the entry's textures in battle_models.modeldb.
 */
export default function UnitCardPreview({ modelFile }) {
  const [folder, setFolder] = useState(() => getFolderIndex());
  const [model, setModel] = useState(null); // { name, parsed }
  const [error, setError] = useState('');

  const load = async (stem, idx) => {
    setError('');
    setModel(null);
    if (!stem) return;
    if (!idx) return;

    const candidates = [`${stem}_lod0.mesh`, `${stem}.mesh`, `${stem}_lod1.mesh`];
    const hit = candidates.map(c => resolveFile(c)).find(Boolean);
    if (!hit) {
      setError(`No mesh found in the folder for "${stem}" (looked for ${stem}_lod0.mesh)`);
      return;
    }
    try {
      const parsed = parseMeshFile(await hit.arrayBuffer(), hit.name);
      if (!parsed.meshes?.length) throw new Error(parsed.errors?.[0] || 'no mesh groups');
      setModel({ name: hit.name, parsed });
    } catch (err) {
      setError(`Could not read ${hit.name}: ${err.message}`);
    }
  };

  useEffect(() => { load(modelFile, folder); }, [modelFile, folder]);

  const pickFolder = async (fileList) => {
    const idx = indexFolder(fileList);
    setFolder(idx);
    await loadFolderModeldb(idx);
  };

  if (!folder) {
    return (
      <div className="p-3 space-y-2 text-[11px]">
        <p className="text-[10px] text-slate-500">
          Pick your mod folder to preview the unit's 3D model here.
        </p>
        <ModFolderPicker folder={folder} onPick={pickFolder} />
      </div>
    );
  }

  if (!modelFile) {
    return (
      <p className="p-3 text-[10px] text-slate-600 flex items-center gap-1.5">
        <Box className="w-3 h-3" /> Set a model file on this entry to preview it.
      </p>
    );
  }

  if (error) {
    return (
      <p className="p-3 text-[10px] text-amber-400 flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-px" /> <span className="break-all">{error}</span>
      </p>
    );
  }

  if (!model) {
    return <p className="p-3 text-[10px] text-slate-600">Loading {modelFile}…</p>;
  }

  return (
    <ModelViewer
      parsedMesh={model.parsed}
      modelName={model.name}
      className="w-full h-full"
    />
  );
}