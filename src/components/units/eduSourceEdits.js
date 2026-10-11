/** Source-preserving output for explicit Unit Editor edits (not faction copying). */
export function eduLines(text) {
  const lines = [];
  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (!match[0]) continue;
    lines.push({ body: match[1], ending: match[2], offset: match.index });
  }
  return lines;
}

function directive(body, occurrences) {
  const match = body.match(/^([ \t\uFEFF]*)([a-z_][a-z_0-9]*)([ \t]+)(.*)$/i);
  if (!match) return null;
  let key = match[2].toLowerCase();
  let prefix = match[1] + match[2] + match[3];
  let rest = match[4];
  if (key === 'banner' || key === 'era') {
    const sub = rest.match(/^(\S+)([ \t]+)(.*)$/);
    if (!sub) return null;
    key += ` ${sub[1].toLowerCase()}`;
    prefix += sub[1] + sub[2];
    rest = sub[3];
  }
  if (key === 'officer') {
    const occurrence = occurrences.officer || 0;
    occurrences.officer = occurrence + 1;
    key += ` ${occurrence}`;
  }
  const semicolon = rest.indexOf(';');
  const code = semicolon < 0 ? rest : rest.slice(0, semicolon);
  const value = code.trimEnd();
  const tail = rest.slice(value.length);
  return { key, prefix, value, tail, indent: match[1],
    comment: semicolon < 0 ? '' : rest.slice(semicolon), body };
}

function generatedDirectives(text) {
  const result = new Map(), occurrences = {};
  for (const { body } of eduLines(text)) {
    const item = directive(body, occurrences);
    if (item) result.set(item.key, item);
  }
  return result;
}

/**
 * Compare the editor's old/new *supported fields* to identify deliberate edits.
 * Apply only those edits to the original block; never emit the template itself.
 * Unknown directives, untouched fields, comments and line endings stay verbatim.
 */
export function patchEditedUnit(source, beforeGenerated, afterGenerated) {
  if (beforeGenerated === afterGenerated) return source;
  const before = generatedDirectives(beforeGenerated);
  const after = generatedDirectives(afterGenerated);
  const changed = new Set([...before.keys(), ...after.keys()].filter(key => {
    const a = before.get(key), b = after.get(key);
    return a?.value !== b?.value || (key === 'dictionary' && a?.comment !== b?.comment);
  }));
  const occurrences = {}, found = new Set();
  const lines = eduLines(source);
  const newline = lines.find(line => line.ending)?.ending || '\n';
  let lastDirective = -1;
  const result = lines.map(({ body, ending }, index) => {
    const item = directive(body, occurrences);
    if (!item) return body + ending;
    lastDirective = index;
    if (!changed.has(item.key)) return body + ending;
    if (found.has(item.key)) throw new Error(`Cannot safely edit repeated EDU directive ${item.key}. Original source has not been rewritten.`);
    found.add(item.key);
    const next = after.get(item.key);
    // Keep a removed optional directive's comment as a comment-only line.
    if (!next) return item.comment ? item.indent + item.comment + ending : '';
    let tail = item.tail;
    if (item.key === 'dictionary' && before.get(item.key)?.comment !== next.comment) {
      const gap = tail.match(/^[ \t]*/)?.[0] || ' ';
      tail = next.comment ? gap + next.comment : (tail.match(/^[ \t]*/)?.[0] || '');
    }
    return item.prefix + next.value + tail + ending;
  });
  const additions = [...changed].filter(key => !found.has(key) && after.has(key)).map(key => after.get(key).body);
  if (additions.length) {
    // Insert after the last active directive, before trailing comment/blank lines.
    const insertion = lastDirective + 1;
    if (lastDirective >= 0 && result[lastDirective] && !/[\r\n]$/.test(result[lastDirective])) result[lastDirective] += newline;
    result.splice(insertion, 0, additions.join(newline) + newline);
  }
  return result.join('');
}
