/**
 * Plain-text (.txt) counterparts for M2TW data/text/*.txt.strings.bin files.
 * The engine and the modding tools read these as UTF-16LE with a BOM, with the
 * leading ¬ marker and one {key}value entry per line.
 */
import { toUtf16leBytes } from '@/lib/utf16';

/** Formats strings.bin entries as the game's plain-text body. */
export function entriesToText(entries) {
  const body = (entries || [])
    .map((e) => `{${String(e.key).replace(/[{}]/g, '')}}${e.value ?? ''}`)
    .join('\n');
  return `¬\n${body}`.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

/** Encodes strings.bin entries as a M2TW .txt file (UTF-16LE + BOM). */
export function entriesToTextBytes(entries) {
  return toUtf16leBytes(entriesToText(entries));
}

/** "export_VnVs.txt.strings.bin" → "export_VnVs.txt" (fallback when already plain). */
export function txtNameFor(binName, fallback) {
  const name = binName || '';
  if (/\.strings\.bin$/i.test(name)) return name.replace(/\.strings\.bin$/i, '');
  if (/\.bin$/i.test(name)) return name.replace(/\.bin$/i, '');
  return fallback || name;
}