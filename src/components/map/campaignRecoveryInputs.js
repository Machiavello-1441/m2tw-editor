import isEqual from 'lodash/isEqual';

/** Keep recovery status and GPU bitmap rebuilds out of the editable-data observer. */
export function captureRecoveryInputs(snapshot, active, enabled) {
  const { layers, ...model } = snapshot;
  return { active, enabled, model, pixels: Object.fromEntries(Object.entries(layers).map(([id, layer]) =>
    [id, { data: layer.data, width: layer.width, height: layer.height }])) };
}

export function sameRecoveryInputs(previous, next) {
  if (!previous || previous.active !== next.active || previous.enabled !== next.enabled) return false;
  const modelKeys = new Set([...Object.keys(previous.model), ...Object.keys(next.model)]);
  for (const key of modelKeys) {
    const before = previous.model[key], after = next.model[key];
    if (Object.is(before, after)) continue;
    // Painting mutates buffers in place, so a new dirty-layer revision is meaningful.
    if (key === 'dirtyLayers' || !isEqual(before, after)) return false;
  }
  const layerKeys = new Set([...Object.keys(previous.pixels), ...Object.keys(next.pixels)]);
  for (const id of layerKeys) {
    const before = previous.pixels[id], after = next.pixels[id];
    if (!before || !after || before.data !== after.data || before.width !== after.width || before.height !== after.height) return false;
  }
  return true;
}