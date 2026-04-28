/**
 * Parser and serializer for descr_faction_movies.xml
 *
 * Structure:
 * <faction_movies>
 *   <faction>
 *     <name>england</name>
 *     <intro>faction/major_intro.bik</intro>
 *     <victory>faction/england_win.bik</victory>
 *     <defeat>faction/england_lose.bik</defeat>
 *     <death>faction/england_lose.bik</death>
 *   </faction>
 * </faction_movies>
 *
 * Movie paths are relative to data/fmv/
 */

/**
 * Parse descr_faction_movies.xml text → { [factionName]: { intro, victory, defeat, death } }
 */
export function parseFactionMovies(xmlText) {
  const result = {};
  if (!xmlText) return result;

  // Use simple regex-based parser to avoid DOMParser quirks
  const factionBlocks = xmlText.match(/<faction>([\s\S]*?)<\/faction>/gi) || [];
  for (const block of factionBlocks) {
    const name = (block.match(/<name>(.*?)<\/name>/i) || [])[1]?.trim();
    if (!name) continue;
    const intro   = (block.match(/<intro>(.*?)<\/intro>/i) || [])[1]?.trim() || '';
    const victory = (block.match(/<victory>(.*?)<\/victory>/i) || [])[1]?.trim() || '';
    const defeat  = (block.match(/<defeat>(.*?)<\/defeat>/i) || [])[1]?.trim() || '';
    const death   = (block.match(/<death>(.*?)<\/death>/i) || [])[1]?.trim() || '';
    result[name] = { intro, victory, defeat, death };
  }
  return result;
}

/**
 * Serialize faction movies map back to XML text
 */
export function serializeFactionMovies(moviesMap) {
  if (!moviesMap || !Object.keys(moviesMap).length) return '';
  const lines = ['<?xml version="1.0" encoding="utf-8" ?> ', '<faction_movies>'];
  for (const [name, movies] of Object.entries(moviesMap)) {
    lines.push('\t<faction>');
    lines.push(`\t\t<name>${name}</name>`);
    if (movies.intro)   lines.push(`\t\t<intro>${movies.intro}</intro>`);
    if (movies.victory) lines.push(`\t\t<victory>${movies.victory}</victory>`);
    if (movies.defeat)  lines.push(`\t\t<defeat>${movies.defeat}</defeat>`);
    if (movies.death)   lines.push(`\t\t<death>${movies.death}</death>`);
    lines.push('\t</faction>');
  }
  lines.push('</faction_movies>');
  return lines.join('\n');
}