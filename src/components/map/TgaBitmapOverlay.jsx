import React, { useEffect, useRef, useState } from 'react';
import { ImageOverlay } from 'react-leaflet';
import mapLayerPreviewEncoder from '@/components/map/mapLayerPreviewEncoder';

/** Pixel-backed overlay: a detached cached bitmap cannot interrupt painting. */
export default function TgaBitmapOverlay({ bounds, layer, kind, transform, opacity, zIndex }) {
  const [url, setUrl] = useState(null);
  const encoder = useRef(null);
  const { bitmap, data, width, height } = layer;
  useEffect(() => {
    const current = mapLayerPreviewEncoder(setUrl);
    encoder.current = current;
    return () => { current.dispose(); encoder.current = null; };
  }, []);
  useEffect(() => {
    encoder.current.update({ data, width, height }, kind, transform);
  }, [bitmap, data, width, height, kind, transform]);
  if (!url) return null;
  return <ImageOverlay url={url} bounds={bounds} opacity={opacity} className="pixelated-overlay" zIndex={zIndex} />;
}