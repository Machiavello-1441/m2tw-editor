import { useEffect, useState } from 'react';

export function transparentMapPixels(data, kind) {
  const rgba = new Uint8ClampedArray(data);
  for (let i = 0; i < rgba.length; i += 4) {
    const black = rgba[i] < 12 && rgba[i + 1] < 12 && rgba[i + 2] < 12;
    const white = rgba[i] > 243 && rgba[i + 1] > 243 && rgba[i + 2] > 243;
    if (kind === 'features' && black || kind === 'fog' && white) rgba[i + 3] = 0;
    if (kind === 'citiesports') rgba[i + 3] = black || white ? 255 : 0;
  }
  return rgba;
}

export default function useTransparentMapBitmap(layer, kind, enabled) {
  const [current, setCurrent] = useState(null);
  const source = layer?.bitmap, data = layer?.data, width = layer?.width, height = layer?.height;
  const bitmap = enabled && current?.source === source && current?.data === data &&
    current?.width === width && current?.height === height && current?.kind === kind ? current.bitmap : null;
  useEffect(() => {
    if (!enabled || !source || !data) return;
    let cancelled = false;
    createImageBitmap(new ImageData(transparentMapPixels(data, kind), width, height)).then(next => {
      if (cancelled) { next.close(); return; }
      // Never close a published bitmap while a consumer or queued render holds it.
      setCurrent({ bitmap: next, source, data, width, height, kind });
    });
    return () => { cancelled = true; };
  }, [enabled, source, data, width, height, kind]);
  return bitmap;
}