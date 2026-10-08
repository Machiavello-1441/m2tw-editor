import { getFile, setFile } from '@/lib/bigFileStore';
import { getStringsBinStore, updateStringsBinFile } from '@/lib/stringsBinStore';
import { parseDescrNames } from '@/components/map/additionalParsers';

export function getCharacterNamesFile() {
  return Object.entries(getStringsBinStore()).find(([name]) => /^(?:.*[\\/])?names\.txt(?:\.strings\.bin|\.bin)?$/i.test(name));
}
export function getCharacterNamesRaw() {
  return sessionStorage.getItem('m2tw_descr_names_raw') || getFile('m2tw_names_file') || '';
}
export function getCharacterDisplayNames() {
  const file = getCharacterNamesFile()?.[1];
  return { ...JSON.parse(getFile('m2tw_names_bin_entries') || '{}'),
    ...Object.fromEntries((file?.entries || []).map(e => [e.key, e.value])),
    ...JSON.parse(sessionStorage.getItem('m2tw_char_names_display') || '{}') };
}
export function serializeCharacterNames(names) {
  const factions = new Set(['male', '_surnames', 'female'].flatMap(section => Object.keys(names?.[section] || {})));
  return [...factions].map(faction => [`faction: ${faction}`,
    ...[['male', 'characters'], ['_surnames', 'surnames'], ['female', 'women']].flatMap(([key, label]) =>
      [`\t${label}`, ...(names?.[key]?.[faction] || []).map(name => `\t\t${name}`)])].join('\r\n')).join('\r\n\r\n') + '\r\n';
}
export function addCharacterName({ faction, section, internalName, displayName, descrNames, namesDisplayMap }) {
  const key = internalName.trim(), display = displayName.trim();
  if (!faction || !display || /[{}\r\n]/.test(display) || !/^[^\s{};,\"]+$/.test(key)) throw new Error('Enter a display name and an internal name without spaces or file delimiters.');
  const displayMap = { ...getCharacterDisplayNames(), ...namesDisplayMap };
  if (displayMap[key] !== undefined && displayMap[key] !== display) throw new Error('This internal name already has a different display name. Choose another internal name.');
  const names = descrNames || parseDescrNames(getCharacterNamesRaw());
  const target = faction.toLowerCase();
  const list = names[section]?.[target] || [];
  const next = { ...names, [section]: { ...names[section], [target]: [...new Set([...list, key])] } };
  const raw = serializeCharacterNames(next);
  const map = { ...displayMap, [key]: display };
  setFile('m2tw_names_file', raw);
  setFile('m2tw_names_bin_entries', JSON.stringify(map));
  // Large mod files can exceed session storage; the shared persistent store remains available.
  try { sessionStorage.setItem('m2tw_descr_names_raw', raw); } catch { sessionStorage.removeItem('m2tw_descr_names_raw'); }
  try { sessionStorage.setItem('m2tw_char_names_display', JSON.stringify(map)); } catch { sessionStorage.removeItem('m2tw_char_names_display'); }
  const stored = getCharacterNamesFile();
  updateStringsBinFile(stored?.[0] || 'names.txt.strings.bin', { ...stored?.[1],
    entries: Object.entries(map).map(([key, value]) => ({ key, value })),
    magic1: stored?.[1]?.magic1 ?? 2, magic2: stored?.[1]?.magic2 ?? 2048 });
  window.dispatchEvent(new CustomEvent('load-character-names', { detail: { raw, namesDisplayMap: map } }));
  return key;
}