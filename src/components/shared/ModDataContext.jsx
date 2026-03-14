/**
 * ModDataContext — single live source of truth for cross-editor reference data.
 *
 * Sits INSIDE all four providers (EDB, RefData, Traits, Ancillaries).
 * Every sub-editor calls useModData() to get always-up-to-date lists of
 * trait names, ancillary names, faction names, building names, etc. —
 * so changes made in one editor are immediately visible in all others.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useEDB } from '../edb/EDBContext';
import { useRefData } from '../edb/RefDataContext';
import { useTraits } from '../traits/TraitsContext';
import { useAncillaries } from '../ancillaries/AncillariesContext';

const ModDataContext = createContext(null);

export function ModDataProvider({ children }) {
  const { edbData } = useEDB();
  const { factions } = useRefData();
  const { traitsData } = useTraits();
  const { ancData } = useAncillaries();

  const value = useMemo(() => {
    // Trait names from live TraitsContext
    const traitNames = (traitsData?.traits || []).map(t => t.name);

    // Trait attribute names from live TraitsContext
    const attrSet = new Set();
    for (const t of traitsData?.traits || []) {
      for (const lvl of t.levels || []) {
        for (const fx of lvl.effects || []) {
          if (fx.attribute) attrSet.add(fx.attribute);
        }
      }
    }
    const traitAttributeNames = [...attrSet];

    // Ancillary names from live AncillariesContext
    const ancillaryNames = (ancData?.ancillaries || []).map(a => a.name);

    // Faction names from live RefDataContext (factions is string[] or object[])
    let factionNames = (factions || []).map(f => (typeof f === 'string' ? f : f?.name)).filter(Boolean);
    // Fall back to localStorage if factions file hasn't been loaded this session
    if (factionNames.length === 0) {
      try {
        const raw = localStorage.getItem('m2tw_factions_file');
        if (raw) {
          factionNames = [...raw.matchAll(/^faction\s+(\S+)/gim)].map(m => m[1]).filter(Boolean);
        }
      } catch {}
    }

    // Building tree names from live EDBContext
    const buildingNames = (edbData?.buildings || []).map(b => b.name);

    // Building level names from live EDBContext
    const buildingLevelNames = [];
    for (const b of edbData?.buildings || []) {
      for (const lvl of b.levels || []) {
        if (lvl.name) buildingLevelNames.push(lvl.name);
      }
    }

    return { traitNames, traitAttributeNames, ancillaryNames, factionNames, buildingNames, buildingLevelNames };
  }, [edbData, factions, traitsData, ancData]);

  return <ModDataContext.Provider value={value}>{children}</ModDataContext.Provider>;
}

export function useModData() {
  const ctx = useContext(ModDataContext);
  if (!ctx) {
    // Graceful fallback — components won't crash if used outside provider
    return {
      traitNames: [], traitAttributeNames: [], ancillaryNames: [],
      factionNames: [], buildingNames: [], buildingLevelNames: [],
    };
  }
  return ctx;
}