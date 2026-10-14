import { analyzeRivers } from '@/components/map/rivers/riverAnalysis';
import { repairRivers } from '@/components/map/rivers/riverRepair';

self.onmessage = ({ data: { kind, image } }) => {
  try {
    if (kind === 'check') self.postMessage({ result: analyzeRivers(image) });
    else {
      const repaired = repairRivers(image, { transparentBackground: true });
      self.postMessage(repaired, [repaired.data.buffer]);
    }
  } catch (error) { self.postMessage({ error: error.message }); }
};