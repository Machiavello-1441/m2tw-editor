import React, { createContext, useContext, useState, useCallback } from 'react';
import { parseEDB, serializeEDB, createDefaultBuilding, createDefaultLevel, parseTextFile, serializeTextFile } from './EDBParser';
import { useEDBAutoSave } from './useEDBAutoSave';

const EDBContext = createContext(null);

export function EDBProvider({ children }) {
  const [edbData, setEdbData] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [textData, setTextData] = useState({}); // { levelName: { title, desc, shortDesc, factionEntries: {} } }
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

  const loadTextFile = useCallback((text) => {
    const parsed = parseTextFile(text);
    setTextData(prev => ({ ...prev, ...parsed }));
  }, []);

  const exportTextFile = useCallback(() => {
    return serializeTextFile(textData);
  }, [textData]);

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
    // Auto-create text entries for the new building's levels
    setTextData(prev => {
      const next = { ...prev };
      for (const level of newBuilding.levels) {
        if (!next[level.name]) next[level.name] = level.name;
        if (!next[level.name + '_desc']) next[level.name + '_desc'] = '';
        if (!next[level.name + '_desc_short']) next[level.name + '_desc_short'] = '';
      }
      return next;
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
    let newLevelName = '';
    setEdbData(prev => {
      if (!prev) return prev;
      const newBuildings = prev.buildings.map(b => {
        if (b.name === buildingName) {
          const newLevel = createDefaultLevel(buildingName, b.levels.length);
          newLevelName = newLevel.name;
          const updatedLevels = b.levels.map((l, idx) => {
            if (idx === b.levels.length - 1 && l.upgrades.length === 0) {
              return { ...l, upgrades: [newLevel.name] };
            }
            return l;
          });
          return { ...b, levels: [...updatedLevels, newLevel] };
        }
        return b;
      });
      return { ...prev, buildings: newBuildings };
    });
    // Auto-create text entry for new level
    setTimeout(() => {
      if (newLevelName) {
        setTextData(prev => {
          const next = { ...prev };
          if (!next[newLevelName]) next[newLevelName] = newLevelName;
          if (!next[newLevelName + '_desc']) next[newLevelName + '_desc'] = '';
          if (!next[newLevelName + '_desc_short']) next[newLevelName + '_desc_short'] = '';
          return next;
        });
      }
    }, 0);
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

  const loadTgaImages = useCallback((images) => {
    setImageData(prev => ({ ...prev, ...images }));
  }, []);

  const value = {
    edbData, setEdbData, loadEDB, exportEDB,
    loadTextFile, exportTextFile,
    selectedBuilding, setSelectedBuilding,
    selectedLevel, setSelectedLevel,
    updateBuilding, updateLevel,
    addBuilding, deleteBuilding,
    addLevel, deleteLevel,
    textData, setTextData,
    imageData, setImageData, loadTgaImages,
    isDirty, fileName
  };

  return <EDBContext.Provider value={value}>{children}</EDBContext.Provider>;
}

export function useEDB() {
  const ctx = useContext(EDBContext);
  if (!ctx) throw new Error('useEDB must be within EDBProvider');
  return ctx;
}