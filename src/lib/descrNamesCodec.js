// Shared descr_names grammar: optional colon, grouped factions and repeated blocks.
export function namesFactionHeader(line) {
  const match = line.replace(/;.*$/, '').trim().match(/^faction(?:\s*:\s*|\s+)(.+)$/i);
  return match ? match[1].split(/[\s,]+/).filter(Boolean) : null;
}

export function parseDescrNames(text) {
  const factions = {};
  let current = [], section = null;
  const sections = { characters: 'characters', male: 'characters', surnames: 'surnames', surname: 'surnames', women: 'females', female: 'females', females: 'females' };
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    const header = namesFactionHeader(line);
    if (header) {
      current = header;
      for (const faction of current) factions[faction] ||= { characters: [], surnames: [], females: [] };
      section = null;
    } else if (/^end$/i.test(line)) {
      current = []; section = null;
    } else if (sections[line.toLowerCase()]) {
      section = sections[line.toLowerCase()];
    } else if (section && /^\S+$/.test(line)) {
      for (const faction of current) factions[faction][section].push(line);
    }
  }
  return factions;
}

export function serializeDescrNames(factions) {
  return Object.entries(factions).map(([name, data]) => [
    `faction: ${name}`,
    ...[['characters', 'characters'], ['surnames', 'surnames'], ['females', 'women']].flatMap(([key, label]) =>
      [`\t${label}`, ...(data[key] || []).map(value => `\t\t${value}`)]),
  ].join('\n')).join('\n\n');
}

export function duplicateDescrNames(raw, source, target) {
  const newline = raw.match(/\r\n|\r|\n/)?.[0] || '\n';
  const lines = raw.split(/\r\n|\r|\n/);
  const headers = [];
  lines.forEach((line, index) => {
    const factions = namesFactionHeader(line);
    if (factions) headers.push({ index, factions: factions.map(name => name.toLowerCase()) });
  });
  const src = source.toLowerCase(), dst = target.toLowerCase();
  const sources = headers.filter(header => header.factions.includes(src));
  if (!sources.length) throw new Error(`No names block found for ${source} in descr_names.txt. No changes made.`);
  const parsed = Object.entries(parseDescrNames(raw));
  const sourceNames = parsed.filter(([name]) => name.toLowerCase() === src).map(([, data]) => data);
  const targetHeaders = headers.filter(header => header.factions.includes(dst));
  if (targetHeaders.length) {
    // Existing placeholders or incomplete pools must not silently skip the copy.
    // Preserve custom target names and add only missing source entries.
    const targetNames = parsed.filter(([name]) => name.toLowerCase() === dst).map(([, data]) => data);
    const missing = {};
    for (const section of ['characters', 'surnames', 'females']) {
      const existing = new Set(targetNames.flatMap(data => data[section]));
      missing[section] = [...new Set(sourceNames.flatMap(data => data[section]))].filter(name => !existing.has(name));
    }
    const count = Object.values(missing).reduce((total, names) => total + names.length, 0);
    if (!count) return { ok: false, already: true, out: raw, count: 0, blocks: 0 };
    const lastTarget = targetHeaders[targetHeaders.length - 1];
    const end = headers.find(next => next.index > lastTarget.index)?.index ?? lines.length;
    const out = [...lines];
    out.splice(end, 0, '', ...serializeDescrNames({ [target]: missing }).split('\n'), '');
    return { ok: true, out: out.join(newline), count, blocks: 1 };
  }
  const out = [...lines];
  // Copy EVERY source block, including all sections, comments and name entries.
  // Insert bottom-up so all source boundaries remain valid.
  for (const header of [...sources].reverse()) {
    const end = headers.find(next => next.index > header.index)?.index ?? lines.length;
    const block = lines.slice(header.index, end);
    block[0] = `faction: ${target}`;
    out.splice(end, 0, '', ...block);
  }
  const count = sourceNames.reduce((total, data) => total + data.characters.length + data.surnames.length + data.females.length, 0);
  return { ok: true, out: out.join(newline), count, blocks: sources.length };
}