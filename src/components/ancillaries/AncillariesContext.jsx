import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { parseAncillariesFile, serializeAncillariesFile, parseTextFile, serializeTextFile } from './AncillariesParser';

const AncillariesContext = createContext(null);

export function AncillariesProvider({ children }) {
  const [ancData, setAncData] = useState(null);
  const [textData, setTextData] = useState(null);
  const [ancFilename, setAncFilename] = useState('export_descr_ancillaries.txt');
  const [textFilename, setTextFilename] = useState('export_ancillaries.txt');
  const [isDirty, setIsDirty] = useState(false);
  const [selectedAnc, setSelectedAnc] = useState(null);
  // tgaImages: { [filename_no_ext]: dataUrl }
  const [tgaImages, setTgaImages] = useState({});

  // Snapshots for revert
  const originalAncData = useRef(null);
  const originalTextData = useRef(null);

  const loadAncFile = useCallback((content, filename) => {
    const parsed = parseAncillariesFile(content);
    originalAncData.current = JSON.stringify(parsed);
    setAncData(parsed);
    setAncFilename(filename || 'export_descr_ancillaries.txt');
    setSelectedAnc(null);
    setIsDirty(false);
  }, []);

  const loadTextFile = useCallback((content, filename) => {
    const parsed = parseTextFile(content);
    originalTextData.current = JSON.stringify(parsed);
    setTextData(parsed);
    setTextFilename(filename || 'export_ancillaries.txt');
  }, []);

  const loadTgaImages = useCallback((images) => {
    // images: { [key]: dataUrl }
    setTgaImages(prev => ({ ...prev, ...images }));
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
      name: 'new_ancillary', type: 'Court', transferable: 0,
      image: 'court_noble.tga', unique: false, excludedAncillaries: [],
      excludeCultures: [], description: 'new_ancillary_desc',
      effectsDescription: 'new_ancillary_effects_desc', effects: [],
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

  const revertAncillaries = useCallback(() => {
    if (originalAncData.current) setAncData(JSON.parse(originalAncData.current));
    if (originalTextData.current) setTextData(JSON.parse(originalTextData.current));
    setSelectedAnc(null);
    setIsDirty(false);
  }, []);

  const saveAncillaries = useCallback(() => {
    if (ancData) originalAncData.current = JSON.stringify(ancData);
    if (textData) originalTextData.current = JSON.stringify(textData);
    setIsDirty(false);
  }, [ancData, textData]);

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

  const getTgaImage = useCallback((filename) => {
    if (!filename) return null;
    const key = filename.replace(/\.tga$/i, '').toLowerCase();
    return tgaImages[key] || null;
  }, [tgaImages]);

  return (
    <AncillariesContext.Provider value={{
      ancData, textData, tgaImages,
      ancFilename, textFilename,
      isDirty, selectedAnc,
      setSelectedAnc,
      loadAncFile, loadTextFile, loadTgaImages,
      updateAncillary, addAncillary, deleteAncillary,
      revertAncillaries, saveAncillaries,
      updateTextEntry,
      exportAncFile, exportTextFile,
      getText, getTgaImage,
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