import importOsmPack from '@/components/newmap/osmpacks/osmPackImport';
import osmPackStore from '@/components/newmap/osmpacks/osmPackStore';
import paintOsmClasses, { clearMasks } from '@/components/newmap/osmpacks/osmPackRaster';
import { bboxKey } from '@/components/newmap/osmpacks/osmPackGeometry';

let dataset = { features: [], classes: [], packs: [], preferences: {} }, key = '', bbox, index = new Map();
function rebuild() {
  index = new Map(); clearMasks();
  for (const feature of dataset.features) { if (!index.has(feature.key)) index.set(feature.key, []); index.get(feature.key).push(feature); }
}
function summary(warning = '') {
  return { packs: dataset.packs, classes: dataset.classes.map(item => ({ ...item, count: index.get(item.key)?.length || 0 })), preferences: dataset.preferences, warning };
}
async function persist() {
  try { await osmPackStore('put', key, { version: 1, ...dataset }); return ''; }
  catch (error) { return `Available in this tab, but could not save locally: ${error.message}. Keep the downloaded ZIP for reimport.`; }
}
self.onmessage = async ({ data }) => {
  const { id, kind } = data;
  const progress = (label, percent) => self.postMessage({ id, progress: { label, percent } });
  try {
    if (kind === 'restore') {
      bbox = data.bbox; key = bboxKey(bbox);
      if (!bbox || !Object.values(bbox).every(Number.isFinite) || bbox.east <= bbox.west || bbox.north <= bbox.south) throw new Error('Select a valid map area first.');
      let warning = '';
      try { const saved = await osmPackStore('get', key); if (saved?.version === 1) dataset = saved; }
      catch (error) { warning = `Local cache unavailable: ${error.message}`; }
      rebuild(); self.postMessage({ id, result: summary(warning) }); return;
    }
    if (kind === 'import') {
      const nextFeatures = new Map(dataset.features.map(feature => [feature.id, feature]));
      const nextClasses = new Map(dataset.classes.map(item => [item.key, item])), packs = new Map(dataset.packs.map(pack => [pack.id || pack.name, pack]));
      for (const file of data.files) {
        const result = await importOsmPack(file, bbox, progress), source = result.pack.id;
        // Reimporting a newer regional extract replaces that source, including deleted polygons.
        for (const [classKey, item] of nextClasses) {
          const sources = (item.sources || []).filter(name => name !== source);
          if (sources.length) nextClasses.set(classKey, { ...item, sources });
          else if (item.sources?.includes(source)) nextClasses.delete(classKey);
        }
        for (const [featureId, feature] of nextFeatures) {
          const sources = (feature.sources || []).filter(item => item !== source);
          if (sources.length) nextFeatures.set(featureId, { ...feature, sources });
          else if (feature.sources?.includes(source)) nextFeatures.delete(featureId);
        }
        let bytes = [...nextFeatures.values()].reduce((sum, feature) => sum + feature.rings.reduce((n, ring) => n + ring.byteLength, 0), 0);
        for (const feature of result.features) {
          const previous = nextFeatures.get(feature.id);
          if (previous) nextFeatures.set(feature.id, { ...previous, sources: [...new Set([...(previous.sources || []), source])] });
          else {
            bytes += feature.rings.reduce((n, ring) => n + ring.byteLength, 0);
            if (bytes > 201326592) throw new Error('Combined polygon data exceeds the 192 MiB retained-data limit. Use a smaller map area.');
            nextFeatures.set(feature.id, { ...feature, sources: [source] });
          }
        }
        result.classes.forEach(item => nextClasses.set(item.key, { ...item, sources: [...new Set([...(nextClasses.get(item.key)?.sources || []), source])] }));
        packs.set(source, result.pack);
      }
      dataset = { ...dataset, features: [...nextFeatures.values()], classes: [...nextClasses.values()].sort((a, b) => a.key.localeCompare(b.key)), packs: [...packs.values()] };
      rebuild(); progress('Saving map-relevant polygons locally', 100);
      self.postMessage({ id, result: summary(await persist()) }); return;
    }
    if (kind === 'preferences') { dataset.preferences = data.preferences; self.postMessage({ id, result: { warning: await persist() } }); return; }
    if (kind === 'clear') { await osmPackStore('delete', key); dataset = { features: [], classes: [], packs: [], preferences: {} }; rebuild(); self.postMessage({ id, result: summary() }); return; }
    if (kind === 'paint') {
      if (!Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width < 1 || data.height < 1 || data.width * data.height > 33554432) throw new Error('Ground layer exceeds the 32-million-pixel regional overlay limit.');
      const result = paintOsmClasses(index, data.choices, bbox, data.pixels, data.width, data.height, progress);
      self.postMessage({ id, result }, [result.pixels.buffer]); return;
    }
    throw new Error('Unknown regional data operation.');
  } catch (error) { self.postMessage({ id, error: error.message || 'Could not process regional data.' }); }
};