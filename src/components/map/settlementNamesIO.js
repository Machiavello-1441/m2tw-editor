import { parseStringsBin } from '@/components/strings/stringsBinCodec';
import { parseSettlementNames } from '@/components/map/stratParser';
import { getStringsBinStore } from '@/lib/stringsBinStore';
import { setFile } from '@/lib/bigFileStore';

export const namesToText = names => Object.entries(names || {}).map(([k, v]) => `{${k}}${v}`).join('\n');
export function storedCampaignNames(campaign) {
  const prefix = `${campaign}_regions_and_settlement_names`.toLowerCase();
  const entry = Object.entries(getStringsBinStore()).find(([name]) => name.toLowerCase().replace(/\.txt\.strings\.bin$|\.strings\.bin$|\.bin$/, '') === prefix);
  return Object.fromEntries((entry?.[1]?.entries || []).filter(e => e.key).map(e => [e.key, e.value]));
}
export async function readNamesFile(file) {
  const buffer = await file.arrayBuffer();
  if (/\.bin$/i.test(file.name)) {
    const decoded = parseStringsBin(buffer);
    if (!decoded) throw new Error('Could not read the settlement names file.');
    sessionStorage.setItem('m2tw_names_bin_meta', JSON.stringify({ magic1: decoded.magic1, magic2: decoded.magic2 }));
    return namesToText(Object.fromEntries(decoded.entries.filter(e => e.key).map(e => [e.key, e.value])));
  }
  const bytes = new Uint8Array(buffer);
  const encoding = bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : (bytes[0] === 0xff && bytes[1] === 0xfe) || bytes[1] === 0 ? 'utf-16le' : 'utf-8';
  return new TextDecoder(encoding).decode(buffer);
}
export function persistNames(names) {
  const text = namesToText(names);
  setFile('m2tw_names_raw', text);
  try { sessionStorage.setItem('m2tw_names_raw', text); } catch { sessionStorage.removeItem('m2tw_names_raw'); }
}
export async function loadNamesMap(file) { return parseSettlementNames(await readNamesFile(file)); }