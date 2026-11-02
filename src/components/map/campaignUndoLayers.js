/** Reverse pixel patches: small strokes do not retain entire map buffers. */
export function captureUndoLayers(layers) {
  return Object.fromEntries(Object.entries(layers).map(([id, layer]) => [id, {
    width: layer.width, height: layer.height,
    data: layer.data ? new Uint8ClampedArray(layer.data) : null,
  }]));
}

export function diffUndoLayers(previous, layers, input, scanPixels) {
  const changes = {}, next = { ...previous };
  for (const id of new Set([...Object.keys(previous), ...Object.keys(layers)])) {
    const old = previous[id], layer = layers[id];
    if (!scanPixels && input?.[id]?.data === layer?.data && old?.width === layer?.width && old?.height === layer?.height) continue;
    const before = old?.data, after = layer?.data;
    if (!before && !after) continue;
    if (!before || !after || before.length !== after.length || old.width !== layer.width || old.height !== layer.height) {
      changes[id] = { full: true, width: old?.width, height: old?.height, data: before };
    } else {
      let count = 0;
      for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) count++;
      if (!count) continue;
      if (count * 5 >= before.length) changes[id] = { full: true, width: old.width, height: old.height, data: before };
      else {
        const indices = new Uint32Array(count), values = new Uint8ClampedArray(count);
        for (let i = 0, j = 0; i < before.length; i++) if (before[i] !== after[i]) { indices[j] = i; values[j++] = before[i]; }
        changes[id] = { indices, values };
      }
    }
    next[id] = { width: layer?.width, height: layer?.height, data: after ? new Uint8ClampedArray(after) : null };
  }
  return { changes, next };
}

export async function restoreUndoLayers(layers, entries, dirtyLayers = new Set(), inverses) {
  const restored = { ...layers }, changed = new Set();
  for (const entry of entries) {
    const inverse = {};
    for (const [id, patch] of Object.entries(entry.layers)) {
      const layer = restored[id];
      if (inverses) inverse[id] = patch.full
        ? { full: true, width: layer?.width, height: layer?.height, data: layer?.data ? new Uint8ClampedArray(layer.data) : null }
        : { indices: patch.indices, values: Uint8ClampedArray.from(patch.indices, index => layer.data[index]) };
      if (!changed.has(id)) restored[id] = { ...layer, data: layer?.data ? new Uint8ClampedArray(layer.data) : null };
      changed.add(id);
      if (patch.full) restored[id] = { ...restored[id], width: patch.width, height: patch.height, data: patch.data ? new Uint8ClampedArray(patch.data) : null };
      else for (let i = 0; i < patch.indices.length; i++) restored[id].data[patch.indices[i]] = patch.values[i];
    }
    inverses?.push(inverse);
  }
  // A preceding paint stroke may still be waiting for its bitmap rebuild.
  // Give dirty buffers fresh identities so stale rebuilds cannot win after undo.
  for (const id of dirtyLayers) if (!changed.has(id) && restored[id]?.data) {
    restored[id] = { ...restored[id], data: new Uint8ClampedArray(restored[id].data) };
    changed.add(id);
  }
  const bitmaps = await Promise.all([...changed].map(async id => {
    const layer = restored[id];
    return [id, layer.data ? await createImageBitmap(new ImageData(layer.data, layer.width, layer.height)) : null];
  }));
  for (const [id, bitmap] of bitmaps) restored[id].bitmap = bitmap;
  return restored;
}