export default async function selectedModFolder(files, onProgress, signal) {
  const name = files[0]?.webkitRelativePath?.split('/')[0];
  if (!name) throw new Error('Choose one mod folder containing its data subfolder.');
  const selected = [];
  let hasData = false;
  for (let i = 0; i < files.length; i++) {
    if (i % 1000 === 0) {
      signal.throwIfAborted();
      onProgress({ phase: 'Checking selected mod', folder: name, current: i, total: files.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const path = files[i].webkitRelativePath.replace(/\\/g, '/');
    const relative = path.slice(name.length + 1).toLowerCase();
    if (relative.startsWith('mods/')) throw new Error('This is the game installation, not one mod. Choose mods → your mod folder, with data inside it, to avoid listing every installed mod.');
    if (relative.startsWith('data/')) { hasData = true; selected.push(files[i]); }
    else if (relative.startsWith('eopdata/eopscripts/')) selected.push(files[i]);
  }
  signal.throwIfAborted();
  if (!hasData) throw new Error('No files were found inside a data subfolder. Select the mod folder itself, not Steam, mods, or data.');
  return { name, prefix: name, files: selected };
}