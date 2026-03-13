import React, { createContext, useContext, useState, useCallback } from 'react';
import { parseAncillariesFile, serializeAncillariesFile, parseTextFile, serializeTextFile } from './AncillariesParser';

const AncillariesContext = createContext(null);

export function AncillariesProvider({ children }) {
  const [ancData, setAncData] = useState(null);       // { ancillaries, triggers }
  const [textData, setTextData] = useState(null);     // { [key]: value }
  const [ancFilename, setAncFilename] = useState('export_descr_ancillaries.txt');
  const [textFilename, setTextFilename] = useState('export_ancillaries.txt');
  const [isDirty, setIsDirty] = useState(false);
  const [selectedAnc, setSelectedAnc] = useState(null);

  const loadAncFile = useCallback((content, filename) => {
    const parsed = parseAncillariesFile(content);
    setAncData(parsed);
    setAncFilename(filename || 'export_descr_ancillaries.txt');
    setSelectedAnc(null);
    setIsDirty(false);
  }, []);

  const loadTextFile = useCallback((content, filename) => {
    const parsed = parseTextFile(content);
    setTextData(parsed);
    setTextFilename(filename || 'export_ancillaries.txt');
  }, []);

  const updateAncillary = useCallback((index, updated) => {
    setAncData(prev => {
      const ancillaries = [...prev.ancillaries];
      ancillaries[index] = updated;
      return { ...prev, ancillaries };
    });
    setIsDirty(true);
  }, []);

  const addAncillary = useCallback(() => {
    const newAnc = {
      name: 'new_ancillary',
      type: 'Court',
      transferable: 0,
      image: 'court_noble.tga',
      unique: false,
      excludedAncillaries: [],
      excludeCultures: [],
      description: 'new_ancillary_desc',
      effectsDescription: 'new_ancillary_effects_desc',
      effects: [],
    };
    setAncData(prev => ({ ...prev, ancillaries: [...(prev?.ancillaries || []), newAnc] }));
    setIsDirty(true);
  }, []);

  const deleteAncillary = useCallback((index) => {
    setAncData(prev => {
      const ancillaries = prev.ancillaries.filter((_, i) => i !== index);
      return { ...prev, ancillaries };
    });
    setSelectedAnc(null);
    setIsDirty(true);
  }, []);

  const updateTextEntry = useCallback((key, value) => {
    setTextData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const exportAncFile = useCallback(() => {
    if (!ancData) return null;
    return serializeAncillariesFile(ancData);
  }, [ancData]);

  const exportTextFile = useCallback(() => {
    if (!textData) return null;
    return serializeTextFile(textData);
  }, [textData]);

  const getText = useCallback((key) => {
    if (!textData || !key) return '';
    return textData[key] || '';
  }, [textData]);

  return (
    <AncillariesContext.Provider value={{
      ancData, textData,
      ancFilename, textFilename,
      isDirty, selectedAnc,
      setSelectedAnc,
      loadAncFile, loadTextFile,
      updateAncillary, addAncillary, deleteAncillary,
      updateTextEntry,
      exportAncFile, exportTextFile,
      getText,
    }}>
      {children}
    </AncillariesContext.Provider>
  );
}

export function useAncillaries() {
  const ctx = useContext(AncillariesContext);
  if (!ctx) throw new Error('useAncillaries must be used within AncillariesProvider');
  return ctx;
}