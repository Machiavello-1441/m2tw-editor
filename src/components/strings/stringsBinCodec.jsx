/**
 * M2TW strings binaries have TWO layouts, selected by their four-byte signature:
 *   01 00 00 08: ordered (values only; the game supplies the keys by position)
 *   02 00 00 08: keyed   (key/value pairs)
 * Both then contain a uint32 LE record count, NOT uint16 + padding.
 * Each string is a uint16 LE count of UTF-16 code units, then that many units.
 * Some keyed writers append a key lookup table; others append nothing or a zero.
 *
 * Format cross-check: CUF StringsReader.init, StringsWriter, and MimeTag:
 * https://github.com/RiritoNinigaya/TTF2CUF/tree/main/SourceCode/org/europabarbarorum/cuf
 * This implementation is independent; no CUF code is copied here.
 */

function asView(input) {
  if (ArrayBuffer.isView(input)) return new DataView(input.buffer, input.byteOffset, input.byteLength);
  try { return new DataView(input); }
  catch { throw new Error('Expected a binary ArrayBuffer or typed array'); }
}

function readerFor(view, offset = 8) {
  let pos = offset;
  return {
    get position() { return pos; },
    string(label) {
      if (pos + 2 > view.byteLength) throw new Error(`Truncated strings binary: missing ${label} length at byte ${pos}`);
      const length = view.getUint16(pos, true);
      pos += 2;
      if (pos + length * 2 > view.byteLength) {
        throw new Error(`Truncated strings binary: ${label} at byte ${pos} needs ${length * 2} bytes, only ${view.byteLength - pos} remain`);
      }
      // Decode raw code units, retaining leading U+FEFF, empty values and lone
      // surrogates exactly. TextDecoder's replacement/BOM rules lose such data.
      const chunks = [];
      for (let i = 0; i < length; i += 4096) {
        const units = [];
        for (let j = i; j < Math.min(i + 4096, length); j++) units.push(view.getUint16(pos + j * 2, true));
        chunks.push(String.fromCharCode(...units));
      }
      pos += length * 2;
      return chunks.join('');
    },
  };
}

/** Strict reader used by import UIs: failures include the signature/byte offset. */
export function decodeStringsBin(input) {
  const view = asView(input);
  if (view.byteLength < 8) throw new Error(`Truncated strings header: expected 8 bytes, received ${view.byteLength}`);
  const magic1 = view.getUint16(0, true);
  const magic2 = view.getUint16(2, true);
  if ((magic1 !== 1 && magic1 !== 2) || magic2 !== 2048) {
    const signature = Array.from({ length: 4 }, (_, i) => view.getUint8(i).toString(16).padStart(2, '0')).join(' ');
    throw new Error(`Unsupported strings binary signature ${signature}; expected 01 00 00 08 (ordered) or 02 00 00 08 (keyed)`);
  }
  const entryCount = view.getUint32(4, true);
  const ordered = magic1 === 1;
  const minimumRecordBytes = ordered ? 2 : 4;
  if (entryCount > Math.floor((view.byteLength - 8) / minimumRecordBytes)) {
    throw new Error(`Truncated strings binary: header declares ${entryCount} ${ordered ? 'ordered' : 'keyed'} records, but the file is too short`);
  }
  const reader = readerFor(view);
  const entries = [];
  for (let index = 0; index < entryCount; index++) {
    const key = ordered ? String(index) : reader.string(`record ${index} key`);
    const value = reader.string(`record ${index} value`);
    entries.push(ordered ? { key, value, index, syntheticKey: true } : { key, value });
  }
  const end = reader.position;
  const remaining = view.byteLength - end;
  const meta = { magic1, magic2, format: ordered ? 'ordered' : 'keyed', entryCount, sourceEntryCount: entryCount, trailerKind: 'none' };
  if (remaining === 2 && view.getUint16(end, true) === 0) {
    meta.trailerKind = 'zero';
  } else if (remaining > 0) {
    // CUF's optional lookup trailer repeats the record count and ordered keys.
    let lookup = false;
    if (!ordered && remaining >= 4 && view.getUint32(end, true) === entryCount) {
      try {
        const tail = readerFor(view, end + 4);
        lookup = entries.every((entry, i) => tail.string(`lookup ${i}`) === entry.key);
        const left = view.byteLength - tail.position;
        lookup = lookup && (left === 0 || (left === 2 && view.getUint16(tail.position, true) === 0));
        if (lookup) { meta.trailerKind = 'key-lookup'; meta.lookupTrailingZero = left === 2; }
      } catch { lookup = false; }
    }
    if (!lookup) {
      // Unknown extensions are retained byte-for-byte, not silently discarded.
      // Viewing/exporting is safe; editing is locked because offsets may exist.
      meta.trailerKind = 'opaque';
      meta.readOnly = true;
      meta.sourceBody = Array.from(new Uint8Array(view.buffer, view.byteOffset, end));
      meta.trailerBytes = Array.from(new Uint8Array(view.buffer, view.byteOffset + end, remaining));
    }
  }
  return { ...meta, entries };
}

