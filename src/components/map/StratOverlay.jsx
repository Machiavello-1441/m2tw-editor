/**
 * SVG overlay rendered on top of the Leaflet map showing resources,
 * characters, fortifications etc. from descr_strat.txt
 *
 * Uses Leaflet's coordinate system: M2TW coords are mapped to lat/lng via osmBbox.
 * Y-axis: M2TW uses y=0 at bottom, screen uses y=0 at top — we invert.
 */
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { SETTLEMENT_LEVEL_ICONS } from './stratParser';

export const ITEM_ICON = {
  'named character': '⚔️', general: '⚔️', admiral: '⚓', spy: '👁️',
  merchant: '💰', diplomat: '📜', priest: '🙏', assassin: '🗡️',
  princess: '👑', heretic: '🔥', witch: '🧙', inquisitor: '⚖️',
  fortification: '🏰', resource: '💎',
  coal: '⬛', fish: '🐟', amber: '🟡', furs: '🦊',
  gold: '🪙', silver: '⚗️', iron: '⚙️', timber: '🪵',
  wine: '🍷', wool: '🐑', grain: '🌾', silk: '🕸️',
  dyes: '🎨', tin: '🔩', marble: '🏛️', ivory: '🦷',
  sugar: '🍬', spices: '🌶️', tobacco: '🌿', chocolate: '🍫',
  cotton: '🪡', sulfur: '💥', slaves: '⛓️',
};

export function getItemIcon(item) {
  if (item.category === 'settlement') return SETTLEMENT_LEVEL_ICONS[item.level] || '🏘️';
  if (item.category === 'character') return ITEM_ICON[item.charType] || '⚔️';
  if (item.category === 'fortification') return '🏰';
  if (item.category === 'resource') return ITEM_ICON[item.type] || '💎';
  return '❓';
}

export function getItemLabel(item) {
  if (item.category === 'settlement') return item.region || item.name || '';
  if (item.name) return item.name;
  if (item.type) return item.type;
  if (item.charType) return item.charType;
  return '';
}

/** Group items that land on the exact same pixel */
function groupByPixel(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.x},${item.y}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** Hook to reactively track window._m2tw_resource_icons */
function useResourceIcons() {
  const [icons, setIcons] = useState(() => window._m2tw_resource_icons || {});
  useEffect(() => {
    const handler = (e) => setIcons(prev => ({ ...prev, ...(e.detail || {}) }));
    window.addEventListener('load-resource-icons', handler);
    return () => window.removeEventListener('load-resource-icons', handler);
  }, []);
  return icons;
}

/**
 * Convert M2TW map pixel coords to Leaflet screen pixel coords.
 * Uses Mercator-correct projection: the TGA is georeferenced via ImageOverlay
 * which stretches it in Mercator space, so we must use the same projection.
 * osmBbox: { north, south, east, west }
 * mapW, mapH: TGA pixel dimensions
 */
function mapCoordToScreen(mx, my, osmBbox, mapW, mapH, leafletMap) {
  if (!osmBbox || !mapW || !mapH || !leafletMap) return null;
  const L = leafletMap.options.crs || window.L?.CRS?.EPSG3857;
  // Project bbox corners to Mercator meters
  const swPx = leafletMap.project([osmBbox.south, osmBbox.west], leafletMap.getZoom());
  const nePx = leafletMap.project([osmBbox.north, osmBbox.east], leafletMap.getZoom());
  // M2TW Y=0 is bottom of map → flip
  const flippedY = mapH - 1 - my;
  // Interpolate linearly in projected (Mercator) pixel space
  const projX = swPx.x + (mx / mapW) * (nePx.x - swPx.x);
  const projY = nePx.y + (flippedY / mapH) * (swPx.y - nePx.y);
  // Convert back to screen container point
  const containerPt = leafletMap.unproject([projX, projY], leafletMap.getZoom());
  const pt = leafletMap.latLngToContainerPoint(containerPt);
  return { sx: pt.x, sy: pt.y };
}

/**
 * Convert a Leaflet container point back to M2TW map pixel coords.
 */
function screenToMapCoord(sx, sy, osmBbox, mapW, mapH, leafletMap) {
  const swPx = leafletMap.project([osmBbox.south, osmBbox.west], leafletMap.getZoom());
  const nePx = leafletMap.project([osmBbox.north, osmBbox.east], leafletMap.getZoom());
  const latlng = leafletMap.containerPointToLatLng([sx, sy]);
  const pt = leafletMap.project(latlng, leafletMap.getZoom());
  const mx = Math.round((pt.x - swPx.x) / (nePx.x - swPx.x) * mapW);
  const flippedY = Math.round((pt.y - nePx.y) / (swPx.y - nePx.y) * mapH);
  const my = mapH - 1 - flippedY;
  return { mx, my };
}

