/**
 * Encode text as UTF-16LE with BOM — the encoding M2TW requires for all
 * files under data/text/. Writing them as UTF-8 halves the byte size and
 * makes tools that read them as UTF-16 show CJK garbage / crash.
 */
export function toUtf16leBytes(text) {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff; out[1] = 0xfe; // BOM
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[2 + i * 2] = c & 0xff;
    out[3 + i * 2] = c >> 8;
  }
  return out;
}