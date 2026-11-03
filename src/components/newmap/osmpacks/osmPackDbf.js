export default function openOsmDbf(buffer, encoding = 'utf-8') {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer), decoder = new TextDecoder(encoding);
  if (buffer.byteLength < 33) throw new Error('The attribute table is incomplete.');
  const count = view.getUint32(4, true), header = view.getUint16(8, true), length = view.getUint16(10, true);
  if (header < 33 || !length || header + count * length > buffer.byteLength) throw new Error('The attribute table is truncated.');
  const fields = []; let offset = 1;
  for (let pos = 32; pos + 32 <= header && bytes[pos] !== 13; pos += 32) {
    const name = decoder.decode(bytes.subarray(pos, pos + 11)).replace(/\0.*$/, '').trim().toLowerCase();
    const size = bytes[pos + 16]; fields.push({ name, offset, size }); offset += size;
  }
  if (offset > length) throw new Error('Invalid attribute field sizes.');
  if (!fields.some(field => field.name === 'fclass')) throw new Error('Expected a Geofabrik area layer with an fclass attribute.');
  const wanted = fields.filter(field => ['fclass', 'osm_id', 'osm_type', 'code'].includes(field.name));
  return { count, read(index) {
    if (index >= count) throw new Error('Geometry and attribute records do not match.');
    const start = header + index * length;
    if (bytes[start] === 42) return null;
    return Object.fromEntries(wanted.map(field => [field.name, decoder.decode(bytes.subarray(start + field.offset, start + field.offset + field.size)).trim()]));
  } };
}