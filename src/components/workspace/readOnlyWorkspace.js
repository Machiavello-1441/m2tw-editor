// Index browser-selected files without reading their bytes or uploading them.
export default async function readOnlyWorkspace(selectedFiles, { folder, onProgress = () => {} } = {}) {
  const files = new Map();
  const name = folder?.name || selectedFiles[0].webkitRelativePath.split('/')[0];
  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    if (i % 1000 === 0) {
      onProgress({ phase: 'Connecting file references', current: i, total: selectedFiles.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const relative = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    const path = folder ? relative.slice(folder.prefix.length + 1) : relative.includes('/') ? relative.slice(relative.indexOf('/') + 1) : relative;
    files.set(path.toLowerCase(), {
      name: file.name, path, webkitRelativePath: `${name}/${path}`, size: file.size,
      handle: { getFile: async () => file },
      text: () => file.text(), arrayBuffer: () => file.arrayBuffer(),
    });
  }
  return { root: null, name: name || 'Selected folder', files, loaded: new Set(), authorized: true, readOnly: true };
}