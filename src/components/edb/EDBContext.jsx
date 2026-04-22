import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { parseEDB, serializeEDB, createDefaultBuilding, createDefaultLevel, parseTextFile, serializeTextFile, parseBuildingImageKey } from './EDBParser';
import { useEDBAutoSave } from './useEDBAutoSave';

const EDBContext = createContext(null);

const EDB_LS_KEY = 'm2tw_edb_file';
const EDB_LS_NAME_KEY = 'm2tw_edb_file_name';
const EDB_TXT_LS_KEY = 'm2tw_edb_txt_file';
const EDB_IMG_LS_KEY = 'm2tw_edb_images';

export function EDBProvider({ children }) {
  const [edbData, setEdbData] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [textData, setTextData] = useState({}); // { levelName: { title, desc, shortDesc, factionEntries: {} } }
  const [imageData, setImageData] = useState({}); // { levelName_culture: { icon, constructed, construction } }
  const [isDirty, setIsDirty] = useState(false);
  const [fileName, setFileName] = useState('');

  // Auto-restore from localStorage on mount
  useEffect(() => {
    // Clear stale image data that may have filled the quota in older sessions
    try { localStorage.removeItem(EDB_IMG_LS_KEY); } catch {}
    try {
      const raw = localStorage.getItem(EDB_LS_KEY);
      const name = localStorage.getItem(EDB_LS_NAME_KEY);
      if (raw) {
        const parsed = parseEDB(raw);
        setEdbData(parsed);
        setFileName(name || 'export_descr_buildings.txt');
      }
      const txtRaw = localStorage.getItem(EDB_TXT_LS_KEY);
      if (txtRaw) {
        const parsed = parseTextFile(txtRaw);
        setTextData(prev => ({ ...prev, ...parsed }));
      }
      // Note: image data URLs are NOT restored from localStorage (too large, quota killer)
    } catch {}
  }, []);

  const loadEDB = useCallback((text, name) => {
    const parsed = parseEDB(text);
    setEdbData(parsed);
    setFileName(name || 'export_descr_buildings.txt');
    setSelectedBuilding(null);
    setSelectedLevel(null);
    setIsDirty(false);
    try {
      localStorage.setItem(EDB_LS_KEY, text);
      localStorage.setItem(EDB_LS_NAME_KEY, name || 'export_descr_buildings.txt');
    } catch {}
  }, []);

  const exportEDB = useCallback(() => {
    if (!edbData) return '';
    return serializeEDB(edbData);
  }, [edbData]);

  const loadTextFile = useCallback((text) => {
    const parsed = parseTextFile(text);
    setTextData(prev => ({ ...prev, ...parsed }));
    try { localStorage.setItem(EDB_TXT_LS_KEY, text); } catch {}
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
              const updated = typeof updater === 'function' ? updater(l) : { ...l, ...updater };
              // If name changed, update selectedLevel too (done after state update)
              return updated;
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

  const reorderBuildings = useCallback((fromIndex, toIndex) => {
    setEdbData(prev => {
      if (!prev) return prev;
      const buildings = [...prev.buildings];
      const [moved] = buildings.splice(fromIndex, 1);
      buildings.splice(toIndex, 0, moved);
      return { ...prev, buildings };
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

  const loadTgaImages = useCallback((images) => {
    setImageData(prev => ({ ...prev, ...images }));
  }, []);

  const loadBuildingTgaImages = useCallback((filesArray, replace = false) => {
    // filesArray: array of { path, name, url } from folder picker
    const structured = {};
    for (const f of filesArray) {
      const parsed = parseBuildingImageKey(f.path, f.name);
      if (parsed) {
        structured[parsed.key] = { url: f.url, culture: parsed.culture, type: parsed.type, levelName: parsed.levelName };
      }
    }
    setImageData(prev => replace ? structured : { ...prev, ...structured });
  }, []);

  const restoreSnapshot = useCallback((snap) => {
    setEdbData(snap.edbData);
    setTextData(snap.textData || {});
    setFileName(snap.fileName || 'export_descr_buildings.txt');
    setSelectedBuilding(null);
    setSelectedLevel(null);
    setIsDirty(false);
  }, []);

  const { saveNow: saveSnapshot } = useEDBAutoSave(edbData, textData, fileName);

  const saveNow = useCallback(async () => {
    // Persist to localStorage so data survives page reload
    if (edbData) {
      try {
        const { serializeEDB, serializeTextFile } = await import('./EDBParser');
        localStorage.setItem('m2tw_edb_file', serializeEDB(edbData));
        localStorage.setItem('m2tw_edb_file_name', fileName);
        if (textData && Object.keys(textData).length > 0) {
          const txtSerialized = serializeTextFile(textData);
          if (txtSerialized.length < 500_000) { // skip if > 500KB to avoid quota
            localStorage.setItem('m2tw_edb_txt_file', txtSerialized);
          }
        }
      } catch {}
    }
    setIsDirty(false);
    return saveSnapshot();
  }, [edbData, textData, fileName, saveSnapshot]);

  const value = {
    edbData, setEdbData, loadEDB, exportEDB,
    loadTextFile, exportTextFile,
    selectedBuilding, setSelectedBuilding,
    selectedLevel, setSelectedLevel,
    updateBuilding, updateLevel,
    addBuilding, deleteBuilding, reorderBuildings,
    addLevel, deleteLevel,
    textData, setTextData,
    imageData, setImageData, loadTgaImages, loadBuildingTgaImages,
    isDirty, fileName,
    restoreSnapshot, saveNow
  };

  return <EDBContext.Provider value={value}>{children}</EDBContext.Provider>;
}

export function useEDB() {
  const ctx = useContext(EDBContext);
  if (!ctx) throw new Error('useEDB must be within EDBProvider');
  return ctx;
}