export async function workspaceDirectory(root, path) {
  let directory = root;
  try {
    for (const part of path.split('/').filter(Boolean)) directory = await directory.getDirectoryHandle(part);
    return directory;
  } catch (error) {
    if (error.name === 'NotFoundError') return null;
    throw error;
  }
}
export function workspaceFileEntry(root, path, handle) {
  return { name: handle.name, path, handle, webkitRelativePath: `${root.name}/${path}`,
    text: async () => (await handle.getFile()).text(),
    arrayBuffer: async () => (await handle.getFile()).arrayBuffer() };
}
export async function indexWorkspaceFolder(root, { signal, onProgress = () => {} } = {}) {
  const files = new Map();
  const data = await workspaceDirectory(root, 'data');
  if (!data) throw new Error('Select the mod folder containing a data subfolder, not the data folder itself or the Steam folder.');
  const walk = async (directory, prefix, recursive, pattern) => {
    for await (const [name, handle] of directory.entries()) {
      signal?.throwIfAborted();
      const path = `${prefix}/${name}`;
      if (handle.kind === 'directory') {
        if (recursive) await walk(handle, path, true, pattern);
      } else if (pattern.test(name)) files.set(path.toLowerCase(), workspaceFileEntry(root, path, handle));
      onProgress({ phase: 'Checking editor file locations', name: path, current: files.size, total: 0 });
    }
  };
  // Do not walk the installation, other mods, UI art, sounds or model assets.
  await walk(data, 'data', false, /\.(txt|xml|modeldb)$/i);
  for (const path of ['data/text', 'data/world/maps/base', 'data/world/maps/campaign', 'eopData/eopScripts']) {
    signal?.throwIfAborted();
    const directory = await workspaceDirectory(root, path);
    if (directory) await walk(directory, path, true, /\.(txt|xml|bin|tga|lua)$/i);
  }
  const models = await workspaceDirectory(root, 'data/unit_models');
  if (models) {
    try {
      const handle = await models.getFileHandle('battle_models.modeldb');
      files.set('data/unit_models/battle_models.modeldb', workspaceFileEntry(root, 'data/unit_models/battle_models.modeldb', handle));
    } catch (error) { if (error.name !== 'NotFoundError') throw error; }
  }
  signal?.throwIfAborted();
  return files;
}