import { parseStringsBin } from '@/components/strings/stringsBinCodec';
import { parseSettlementNames, parseDescrRegions, serializeDescrRegions, parseWinConditions, serializeWinConditions } from '@/components/map/stratParser';
import { parseFactionMovies } from '@/components/map/factionMoviesParser';
import { parseCampaignEvents } from '@/components/map/campaignEventsParser';
import { parseDisasters } from '@/components/map/disastersParser';
import { decodeTGA } from '@/components/map/tgaLoader';

export function decodeExportText(bytes) {
  const encoding = bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : (bytes[0] === 0xff && bytes[1] === 0xfe) || bytes[1] === 0 ? 'utf-16le' : 'utf-8';
  return new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
export const exportDataPath = path => String(path).replace(/\\/g, '/').replace(/^.*?(?=data\/)/i, '').replace(/^\/+/, '').toLowerCase();

/** Compare game content, not generated line endings, dictionary order or TGA headers. */
export async function exportFingerprint(path, input) {
  let bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const name = path.split('/').pop().toLowerCase();
  let content;
  if (/\.tga$/i.test(name)) {
    const image = decodeTGA(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    if (image) {
      const rgb = new Uint8Array(8 + image.width * image.height * 3);
      const view = new DataView(rgb.buffer); view.setUint32(0, image.width, true); view.setUint32(4, image.height, true);
      for (let i = 0, at = 8; i < image.data.length; i += 4) { rgb[at++] = image.data[i]; rgb[at++] = image.data[i + 1]; rgb[at++] = image.data[i + 2]; }
      bytes = rgb;
    }
  } else if (/\.bin$/i.test(name)) {
    const file = parseStringsBin(bytes);
    if (file && file.trailerKind !== 'opaque') content = JSON.stringify(file.magic1 === 1 ? file.entries.map(entry => entry.value) : sorted(Object.fromEntries(file.entries.map(entry => [entry.key, entry.value]))));
  } else if (/\.(txt|xml|modeldb)$/i.test(name)) {
    content = decodeExportText(bytes);
    if (/_regions_and_settlement_names\.txt$/i.test(name)) content = JSON.stringify(sorted(parseSettlementNames(content)));
    else if (name === 'descr_regions.txt') content = serializeDescrRegions(parseDescrRegions(content));
    else if (name === 'descr_win_conditions.txt') content = serializeWinConditions(parseWinConditions(content));
    else if (name === 'descr_faction_movies.xml') content = JSON.stringify(parseFactionMovies(content));
    else if (name === 'descr_disasters.txt') content = JSON.stringify(parseDisasters(content));
    else if (name === 'descr_events.txt' && /\/maps\/campaign\//i.test(path)) content = JSON.stringify(parseCampaignEvents(content));
    else if (name === 'descr_strat.txt') content = content.split('\n').map(line => (line.match(/"[^"\n]*"|[^\s]+/g) || []).join(' ')).filter(Boolean).join('\n');
    content = content.replace(/\n+$/, '');
  }
  if (content !== undefined) bytes = new TextEncoder().encode(content);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}