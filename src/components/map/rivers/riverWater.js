export function riverWater(heights, width, height) {
  if (!heights?.data) return null;
  const sample = n => {
    const x = Math.round(((n % width + 0.5) / width) * heights.width - 0.5);
    const y = Math.round(((Math.floor(n / width) + 0.5) / height) * heights.height - 0.5);
    return [x, y];
  };
  const blue = (x, y) => {
    if (x < 0 || y < 0 || x >= heights.width || y >= heights.height) return false;
    const i = (y * heights.width + x) * 4, d = heights.data;
    return d[i + 3] > 0 && d[i] < 10 && d[i + 1] < 10 && d[i + 2] > 200;
  };
  return {
    at(n) { const [x,y] = sample(n); return blue(x,y); },
    beside(n) {
      const [x,y] = sample(n), rx = Math.max(1, Math.ceil(heights.width / width / 2)), ry = Math.max(1, Math.ceil(heights.height / height / 2));
      for (let yy = y - ry; yy <= y + ry; yy++) for (let xx = x - rx; xx <= x + rx; xx++) if (blue(xx,yy)) return true;
      return false;
    },
  };
}