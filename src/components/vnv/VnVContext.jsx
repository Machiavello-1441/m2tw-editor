import React, { createContext, useContext, useState, useCallback } from 'react';
import { parseTraitFile, parseAncillaryFile, serializeTraitFile, serializeAncillaryFile } from './VnVParser';

const VnVContext = createContext(null);

export function VnVProvider({ children }) {
  const [traitData, setTraitData] = useState(null);
  const [ancData, setAncData] = useState(null);
  const [traitFileName, setTraitFileName] = useState(null);
  const [ancFileName, setAncFileName] = useState(null);
  const [dirty, setDirty] = useState(false);

  const loadTraitFile = useCallback((text, filename) => {
    const parsed = parseTraitFile(text);
    setTraitData(parsed);
    setTraitFileName(filename || 'export_descr_character_traits.txt');
    setDirty(false);
  }, []);

  const loadAncFile = useCallback((text, filename) => {
    const parsed = parseAncillaryFile(text);
    setAncData(parsed);
    setAncFileName(filename || 'export_descr_ancillaries.txt');
    setDirty(false);
  }, []);

  const exportTraitFile = useCallback(() => {
    if (!traitData) return null;
    return serializeTraitFile(traitData);
  }, [traitData]);

  const exportAncFile = useCallback(() => {
    if (!ancData) return null;
    return serializeAncillaryFile(ancData);
  }, [ancData]);

  // ─── Trait CRUD ──────────────────────────────────────────────────────────

  const updateTrait = useCallback((traitName, changes) => {
    setTraitData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        traits: prev.traits.map(t => t.name === traitName ? { ...t, ...changes } : t)
      };
    });
    setDirty(true);
  }, []);

  const addTrait = useCallback(() => {
    const newTrait = {
      name: 'NewTrait',
      characters: ['family'],
      hidden: false,
      excludeCultures: [],
      noGoingBackLevel: null,
      antiTraits: [],
      levels: [{
        name: 'NewTrait_Level1',
        description: 'NewTrait_Level1_desc',
        effectsDescription: 'NewTrait_Level1_effects_desc',
        gainMessage: '',
        loseMessage: '',
        epithet: '',
        threshold: 1,
        effects: [{ stat: 'Command', value: 1 }],
      }]
    };
    setTraitData(prev => prev ? { ...prev, traits: [...prev.traits, newTrait] } : { traits: [newTrait], triggers: [] });
    setDirty(true);
    return newTrait.name;
  }, []);

  const deleteTrait = useCallback((traitName) => {
    setTraitData(prev => {
      if (!prev) return prev;
      return { ...prev, traits: prev.traits.filter(t => t.name !== traitName) };
    });
    setDirty(true);
  }, []);

  // ─── Ancillary CRUD ───────────────────────────────────────────────────────

  const updateAncillary = useCallback((ancName, changes) => {
    setAncData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        ancillaries: prev.ancillaries.map(a => a.name === ancName ? { ...a, ...changes } : a)
      };
    });
    setDirty(true);
  }, []);

  const addAncillary = useCallback(() => {
    const newAnc = {
      name: 'new_ancillary',
      type: 'Academic',
      transferable: 0,
      image: 'academic_scholar.tga',
      unique: false,
      excludedAncillaries: [],
      excludeCultures: [],
      description: 'new_ancillary_desc',
      effectsDescription: 'new_ancillary_effects_desc',
      effects: [{ stat: 'Command', value: 1 }],
    };
    setAncData(prev => prev ? { ...prev, ancillaries: [...prev.ancillaries, newAnc] } : { ancillaries: [newAnc], triggers: [] });
    setDirty(true);
    return newAnc.name;
  }, []);

  const deleteAncillary = useCallback((ancName) => {
    setAncData(prev => {
      if (!prev) return prev;
      return { ...prev, ancillaries: prev.ancillaries.filter(a => a.name !== ancName) };
    });
    setDirty(true);
  }, []);

  return (
    <VnVContext.Provider value={{
      traitData, ancData, traitFileName, ancFileName, dirty,
      loadTraitFile, loadAncFile,
      exportTraitFile, exportAncFile,
      updateTrait, addTrait, deleteTrait,
      updateAncillary, addAncillary, deleteAncillary,
    }}>
      {children}
    </VnVContext.Provider>
  );
}

export function useVnV() {
  const ctx = useContext(VnVContext);
  if (!ctx) throw new Error('useVnV must be used within VnVProvider');
  return ctx;
}