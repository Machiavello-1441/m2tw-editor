import { parseMeshFile } from '@/lib/m2MeshCodec';
import { parseCasFile } from '@/lib/m2CasCodec';
import { resolveFile } from '@/lib/modFolderStore';
import { buildSheetAtlas } from '@/lib/skinAtlas';

export async function loadArmorySource(db, descriptor) {
  const entry = db?.entries?.find(item => item.name === descriptor.entry);
  if (!entry) throw new Error(`Model entry not found: ${descriptor.entry}. Load battle_models.modeldb first.`);
  const path = entry.meshes?.[descriptor.lod || 0]?.path;
  const file = resolveFile(path);
  if (!file) throw new Error(`Model file not found: ${path || descriptor.entry}. Pick the mod's data folder, including unit_models.`);
  const parsed = /\.cas$/i.test(file.name) ? parseCasFile(await file.arrayBuffer(), file.name) : parseMeshFile(await file.arrayBuffer(), file.name);
  if (!parsed.meshes?.length) throw new Error(parsed.errors?.join(' ') || `Could not read ${file.name}.`);
  const skin = entry.factions?.find(item => item.faction === descriptor.faction) || entry.factions?.[0];
  const attachment = entry.attachFactions?.find(item => item.faction === skin?.faction);
  const main = resolveFile(skin?.texture), attach = resolveFile(attachment?.diffTex);
  const atlas = main ? await buildSheetAtlas(main, attach) : null;
  const normalized = { entry: entry.name, lod: descriptor.lod || 0, faction: skin?.faction || '' };
  const id = JSON.stringify(normalized);
  return { id, descriptor: normalized, path, parsed, atlas, label: `${entry.name} / ${normalized.faction || 'no skin'} / LOD ${normalized.lod}`,
    warnings: [...(parsed.errors || []), ...(!atlas ? ['Diffuse texture missing or unreadable; shown untextured.'] : []), ...(attachment?.diffTex && !attach ? ['Attachment texture missing; main texture repeated.'] : [])] };
}

export function initialArmoryParts(source) {
  return source.parsed.meshes.map((mesh, group) => ({ id: `${source.id}:${group}`, source: source.id, group, name: mesh.name, visible: true,
    position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }));
}