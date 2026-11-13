export function parseExportUnits(text) {
  const map = {};
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith(';')) { i++; continue; }
    if (!trimmed.startsWith('{')) { i++; continue; }
    const keyMatch = trimmed.match(/^\{([^}]+)\}/);
    if (!keyMatch) { i++; continue; }
    const fullKey = keyMatch[1].trim();
    const afterBrace = trimmed.slice(keyMatch[0].length);
    const inlineValue = afterBrace.replace(/^[¬\t ]/, '').trim();
    const isShort = fullKey.endsWith('_descr_short');
    const isLong = !isShort && fullKey.endsWith('_descr');
    if (isShort) {
      const baseKey = fullKey.slice(0, -'_descr_short'.length);
      map[baseKey] = map[baseKey] || {};
      if (inlineValue) map[baseKey].short = inlineValue;
      else {
        const parts = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith('{')) { parts.push(lines[i]); i++; }
        map[baseKey].short = parts.join('\n').trim();
        continue;
      }
    } else if (isLong) {
      const baseKey = fullKey.slice(0, -'_descr'.length);
      map[baseKey] = map[baseKey] || {};
      if (inlineValue) map[baseKey].long = inlineValue;
      else {
        const parts = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith('{')) { parts.push(lines[i]); i++; }
        map[baseKey].long = parts.join('\n').trim();
        continue;
      }
    } else {
      map[fullKey] = map[fullKey] || {};
      if (inlineValue) map[fullKey].name = inlineValue;
      else {
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length && !lines[i].trim().startsWith('{')) { map[fullKey].name = lines[i].trim(); i++; }
        continue;
      }
    }
    i++;
  }
  return map;
}

export function serializeExportUnits(descrMap) {
  const lines = [];
  for (const [key, val] of Object.entries(descrMap)) {
    lines.push(`{${key}}\t${val.name || ''}`, '');
    if (val.long) lines.push(`{${key}_descr}`, val.long, '');
    if (val.short) lines.push(`{${key}_descr_short}`, val.short, '');
  }
  return lines.join('\n');
}

export function groupUnitDescriptions(strings) {
  const map = {};
  for (const [key, value] of Object.entries(strings || {})) {
    const suffix = key.endsWith('_descr_short') ? '_descr_short' : key.endsWith('_descr') ? '_descr' : '';
    const base = suffix ? key.slice(0, -suffix.length) : key;
    (map[base] ||= {})[suffix === '_descr_short' ? 'short' : suffix ? 'long' : 'name'] = value;
  }
  return map;
}
export function flattenUnitDescriptions(map) {
  return Object.fromEntries(Object.entries(map || {}).flatMap(([key, value]) =>
    [['name', ''], ['long', '_descr'], ['short', '_descr_short']].filter(([field]) => value[field] !== undefined).map(([field, suffix]) => [key + suffix, value[field]])));
}
export const parseUnitDescriptionStrings = text => flattenUnitDescriptions(parseExportUnits(text));
export const serializeUnitDescriptionStrings = strings => serializeExportUnits(groupUnitDescriptions(strings));