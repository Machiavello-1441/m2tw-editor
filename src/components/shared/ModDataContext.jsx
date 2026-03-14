/**
 * ModDataContext — single source of truth for cross-editor reference data.
 *
 * Must be rendered INSIDE EDBProvider, RefDataProvider, TraitsProvider, and
 * AncillariesProvider. See layout.jsx for usage.
 *
 * Consumers call useModData() to get always-live:
 *   traitNames, traitAttributeNames, ancillaryNames,
 *   factionNames, buildingNames, buildingLevelNames
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useEDB } from '../edb/EDBContext';
import { useRefData } from '../edb/RefDataContext';
import { useTraits } from '../traits/TraitsContext';
import { useAncillaries } from '../ancillaries/AncillariesContext';

const ModDataContext = createContext(null);

export function ModDataProvider({ children }) {
  let edbData = null, factions = [], traitsData = null, ancData = null;

  // Each hook may throw if its provider isn't mounted yet — swallow gracefully
  try { ({ edbData } = useEDB()); } catch {}
  try { ({ factions } = useRefData()); } catch {}
  try { ({ traitsData } = useTraits()); } catch {}
  try { ({ ancData } = useAncillaries()); } catch {}

  const value = useMemo(() => {
    // ── Traits ──────────────────────────────────────────────────────────────
    const traitNames = (traitsData?.traits || []).map(t => t.name);

    const attrSet = new Set();
    for (const t of traitsData?.traits || []) {
      for (const lvl of t.levels || []) {
        for (const fx of lvl.effects || []) {
          if (fx.attribute) attrSet.add(fx.attribute);
        }
      }
    }
    const traitAttributeNames = [...attrSet];

    // ── Ancillaries ──────────────────────────────────────────────────────────
    const ancillaryNames = (ancData?.ancillaries || []).map(a => a.name);

    // ── Factions — live first, then localStorage fallback ────────────────────
    let factionNames = (factions || []);
    if (factionNames.length === 0) {
      try {
        const raw = localStorage.getItem('m2tw_factions_file');
        if (raw) {
          factionNames = [...raw.matchAll(/^faction\s+(\S+)/gim)].map(m => m[1]).filter(Boolean);
        }
      } catch {}
    }

    // ── Buildings (EDB) ──────────────────────────────────────────────────────
    const buildingNames = (edbData?.buildings || []).map(b => b.name);
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
    return {
      traitNames: [], traitAttributeNames: [], ancillaryNames: [],
      factionNames: [], buildingNames: [], buildingLevelNames: [],
    };
  }
  return ctx;
}