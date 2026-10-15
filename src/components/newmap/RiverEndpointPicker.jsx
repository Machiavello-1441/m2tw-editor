import { useEffect } from 'react';
import { useMapEvents } from 'react-leaflet';

export default function RiverEndpointPicker({ active, bbox, image, onPick, onCancel }) {
  const map = useMapEvents({ click(event) {
    if (!active || !bbox || !image) return;
    const top = map.project([bbox.north,bbox.west],0), bottom = map.project([bbox.south,bbox.east],0), point = map.project(event.latlng,0);
    onPick({ x: Math.floor((point.x - top.x) / (bottom.x - top.x) * image.width), y: Math.floor((point.y - top.y) / (bottom.y - top.y) * image.height) });
  } });
  useEffect(() => {
    if (!active) return;
    const container = map.getContainer(), previous = container.style.cursor;
    container.style.cursor = 'crosshair';
    const escape = event => { if (event.key === 'Escape') onCancel(); };
    document.addEventListener('keydown',escape);
    return () => { container.style.cursor = previous; document.removeEventListener('keydown',escape); };
  }, [active,map,onCancel]);
  return null;
}