import { getFile } from '@/lib/bigFileStore';
import { getStringsBinStore } from '@/lib/stringsBinStore';
import { parseSettlementNames } from '@/components/map/stratParser';
import { encodeStoredStringsBin } from '@/components/strings/stringsBinCodec';
import { entriesToTextBytes } from '@/lib/stringsTxtFile';
import { writeLatestZipFile, removeZipFile } from '@/components/export/zipFilePrecedence';

export const campaignNamesBase = name => String(name).replace(/^.*[\\/]/, '').replace(/(?:\.txt)?(?:\.strings)?\.bin$|\.txt$/i, '').toLowerCase();
export function campaignNamesRecord(campaignName, names) {
  const base = `${campaignName}_regions_and_settlement_names`;
  const stored = Object.entries(getStringsBinStore()).find(([name]) => campaignNamesBase(name) === base.toLowerCase());
  const raw = getFile('m2tw_names_raw');
  if (names == null && raw == null && !stored) return null;
  const savedMeta = JSON.parse(getFile('m2tw_names_bin_meta') || '{}');
  const meta = stored?.[1] || (campaignNamesBase(savedMeta.filename || '') === base.toLowerCase() ? savedMeta : {});
  if (meta.magic1 === 1 || meta.format === 'ordered') throw new Error('Campaign settlement names need a keyed strings file; an ordered file cannot safely store province identifiers.');
  const values = new Map((meta.entries || []).map(entry => [entry.key, entry.value]));
  for (const [key, value] of Object.entries(names ?? (raw == null ? {} : parseSettlementNames(raw)))) values.set(key, value);
  const data = { ...meta, magic1: meta.magic1 ?? 2, magic2: meta.magic2 ?? 2048, entries: [...values].map(([key, value]) => ({ key, value })) };
  return { filename: `${base}.txt.strings.bin`, data };
}

/** Run after shared dictionaries, so an older loaded binary cannot undo live names. */
export function addCampaignNamesToZip(folder, campaignName, names) {
  if (!campaignName) return;
  const record = campaignNamesRecord(campaignName, names);
  if (!record) return;
  // Encode before touching the archive: unsupported trailers must fail, not lose edits.
  const binary = encodeStoredStringsBin(record.data);
  const textName = record.filename.replace(/\.strings\.bin$/i, '');
  for (const name of Object.keys(folder.files)) {
    const relative = name.slice((folder.root || '').length);
    if (/^text\//i.test(relative) && campaignNamesBase(relative) === campaignNamesBase(record.filename)) removeZipFile(folder, relative);
  }
  writeLatestZipFile(folder, `text/${record.filename}`, binary);
  writeLatestZipFile(folder, `text/${textName}`, entriesToTextBytes(record.data.entries));
}

export function addActiveCampaignNamesToZip(folder) {
  const raw = getFile('m2tw_campaign_strat') || '';
  const campaignName = raw.match(/^[\t ]*campaign[\t ]+([^\s;]+)/im)?.[1];
  addCampaignNamesToZip(folder, campaignName);
}