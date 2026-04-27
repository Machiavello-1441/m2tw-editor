/**
 * SVG overlay rendered on top of the map canvas showing resources,
 * characters, fortifications etc. from descr_strat.txt
 *
 * Y-axis: M2TW uses y=0 at bottom, screen uses y=0 at top — we invert.
 */
import React, { useRef, useCallback, useEffect, useState } from 'react';
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

/**
 * Convert M2TW map coords to screen coords.
 * mapH is the map height in pixels (used to flip Y).
 */
function toScreen(mx, my, transform, mapH) {
  const flippedY = mapH - 1 - my;
  return {
    sx: mx * transform.scale + transform.x + transform.scale * 0.5,
    sy: flippedY * transform.scale + transform.y + transform.scale * 0.5,
  };
}

// Group items that land on the exact same pixel
function groupByPixel(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.x},${item.y}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

// Hook to reactively track window._m2tw_resource_icons
function useResourceIcons() {
  const [icons, setIcons] = useState(() => window._m2tw_resource_icons || {});
  useEffect(() => {
    const handler = (e) => setIcons(prev => ({ ...prev, ...(e.detail || {}) }));
    window.addEventListener('load-resource-icons', handler);
    return () => window.removeEventListener('load-resource-icons', handler);
  }, []);
  return icons;
}

export default function StratOverlay({
  items = [], transform, mapH = 0,
  visibleCategories, selectedId, onSelect, onMoveItem, onDoubleClick,
}) {
  const svgRef = useRef(null);
  const draggingRef = useRef(null);
  const resourceIcons = useResourceIcons();

  // Filter to visible items
  const visible = items.filter(item =>
    !visibleCategories || visibleCategories.has(item.category)
  );

  // Group by pixel for stack display
  const groups = groupByPixel(visible);

  // Handle drag-to-move via window events so the SVG doesn't need pointer-events
  const handleDragStart = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = item;
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current || !onMoveItem || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const mx = Math.floor((sx - transform.x) / transform.scale);
      const my = Math.floor(mapH - 1 - (sy - transform.y) / transform.scale);
      onMoveItem(draggingRef.current.id, mx, my, false);
    };
    const onUp = (e) => {
      if (!draggingRef.current || !onMoveItem || !svgRef.current) { draggingRef.current = null; return; }
      const rect = svgRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const mx = Math.floor((sx - transform.x) / transform.scale);
      const my = Math.floor(mapH - 1 - (sy - transform.y) / transform.scale);
      onMoveItem(draggingRef.current.id, mx, my, true);
      draggingRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [transform, mapH, onMoveItem]);

  const showLabel = transform.scale > 1.5;

  if (!items.length) return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 10, pointerEvents: 'none' }}
    >
      {[...groups.entries()].map(([key, groupItems]) => {
        const first = groupItems[0];
        const { sx, sy } = toScreen(first.x, first.y, transform, mapH);
        const isStack = groupItems.length > 1;

        // Find if selected item is in this group
        const selInGroup = groupItems.find(i => i.id === selectedId);
        const isSelected = !!selInGroup;
        const displayItem = selInGroup || first;
        const icon = getItemIcon(displayItem);
        const label = getItemLabel(displayItem);
        // Use TGA resource icon image if available
        const resIconUrl = displayItem.category === 'resource' && displayItem.type
          ? (resourceIcons[displayItem.type.toLowerCase()] || resourceIcons[`resource_${displayItem.type.toLowerCase()}`] || null)
          : null;

        return (
          <g key={key} transform={`translate(${sx}, ${sy})`}>
            {/* Glow ring for selected */}
            {isSelected && (
              <circle r={15} fill="rgba(245,158,11,0.25)" stroke="#f59e0b" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            )}

            {/* Main icon circle — clickable */}
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

            {/* Stack badge (blue dot with count) */}
            {isStack && (
              <g transform="translate(8,-8)" style={{ pointerEvents: 'none' }}>
                <circle r={6} fill="#2563eb" stroke="#1e3a8a" strokeWidth={1} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={7} fill="white" fontWeight="bold">
                  {groupItems.length}
                </text>
              </g>
            )}

            {/* Stack item list (small icons offset when zoomed in) */}
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
                  <circle
                    r={8}
                    fill="rgba(0,0,0,0.65)"
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

            {/* Name label for selected items with a name, or type label at zoom */}
            {isSelected && label && (
              <g transform={`translate(0, 20)`} style={{ pointerEvents: 'none' }}>
                <text
                  textAnchor="middle" fontSize={9} fill="white"
                  stroke="black" strokeWidth={2.5} paintOrder="stroke"
                  style={{ userSelect: 'none' }}
                >
                  {label}
                </text>
              </g>
            )}
            {!isSelected && showLabel && (
              <text
                y={16} textAnchor="middle" fontSize={8} fill="white"
                stroke="black" strokeWidth={2} paintOrder="stroke"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {displayItem.type || displayItem.charType}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}