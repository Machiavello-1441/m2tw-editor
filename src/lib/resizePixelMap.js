/** Nearest-neighbour resizing that copies exact RGBA values without blending. */
export default function resizePixelMap(source, width, height) {
  if (source.width === width && source.height === height) return source;
  const output = new ImageData(width, height);
  const src = source.data, dst = output.data;
  const scaleX = source.width / width, scaleY = source.height / height;
  for (let y = 0; y < height; y++) {
    const sy = Math.min(source.height - 1, Math.floor((y + 0.5) * scaleY));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(source.width - 1, Math.floor((x + 0.5) * scaleX));
      const from = (sy * source.width + sx) * 4;
      const to = (y * width + x) * 4;
      dst[to] = src[from]; dst[to + 1] = src[from + 1];
      dst[to + 2] = src[from + 2]; dst[to + 3] = src[from + 3];
    }
  }
  return output;
}