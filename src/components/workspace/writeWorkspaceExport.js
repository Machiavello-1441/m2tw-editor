import { findWorkspaceFile, getWorkspace } from '@/components/workspace/localWorkspace';

export async function confirmWorkspaceWrite() {
  const workspace = getWorkspace();
  if (!workspace?.authorized) throw new Error('Reconnect your local source folder first.');
  if (!window.confirm('Overwrite the exported files in your original mod folder? This changes your source files. Choose Cancel to keep them unchanged.')) return false;
  if (await workspace.root.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Write permission was not granted. No source files were changed.');
  return true;
}
export async function writeWorkspaceExport(zip, modName) {
  const workspace = getWorkspace();
  const dataOnly = workspace.root.name.toLowerCase() === 'data' || [...workspace.files.keys()].some(path => path === 'export_descr_buildings.txt' || path === 'descr_sm_factions.txt');
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  for (const entry of entries) {
    const relative = entry.name.slice(`${modName}/`.length);
    if (!entry.name.startsWith(`${modName}/`) || relative.split('/').some(part => part === '..' || !part)) throw new Error(`Unsafe output path: ${entry.name}`);
    if (dataOnly && !relative.startsWith('data/')) throw new Error('To save EOP scripts in place, connect the mod folder rather than its data subfolder.');
  }
  for (const entry of entries) {
    const relative = entry.name.slice(`${modName}/`.length);
    const lookup = relative.startsWith('data/') ? relative.slice(5) : relative;
    const original = findWorkspaceFile(lookup);
    let handle = original?.handle;
    if (!handle) {
      const parts = (dataOnly ? lookup : relative).split('/');
      let directory = workspace.root;
      for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true });
      handle = await directory.getFileHandle(parts[parts.length - 1], { create: true });
    }
    const writable = await handle.createWritable();
    await writable.write(await entry.async('uint8array'));
    await writable.close();
  }
  return entries.length;
}