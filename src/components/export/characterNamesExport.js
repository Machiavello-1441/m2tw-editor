import { getCharacterNamesRaw, getCharacterDisplayNames, getCharacterNamesFile, serializeCharacterNames } from '@/lib/characterNames';
import { encodeStringsBin } from '@/components/strings/stringsBinCodec';
import { entriesToTextBytes } from '@/lib/stringsTxtFile';

export function addCharacterNamesToZip(dataFolder, descrNames, namesDisplayMap) {
  const raw = descrNames ? serializeCharacterNames(descrNames) : getCharacterNamesRaw();
  if (raw) dataFolder.file('descr_names.txt', raw.replace(/\r\n|\r|\n/g, '\r\n'));
  const map = { ...getCharacterDisplayNames(), ...namesDisplayMap };
  const entries = Object.entries(map).map(([key, value]) => ({ key, value }));
  if (!entries.length) return;
  const meta = getCharacterNamesFile()?.[1];
  dataFolder.file('text/names.txt', entriesToTextBytes(entries));
  dataFolder.file('text/names.txt.strings.bin', encodeStringsBin(entries, meta?.magic1 ?? 2, meta?.magic2 ?? 2048));
}