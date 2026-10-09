const editors = [
  ['Buildings', '/EDBEditor', ['export_descr_buildings.txt']],
  ['Units', '/UnitEditor', ['export_descr_unit.txt']],
  ['Campaign Map', '/CampaignMap', ['descr_strat.txt', 'descr_regions.txt']],
  ['Traits', '/TraitsEditor', ['export_descr_character_traits.txt']],
  ['Ancillaries', '/AncillariesEditor', ['export_descr_ancillaries.txt']],
  ['Factions', '/FactionsEditor', ['descr_sm_factions.txt']],
  ['Cultures', '/CulturesEditor', ['descr_cultures.txt']],
  ['Minor Files', '/MinorFiles', ['descr_names.txt', 'descr_rebel_factions.txt', 'descr_religions.txt', 'descr_sm_resources.txt', 'descr_character.txt', 'descr_campaign_db.xml', 'descr_settlement_mechanics.xml']],
];
const pathOf = file => (file.webkitRelativePath || file.path || file.name).replace(/\\/g, '/');
const special = file => /\.strings\.bin$/i.test(file.name) || /(?:^|\/)eopscripts\/[^/]+\.lua$/i.test(pathOf(file));
const known = new Set(editors.flatMap(editor => editor[2]));
export function workspaceEditors(files) {
  const names = new Set(files.map(file => file.name.toLowerCase()));
  const result = editors.filter(editor => editor[2].some(name => names.has(name))).map(([label, route]) => ({ label, route }));
  if (files.some(file => /\.strings\.bin$/i.test(file.name))) result.push({ label: 'Strings', route: '/StringsBinEditor' });
  if (files.some(file => /(?:^|\/)eopscripts\/[^/]+\.lua$/i.test(pathOf(file)))) result.push({ label: 'Lua Scripts', route: '/LuaScripts' });
  return result;
}
export async function discoverWorkspaceFolders(files, onProgress, signal) {
  const roots = new Map();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (known.has(file.name.toLowerCase()) || special(file)) {
      const parts = pathOf(file).split('/');
      const lower = parts.map(part => part.toLowerCase());
      const data = lower.lastIndexOf('data');
      const anchor = data >= 0 ? data : lower.includes('eopdata') ? lower.lastIndexOf('eopdata') : lower.lastIndexOf('eopscripts');
      const prefix = anchor > 0 ? parts.slice(0, anchor).join('/') : parts[0];
      roots.set(prefix.toLowerCase(), { prefix, name: prefix.split('/').pop(), files: [] });
    }
    if (i % 2000 === 0) {
      signal?.throwIfAborted();
      onProgress({ phase: 'Finding mods and unpacked game files', current: i, total: files.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  const folders = [...roots.values()].sort((a, b) => b.prefix.length - a.prefix.length);
  for (let i = 0; i < files.length; i++) {
    let path = pathOf(files[i]).toLowerCase();
    let folder;
    // Walk ancestors instead of comparing each file with every installed mod.
    while (!folder && path.includes('/')) {
      path = path.slice(0, path.lastIndexOf('/'));
      folder = roots.get(path);
    }
    if (folder) folder.files.push(files[i]);
    if (i % 2000 === 0) {
      signal?.throwIfAborted();
      onProgress({ phase: 'Grouping files by mod', current: i, total: files.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  signal?.throwIfAborted();
  return folders.sort((a, b) => a.name.localeCompare(b.name));
}