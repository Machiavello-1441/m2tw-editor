// Index browser-selected files without reading their bytes or uploading them.
export default function readOnlyWorkspace(selectedFiles) {
  const files = new Map();
  const name = selectedFiles[0].webkitRelativePath.split('/')[0];
  for (const file of selectedFiles) {
    const relative = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    const path = relative.includes('/') ? relative.slice(relative.indexOf('/') + 1) : relative;
    files.set(path.toLowerCase(), {
      name: file.name, path, webkitRelativePath: relative, size: file.size,
      handle: { getFile: async () => file },
      text: () => file.text(), arrayBuffer: () => file.arrayBuffer(),
    });
  }
  return { root: null, name: name || 'Selected folder', files, loaded: new Set(), authorized: true, readOnly: true };
}