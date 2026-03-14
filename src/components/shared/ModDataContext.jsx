/**
 * ModDataContext — single source of truth for cross-editor reference data.
 *
 * Aggregates live data from EDBContext, RefDataContext, TraitsContext, and
 * AncillariesContext so every sub-editor always sees up-to-date values from
 * ALL other editors (not stale localStorage snapshots).
 *
 * Wrap this inside all four provider trees (see layout.jsx).
 * Consumers call useModData() to get:
 *   - traitNames        string[]   — from live TraitsContext
 *   - traitAttributeNames string[] — from live TraitsContext
 *   - ancillaryNames    string[]   — from live AncillariesContext
 *   - factionNames      string[]   — from live RefDataContext
 *   - buildingNames     string[]   — from live EDBContext
 *   - buildingLevelNames string[]  — from live EDBContext
 */
import React, { createContext, useContext, useMemo } from 'react';

// Lazy imports to avoid circular deps — consumers must be inside all 4 providers
let _useEDB, _useRefData, _useTraits, _useAncillaries;

try { _useEDB = require('../edb/EDBContext').useEDB; } catch {}
try { _useRefData = require('./RefDataContext').useRefData; } catch {}

const ModDataContext = createContext(null);

export function ModDataProvider({ children, useEDB, useRefData, useTraits, useAncillaries }) {
  // Accept provider hooks as props so we avoid circular imports
  let edbData = null, factions = [], traitsData = null, ancData = null;

  try { ({ edbData } = useEDB()); } catch {}
  try { ({ factions } = useRefData()); } catch {}
  try { ({ traitsData } = useTraits()); } catch {}
  try { ({ ancData } = useAncillaries()); } catch {}

  const value = useMemo(() => {
    // Trait names from live context
    const traitNames = (traitsData?.traits || []).map(t => t.name);

    // Trait attribute names from live context
    const attrSet = new Set();
    for (const t of traitsData?.traits || []) {
      for (const lvl of t.levels || []) {
        for (const fx of lvl.effects || []) {
          if (fx.attribute) attrSet.add(fx.attribute);
        }
      }
    }
    const traitAttributeNames = [...attrSet];

    // Ancillary names from live context
    const ancillaryNames = (ancData?.ancillaries || []).map(a => a.name);

    // Faction names from live context (fall back to localStorage if not loaded yet)
    let factionNames = (factions || []).filter(f => typeof f === 'string' ? f : f?.name);
    if (factionNames.length === 0) {
      try {
        const raw = localStorage.getItem('m2tw_factions_file');
        if (raw) {
          const matches = [...raw.matchAll(/^faction\s+(\S+)/gim)];
          factionNames = matches.map(m => m[1]).filter(Boolean);
        }
      } catch {}
    }

    // Building & level names from live EDB
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
    // Graceful fallback — return empty arrays so components don't crash
    return { traitNames: [], traitAttributeNames: [], ancillaryNames: [], factionNames: [], buildingNames: [], buildingLevelNames: [] };
  }
  return ctx;
}