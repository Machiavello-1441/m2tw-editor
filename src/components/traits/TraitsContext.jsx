import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { parseTraitsFile, serializeTraitsFile, parseTextFile, serializeTextFile } from './TraitsParser';
import { getStringsBinStore } from '@/lib/stringsBinStore';
import { encodeStringsBin } from '@/components/strings/stringsBinCodec';

const TraitsContext = createContext(null);

export function TraitsProvider({ children }) {
  const [traitsData, setTraitsData] = useState(null);
  const [textData, setTextData] = useState(null);
  const [traitsFilename, setTraitsFilename] = useState('export_descr_character_traits.txt');
  const [textFilename, setTextFilename] = useState('export_VnVs.txt');
  const [isDirty, setIsDirty] = useState(false);
  const [selectedTrait, setSelectedTrait] = useState(null);
  const [textBinMeta, setTextBinMeta] = useState({ magic1: 2, magic2: 2048 });

  // Snapshots for revert
  const originalTraitsData = useRef(null);
  const originalTextData = useRef(null);

  // Auto-load from localStorage if Home page cached the files
  const loadFromStorage = useCallback(() => {
    try {
      const traitsContent = localStorage.getItem('m2tw_traits_file');
      const traitsName = localStorage.getItem('m2tw_traits_file_name');
      if (traitsContent) {
        const parsed = parseTraitsFile(traitsContent);
        originalTraitsData.current = JSON.stringify(parsed);
        setTraitsData(parsed);
        if (traitsName) setTraitsFilename(traitsName);
      }
      // Try .strings.bin store first (case-insensitive), then fall back to plain txt cache
      const store = getStringsBinStore();
      // Accept any file whose name contains 'vnv' or matches exactly
      const vnvsBinEntry = Object.entries(store).find(([k]) => {
        const lk = k.toLowerCase();
        return lk === 'export_vnvs.txt.strings.bin' || lk.includes('vnv');
      });
      const vnvsBin = vnvsBinEntry?.[1];
      if (vnvsBin) {
        const map = {};
        for (const e of vnvsBin.entries) map[e.key] = e.value;
        originalTextData.current = JSON.stringify(map);
        setTextData(map);
        setTextBinMeta({ magic1: vnvsBin.magic1 ?? 2, magic2: vnvsBin.magic2 ?? 2048 });
        setTextFilename(vnvsBinEntry[0]);
      } else {
        const vnvsContent = localStorage.getItem('m2tw_vnvs_file');
        const vnvsName = localStorage.getItem('m2tw_vnvs_file_name');
        if (vnvsContent) {
          const parsed = parseTextFile(vnvsContent);
          originalTextData.current = JSON.stringify(parsed);
          setTextData(parsed);
          if (vnvsName) setTextFilename(vnvsName);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadFromStorage();
    // Listen for Home page loading traits
    const handler = () => loadFromStorage();
    window.addEventListener('load-traits', handler);
    window.addEventListener('load-vnvs', handler);
    window.addEventListener('strings-bin-updated', handler);
    return () => {
      window.removeEventListener('load-traits', handler);
      window.removeEventListener('load-vnvs', handler);
      window.removeEventListener('strings-bin-updated', handler);
    };
  }, [loadFromStorage]);

  const loadTraitsFile = useCallback((content, filename) => {
    const parsed = parseTraitsFile(content);
    originalTraitsData.current = JSON.stringify(parsed);
    setTraitsData(parsed);
    const fn = filename || 'export_descr_character_traits.txt';
    setTraitsFilename(fn);
    setSelectedTrait(null);
    setIsDirty(false);
    try { localStorage.setItem('m2tw_traits_file', content); localStorage.setItem('m2tw_traits_file_name', fn); } catch {}
  }, []);

  const loadTextFile = useCallback((content, filename, binMeta) => {
    // content may be a pre-parsed map (from .strings.bin) or a raw string
    const parsed = (typeof content === 'object' && content !== null && !(content instanceof ArrayBuffer))
      ? content
      : parseTextFile(content);
    originalTextData.current = JSON.stringify(parsed);
    setTextData(parsed);
    if (binMeta) setTextBinMeta(binMeta);
    const fn = filename || 'export_VnVs.txt';
    setTextFilename(fn);
    if (typeof content === 'string') {
      try { localStorage.setItem('m2tw_vnvs_file', content); localStorage.setItem('m2tw_vnvs_file_name', fn); } catch {}
    }
  }, []);

  // Persist to localStorage whenever traitsData or textData changes (crash protection)
  useEffect(() => {
    if (!traitsData) return;
    try {
      localStorage.setItem('m2tw_traits_file', serializeTraitsFile(traitsData));
    } catch {}
  }, [traitsData]);

  useEffect(() => {
    if (!textData) return;
    try {
      localStorage.setItem('m2tw_vnvs_file', serializeTextFile(textData));
    } catch {}
  }, [textData]);

  const updateTrait = useCallback((index, updated) => {
    setTraitsData(prev => {
      const traits = [...prev.traits];
      traits[index] = updated;
      return { ...prev, traits };
    });
    setIsDirty(true);
  }, []);

  const updateTrigger = useCallback((index, updated) => {
    setTraitsData(prev => {
      const triggers = [...prev.triggers];
      triggers[index] = updated;
      return { ...prev, triggers };
    });
    setIsDirty(true);
  }, []);

  const addTrigger = useCallback((traitName) => {
    const newTrigger = {
      name: `Trigger_${traitName}_New`,
      whenToTest: 'PostBattle',
      conditions: ['Condition IsGeneral true'],
      affects: [{ trait: traitName, value: 1, chance: 10 }],
      rawLines: [],
    };
    setTraitsData(prev => ({ ...prev, triggers: [...(prev.triggers || []), newTrigger] }));
    setIsDirty(true);
  }, []);

  const deleteTrigger = useCallback((index) => {
    setTraitsData(prev => {
      const triggers = prev.triggers.filter((_, i) => i !== index);
      return { ...prev, triggers };
    });
    setIsDirty(true);
  }, []);

  const addTrait = useCallback(() => {
    const baseName = 'NewTrait';
    const newTrait = {
      name: baseName,
      characters: ['family'],
      hidden: false,
      excludeCultures: [],
      noGoingBackLevel: null,
      antiTraits: [],
      levels: [{
        name: `${baseName}_Level1`,
        description: `${baseName}_Level1_desc`,
        effectsDescription: `${baseName}_Level1_effects_desc`,
        gainMessage: '', loseMessage: '',
        epithet: `${baseName}_Level1_epithet_desc`,
        threshold: 1, effects: [],
      }],
    };
    setTraitsData(prev => ({ ...prev, traits: [...(prev?.traits || []), newTrait] }));
    // Pre-populate empty text entries so they show up in the .strings.bin export
    setTextData(prev => ({
      ...prev,
      [`${baseName}_Level1_desc`]: '',
      [`${baseName}_Level1_effects_desc`]: '',
      [`${baseName}_Level1_epithet_desc`]: '',
    }));
    setIsDirty(true);
    return (traitsData?.traits?.length || 0);
  }, [traitsData]);

  const deleteTrait = useCallback((index) => {
    setTraitsData(prev => {
      const traits = prev.traits.filter((_, i) => i !== index);
      return { ...prev, traits };
    });
    setSelectedTrait(null);
    setIsDirty(true);
  }, []);

  const revertTraits = useCallback(() => {
    if (originalTraitsData.current) {
      setTraitsData(JSON.parse(originalTraitsData.current));
    }
    if (originalTextData.current) {
      setTextData(JSON.parse(originalTextData.current));
    }
    setSelectedTrait(null);
    setIsDirty(false);
  }, []);

  const saveTraits = useCallback(() => {
    // Commit current state as new baseline
    if (traitsData) originalTraitsData.current = JSON.stringify(traitsData);
    if (textData) originalTextData.current = JSON.stringify(textData);
    setIsDirty(false);
  }, [traitsData, textData]);

  const updateTextEntry = useCallback((key, value) => {
    setTextData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const exportTraitsFile = useCallback(() => {
    if (!traitsData) return null;
    return serializeTraitsFile(traitsData);
  }, [traitsData]);

  const exportTextFile = useCallback(() => {
    if (!textData) return null;
    // If the loaded file was a .strings.bin, export binary
    if (textFilename.toLowerCase().endsWith('.bin')) {
      const entries = Object.entries(textData).map(([key, value]) => ({ key, value: String(value) }));
      return encodeStringsBin(entries, textBinMeta.magic1, textBinMeta.magic2);
    }
    return serializeTextFile(textData);
  }, [textData, textFilename, textBinMeta]);

  const getText = useCallback((key) => {
    if (!textData || !key) return '';
    return textData[key] || '';
  }, [textData]);

  return (
    <TraitsContext.Provider value={{
      traitsData, textData,
      traitsFilename, textFilename, textBinMeta,
      isDirty, selectedTrait,
      setSelectedTrait,
      loadTraitsFile, loadTextFile,
      updateTrait, addTrait, deleteTrait,
      updateTrigger, addTrigger, deleteTrigger,
      revertTraits, saveTraits,
      updateTextEntry,
      exportTraitsFile, exportTextFile,
      getText,
    }}>
      {children}
    </TraitsContext.Provider>
  );
}

export function useTraits() {
  return useContext(TraitsContext);
}