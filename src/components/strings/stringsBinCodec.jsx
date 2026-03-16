/**
 * Codec for M2TW .txt.strings.bin files.
 * Format (from BinEditor v3.0 source):
 *   Header: [uint16 2] [uint16 2048] [uint16 entry_count] [uint16 0]
 *   For each entry:
 *     [uint16 key_char_len] [key_char_len * 2 bytes UTF-16LE]
 *     [uint16 val_char_len] [val_char_len * 2 bytes UTF-16LE]
 *   Footer: [uint16 0]
 */

export function parseStringsBin(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8) return null;
  let pos = 0;

  const magic1 = view.getUint16(pos, true); pos += 2;
  const magic2 = view.getUint16(pos, true); pos += 2;
  const entryCount = view.getUint16(pos, true); pos += 2;
  pos += 2; // padding word

  const entries = [];
  const totalStrings = entryCount * 2; // each entry = 2 strings (key + value)

  for (let i = 0; i < totalStrings; i++) {
    if (pos + 2 > buffer.byteLength) break;
    const charLen = view.getUint16(pos, true); pos += 2;
    let str = '';
    if (charLen > 0 && pos + charLen * 2 <= buffer.byteLength) {
      const bytes = new Uint8Array(buffer, pos, charLen * 2);
      str = new TextDecoder('utf-16le').decode(bytes);
      pos += charLen * 2;
    }
    if (i % 2 === 0) {
      entries.push({ key: str, value: '' });
    } else {
      if (entries.length > 0) entries[entries.length - 1].value = str;
    }
  }

  return { magic1, magic2, entries };
}

export function encodeStringsBin(entries, magic1 = 2, magic2 = 2048) {
  // Calculate total buffer size
  let size = 8 + 2; // header (4 × uint16) + trailing zero word
  for (const e of entries) {
    size += 2 + e.key.length * 2;
    size += 2 + e.value.length * 2;
  }

  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  let pos = 0;

  view.setUint16(pos, magic1, true); pos += 2;
  view.setUint16(pos, magic2, true); pos += 2;
  view.setUint16(pos, entries.length, true); pos += 2;
  view.setUint16(pos, 0, true); pos += 2;

  for (const e of entries) {
    // Key
    view.setUint16(pos, e.key.length, true); pos += 2;
    for (let i = 0; i < e.key.length; i++) {
      view.setUint16(pos, e.key.charCodeAt(i), true); pos += 2;
    }
    // Value
    view.setUint16(pos, e.value.length, true); pos += 2;
    for (let i = 0; i < e.value.length; i++) {
      view.setUint16(pos, e.value.charCodeAt(i), true); pos += 2;
    }
  }

  view.setUint16(pos, 0, true); // trailing zero
  return buf;
}