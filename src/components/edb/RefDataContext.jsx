import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  parseFactionsFile, parseResourcesFile, parseEventsFile, parseUnitsFile,
  FACTIONS as DEFAULT_FACTIONS, CULTURES as DEFAULT_CULTURES, HIDDEN_RESOURCES_DEFAULT
} from './EDBParser';

const RefDataContext = createContext(null);

const LS_KEYS = {
  factions: 'm2tw_factions_file',
  resources: 'm2tw_resources_file',
  events: 'm2tw_events_file',
  units: 'm2tw_units_file',
  skeleton: 'm2tw_skeleton_file',
  mount: 'm2tw_mount_file',
};

// Parse descr_skeleton.txt → array of skeleton type name strings
function parseSkeletonFile(text) {
  const types = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^type\s+(\S+)/i);
    if (m) types.push(m[1]);
  }
  return [...new Set(types)];
}

// Parse descr_mount.txt → array of mount type name strings
function parseMountFile(text) {
  const types = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^type\s+(\S+)/i);
    if (m) types.push(m[1]);
  }
  return [...new Set(types)];
}

export function RefDataProvider({ children }) {
  const [factions, setFactions] = useState(DEFAULT_FACTIONS);
  const [cultures, setCultures] = useState(DEFAULT_CULTURES);
  const [mapResources, setMapResources] = useState([]);
  const [eventCounters, setEventCounters] = useState([]);
  const [units, setUnits] = useState([]); // [{type, dictionary}]

  // Auto-restore from localStorage on mount
  useEffect(() => {
    try {
      const facRaw = localStorage.getItem(LS_KEYS.factions);
      if (facRaw) {
        const result = parseFactionsFile(facRaw);
        if (result.factions) setFactions(result.factions);
        if (result.cultures) setCultures(result.cultures);
      }
      const resRaw = localStorage.getItem(LS_KEYS.resources);
      if (resRaw) {
        const res = parseResourcesFile(resRaw);
        if (res.length) setMapResources(res);
      }
      const evRaw = localStorage.getItem(LS_KEYS.events);
      if (evRaw) {
        const evs = parseEventsFile(evRaw);
        if (evs.length) setEventCounters(evs);
      }
      const unitRaw = localStorage.getItem(LS_KEYS.units);
      if (unitRaw) {
        const u = parseUnitsFile(unitRaw);
        if (u.length) setUnits(u);
      }
    } catch {}
  }, []);

  const loadFactionsFile = useCallback((text) => {
    const result = parseFactionsFile(text);
    if (result.factions) setFactions(result.factions);
    if (result.cultures) setCultures(result.cultures);
    try { localStorage.setItem(LS_KEYS.factions, text); } catch {}
  }, []);

  const loadResourcesFile = useCallback((text) => {
    const res = parseResourcesFile(text);
    if (res.length) setMapResources(res);
    try { localStorage.setItem(LS_KEYS.resources, text); } catch {}
  }, []);

  const loadEventsFile = useCallback((text) => {
    const evs = parseEventsFile(text);
    if (evs.length) setEventCounters(evs);
    try { localStorage.setItem(LS_KEYS.events, text); } catch {}
  }, []);

  const loadUnitsFile = useCallback((text) => {
    const u = parseUnitsFile(text);
    if (u.length) setUnits(u);
    try { localStorage.setItem(LS_KEYS.units, text); } catch {}
  }, []);

  return (
    <RefDataContext.Provider value={{
      factions, cultures, mapResources, eventCounters, units,
      loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile
    }}>
      {children}
    </RefDataContext.Provider>
  );
}

export function useRefData() {
  const ctx = useContext(RefDataContext);
  if (!ctx) throw new Error('useRefData must be within RefDataProvider');
  return ctx;
}