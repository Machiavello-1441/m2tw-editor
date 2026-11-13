import { getFile } from '@/lib/bigFileStore';
import { toUtf16leBytes } from '@/lib/utf16';
import { SHARED_EXPORT_SOURCES, sharedExportPath } from '@/components/export/sharedExportSources';
import { writeLatestZipFile } from '@/components/export/zipFilePrecedence';
import { addSharedStringsToZip } from '@/components/export/sharedStringsExport';
import { addCharacterNamesToZip } from '@/components/export/characterNamesExport';
import { addSharedTextToZip } from '@/components/export/sharedTextExport';
import { getAllSymbols } from '@/lib/factionSymbolStore';

/** Run last, after imported extras and cached editor exports, and before ZIP generation. */
export function addSharedEditedFilesToZip(dataFolder) {
  for (const { key, name } of SHARED_EXPORT_SOURCES) {
    const raw = getFile(key);
    if (raw === null) continue;
    const path = sharedExportPath(name, key);
    const content = /^text\//i.test(path) ? toUtf16leBytes(raw.replace(/^\uFEFF/, '')) : raw;
    writeLatestZipFile(dataFolder, path, content);
  }
  for (const [path, symbol] of Object.entries(getAllSymbols())) {
    if (symbol?.buffer) writeLatestZipFile(dataFolder, path.replace(/^data[\\/]/i, ''), symbol.buffer);
  }
  addSharedTextToZip(dataFolder);
  addCharacterNamesToZip(dataFolder);
  // Binary entries, layout and trailers are authoritative, not old parsed dictionaries.
  addSharedStringsToZip(dataFolder);
}