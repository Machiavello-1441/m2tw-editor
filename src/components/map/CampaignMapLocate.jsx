import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function CampaignMapLocate({ locateRef }) {
  const map = useMap();
  useEffect(() => {
    if (!locateRef) return;
    const locate = (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      map.setView([lat, lng], map.getZoom(), { animate: false });
    };
    locateRef.current = locate;
    return () => { if (locateRef.current === locate) locateRef.current = null; };
  }, [map, locateRef]);
  return null;
}