/** Compatibility wrapper for older consumers that expect null on a bad input. */
export function parseStringsBin(input) {
  try { return decodeStringsBin(input); } catch { return null; }
}

/**
 * Preserve metadata by passing the loaded file as the fourth argument.
 * Ordered records have display-only numeric keys; these are NEVER written.
 */
export function encodeStringsBin(entries, magic1 = 2, magic2 = 2048, options = {}) {
  if (!Array.isArray(entries)) throw new Error('Strings entries must be an array');
  if ((magic1 !== 1 && magic1 !== 2) || magic2 !== 2048) throw new Error('Unsupported strings binary format');
  if (entries.length > 0xffffffff) throw new Error('Too many strings records for a 32-bit header');
  const ordered = magic1 === 1;
  if (ordered && options.sourceEntryCount != null && entries.length !== options.sourceEntryCount) {
    throw new Error('Ordered strings must keep their original number of records');
  }
  if (ordered && entries.some((entry, i) => entry.index !== undefined && entry.index !== i)) {
    throw new Error('Ordered strings must keep their original record positions');
  }
  const check = (value, label) => {
    if (typeof value !== 'string') throw new Error(`${label} must be text`);
    if (value.length > 0xffff) throw new Error(`${label} exceeds the 65535 UTF-16-code-unit limit`);
    return 2 + value.length * 2;
  };
  let bodySize = 8;
  for (const [i, entry] of entries.entries()) {
    if (!ordered) bodySize += check(entry.key, `Record ${i} key`);
    bodySize += check(entry.value, `Record ${i} value`);
  }
  const trailerKind = options.trailerKind ?? (ordered ? 'none' : 'zero');
  let tailSize = 0;
  if (trailerKind === 'zero') tailSize = 2;
  else if (trailerKind === 'key-lookup') {
    if (ordered) throw new Error('Ordered strings cannot have a keyed lookup trailer');
    tailSize = 4 + entries.reduce((size, entry) => size + 2 + entry.key.length * 2, 0) + (options.lookupTrailingZero ? 2 : 0);
  } else if (trailerKind === 'opaque') tailSize = options.trailerBytes?.length || 0;
  else if (trailerKind !== 'none') throw new Error('Unknown strings trailer format');
  const buffer = new ArrayBuffer(bodySize + tailSize);
  const view = new DataView(buffer);
  view.setUint16(0, magic1, true);
  view.setUint16(2, magic2, true);
  view.setUint32(4, entries.length, true);
  let pos = 8;
  const write = value => {
    view.setUint16(pos, value.length, true); pos += 2;
    for (let i = 0; i < value.length; i++, pos += 2) view.setUint16(pos, value.charCodeAt(i), true);
  };
  for (const entry of entries) {
    if (!ordered) write(entry.key);
    write(entry.value);
  }
  if (trailerKind === 'key-lookup') {
    view.setUint32(pos, entries.length, true); pos += 4;
    for (const entry of entries) write(entry.key);
  } else if (trailerKind === 'opaque') {
    const body = new Uint8Array(buffer, 0, bodySize);
    if (!options.sourceBody || options.sourceBody.length !== body.length || body.some((byte, i) => byte !== options.sourceBody[i])) {
      throw new Error('This file has an unknown binary trailer. Export the unmodified file; editing it is not supported safely.');
    }
    new Uint8Array(buffer, bodySize).set(options.trailerBytes || []);
  }
  // ArrayBuffer is zero-filled, covering the optional final zero word.
  return buffer;
}

/** Serialise a stored file without dropping its layout or trailer information. */
export function encodeStoredStringsBin(file) {
  return encodeStringsBin(file.entries, file.magic1 ?? 2, file.magic2 ?? 2048, file);
}
