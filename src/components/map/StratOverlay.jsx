/**
 * SVG overlay rendered on top of the map canvas showing resources,
 * characters, fortifications etc. from descr_strat.txt
 */
import React from 'react';

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
  if (item.category === 'character') return ITEM_ICON[item.charType] || '⚔️';
  if (item.category === 'fortification') return '🏰';
  if (item.category === 'resource') return ITEM_ICON[item.type] || '💎';
  return '❓';
}

export default function StratOverlay({ items = [], transform, mapW, mapH, visibleCategories, selectedId, onSelect, onPlace, placingItem }) {
  if (!items.length && !placingItem) return null;

  // Transform map coords → screen coords, centered in the pixel
  const toScreen = (mx, my) => ({
    sx: mx * transform.scale + transform.x + transform.scale * 0.5,
    sy: my * transform.scale + transform.y + transform.scale * 0.5,
  });

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {items.map(item => {
        if (visibleCategories && !visibleCategories.has(item.category)) return null;
        const { sx, sy } = toScreen(item.x, item.y);
        const isSelected = item.id === selectedId;
        const icon = getItemIcon(item);
        return (
          <g
            key={item.id}
            transform={`translate(${sx}, ${sy})`}
            className="pointer-events-auto cursor-pointer"
            onClick={() => onSelect && onSelect(item)}
          >
            {isSelected && <circle r={14} fill="rgba(245,158,11,0.3)" stroke="#f59e0b" strokeWidth={1.5} />}
            <circle r={10} fill="rgba(0,0,0,0.6)" stroke={isSelected ? '#f59e0b' : 'rgba(255,255,255,0.3)'} strokeWidth={isSelected ? 1.5 : 1} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={11}>{icon}</text>
            {transform.scale > 1.5 && (
              <text y={16} textAnchor="middle" fontSize={8} fill="white" stroke="black" strokeWidth={2} paintOrder="stroke">
                {item.type || item.charType}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}