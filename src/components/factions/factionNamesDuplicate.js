import { getFile, setFile } from '@/lib/bigFileStore';
import { duplicateDescrNames } from '@/lib/descrNamesCodec';
import { getCharacterDisplayNames, getCharacterNamesFile } from '@/lib/characterNames';
import { updateStringsBinFile } from '@/lib/stringsBinStore';

const NAMES_KEY = 'm2tw_names_file';

export function prepareFactionNames(srcName, dstName) {
  const original = getFile(NAMES_KEY);
  if (!original) throw new Error('Load descr_names.txt before duplicating a faction. No changes made.');
  return {
    ...duplicateDescrNames(original, srcName, dstName), original, loaded: true,
    displayNames: getCharacterDisplayNames(), displayFile: getCharacterNamesFile(),
  };
}

/** Keep copied name references and their existing localized values together. */
export function duplicateFactionNames(srcName, dstName, prepared) {
  const result = prepared || prepareFactionNames(srcName, dstName);
  if (getFile(NAMES_KEY) !== result.original) throw new Error('Character names changed during duplication. Try again.');
  const { displayNames, displayFile } = result;
  const displayCount = Object.keys(displayNames).length;
  if (displayCount) {
    const meta = displayFile?.[1];
    // Name IDs are global: copied faction pools reuse them, not renamed or blank IDs.
    updateStringsBinFile(displayFile?.[0] || 'names.txt.strings.bin', {
      ...meta, entries: Object.entries(displayNames).map(([key, value]) => ({ key, value })),
      magic1: meta?.magic1 ?? 2, magic2: meta?.magic2 ?? 2048,
    });
    setFile('m2tw_names_bin_entries', JSON.stringify(displayNames));
  }
  if (result.ok) setFile(NAMES_KEY, result.out);
  window.dispatchEvent(new CustomEvent('load-character-names', {
    detail: { raw: result.out, namesDisplayMap: displayNames },
  }));
  return { ...result, displayCount };
}