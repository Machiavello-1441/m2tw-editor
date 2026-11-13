import { getCharacterNamesRaw, getCharacterDisplayNames, getCharacterNamesFile, serializeCharacterNames } from '@/lib/characterNames';
import { encodeStoredStringsBin } from '@/components/strings/stringsBinCodec';
import { writeLatestZipFile } from '@/components/export/zipFilePrecedence';
import { entriesToTextBytes } from '@/lib/stringsTxtFile';

export function addCharacterNamesToZip(dataFolder, descrNames, namesDisplayMap) {
  const raw = getCharacterNamesRaw() || (descrNames ? serializeCharacterNames(descrNames) : '');
  if (raw) writeLatestZipFile(dataFolder, 'descr_names.txt', raw.replace(/\r\n|\r|\n/g, '\r\n'));
  const meta = getCharacterNamesFile()?.[1];
  const map = { ...namesDisplayMap, ...getCharacterDisplayNames() };
  const entries = meta?.entries || Object.entries(map).map(([key, value]) => ({ key, value }));
  if (!entries.length && !meta) return;
  if (meta?.magic1 !== 1 && meta?.format !== 'ordered') writeLatestZipFile(dataFolder, 'text/names.txt', entriesToTextBytes(entries));
  writeLatestZipFile(dataFolder, 'text/names.txt.strings.bin', encodeStoredStringsBin(meta || { entries, magic1: 2, magic2: 2048 }));
}