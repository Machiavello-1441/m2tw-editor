import { workspaceSetting, clearEditorCaches } from '@/components/workspace/workspaceStorage';

let workspace = null;
let initialization;
export const workspaceEvent = 'm2tw-workspace-changed';
export const getWorkspace = () => workspace;
export const supportsLocalWorkspace = () => typeof window.showDirectoryPicker === 'function';
const announce = () => window.dispatchEvent(new Event(workspaceEvent));

async function indexDirectory(root) {
  const files = new Map();
  async function walk(directory, prefix = '') {
    for await (const [name, handle] of directory.entries()) {
      const path = `${prefix}${name}`;
      if (handle.kind === 'directory') await walk(handle, `${path}/`);
      else files.set(path.toLowerCase(), {
        name, path, handle, webkitRelativePath: `${root.name}/${path}`,
        text: async () => (await handle.getFile()).text(),
        arrayBuffer: async () => (await handle.getFile()).arrayBuffer(),
      });
    }
  }
  await walk(root);
  return files;
}
export function restoreWorkspace() {
  if (!initialization) initialization = (async () => {
    const root = await workspaceSetting('source');
    if (!root) return null;
    workspace = { root, name: root.name, files: new Map(), loaded: new Set(), authorized: false };
    if (await root.queryPermission({ mode: 'read' }) === 'granted') {
      workspace.files = await indexDirectory(root);
      workspace.authorized = true;
    }
    return workspace;
  })();
  return initialization;
}
export async function connectWorkspace() {
  const root = await window.showDirectoryPicker({ id: 'm2tw-source', mode: 'read' });
  if (!window.confirm('Connect this folder? Existing editor caches will be cleared. Export any unsaved changes before continuing. Your source files will not be changed.')) return;
  await workspaceSetting('source', root);
  clearEditorCaches();
  window.location.assign('/Home');
}
export async function authorizeWorkspace() {
  if (await workspace.root.requestPermission({ mode: 'read' }) !== 'granted') throw new Error('Folder access was not granted.');
  workspace.files = await indexDirectory(workspace.root);
  workspace.authorized = true;
  announce();
}
export async function disconnectWorkspace() {
  if (!window.confirm('Disconnect the local folder and clear editor caches? Export unsaved changes first.')) return;
  await workspaceSetting('source', null);
  clearEditorCaches();
  window.location.reload();
}
export function findWorkspaceFile(path) {
  if (!workspace?.authorized || !path) return null;
  const key = path.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
  return workspace.files.get(key) || workspace.files.get(`data/${key}`) || [...workspace.files.values()].find(file => file.path.toLowerCase().endsWith(`/${key}`)) || null;
}