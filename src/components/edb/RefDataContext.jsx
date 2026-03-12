import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  parseFactionsFile, parseResourcesFile, parseEventsFile, parseUnitsFile,
  FACTIONS as DEFAULT_FACTIONS, CULTURES as DEFAULT_CULTURES, HIDDEN_RESOURCES_DEFAULT
} from './EDBParser';

const RefDataContext = createContext(null);

// Parse export_buildings.txt into a flat key→value map
export function parseExportBuildingsFile(text) {
  const entries = {};
  const lines = text.split('\n');
  let currentKey = '';
  let currentText = '';
  for (const line of lines) {
    const match = line.match(/^\{([^}]+)\}(.*)/);
    if (match) {
      if (currentKey) entries[currentKey] = currentText.trim();
      currentKey = match[1];
      currentText = match[2].trim();
    } else if (currentKey) {
      currentText += (currentText ? '\n' : '') + line;
    }
  }
  if (currentKey) entries[currentKey] = currentText.trim();
  return entries;
}

// Serialize textData back to export_buildings.txt format
export function serializeExportBuildingsFile(entries) {
  let out = '';
  for (const [key, value] of Object.entries(entries)) {
    out += `{${key}}${value ? ' ' + value : ''}\n`;
  }
  return out;
}

export function RefDataProvider({ children }) {
  const [factions, setFactions] = useState(DEFAULT_FACTIONS);
  const [cultures, setCultures] = useState(DEFAULT_CULTURES);
  const [mapResources, setMapResources] = useState([]);
  const [eventCounters, setEventCounters] = useState([]);
  const [units, setUnits] = useState([]); // [{type, dictionary}]
  const [textData, setTextData] = useState({}); // export_buildings.txt entries
  const [textDataLoaded, setTextDataLoaded] = useState(false);

  const loadFactionsFile = useCallback((text) => {
    const result = parseFactionsFile(text);
    if (result.factions) setFactions(result.factions);
    if (result.cultures) setCultures(result.cultures);
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

  const loadTextFile = useCallback((text) => {
    const entries = parseExportBuildingsFile(text);
    setTextData(entries);
    setTextDataLoaded(true);
  }, []);

  return (
    <RefDataContext.Provider value={{
      factions, cultures, mapResources, eventCounters, units,
      textData, setTextData, textDataLoaded,
      loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile, loadTextFile
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