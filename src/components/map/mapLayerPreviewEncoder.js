import { transparentMapPixels } from '@/components/map/useTransparentMapBitmap';

/** One canvas and one PNG encode per overlay; replace queued work, not active images. */
export default function mapLayerPreviewEncoder(onUrl) {
  const canvas = document.createElement('canvas');
  let pending = null, latest = null, busy = false, stopped = false, url = null;
  const releaseUrl = () => { if (url) URL.revokeObjectURL(url); url = null; };
  const matches = (a, b) => a && b && a.data === b.data && a.width === b.width && a.height === b.height && a.kind === b.kind;
  const drain = () => {
    if (stopped || busy || !pending) return;
    const job = pending; pending = null; busy = true;
    if (canvas.width !== job.width) canvas.width = job.width;
    if (canvas.height !== job.height) canvas.height = job.height;
    const pixels = job.kind ? transparentMapPixels(job.data, job.kind) : job.data;
    // Read canonical pixels, not a shared ImageBitmap that may already be detached.
    canvas.getContext('2d').putImageData(new ImageData(pixels, job.width, job.height), 0, 0);
    canvas.toBlob(blob => {
      busy = false;
      if (!stopped && matches(job, latest) && blob) {
        const previous = url;
        url = URL.createObjectURL(blob); onUrl(url);
        if (previous) URL.revokeObjectURL(previous);
      }
      if (stopped) { canvas.width = 0; canvas.height = 0; }
      else drain();
    }, 'image/png');
  };
  return {
    update(layer, kind = null) {
      if (stopped) return;
      if (!layer?.data || !layer.width || !layer.height) {
        latest = null; pending = null; releaseUrl(); onUrl(null); return;
      }
      latest = { data: layer.data, width: layer.width, height: layer.height, kind };
      pending = latest; drain();
    },
    dispose() {
      stopped = true; latest = null; pending = null; releaseUrl();
      if (!busy) { canvas.width = 0; canvas.height = 0; }
    },
  };
}