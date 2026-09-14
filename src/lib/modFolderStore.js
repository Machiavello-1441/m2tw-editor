/**
 * An index of a picked mod folder, kept for the session.
 *
 * The browser hands a folder over as a flat FileList where each file carries
 * its `webkitRelativePath`, so a modeldb path like
 * `unit_models/_Units/EN_Body/textures/x.texture` is resolved by matching that
 * relative path from the right — and, failing that, by file name alone, which
 * is what makes a folder picked at any depth still work.
 */
import { parseModeldb } from './modeldbCodec';
import { modeldbStore } from './modeldbStore';

let index = null;

const MODEL_RE = /\.(mesh|cas|ms3d)$/i;
const TEXTURE_RE = /\.(texture|tga|dds)$/i;
const MODELDB_RE = /battle_models\.modeldb$/i;

export function indexFolder(fileList) {
  const byName = new Map();
  let modeldbFile = null;
  let models = 0, textures = 0;

  for (const file of fileList) {
    const relPath = (file.webkitRelativePath || file.name).replace(/\\/g, '/').toLowerCase();
    const name = relPath.split('/').pop();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push({ file, relPath });

    if (MODELDB_RE.test(name)) modeldbFile = file;
    else if (MODEL_RE.test(name)) models++;
    else if (TEXTURE_RE.test(name)) textures++;
  }

  index = { byName, modeldbFile, models, textures, total: fileList.length };
  window.dispatchEvent(new CustomEvent('mod-folder-indexed', { detail: index }));
  return index;
}

export function getFolderIndex() {
  return index;
}

/** Parse the folder's battle_models.modeldb into the shared store. */
export async function loadFolderModeldb(idx = index) {
  if (!idx?.modeldbFile) return null;
  const parsed = parseModeldb(await idx.modeldbFile.text());
  modeldbStore.set(parsed);
  return parsed;
}

/** The File a modeldb path points at, or null. */
export function resolveFile(gamePath) {
  if (!index || !gamePath) return null;
  const p = gamePath.replace(/\\/g, '/').toLowerCase();
  const candidates = index.byName.get(p.split('/').pop());
  if (!candidates || !candidates.length) return null;
  if (candidates.length === 1) return candidates[0].file;
  const exact = candidates.find(c => c.relPath.endsWith(p));
  return (exact || candidates[0]).file;
}