import { getFile } from '@/lib/bigFileStore';
import { getSharedDictionaryFile } from '@/lib/sharedDictionary';
import { parseTextFile } from '@/components/edb/EDBParser';
import { parseUnitDescriptionStrings } from '@/components/units/unitDescriptionsCodec';
import { encodeStringsBin } from '@/components/strings/stringsBinCodec';
import { entriesToTextBytes } from '@/lib/stringsTxtFile';
import { writeLatestZipFile } from '@/components/export/zipFilePrecedence';

const sources = [
  ['export_buildings.txt', 'm2tw_edb_txt_file', parseTextFile],
  ['export_vnvs.txt', 'm2tw_vnvs_file', parseTextFile],
  ['export_ancillaries.txt', 'm2tw_anctxt_file', parseTextFile],
  ['export_units.txt', 'm2tw_export_units_file', parseUnitDescriptionStrings],
  ['descr_religions.txt', 'm2tw_religion_display_names', JSON.parse],
  ['rebel_faction_descr.txt', 'm2tw_rebel_display_names', JSON.parse],
  ['strat.txt', 'm2tw_resource_display_names', JSON.parse],
];

/** Compatibility for text-only imports; a loaded binary always takes priority. */
export function addSharedTextToZip(folder) {
  for (const [name, key, parse] of sources) {
    const raw = getFile(key);
    if (raw === null || getSharedDictionaryFile(name)) continue;
    const entries = Object.entries(parse(raw)).map(([key, value]) => ({ key, value }));
    writeLatestZipFile(folder, `text/${name}.strings.bin`, encodeStringsBin(entries));
    if (parse === JSON.parse) writeLatestZipFile(folder, `text/${name}`, entriesToTextBytes(entries));
  }
}