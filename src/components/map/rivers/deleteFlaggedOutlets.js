// Delete this validation snapshot only: never repeatedly trim new endpoints.
export function deleteFlaggedOutlets(image, issues) {
  if (!image) return null;
  const pixels = new Set();
  for (const issue of issues || []) {
    if (issue.type !== 'inland_outlet') continue;
    const { x, y } = issue;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
    const n = y * image.width + x, i = n * 4, d = image.data;
    if (d[i+3] && d[i] === 0 && d[i+2] === 255 && (d[i+1] === 0 || d[i+1] === 255)) pixels.add(n);
  }
  if (!pixels.size) return null;
  const data = new Uint8ClampedArray(image.data);
  for (const n of pixels) data.set([0,0,0,255],n * 4);
  return { data, width: image.width, height: image.height };
}