import React, { createContext, useContext, useState, useCallback } from 'react';
import { parseEDB, serializeEDB, createDefaultBuilding, createDefaultLevel } from './EDBParser';

const EDBContext = createContext(null);

export function EDBProvider({ children }) {
  const [edbData, setEdbData] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState(null); // JSON snapshot for Revert
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [imageData, setImageData] = useState({}); // { levelName_culture: { icon, constructed, construction } }
  const [isDirty, setIsDirty] = useState(false);
  const [fileName, setFileName] = useState('');

  const loadEDB = useCallback((text, name) => {
    const parsed = parseEDB(text);
    // Auto-assign convertTo index for buildings that have a convertTo
    for (const building of parsed.buildings) {
      if (building.convertTo) {
        building.levels = building.levels.map((level, idx) => ({
          ...level,
          convertTo: level.convertTo !== null && level.convertTo !== undefined ? level.convertTo : String(idx)
        }));
      }
    }
    setEdbData(parsed);
    setFileName(name || 'export_descr_buildings.txt');
    setSelectedBuilding(null);
    setSelectedLevel(null);
    setIsDirty(false);
  }, []);

  const exportEDB = useCallback(() => {
    if (!edbData) return '';
    return serializeEDB(edbData);
  }, [edbData]);

  // Save: commit current state as the revert baseline
  const saveEDB = useCallback(() => {
    if (!edbData) return;
    setSavedSnapshot(JSON.stringify(edbData));
    setIsDirty(false);
  }, [edbData]);

  // Revert: restore to last saved snapshot
  const revertEDB = useCallback(() => {
    if (!savedSnapshot) return;
    setEdbData(JSON.parse(savedSnapshot));
    setIsDirty(false);
  }, [savedSnapshot]);

  const updateBuilding = useCallback((buildingName, updater) => {
    setEdbData(prev => {
      if (!prev) return prev;
      const newBuildings = prev.buildings.map(b => {
        if (b.name === buildingName) {
          return typeof updater === 'function' ? updater(b) : { ...b, ...updater };
        }
        return b;
      });
      return { ...prev, buildings: newBuildings };
    });
    setIsDirty(true);
  }, []);

  const updateLevel = useCallback((buildingName, levelName, updater) => {
    setEdbData(prev => {
      if (!prev) return prev;
      const newBuildings = prev.buildings.map(b => {
        if (b.name === buildingName) {
          const newLevels = b.levels.map(l => {
            if (l.name === levelName) {
              return typeof updater === 'function' ? updater(l) : { ...l, ...updater };
            }
            return l;
          });
          return { ...b, levels: newLevels };
        }
        return b;
      });
      return { ...prev, buildings: newBuildings };
    });
    setIsDirty(true);
  }, []);

  const addBuilding = useCallback((name) => {
    const newBuilding = createDefaultBuilding(name);
    setEdbData(prev => {
      if (!prev) return prev;
      return { ...prev, buildings: [...prev.buildings, newBuilding] };
    });
    setIsDirty(true);
  }, []);

  const deleteBuilding = useCallback((buildingName) => {
    setEdbData(prev => {
      if (!prev) return prev;
      return { ...prev, buildings: prev.buildings.filter(b => b.name !== buildingName) };
    });
    if (selectedBuilding === buildingName) {
      setSelectedBuilding(null);
      setSelectedLevel(null);
    }
    setIsDirty(true);
  }, [selectedBuilding]);

  const addLevel = useCallback((buildingName) => {
    setEdbData(prev => {
      if (!prev) return prev;
      const newBuildings = prev.buildings.map(b => {
        if (b.name === buildingName) {
          const newLevel = createDefaultLevel(buildingName, b.levels.length);
          const updatedLevels = b.levels.map((l, idx) => {
            if (idx === b.levels.length - 1 && l.upgrades.length === 0) {
              return { ...l, upgrades: [{ name: newLevel.name, requirements: [] }] };
            }
            return l;
          });
          return { ...b, levels: [...updatedLevels, newLevel] };
        }
        return b;
      });
      return { ...prev, buildings: newBuildings };
    });
    setIsDirty(true);
  }, []);

  const deleteLevel = useCallback((buildingName, levelName) => {
    setEdbData(prev => {
      if (!prev) return prev;
      const newBuildings = prev.buildings.map(b => {
        if (b.name === buildingName) {
          const newLevels = b.levels.filter(l => l.name !== levelName);
          // Clean up upgrade references
          const cleaned = newLevels.map(l => ({
            ...l,
            upgrades: l.upgrades.filter(u => u !== levelName)
          }));
          return { ...b, levels: cleaned };
        }
        return b;
      });
      return { ...prev, buildings: newBuildings };
    });
    if (selectedLevel === levelName) setSelectedLevel(null);
    setIsDirty(true);
  }, [selectedLevel]);

  const value = {
    edbData, setEdbData, loadEDB, exportEDB, saveEDB, revertEDB, savedSnapshot,
    selectedBuilding, setSelectedBuilding,
    selectedLevel, setSelectedLevel,
    updateBuilding, updateLevel,
    addBuilding, deleteBuilding,
    addLevel, deleteLevel,
    textData, setTextData,
    imageData, setImageData,
    isDirty, fileName
  };

  return <EDBContext.Provider value={value}>{children}</EDBContext.Provider>;
}

export function useEDB() {
  const ctx = useContext(EDBContext);
  if (!ctx) throw new Error('useEDB must be within EDBProvider');
  return ctx;
}