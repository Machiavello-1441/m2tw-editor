/**
 * Climate presets for the Campaign Map editor, read from the mod's own
 * data/descr_climates.txt (codename + colour) and cross-checked against
 * data/descr_aerial_map_ground_types.txt (which climates have textures).
 * Falls back to the vanilla preset list when nothing has been loaded.
 */
import { useState, useEffect } from 'react';
import { LAYER_PRESETS } from '@/components/map/paintPresets';

export const DESCR_CLIMATES_KEY = 'm2tw_descr_climates';
export const AERIAL_RAW_KEY = 'm2tw_aerial_ground_types_raw';
export const MOD_CLIMATES_EVT = 'mod-climates-changed';

const prettify = (id) => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** descr_climates.txt → [{ id, r, g, b }] for every "climate name { colour r g b }" block */
export function parseDescrClimatesColours(text) {
  const out = [];
  for (const m of text.matchAll(/climate\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const col = m[2].match(/colour\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (col) out.push({ id: m[1], r: +col[1], g: +col[2], b: +col[3] });
  }
  return out;
}

/** descr_aerial_map_ground_types.txt → climate block names */
export function parseAerialClimateNames(text) {
  return [...text.matchAll(/^[ \t]*(\w+)[ \t]*\r?\n[ \t]*\{/gm)].map(m => m[1]);
}

export function getModClimatePresets() {
  let descr = '', aerial = '';
  try { descr = localStorage.getItem(DESCR_CLIMATES_KEY) || ''; aerial = localStorage.getItem(AERIAL_RAW_KEY) || ''; } catch {}
  if (!descr) return LAYER_PRESETS.climates;
  const textured = new Set(parseAerialClimateNames(aerial));
  return parseDescrClimatesColours(descr).map(c => ({
    ...c,
    label: prettify(c.id) + (aerial && !textured.has(c.id) ? ' (no aerial textures)' : ''),
  }));
}

export function useModClimatePresets() {
  const [presets, setPresets] = useState(getModClimatePresets);
  useEffect(() => {
    const f = () => setPresets(getModClimatePresets());
    window.addEventListener(MOD_CLIMATES_EVT, f);
    window.addEventListener('storage', f);
    return () => { window.removeEventListener(MOD_CLIMATES_EVT, f); window.removeEventListener('storage', f); };
  }, []);
  return presets;
}