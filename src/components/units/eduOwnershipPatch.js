/**
 * Faction duplication is an insertion-only edit of the original EDU text.
 * Never parse/serialize unit records here: unknown directives are game data too.
 */
function identifier(value, label, optional = false) {
  if (optional && (value === '' || value == null)) return '';
  if (typeof value !== 'string' || !/^[a-z0-9_]+$/i.test(value.trim())) {
    throw new Error(`${label} must be a faction/culture identifier without spaces or file delimiters.`);
  }
  return value.trim();
}

export function patchEduOwnership(raw, sourceFaction, targetFaction, sourceCulture = '') {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('The original export_descr_unit.txt is required. A parsed unit cache is not a safe replacement.');
  }
  const source = identifier(sourceFaction, 'Source faction');
  const target = identifier(targetFaction, 'New faction');
  const culture = identifier(sourceCulture, 'Source culture', true);
  const sources = new Set([source, culture].filter(Boolean).map(name => name.toLowerCase()));
  let count = 0, already = 0, srcLines = 0, ownershipLines = 0, eraLines = 0;
  const insertions = [];
  // Horizontal whitespace only: never consume a newline or a commented-out line.
  const out = raw.replace(/^([\t \uFEFF]*(ownership|era[\t ]+\d+)[\t ]+)([^;\r\n]*)/gmi,
    (line, prefix, directive, list, offset) => {
      // Entries are comma-delimited. Preserve commas, spacing and case as written.
      // Do not guess at malformed lists or reinterpret comments as faction names.
      const tokens = [...list.matchAll(/[^,]+/g)].map(match => ({
        name: match[0].trim(),
        end: match.index + match[0].trimEnd().length,
      }));
      if (!tokens.length || tokens.some(token => !/^[a-z0-9_]+$/i.test(token.name))) return line;
      const src = tokens.find(token => sources.has(token.name.toLowerCase()));
      if (!src) return line;
      srcLines++;
      if (tokens.some(token => token.name.toLowerCase() === target.toLowerCase())) {
        already++;
        return line;
      }
      // Insert immediately after the source token, leaving every original
      // character (including comments and CRLF/LF/CR endings) in place.
      const position = prefix.length + src.end;
      const addition = `, ${target}`;
      insertions.push({ offset: offset + position, text: addition });
      count++;
      if (/^ownership$/i.test(directive)) ownershipLines++; else eraLines++;
      return line.slice(0, position) + addition + line.slice(position);
    });
  return { out, count, already, srcLines, ownershipLines, eraLines, insertions };
}

/** Runtime guard: undoing only our recorded insertions must reproduce the input. */
export function verifyEduOwnershipPatch(original, patch) {
  let rebuilt = '', cursor = 0;
  for (const { offset, text } of patch.insertions) {
    if (!Number.isInteger(offset) || offset < cursor || offset > original.length) {
      throw new Error('Unsafe EDU patch: invalid insertion position. No file was written.');
    }
    rebuilt += original.slice(cursor, offset) + text;
    cursor = offset;
  }
  rebuilt += original.slice(cursor);
  if (rebuilt !== patch.out || patch.insertions.length !== patch.count) {
    throw new Error('Unsafe EDU patch: content outside the faction additions changed. No file was written.');
  }
  return true;
}
