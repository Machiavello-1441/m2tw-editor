import { editorStorage } from '@/lib/editorStorage';

const STORAGE_KEY = 'm2tw_campaign_source_paths';
const normalize = path => String(path || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');

export function sourceDataPath(file) {
  const path = normalize(file.webkitRelativePath);
  if (!path.includes('/')) return null; // A loose file exposes no original directory.
  const parts = path.split('/'), dataIndex = parts.findIndex(part => part.toLowerCase() === 'data');
  if (dataIndex >= 0) return parts.slice(dataIndex).join('/');
  const worldIndex = parts.findIndex((part, index) => part.toLowerCase() === 'world' && parts[index + 1]?.toLowerCase() === 'maps');
  if (worldIndex >= 0) return `data/${parts.slice(worldIndex).join('/')}`;
  if (['text', 'ui'].includes(parts[0].toLowerCase())) return `data/${path}`;
  if (parts[0].toLowerCase() === 'base') return `data/world/maps/${path}`;
  // A folder picker may expose only the selected campaign folder and its descendants.
  return `data/world/maps/campaign/${path}`;
}

function pathsFromFiles(files) {
  const paths = {};
  for (const file of files || []) {
    const path = sourceDataPath(file);
    if (path) paths[file.name.toLowerCase()] = path;
  }
  const strat = paths['descr_strat.txt'];
  const campaignFile = strat || Object.values(paths).find(path => /\/maps\/campaign\//i.test(path));
  const directory = campaignFile?.match(/^(.*\/maps\/campaign\/(?:custom\/)?[^/]+)(?:\/|$)/i)?.[1];
  return { paths, directory };
}

export function rememberCampaignSourceFiles(files, campaignName, replace = false) {
  const incoming = pathsFromFiles(files);
  if (!Object.keys(incoming.paths).length) return;
  const previous = replace ? {} : JSON.parse(editorStorage.getItem(STORAGE_KEY) || '{}');
  editorStorage.setItem(STORAGE_KEY, JSON.stringify({
    campaignName: campaignName || incoming.directory?.split('/').pop() || previous.campaignName,
    directory: incoming.directory || previous.directory,
    paths: { ...previous.paths, ...incoming.paths },
  }));
}

export function getCampaignExportPaths(campaignName = 'imperial_campaign', fallbackDirectory, matchingOnly = false) {
  const stored = JSON.parse(editorStorage.getItem(STORAGE_KEY) || '{}');
  const live = pathsFromFiles(window._m2tw_loaded_map_files || window._m2tw_map_files || []);
  const matches = context => !matchingOnly || context.campaignName === campaignName || context.directory?.split('/').pop().toLowerCase() === campaignName.toLowerCase();
  const saved = matches(stored) ? stored : {};
  const current = matches(live) ? live : {};
  const directory = saved.directory || current.directory || fallbackDirectory || `data/world/maps/campaign/${campaignName}`;
  const paths = { ...(current.paths || {}), ...(saved.paths || {}) };
  return { directory, resolve(fallback) {
    const normalized = normalize(fallback), name = normalized.split('/').pop().toLowerCase();
    return paths[name] || (name === 'descr_events.txt' ? paths['descr_event.txt'] : null) || normalized;
  } };
}