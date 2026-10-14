export function openHydroDbf(buffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');
  if (buffer.byteLength < 33) throw new Error('The attribute table is incomplete.');
  const count = view.getUint32(4, true), header = view.getUint16(8, true);
  const length = view.getUint16(10, true), fields = [];
  if (!length || header + count * length > buffer.byteLength) throw new Error('The attribute table is truncated.');
  let offset = 1;
  for (let pos = 32; pos < header - 1 && bytes[pos] !== 13; pos += 32) {
    const name = decoder.decode(bytes.subarray(pos, pos + 11)).replace(/\0.*$/, '').trim().toUpperCase();
    const size = bytes[pos + 16];
    fields.push({ name, offset, size }); offset += size;
  }
  for (const name of ['HYRIV_ID', 'NEXT_DOWN', 'ORD_STRA']) {
    if (!fields.some(field => field.name === name)) throw new Error(`Not a HydroRIVERS table: missing ${name}. Use the official regional shapefile ZIP.`);
  }
  const wanted = fields.filter(f => ['HYRIV_ID', 'NEXT_DOWN', 'ORD_STRA', 'DIS_AV_CMS'].includes(f.name));
  return { count, read(index) {
    if (index >= count) throw new Error('River geometry and attribute record counts do not match.');
    const start = header + index * length;
    if (bytes[start] === 42) return null;
    const row = {};
    for (const field of wanted) {
      const text = decoder.decode(bytes.subarray(start + field.offset, start + field.offset + field.size)).trim();
      row[field.name] = text ? Number(text) : null;
    }
    return row;
  } };
}