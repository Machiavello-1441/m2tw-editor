/**
 * Custom strat-map climates — duplicates of a vanilla climate under a new
 * name + colour (see the TWC "How-To: Add a New Climate Zone" tutorial).
 * Persisted in localStorage so they survive reloads; every palette consumer
 * reads the merged list through useClimatePalette().
 *
 * Custom climate shape: { id, label, color, sourceId, koppenCode? }
 *  - id        → codename used in descr_climates.txt (e.g. koppen_cfb)
 *  - sourceId  → palette id of the vanilla climate the block is copied from
 */
import { useState, useEffect } from 'react';
import { CLIMATE_PALETTE } from '@/lib/mapLayerStore';

const KEY = 'm2tw_custom_climates';
const EVT = 'custom-climates-changed';

// Palette ids that differ from the codename used in descr_climates.txt
const DESCR_NAME = {
  temperate_grassland:  'unused1',
  temperate_deciduous:  'temperate_deciduous_forest',
  temperate_coniferous: 'temperate_coniferous_forest',
  swamp:                'unused2',
};
export const descrName = (id) => DESCR_NAME[id] ?? id;

export function getCustomClimates() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

export function addCustomClimates(items) {
  const cur = getCustomClimates().filter(x => !items.some(i => i.id === x.id));
  save([...cur, ...items]);
}

export function removeCustomClimate(id) {
  save(getCustomClimates().filter(x => x.id !== id));
}

export function getClimatePalette() {
  return [
    ...CLIMATE_PALETTE,
    ...getCustomClimates().map(c => ({ id: c.id, color: c.color, label: c.label, custom: true })),
  ];
}

export function useClimatePalette() {
  const [pal, setPal] = useState(getClimatePalette);
  useEffect(() => {
    const f = () => setPal(getClimatePalette());
    window.addEventListener(EVT, f);
    return () => window.removeEventListener(EVT, f);
  }, []);
  return pal;
}

export function useCustomClimates() {
  const [list, setList] = useState(getCustomClimates);
  useEffect(() => {
    const f = () => setList(getCustomClimates());
    window.addEventListener(EVT, f);
    return () => window.removeEventListener(EVT, f);
  }, []);
  return list;
}