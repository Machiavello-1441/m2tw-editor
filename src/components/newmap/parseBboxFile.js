export default function parseBboxFile(text) {
  const values = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(north|south|east|west|map_width|map_height)\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:#.*)?$/);
    if (match) values[match[1]] = Number(match[2]);
  }
  const hasBounds = ['north', 'south', 'east', 'west'].every(key => Number.isFinite(values[key]));
  const dimension = key => Number.isSafeInteger(values[key]) && values[key] > 0 ? values[key] : undefined;
  return {
    selection: hasBounds ? {
      start: { lat: values.north, lng: values.west },
      end: { lat: values.south, lng: values.east },
    } : null,
    width: dimension('map_width'),
    height: dimension('map_height'),
  };
}