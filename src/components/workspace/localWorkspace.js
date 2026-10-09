import { workspaceSetting, clearEditorCaches } from '@/components/workspace/workspaceStorage';
import readOnlyWorkspace from '@/components/workspace/readOnlyWorkspace';
import { awaitWorkspaceOperation } from '@/components/workspace/workspaceOperation';
import { indexWorkspaceFolder, workspaceDirectory, workspaceFileEntry } from '@/components/workspace/workspaceDirectory';
import { setWorkspaceProgress } from '@/components/workspace/workspaceProgress';
import { clearStringsBinStore } from '@/lib/stringsBinStore';
import { indexCampaignLibrary } from '@/components/map/campaignLibrary';

let workspace = null;
let initialization;
let workspaceGeneration = 0;
export const workspaceEvent = 'm2tw-workspace-changed';
export const getWorkspace = () => workspace;
export const supportsLocalWorkspace = () => typeof window.showDirectoryPicker === 'function';
const announce = () => window.dispatchEvent(new Event(workspaceEvent));

async function indexDirectory(root, options = {}) {
  setWorkspaceProgress({ folder: root.name, phase: 'Checking data subfolder', current: 0 });
  try {
    return await indexWorkspaceFolder(root, { ...options, onProgress: value => {
      setWorkspaceProgress({ ...value, folder: root.name });
      options.onProgress?.(value);
    } });
  } finally {
    setWorkspaceProgress(null);
  }
}
export async function selectWorkspaceFolder() {
  const root = await window.showDirectoryPicker({ id: 'm2tw-mod-folder', mode: 'read' });
  if (!await workspaceDirectory(root, 'data')) throw new Error('Select the mod folder with a data subfolder inside it. Do not select Steam, mods, or the data subfolder itself.');
  return root;
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
export async function connectWorkspace(root, options = {}) {
  options.signal?.throwIfAborted();
  const files = await indexDirectory(root, options);
  options.signal?.throwIfAborted();
  await awaitWorkspaceOperation(workspaceSetting('source', root), options.signal);
  options.signal?.throwIfAborted();
  workspaceGeneration++;
  clearEditorCaches();
  window.__m2twBigFileStore = {};
  clearStringsBinStore();
  for (const key of Object.keys(window)) if (key.startsWith('_m2tw_')) delete window[key];
  indexCampaignLibrary([]);
  workspace = { root, name: root.name, files, loaded: new Set(), authorized: true, readOnly: false };
  initialization = Promise.resolve(workspace);
  window.dispatchEvent(new CustomEvent(workspaceEvent, { detail: { reset: true } }));
}
export async function connectReadOnlyWorkspace(files, options = {}) {
  if (!files.length) throw new Error('The selected folder contains no readable files');
  // Confirmation is provided by the in-app folder review, not blocked iframe dialogs.
  options.onProgress?.({ phase: 'Connecting local file references', current: 0, total: files.length });
  await new Promise(resolve => setTimeout(resolve, 0));
  options.signal?.throwIfAborted();
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
export async function authorizeWorkspace(options = {}) {
  if (await workspace.root.requestPermission({ mode: 'read' }) !== 'granted') throw new Error('Folder access was not granted.');
  const files = await indexDirectory(workspace.root, options);
  options.signal?.throwIfAborted();
  workspace.files = files;
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
export async function resolveWorkspaceFile(path) {
  const cached = findWorkspaceFile(path);
  if (cached || !workspace?.authorized || !workspace.root || !path) return cached;
  const source = workspace;
  const relative = path.replace(/\\/g, '/').replace(/^\//, '');
  const parts = (/^(data|eopData)\//i.test(relative) ? relative : `data/${relative}`).split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  const name = parts.pop();
  const directory = await workspaceDirectory(source.root, parts.join('/'));
  if (!directory) return null;
  try {
    const handle = await directory.getFileHandle(name);
    const entry = workspaceFileEntry(source.root, [...parts, name].join('/'), handle);
    source.files.set(entry.path.toLowerCase(), entry);
    return entry;
  } catch (error) {
    if (error.name === 'NotFoundError') return null;
    throw error;
  }
}