/** Inner component that lives inside MapContainer and has access to map context */
function StratOverlayInner({
  items, visibleCategories, selectedId, onSelect, onMoveItem, onDoubleClick,
  osmBbox, mapW, mapH,
}) {
  const map = useMap();
  const svgRef = useRef(null);
  const draggingRef = useRef(null);
  const resourceIcons = useResourceIcons();
  const [tick, setTick] = useState(0);

  // Re-render on map move/zoom so icons follow correctly
  useMapEvents({
    move() { setTick(t => t + 1); },
    zoom() { setTick(t => t + 1); },
  });

  const visible = items.filter(item =>
    !visibleCategories || visibleCategories.has(item.category)
  );

  const groups = groupByPixel(visible);

  const handleDragStart = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = item;
    map.dragging.disable();
  }, [map]);

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current || !onMoveItem) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { mx, my } = screenToMapCoord(e.clientX - rect.left, e.clientY - rect.top, osmBbox, mapW, mapH, map);
      onMoveItem(draggingRef.current.id, mx, my, false);
    };
    const onUp = (e) => {
      if (!draggingRef.current || !onMoveItem) { draggingRef.current = null; map.dragging.enable(); return; }
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const { mx, my } = screenToMapCoord(e.clientX - rect.left, e.clientY - rect.top, osmBbox, mapW, mapH, map);
        onMoveItem(draggingRef.current.id, mx, my, true);
      }
      draggingRef.current = null;
      map.dragging.enable();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [map, osmBbox, mapW, mapH, onMoveItem]);

  const zoom = map.getZoom();
  const showLabel = zoom >= 8;

  if (!items.length || !osmBbox) return null;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 600, pointerEvents: 'none',
      }}
    >
      {[...groups.entries()].map(([key, groupItems]) => {
        const first = groupItems[0];
        if (first.x == null || first.y == null) return null;
        const pos = mapCoordToScreen(first.x, first.y, osmBbox, mapW, mapH, map);
        if (!pos) return null;
        const { sx, sy } = pos;

        const isStack = groupItems.length > 1;
        const selInGroup = groupItems.find(i => i.id === selectedId);
        const isSelected = !!selInGroup;
        const displayItem = selInGroup || first;
        const icon = getItemIcon(displayItem);
        const label = getItemLabel(displayItem);
        const resIconUrl = displayItem.category === 'resource' && displayItem.type
          ? (resourceIcons[displayItem.type.toLowerCase()] || resourceIcons[`resource_${displayItem.type.toLowerCase()}`] || null)
          : null;

        return (
          <g key={key} transform={`translate(${sx}, ${sy})`}>
            {isSelected && (
              <circle r={15} fill="rgba(245,158,11,0.25)" stroke="#f59e0b" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            )}

            <g
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onSelect && onSelect(displayItem); }}
              onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick && onDoubleClick(displayItem); }}
              onMouseDown={(e) => { if (isSelected && onMoveItem) handleDragStart(e, displayItem); }}
            >
              <circle
                r={10}
                fill="rgba(0,0,0,0.65)"
                stroke={isSelected ? '#f59e0b' : isStack ? '#60a5fa' : 'rgba(255,255,255,0.3)'}
                strokeWidth={isSelected ? 2 : isStack ? 1.5 : 1}
              />
              {resIconUrl ? (
                <image href={resIconUrl} x={-9} y={-9} width={18} height={18} style={{ imageRendering: 'pixelated' }} />
              ) : (
                <text textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ userSelect: 'none' }}>
                  {icon}
                </text>
              )}
            </g>

            {isStack && (
              <g transform="translate(8,-8)" style={{ pointerEvents: 'none' }}>
                <circle r={6} fill="#2563eb" stroke="#1e3a8a" strokeWidth={1} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={7} fill="white" fontWeight="bold">
                  {groupItems.length}
                </text>
              </g>
            )}

            {isStack && showLabel && groupItems.slice(1).map((extra, idx) => {
              const offsetX = (idx + 1) * 18;
              const extraResUrl = extra.category === 'resource' && extra.type
                ? (resourceIcons[extra.type.toLowerCase()] || resourceIcons[`resource_${extra.type.toLowerCase()}`] || null)
                : null;
              return (
                <g
                  key={extra.id}
                  transform={`translate(${offsetX}, 0)`}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onSelect && onSelect(extra); }}
                  onMouseDown={(e) => { if (extra.id === selectedId && onMoveItem) handleDragStart(e, extra); }}
                >
                  <circle r={8} fill="rgba(0,0,0,0.65)"
                    stroke={extra.id === selectedId ? '#f59e0b' : 'rgba(255,255,255,0.25)'}
                    strokeWidth={extra.id === selectedId ? 2 : 1}
                  />
                  {extraResUrl ? (
                    <image href={extraResUrl} x={-7} y={-7} width={14} height={14} style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <text textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ userSelect: 'none' }}>
                      {getItemIcon(extra)}
                    </text>
                  )}
                </g>
              );
            })}

            {isSelected && label && (
              <g transform="translate(0, 20)" style={{ pointerEvents: 'none' }}>
                <text textAnchor="middle" fontSize={9} fill="white"
                  stroke="black" strokeWidth={2.5} paintOrder="stroke"
                  style={{ userSelect: 'none' }}>
                  {label}
                </text>
              </g>
            )}
            {!isSelected && showLabel && (
              <text y={16} textAnchor="middle" fontSize={8} fill="white"
                stroke="black" strokeWidth={2} paintOrder="stroke"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {displayItem.type || displayItem.charType}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Exported wrapper — when osmBbox is available, renders the Leaflet-native overlay.
 * Falls back to null when no bbox (no map to position against).
 */
export default function StratOverlay({ items = [], osmBbox, mapW, mapH, visibleCategories, selectedId, onSelect, onMoveItem, onDoubleClick }) {
  if (!osmBbox || !mapW || !mapH) return null;
  return (
    <StratOverlayInner
      items={items}
      visibleCategories={visibleCategories}
      selectedId={selectedId}
      onSelect={onSelect}
      onMoveItem={onMoveItem}
      onDoubleClick={onDoubleClick}
      osmBbox={osmBbox}
      mapW={mapW}
      mapH={mapH}
    />
  );
}