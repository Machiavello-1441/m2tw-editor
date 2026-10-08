import { useEffect, useState } from 'react';
import { getFile, setFile } from '@/lib/bigFileStore';

const KEY = 'm2tw_settlement_mechanics';
const EVENT = 'settlement-mechanics-changed';
const CITY_LEVELS = ['village', 'town', 'large_town', 'city', 'large_city', 'huge_city'];
const CASTLE_LEVELS = ['motte_and_bailey', 'wooden_castle', 'castle', 'fortress', 'citadel'];
let cachedRaw, cachedLevels = null;

export function parseSettlementMechanics(raw) {
  const xml = new DOMParser().parseFromString(raw.replace(/^\uFEFF/, ''), 'application/xml');
  const population = xml.querySelector('population_levels');
  if (xml.querySelector('parsererror') || !population) throw new Error('Choose a valid descr_settlement_mechanics.xml containing population_levels.');
  const definitions = Array.from(population.querySelectorAll('level')).map(node => {
    const name = node.getAttribute('name')?.toLowerCase().replace('moot_and_bailey', 'motte_and_bailey');
    const number = key => node.hasAttribute(key) ? Number(node.getAttribute(key)) : null;
    return { name, base: number('base'), upgrade: number('upgrade') };
  });
  const read = names => names.flatMap((name, index) => {
    const entry = definitions.find(d => d.name === name);
    return entry ? [{ ...entry, level: CITY_LEVELS[index] }] : [];
  });
  const levels = { city: read(CITY_LEVELS), castle: read(CASTLE_LEVELS) };
  for (const entries of Object.values(levels)) {
    if (!entries.length || entries.some((entry, i) => (entry.base !== null && (!Number.isFinite(entry.base) || entry.base < 0)) || (i < entries.length - 1 && (entry.upgrade === null || !Number.isFinite(entry.upgrade) || entry.upgrade < 0)))) {
      throw new Error('Population levels must include valid city and castle upgrade thresholds.');
    }
  }
  return levels;
}

export function getSettlementMechanics() {
  const raw = getFile(KEY);
  if (raw !== cachedRaw) { cachedLevels = raw ? parseSettlementMechanics(raw) : null; cachedRaw = raw; }
  return cachedLevels;
}

export async function loadSettlementMechanicsFile(file) {
  if (file.name.toLowerCase() !== 'descr_settlement_mechanics.xml') return false;
  const raw = await file.text();
  const levels = parseSettlementMechanics(raw);
  setFile(KEY, raw); cachedRaw = raw; cachedLevels = levels;
  window.dispatchEvent(new Event(EVENT));
  return true;
}

export function populationSettlementLevel(population, castle, mechanics = getSettlementMechanics()) {
  const entries = mechanics?.[castle ? 'castle' : 'city'];
  if (!entries?.length || !Number.isFinite(Number(population))) return null;
  let index = 0;
  while (index < entries.length - 1 && Number(population) >= entries[index].upgrade) index++;
  return entries[index].level;
}

export function useSettlementMechanics() {
  const [levels, setLevels] = useState(getSettlementMechanics);
  useEffect(() => {
    const refresh = () => setLevels(getSettlementMechanics());
    window.addEventListener(EVENT, refresh);
    return () => window.removeEventListener(EVENT, refresh);
  }, []);
  return levels;
}