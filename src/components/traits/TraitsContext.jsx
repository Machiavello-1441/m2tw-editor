import React, { createContext, useContext, useState, useCallback } from 'react';
import { parseTraitsFile, serializeTraitsFile, parseTextFile, serializeTextFile } from './TraitsParser';

const TraitsContext = createContext(null);

export function TraitsProvider({ children }) {
  const [traitsData, setTraitsData] = useState(null); // { traits, triggers }
  const [textData, setTextData] = useState(null);     // { [key]: value }
  const [traitsFilename, setTraitsFilename] = useState('export_descr_character_traits.txt');
  const [textFilename, setTextFilename] = useState('export_VnVs.txt');
  const [isDirty, setIsDirty] = useState(false);
  const [selectedTrait, setSelectedTrait] = useState(null);

  const loadTraitsFile = useCallback((content, filename) => {
    const parsed = parseTraitsFile(content);
    setTraitsData(parsed);
    setTraitsFilename(filename || 'export_descr_character_traits.txt');
    setSelectedTrait(null);
    setIsDirty(false);
  }, []);

  const loadTextFile = useCallback((content, filename) => {
    const parsed = parseTextFile(content);
    setTextData(parsed);
    setTextFilename(filename || 'export_VnVs.txt');
  }, []);

  const updateTrait = useCallback((index, updated) => {
    setTraitsData(prev => {
      const traits = [...prev.traits];
      traits[index] = updated;
      return { ...prev, traits };
    });
    setIsDirty(true);
  }, []);

  const addTrait = useCallback(() => {
    const newTrait = {
      name: 'NewTrait',
      characters: ['family'],
      hidden: false,
      excludeCultures: [],
      noGoingBackLevel: null,
      antiTraits: [],
      levels: [
        {
          name: 'NewTrait_Level1',
          description: 'NewTrait_Level1_desc',
          effectsDescription: 'NewTrait_Level1_effects_desc',
          gainMessage: '',
          loseMessage: '',
          epithet: '',
          threshold: 1,
          effects: [],
        }
      ],
    };
    setTraitsData(prev => ({ ...prev, traits: [...(prev?.traits || []), newTrait] }));
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
    return serializeTextFile(textData);
  }, [textData]);

  const getText = useCallback((key) => {
    if (!textData || !key) return '';
    return textData[key] || '';
  }, [textData]);

  return (
    <TraitsContext.Provider value={{
      traitsData, textData,
      traitsFilename, textFilename,
      isDirty, selectedTrait,
      setSelectedTrait,
      loadTraitsFile, loadTextFile,
      updateTrait, addTrait, deleteTrait,
      updateTextEntry,
      exportTraitsFile, exportTextFile,
      getText,
    }}>
      {children}
    </TraitsContext.Provider>
  );
}

export function useTraits() {
  const ctx = useContext(TraitsContext);
  if (!ctx) throw new Error('useTraits must be used within TraitsProvider');
  return ctx;
}