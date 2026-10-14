import { importHydroFile } from '@/components/newmap/hydrorivers/importData';
import { rasterizeHydroRivers } from '@/components/newmap/hydrorivers/rasterize';

self.onmessage = async ({ data }) => {
  const { id, kind } = data;
  try {
    if (kind === 'import') {
      const byId = new Map();
      for (const file of data.files) {
        self.postMessage({ id, progress: `Reading ${file.name} locally…` });
        for (const reach of await importHydroFile(file, data.bbox)) {
          if (!Number.isFinite(reach.HYRIV_ID) || !Number.isInteger(reach.ORD_STRA) || reach.ORD_STRA < 1) throw new Error('Invalid HydroRIVERS reach identifiers or Strahler orders.');
          byId.set(reach.HYRIV_ID, reach);
        }
      }
      self.postMessage({ id, result: [...byId.values()] });
    } else {
      const result = rasterizeHydroRivers(data.reaches, data.bbox, data.width, data.height, data.minOrder);
      self.postMessage({ id, result }, [result.pixels.buffer]);
    }
  } catch (error) { self.postMessage({ id, error: error.message }); }
};