export function mergeHydroDraft(layer, draft) {
  const width = draft.width, height = draft.height;
  const base = layer?.imageData;
  const data = base && base.width === width && base.height === height
    ? new Uint8ClampedArray(base.data) : new Uint8ClampedArray(width * height * 4);
  // Revert only the last generated pixels that have not since been edited.
  const previous = layer?.hydroRiverPatch;
  if (previous?.width === width && previous?.height === height) {
    for (const [i, ...rgba] of previous.entries) {
      if (rgba.slice(4).every((value, channel) => data[i + channel] === value)) data.set(rgba.slice(0, 4), i);
    }
  }
  const entries = [];
  let protectedPixels = 0;
  for (let i = 0; i < draft.data.length; i += 4) {
    if (!draft.data[i + 3]) continue;
    if (data[i + 3] && (data[i] || data[i + 1] || data[i + 2])) {
      if (!Array.from(draft.data.subarray(i, i + 4)).every((value, channel) => data[i + channel] === value)) protectedPixels++;
      continue; // Keep hand-painted rivers, fords, cliffs, volcanoes and bridges.
    }
    entries.push([i, ...data.subarray(i, i + 4), ...draft.data.subarray(i, i + 4)]);
    data.set(draft.data.subarray(i, i + 4), i);
  }
  return { imageData: new ImageData(data, width, height), hydroRiverPatch: { width, height, entries }, protectedPixels };
}