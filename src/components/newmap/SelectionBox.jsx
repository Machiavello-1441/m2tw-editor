/**
 * SelectionBox — CotaMap-inspired interactive selection box on Leaflet.
 * Features:
 *  - 4 corner handles (drag to resize)
 *  - Center handle (drag to pan/move)
 *  - Rotation handle (drag to rotate)
 *  - Shows dashed amber box with handles
 *
 * Outputs an `{ north, south, east, west, rotation }` bbox (rotation stored separately,
 * applied when rasterizing).
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Small square SVG handle
function makeHandle(map, latlng, color, cursor, onDrag) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:12px;height:12px;background:${color};border:2px solid #1e293b;
      border-radius:2px;cursor:${cursor};box-shadow:0 0 4px rgba(0,0,0,.6);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  const marker = L.marker(latlng, { icon, draggable: true, zIndexOffset: 1000 });
  marker.addTo(map);
  marker.on('drag', (e) => onDrag(e.target.getLatLng()));
  return marker;
}

// Circle handle (rotation / center)
function makeCircleHandle(map, latlng, color, cursor, onDrag) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;background:${color};border:2px solid #1e293b;
      border-radius:50%;cursor:${cursor};box-shadow:0 0 6px rgba(0,0,0,.7);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  const marker = L.marker(latlng, { icon, draggable: true, zIndexOffset: 2000 });
  marker.addTo(map);
  marker.on('drag', (e) => onDrag(e.target.getLatLng()));
  return marker;
}

function rotateLatLng(center, latlng, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dlat = latlng.lat - center.lat;
  const dlng = latlng.lng - center.lng;
  return L.latLng(
    center.lat + dlat * cos - dlng * sin,
    center.lng + dlat * sin + dlng * cos
  );
}

export default function SelectionBox({ box, onChange }) {
  // box: { north, south, east, west, rotation }
  const map = useMap();
  const refs = useRef({ poly: null, handles: [], center: null, rot: null });

  const cleanup = useCallback(() => {
    const r = refs.current;
    if (r.poly) { map.removeLayer(r.poly); r.poly = null; }
    r.handles.forEach(h => map.removeLayer(h));
    r.handles = [];
    if (r.center) { map.removeLayer(r.center); r.center = null; }
    if (r.rot) { map.removeLayer(r.rot); r.rot = null; }
  }, [map]);

  useEffect(() => {
    cleanup();
    if (!box) return;

    const { north, south, east, west, rotation = 0 } = box;
    const centerLat = (north + south) / 2;
    const centerLng = (east + west) / 2;
    const center = L.latLng(centerLat, centerLng);

    // The 4 unrotated corners
    const rawCorners = [
      L.latLng(north, west),
      L.latLng(north, east),
      L.latLng(south, east),
      L.latLng(south, west),
    ];
    const corners = rawCorners.map(c => rotateLatLng(center, c, rotation));

    // Dashed polygon
    const poly = L.polygon(corners, {
      color: '#f59e0b',
      weight: 2,
      dashArray: '6 4',
      fillOpacity: 0.08,
      fillColor: '#f59e0b',
      interactive: false,
    }).addTo(map);
    refs.current.poly = poly;

    // Corner handles — drag corner → recalculate bbox
    const cornerMarkers = corners.map((c, i) => {
      return makeHandle(map, c, '#f59e0b', 'nwse-resize', (newPos) => {
        // Unrotate newPos back to axis-aligned space
        const unrotated = rotateLatLng(center, newPos, -rotation);
        // Opposite corner index: 0↔2, 1↔3
        const opp = rawCorners[(i + 2) % 4];
        const newN = Math.max(unrotated.lat, opp.lat);
        const newS = Math.min(unrotated.lat, opp.lat);
        const newE = Math.max(unrotated.lng, opp.lng);
        const newW = Math.min(unrotated.lng, opp.lng);
        onChange({ ...box, north: newN, south: newS, east: newE, west: newW });
      });
    });
    refs.current.handles = cornerMarkers;

    // Center handle — pan the whole box
    const centerMarker = makeCircleHandle(map, center, '#38bdf8', 'move', (newCenter) => {
      const dlat = newCenter.lat - centerLat;
      const dlng = newCenter.lng - centerLng;
      onChange({ ...box, north: north + dlat, south: south + dlat, east: east + dlng, west: west + dlng });
    });
    refs.current.center = centerMarker;

    // Rotation handle — above center
    const rotHandlePos = rotateLatLng(center, L.latLng(north + (north - south) * 0.18, centerLng), rotation);
    const rotMarker = makeCircleHandle(map, rotHandlePos, '#a78bfa', 'crosshair', (newPos) => {
      const dy = newPos.lat - centerLat;
      const dx = newPos.lng - centerLng;
      const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
      onChange({ ...box, rotation: angle });
    });
    refs.current.rot = rotMarker;

    return cleanup;
  }, [box, map, cleanup, onChange]);

  return null;
}