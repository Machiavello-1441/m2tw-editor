import { getFile, setFile } from '@/lib/bigFileStore';
import { exportFingerprint, exportDataPath } from '@/components/export/exportFingerprint';

const KEY = 'm2tw_export_original_fingerprints_v1';
let pending = Promise.resolve();
const read = () => JSON.parse(getFile(KEY) || '{}');

/** Immutable import fingerprints survive Save, navigation and browser reloads. */
export function rememberExportOriginals(files, paths, reset = false) {
  pending = pending.then(async () => {
    const originals = reset ? {} : read();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (typeof file.arrayBuffer !== 'function' || !(/\.(txt|xml|modeldb|strings\.bin)$/i.test(file.name) || /^map_(?:heights|ground_types|climates|regions|features|fog)\.tga$/i.test(file.name))) continue;
      const path = exportDataPath(paths[i] || `@loose/${file.name}`);
      if (Object.hasOwn(originals, path)) continue;
      originals[path] = await exportFingerprint(path, await file.arrayBuffer());
    }
    setFile(KEY, JSON.stringify(originals));
  });
  return pending;
}

/** Unknown originals are retained conservatively, never mistaken for unmodified work. */
export async function removeUnchangedCampaignFiles(zip) {
  await pending;
  const originals = read(), checks = new Map();
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const normalized = exportDataPath(path);
    const original = originals[normalized] ?? originals[`@loose/${normalized.split('/').pop()}`];
    checks.set(path, original == null ? null : await exportFingerprint(normalized, await file.async('uint8array')) === original);
  }
  // A changed localization dictionary always travels with its matching text/binary twin.
  for (const [path, unchanged] of checks) {
    if (!/\/text\/.+\.txt(?:\.strings\.bin)?$/i.test(path)) continue;
    const twin = /\.strings\.bin$/i.test(path) ? path.replace(/\.strings\.bin$/i, '') : `${path}.strings.bin`;
    if (!checks.has(twin)) continue;
    const other = checks.get(twin);
    if (unchanged === false || other === false) { checks.set(path, false); checks.set(twin, false); }
    else if (unchanged === true || other === true) { checks.set(path, true); checks.set(twin, true); }
  }
  for (const [path, unchanged] of checks) if (unchanged === true) zip.remove(path);
  // JSZip otherwise leaves empty directories from excluded shared files.
  for (const path of Object.keys(zip.files).sort((a, b) => b.length - a.length)) {
    if (zip.files[path]?.dir && !Object.keys(zip.files).some(other => other !== path && other.startsWith(path))) zip.remove(path);
  }
  return [...checks].filter(([, unchanged]) => unchanged == null).map(([path]) => path);
}