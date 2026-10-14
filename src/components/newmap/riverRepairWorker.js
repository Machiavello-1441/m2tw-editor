import { analyzeRivers } from '@/components/map/rivers/riverAnalysis';
import { repairRivers } from '@/components/map/rivers/riverRepair';

self.onmessage = ({ data: { kind, image, heights } }) => {
  try {
    if (kind === 'check') self.postMessage({ result: analyzeRivers(image, { heights }) });
    else {
      const repaired = repairRivers(image, { transparentBackground: true, heights });
      self.postMessage(repaired, [repaired.data.buffer]);
    }
  } catch (error) { self.postMessage({ error: error.message }); }
};