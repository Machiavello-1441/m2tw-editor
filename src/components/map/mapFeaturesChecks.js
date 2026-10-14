import { analyzeRivers } from '@/components/map/rivers/riverAnalysis';

const VALID = new Set([0x000000, 0x0000ff, 0x00ffff, 0xffffff, 0xffff00, 0xff0000, 0x00ff00]);
export function checkMapFeatures(features, push, heights = null) {
  const { data, width } = features, invalid = new Map();
  for (let n = 0; n < data.length / 4; n++) {
    const i = n * 4;
    if (!data[i + 3]) continue;
    const colour = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    if (VALID.has(colour)) continue;
    const count = (invalid.get(colour) || 0) + 1; invalid.set(colour, count);
    if (count <= 5) push('error', 'features', `Invalid colour rgb(${data[i]},${data[i + 1]},${data[i + 2]})`, n % width, Math.floor(n / width));
  }
  for (const [colour, count] of invalid) if (count > 5) push('error', 'features', `Invalid colour rgb(${colour >> 16},${(colour >> 8) & 255},${colour & 255}): ${count} pixels total`, null, null);
  const result = analyzeRivers(features, { heights }), displayed = {};
  for (const issue of result.issues) {
    displayed[issue.type] = (displayed[issue.type] || 0) + 1;
    if (displayed[issue.type] <= 150) push(issue.severity, 'features', issue.desc, issue.x, issue.y);
  }
  for (const [type, count] of Object.entries(result.counts)) {
    const shown = Math.min(150, displayed[type] || 0);
    if (shown >= 150 && count > shown) push('warning', 'features', `${type}: ${count} issues in total; first ${shown} locations shown`, null, null);
  }
}