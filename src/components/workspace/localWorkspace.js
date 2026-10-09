import { workspaceSetting, clearEditorCaches } from '@/components/workspace/workspaceStorage';
import readOnlyWorkspace from '@/components/workspace/readOnlyWorkspace';
import { awaitWorkspaceOperation } from '@/components/workspace/workspaceOperation';
import { clearStringsBinStore } from '@/lib/stringsBinStore';
import { indexCampaignLibrary } from '@/components/map/campaignLibrary';

let workspace = null;
let initialization;
let workspaceGeneration = 0;
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
    const generation = workspaceGeneration;
    const root = await workspaceSetting('source');
    if (!root || generation !== workspaceGeneration) return workspace;
    const restored = { root, name: root.name, files: new Map(), loaded: new Set(), authorized: false };
    if (await root.queryPermission({ mode: 'read' }) === 'granted') {
      restored.files = await indexDirectory(root);
      restored.authorized = true;
    }
    if (generation === workspaceGeneration) workspace = restored;
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
export async function connectReadOnlyWorkspace(files, options = {}) {
  if (!files.length) throw new Error('The selected folder contains no readable files');
  // Confirmation is provided by the in-app folder review, not blocked iframe dialogs.
  options.onProgress?.({ phase: 'Checking local file read access', current: 0, total: files.length });
  await new Promise(resolve => setTimeout(resolve, 0));
  options.signal?.throwIfAborted();
  await awaitWorkspaceOperation(files[0].slice(0, 1).arrayBuffer(), options.signal);
  const nextWorkspace = await readOnlyWorkspace(files, options);
  options.signal?.throwIfAborted();
  await awaitWorkspaceOperation(workspaceSetting('source', null), options.signal);
  options.signal?.throwIfAborted();
  workspaceGeneration++;
  clearEditorCaches();
  window.__m2twBigFileStore = {};
  clearStringsBinStore();
  for (const key of Object.keys(window)) if (key.startsWith('_m2tw_')) delete window[key];
  indexCampaignLibrary([]);
  workspace = nextWorkspace;
  initialization = Promise.resolve(workspace);
  options.onProgress?.({ phase: 'Ready to edit', current: files.length, total: files.length });
  window.dispatchEvent(new CustomEvent(workspaceEvent, { detail: { reset: true } }));
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