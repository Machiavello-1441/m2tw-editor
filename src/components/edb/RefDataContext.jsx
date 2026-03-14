import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  parseFactionsFile, parseResourcesFile, parseEventsFile, parseUnitsFile,
  FACTIONS as DEFAULT_FACTIONS, CULTURES as DEFAULT_CULTURES, HIDDEN_RESOURCES_DEFAULT
} from './EDBParser';

const RefDataContext = createContext(null);

export function RefDataProvider({ children }) {
  const [factions, setFactions] = useState(DEFAULT_FACTIONS);
  const [cultures, setCultures] = useState(DEFAULT_CULTURES);
  const [mapResources, setMapResources] = useState([]);
  const [eventCounters, setEventCounters] = useState([]);
  const [units, setUnits] = useState([]); // [{type, dictionary}]

  const loadFactionsFile = useCallback((text) => {
    const result = parseFactionsFile(text);
    if (result.factions) setFactions(result.factions);
    if (result.cultures) setCultures(result.cultures);
    // Cache raw file so condition dropdowns can read faction names
    try { localStorage.setItem('m2tw_factions_file', text); } catch {}
  }, []);

  const loadResourcesFile = useCallback((text) => {
    const res = parseResourcesFile(text);
    if (res.length) setMapResources(res);
  }, []);

  const loadEventsFile = useCallback((text) => {
    const evs = parseEventsFile(text);
    if (evs.length) setEventCounters(evs);
  }, []);

  const loadUnitsFile = useCallback((text) => {
    const u = parseUnitsFile(text);
    if (u.length) setUnits(u);
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