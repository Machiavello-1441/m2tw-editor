import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Upload, Download, Eye, EyeOff, Trash2, Plus, ChevronDown, ChevronRight, Edit2, Check, X, FolderDown, MapPin, Anchor } from 'lucide-react';
import { getItemIcon, getItemLabel } from './StratOverlay';
import { serializeDescrStrat, serializeDescrRegions, serializeWinConditions, parseWinConditions, SETTLEMENT_LEVELS, SETTLEMENT_LEVEL_ICONS } from './stratParser';
import { exportTGA, downloadBlob } from './tgaExporter';
import { LAYER_DEFS } from './mapLayerConstants';
import { encodeStringsBin } from '../strings/stringsBinCodec';
import JSZip from 'jszip';
import { extractBuildingLevelsFromEDB, extractHiddenResourcesFromEDB } from './additionalParsers';
import RegionColorDetector from './RegionColorDetector';
import NewRegionForm from './NewRegionForm';
import FactionsCampaignTab from './FactionsCampaignTab';
import CharactersTab from './CharactersTab';

const CATEGORIES = [
  { id: 'settlement',    label: 'Settlements',   emoji: '🏛️' },
  { id: 'resource',      label: 'Resources',     emoji: '💎' },
  { id: 'character',     label: 'Characters',    emoji: '⚔️' },
  { id: 'fortification', label: 'Fortifications',emoji: '🏰' },
];

// CHARACTER_TYPES moved to CharactersTab
const RESOURCE_TYPES  = ['coal','fish','amber','furs','gold','silver','iron','timber','wine','wool','grain','silk','dyes','tin','marble','ivory','sugar','spices','tobacco','chocolate','cotton','sulfur','slaves'];
const FORT_TYPES      = ['me_fort_a','me_fort_b','stone_fort_a','stone_fort_b','stone_fort_c','stone_fort_d'];
const BOOL_FLAGS      = ['marian_reforms_disabled','marian_reforms_activated','rebelling_characters_active','gladiator_uprising_disabled','night_battles_enabled','show_date_as_turns'];
const SEASONS         = ['summer', 'winter'];

// Faction color dot
function FactionDot({ factionColors, factionName }) {
  const fc = factionColors?.[factionName];
  if (!fc?.primaryColor) return null;
  const { r, g, b } = fc.primaryColor;
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: `rgb(${r},${g},${b})` }} />;
}

// ─── Overview / Campaign Settings ─────────────────────────────────────────────
function CampaignInfoEditor({ stratData, allFactions, onStratDataChange }) {
  if (!stratData) return <div className="text-[10px] text-slate-600 text-center py-4">Load descr_strat.txt first</div>;

  const [year, season] = (stratData.startDate || '1080 summer').split(' ');
  const [endYear, endSeason] = (stratData.endDate || '1530 winter').split(' ');

  const set = (key, value) => onStratDataChange({ ...stratData, [key]: value });
  const setFlag = (key, value) => onStratDataChange({ ...stratData, flags: { ...(stratData.flags || {}), [key]: value } });

  const moveFaction = (name, from, to) => {
    const remove = arr => (arr || []).filter(f => f !== name);
    const add = arr => [...(arr || []), name];
    const updates = { playable: remove(stratData.playable), unlockable: remove(stratData.unlockable), nonplayable: remove(stratData.nonplayable) };
    if (to) updates[to] = add(updates[to]);
    onStratDataChange({ ...stratData, ...updates });
  };

  return (
    <div className="space-y-2">
      {/* Campaign name */}
      <div className="space-y-1">
        <p className="text-[9px] text-slate-500 uppercase font-semibold">Campaign Name</p>
        <input value={stratData.campaignName || ''} onChange={e => set('campaignName', e.target.value)}
          className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
      </div>

      {/* Start / End dates */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-0.5">
          <p className="text-[9px] text-slate-500">Start Year</p>
          <input type="number" value={year || 1080} onChange={e => set('startDate', `${e.target.value} ${season || 'summer'}`)}
            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] text-slate-500">Start Season</p>
          <select value={season || 'summer'} onChange={e => set('startDate', `${year || 1080} ${e.target.value}`)}
            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
            {SEASONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] text-slate-500">End Year</p>
          <input type="number" value={endYear || 1530} onChange={e => set('endDate', `${e.target.value} ${endSeason || 'winter'}`)}
            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] text-slate-500">End Season</p>
          <select value={endSeason || 'winter'} onChange={e => set('endDate', `${endYear || 1530} ${e.target.value}`)}
            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
            {SEASONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Timescale + script */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-0.5">
          <p className="text-[9px] text-slate-500">Timescale (yr/turn)</p>
          <input type="number" step="0.5" value={stratData.timescale || 2} onChange={e => set('timescale', e.target.value)}
            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="text-[9px] text-slate-500">Campaign Script file</p>
        <input value={stratData.scriptFile || 'campaign_script.txt'} onChange={e => set('scriptFile', e.target.value)}
          className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
      </div>

      {/* Flags */}
      <div>
        <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Flags</p>
        <div className="space-y-1">
          {BOOL_FLAGS.map(flag => (
            <label key={flag} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={stratData.flags?.[flag] === true}
                onChange={e => setFlag(flag, e.target.checked)}
                className="w-3 h-3 accent-amber-500" />
              <span className="text-[10px] text-slate-400 font-mono">{flag}</span>
            </label>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono w-32">brigand_spawn</span>
            <input type="number" value={stratData.flags?.brigand_spawn_value ?? 20} onChange={e => setFlag('brigand_spawn_value', parseInt(e.target.value))}
              className="flex-1 h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono w-32">pirate_spawn</span>
            <input type="number" value={stratData.flags?.pirate_spawn_value ?? 28} onChange={e => setFlag('pirate_spawn_value', parseInt(e.target.value))}
              className="flex-1 h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
          </div>
        </div>
      </div>

      {/* Faction playability */}
      {allFactions.length > 0 && (
        <div>
          <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Faction Playability</p>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {allFactions.map(name => {
              const inPlayable    = (stratData.playable    || []).includes(name);
              const inUnlockable  = (stratData.unlockable  || []).includes(name);
              const inNonplayable = (stratData.nonplayable || []).includes(name);
              const current = inPlayable ? 'playable' : inUnlockable ? 'unlockable' : inNonplayable ? 'nonplayable' : 'none';
              const colors  = { playable: 'text-green-400', unlockable: 'text-yellow-400', nonplayable: 'text-slate-500', none: 'text-slate-600' };
              return (
                <div key={name} className="flex items-center gap-1.5 px-1">
                  <span className={`text-[10px] font-mono flex-1 truncate ${colors[current]}`}>{name}</span>
                  <select value={current} onChange={e => moveFaction(name, current, e.target.value === 'none' ? null : e.target.value)}
                    className="h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-300">
                    <option value="none">—</option>
                    <option value="playable">playable</option>
                    <option value="unlockable">unlockable</option>
                    <option value="nonplayable">nonplayable</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] pt-1 border-t border-slate-700/40">
        <span className="text-slate-500">Playable</span><span className="text-green-400 font-mono">{(stratData.playable||[]).length}</span>
        <span className="text-slate-500">Unlockable</span><span className="text-yellow-400 font-mono">{(stratData.unlockable||[]).length}</span>
        <span className="text-slate-500">Nonplayable</span><span className="text-slate-500 font-mono">{(stratData.nonplayable||[]).length}</span>
      </div>
    </div>
  );
}

// ─── Settlement editor (inline) ──────────────────────────────────────────────
function SettlementRow({ item, isSelected, factionColors, onSelect, onDelete, onChange, edbData, regionsData, settlementNames, onSettlementNamesChange, onRegionsDataChange, onRecolorRegion, overlayItems, regionsLayer, onRelocatePixel, mapH, rebelFactionList, musicTypeList, mercenaryPoolList, religionList, allFactions }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [selectedTree, setSelectedTree] = useState('');
  const [relocating, setRelocating] = useState(null); // null | 'city' | 'port'

  // Auto-expand when selected from map click
  const prevSelected = useRef(false);
  useEffect(() => {
    if (isSelected && !prevSelected.current) setExpanded(true);
    prevSelected.current = isSelected;
  }, [isSelected]);

  // Find matching region from regionsData — match by region internal name
  const regionInfo = useMemo(() => {
    if (!regionsData?.length || !item.region) return null;
    return regionsData.find(r => r.regionName === item.region);
  }, [regionsData, item.region]);

  const buildingLevels = useMemo(() => extractBuildingLevelsFromEDB(edbData), [edbData]);
  const hiddenResourceMasterList = useMemo(() => extractHiddenResourcesFromEDB(edbData), [edbData]);

  // Compute which resource overlay items sit on this region's territory via pixel lookup
  const regionResources = useMemo(() => {
    if (!regionInfo || !regionsLayer?.data || !overlayItems?.length) return [];
    const { r: regR, g: regG, b: regB } = regionInfo;
    const { data, width, height } = regionsLayer;
    const resources = overlayItems.filter(oi => {
      if (oi.category !== 'resource' || oi.x == null || oi.y == null) return false;
      const px = Math.round(oi.x);
      const py = height - 1 - Math.round(oi.y);
      if (px < 0 || px >= width || py < 0 || py >= height) return false;
      const idx = (py * width + px) * 4;
      return data[idx] === regR && data[idx + 1] === regG && data[idx + 2] === regB;
    });
    return resources;
  }, [regionInfo, regionsLayer, overlayItems]);

  // Hidden resources from descr_regions resources list (editable)
  const regionHiddenResources = useMemo(() => {
    const hiddenSet = new Set(hiddenResourceMasterList);
    return (regionInfo?.resources || []).filter(r => hiddenSet.has(r));
  }, [regionInfo, hiddenResourceMasterList]);

  // Group building levels by tree name for two-step dropdown
  const buildingTrees = useMemo(() => {
    const map = {};
    for (const bl of buildingLevels) {
      const tree = bl.building || '(unknown)';
      if (!map[tree]) map[tree] = [];
      map[tree].push(bl.name);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [buildingLevels]);

  const treeLevels = useMemo(() => {
    if (!selectedTree) return [];
    const entry = buildingTrees.find(([t]) => t === selectedTree);
    return entry ? entry[1] : [];
  }, [buildingTrees, selectedTree]);

  // Build faction list from factionColors (descr_sm_factions.txt)
  const factionList = useMemo(() => {
    if (!factionColors) return [];
    return Object.keys(factionColors).sort();
  }, [factionColors]);

  const open = () => {
    setDraft({
      level: item.level,
      population: item.population,
      yearFounded: item.yearFounded,
      planSet: item.planSet,
      factionCreator: item.factionCreator || regionInfo?.factionCreator || '',
      faction: item.faction,
      buildings: [...(item.buildings || [])],
      region: item.region || '',
      regionDisplayName: settlementNames?.[item.region] || '',
      settlementName: regionInfo?.settlementName || '',
      settlementDisplayName: settlementNames?.[regionInfo?.settlementName] || '',
      regionR: regionInfo?.r ?? 0,
      regionG: regionInfo?.g ?? 0,
      regionB: regionInfo?.b ?? 0,
      hiddenResources: [...regionHiddenResources],
      rebelFaction: regionInfo?.rebelFaction || '',
      musicType: regionInfo?.musicType || '',
      mercenaryPool: regionInfo?.mercenaryPool || '',
      religions: { ...(regionInfo?.religions || {}) },
    });
    setEditing(true);
    setExpanded(true);
  };

  const commit = () => {
    // Save settlement/strat edits
    onChange(item.id, draft);
    // Propagate display name edits back to settlementNames
    if (onSettlementNamesChange) {
      const nameUpdates = {};
      if (draft.region && draft.regionDisplayName) nameUpdates[draft.region] = draft.regionDisplayName;
      if (draft.settlementName && draft.settlementDisplayName) nameUpdates[draft.settlementName] = draft.settlementDisplayName;
      if (Object.keys(nameUpdates).length > 0) onSettlementNamesChange(nameUpdates);
    }
    // Propagate RGB / region data changes back to regionsData
    if (onRegionsDataChange && regionInfo) {
      // If the RGB changed, recolor the TGA layer first
      const oldR = regionInfo.r, oldG = regionInfo.g, oldB = regionInfo.b;
      const newR = draft.regionR, newG = draft.regionG, newB = draft.regionB;
      if ((oldR !== newR || oldG !== newG || oldB !== newB) && onRecolorRegion) {
        onRecolorRegion({ oldR, oldG, oldB }, { newR, newG, newB });
      }
      onRegionsDataChange(regionInfo.regionName, {
        settlementName: draft.settlementName,
        factionCreator: draft.factionCreator,
        r: draft.regionR,
        g: draft.regionG,
        b: draft.regionB,
        resources: draft.hiddenResources || [],
        rebelFaction: draft.rebelFaction,
        musicType: draft.musicType,
        mercenaryPool: draft.mercenaryPool,
        religions: draft.religions,
      });
    }
    setEditing(false);
  };

  const addBuilding = (bldName) => {
    if (!bldName) return;
    // Store as "treeName levelName" so the serializer outputs "type tree level"
    const fullName = selectedTree ? `${selectedTree} ${bldName}` : bldName;
    if (draft.buildings.includes(fullName)) return;
    setDraft(d => ({ ...d, buildings: [...d.buildings, fullName] }));
    setSelectedTree('');
  };

  const removeBuilding = (bldName) => {
    setDraft(d => ({ ...d, buildings: d.buildings.filter(b => b !== bldName) }));
  };

  // Find city (black pixel) and port (white pixel) positions adjacent to this region's color
  const cityPortPos = useMemo(() => {
    if (!regionInfo || !regionsLayer?.data) return { city: null, port: null };
    const { r: rr, g: rg, b: rb } = regionInfo;
    const { data, width, height } = regionsLayer;
    let city = null, port = null;
    for (let py = 0; py < height && (!city || !port); py++) {
      for (let px = 0; px < width && (!city || !port); px++) {
        const idx = (py * width + px) * 4;
        const pr = data[idx], pg = data[idx + 1], pb = data[idx + 2];
        const isBlack = pr < 5 && pg < 5 && pb < 5;
        const isWhite = pr > 250 && pg > 250 && pb > 250;
        if (!isBlack && !isWhite) continue;
        // Check if adjacent to this region's color
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = (ny * width + nx) * 4;
          if (data[ni] === rr && data[ni + 1] === rg && data[ni + 2] === rb) {
            if (isBlack && !city) city = { px, py, stratY: height - 1 - py };
            if (isWhite && !port) port = { px, py, stratY: height - 1 - py };
            break;
          }
        }
      }
    }
    return { city, port };
  }, [regionInfo, regionsLayer]);

  const iconChar = SETTLEMENT_LEVEL_ICONS[item.level] || '🏘️';
  const posText = item.x != null ? `${item.x},${item.y}` : 'pos?';

  return (
    <div className={`rounded border transition-colors ${isSelected ? 'border-amber-500/50 bg-amber-900/10' : 'border-slate-700/40 bg-slate-900/20'}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => onSelect(item)}>
        <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }} className="text-slate-500 hover:text-slate-300">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <span className="text-sm shrink-0">{iconChar}</span>
        <FactionDot factionColors={factionColors} factionName={item.faction} />
        <span className={`text-[11px] font-mono flex-1 truncate ${isSelected ? 'text-amber-300' : 'text-slate-300'}`}>
          {settlementNames?.[item.region] || item.region}
        </span>
        <span className="text-[9px] text-slate-600 font-mono shrink-0">{posText}</span>
        <button onClick={e => { e.stopPropagation(); open(); }} title="Edit" className="p-0.5 text-slate-600 hover:text-slate-300 transition-colors">
          <Edit2 className="w-3 h-3" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(item.id); }} title="Delete" className="p-0.5 text-slate-600 hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/40 px-2 py-2 space-y-1.5">
          {editing ? (
            <>
              {/* Settlement & Region names */}
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Settlement Identity</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <span className="text-[9px] text-slate-500">Region Internal</span>
                    <input value={draft.region} onChange={e => setDraft(d => ({...d, region: e.target.value}))}
                      className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500">Region Display</span>
                    <input value={draft.regionDisplayName} onChange={e => setDraft(d => ({...d, regionDisplayName: e.target.value}))}
                      className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500">Settlement Internal</span>
                    <input value={draft.settlementName} onChange={e => setDraft(d => ({...d, settlementName: e.target.value}))}
                      className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500">Settlement Display</span>
                    <input value={draft.settlementDisplayName} onChange={e => setDraft(d => ({...d, settlementDisplayName: e.target.value}))}
                      className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                  </div>
                </div>
              </div>

              {/* Region RGB */}
              <div>
                <span className="text-[9px] text-slate-500">Region Color (RGB)</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded border border-slate-600/40 shrink-0" style={{ background: `rgb(${draft.regionR},${draft.regionG},${draft.regionB})` }} />
                  <input type="number" min="0" max="255" value={draft.regionR} onChange={e => setDraft(d => ({...d, regionR: parseInt(e.target.value)||0}))}
                    className="h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-red-400 w-14 font-mono text-center" />
                  <input type="number" min="0" max="255" value={draft.regionG} onChange={e => setDraft(d => ({...d, regionG: parseInt(e.target.value)||0}))}
                    className="h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-green-400 w-14 font-mono text-center" />
                  <input type="number" min="0" max="255" value={draft.regionB} onChange={e => setDraft(d => ({...d, regionB: parseInt(e.target.value)||0}))}
                    className="h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-blue-400 w-14 font-mono text-center" />
                </div>
              </div>

              <select value={draft.level} onChange={e => setDraft(d => ({...d, level: e.target.value}))}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                {SETTLEMENT_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <span className="text-[9px] text-slate-500">Population</span>
                  <input type="number" value={draft.population} onChange={e => setDraft(d => ({...d, population: parseInt(e.target.value)||0}))}
                    className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500">Year Founded</span>
                  <input type="number" value={draft.yearFounded} onChange={e => setDraft(d => ({...d, yearFounded: parseInt(e.target.value)||0}))}
                    className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                </div>
              </div>
              <div>
                <span className="text-[9px] text-slate-500">Faction Creator</span>
                {factionList.length > 0 ? (
                  <select value={draft.factionCreator} onChange={e => setDraft(d => ({...d, factionCreator: e.target.value}))}
                    className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                    <option value="">— select faction —</option>
                    {factionList.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : (
                  <input value={draft.factionCreator} onChange={e => setDraft(d => ({...d, factionCreator: e.target.value}))}
                    placeholder="Load descr_sm_factions.txt"
                    className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                )}
              </div>

              {/* Map Resources in this region (read-only, from overlay items) */}
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Map Resources ({regionResources.length})</p>
                {regionResources.length > 0 ? (
                  <div className="flex flex-wrap gap-0.5">
                    {regionResources.map(r => (
                      <span key={r.id} className="px-1.5 py-0.5 bg-slate-800/60 rounded text-[10px] text-emerald-400 font-mono">
                        {r.type} <span className="text-slate-600">({r.x},{r.y})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-slate-600 italic">No resources placed in this region</p>
                )}
              </div>

              {/* Hidden Resources (editable, from EDB) */}
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Hidden Resources (EDB)</p>
                {(draft.hiddenResources?.length > 0) && (
                  <div className="space-y-0.5 mb-1 max-h-20 overflow-y-auto">
                    {draft.hiddenResources.map(hr => (
                      <div key={hr} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/60 rounded text-[10px]">
                        <span className="text-purple-300 font-mono flex-1 truncate">{hr}</span>
                        <button onClick={() => setDraft(d => ({ ...d, hiddenResources: d.hiddenResources.filter(x => x !== hr) }))}
                          className="text-slate-600 hover:text-red-400 shrink-0"><X className="w-2.5 h-2.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <select value="" onChange={e => {
                  const val = e.target.value;
                  if (val && !draft.hiddenResources?.includes(val)) {
                    setDraft(d => ({ ...d, hiddenResources: [...(d.hiddenResources || []), val] }));
                  }
                }}
                  className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                  <option value="">{hiddenResourceMasterList.length ? '— add hidden resource —' : 'Load EDB for list'}</option>
                  {hiddenResourceMasterList
                    .filter(hr => !draft.hiddenResources?.includes(hr))
                    .map(hr => <option key={hr} value={hr}>{hr}</option>)}
                </select>
              </div>

              {/* Buildings editor — two-step dropdown */}
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Buildings</p>
                {draft.buildings.length > 0 && (
                  <div className="space-y-0.5 mb-1 max-h-24 overflow-y-auto">
                    {draft.buildings.map(b => (
                      <div key={b} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/60 rounded text-[10px]">
                        <span className="text-slate-300 font-mono flex-1 truncate">{b}</span>
                        <button onClick={() => removeBuilding(b)} className="text-slate-600 hover:text-red-400 shrink-0"><X className="w-2.5 h-2.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1">
                  <select value={selectedTree} onChange={e => setSelectedTree(e.target.value)}
                    className="h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                    <option value="">{buildingTrees.length ? '— tree —' : 'Load EDB'}</option>
                    {buildingTrees.map(([tree]) => <option key={tree} value={tree}>{tree}</option>)}
                  </select>
                  <select value="" onChange={e => addBuilding(e.target.value)}
                    disabled={!selectedTree}
                    className="h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 disabled:opacity-40">
                    <option value="">— level —</option>
                    {treeLevels.map(lv => <option key={lv} value={lv}>{lv}</option>)}
                  </select>
                </div>
              </div>

              {/* Owning Faction */}
              <div>
                <span className="text-[9px] text-slate-500">Owning Faction (descr_strat)</span>
                <select value={draft.faction || ''} onChange={e => setDraft(d => ({...d, faction: e.target.value}))}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                  <option value="">— select —</option>
                  {(allFactions || factionList).map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Rebel Faction */}
              <div>
                <span className="text-[9px] text-slate-500">Rebel Faction (descr_regions)</span>
                {rebelFactionList?.length > 0 ? (
                  <select value={draft.rebelFaction || ''} onChange={e => setDraft(d => ({...d, rebelFaction: e.target.value}))}
                    className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                    <option value="">— select —</option>
                    {rebelFactionList.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : (
                  <input value={draft.rebelFaction || ''} onChange={e => setDraft(d => ({...d, rebelFaction: e.target.value}))}
                    placeholder="rebel faction…"
                    className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                )}
              </div>

              {/* Music Type */}
              <div>
                <span className="text-[9px] text-slate-500">Music Type</span>
                {musicTypeList?.length > 0 ? (
                  <select value={draft.musicType || ''} onChange={e => setDraft(d => ({...d, musicType: e.target.value}))}
                    className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                    <option value="">— none —</option>
                    {musicTypeList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={draft.musicType || ''} onChange={e => setDraft(d => ({...d, musicType: e.target.value}))}
                    placeholder="music type…"
                    className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                )}
              </div>

              {/* Mercenary Pool */}
              <div>
                <span className="text-[9px] text-slate-500">Mercenary Pool</span>
                {mercenaryPoolList?.length > 0 ? (
                  <select value={draft.mercenaryPool || ''} onChange={e => setDraft(d => ({...d, mercenaryPool: e.target.value}))}
                    className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                    <option value="">— none —</option>
                    {mercenaryPoolList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <input value={draft.mercenaryPool || ''} onChange={e => setDraft(d => ({...d, mercenaryPool: e.target.value}))}
                    placeholder="mercenary pool…"
                    className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
                )}
              </div>

              {/* Religions */}
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">Religions (sum=100)</p>
                {Object.entries(draft.religions || {}).map(([rel, val]) => (
                  <div key={rel} className="flex items-center gap-1 mb-0.5">
                    <span className="text-[10px] font-mono text-slate-300 flex-1 truncate">{rel}</span>
                    <input type="number" min={0} max={100} value={val}
                      onChange={e => setDraft(d => ({ ...d, religions: { ...d.religions, [rel]: parseInt(e.target.value)||0 } }))}
                      className="w-14 h-5 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-center" />
                    <button onClick={() => setDraft(d => { const r = {...d.religions}; delete r[rel]; return {...d, religions: r}; })}
                      className="text-slate-600 hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                  </div>
                ))}
                {(religionList||[]).filter(r => !(r in (draft.religions||{}))).length > 0 && (
                  <select defaultValue="" onChange={e => {
                    if (!e.target.value) return;
                    setDraft(d => ({ ...d, religions: { ...(d.religions||{}), [e.target.value]: 0 } }));
                    e.target.value = '';
                  }} className="w-full h-5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-400">
                    <option value="">+ Add religion…</option>
                    {(religionList||[]).filter(r => !(r in (draft.religions||{}))).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
                {Object.keys(draft.religions||{}).length > 0 && (() => {
                  const total = Object.values(draft.religions||{}).reduce((s,v) => s+(parseInt(v)||0), 0);
                  return <p className={`text-[9px] font-mono mt-0.5 ${total===100?'text-green-400':'text-red-400'}`}>Total: {total}/100</p>;
                })()}
              </div>

              <div className="flex gap-1.5 justify-end pt-0.5">
                <button onClick={() => setEditing(false)} className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-200 border border-slate-700/40">
                  <X className="w-2.5 h-2.5" /> Cancel
                </button>
                <button onClick={commit} className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] bg-green-700/80 hover:bg-green-700 border border-green-600/40 text-green-200 font-semibold">
                  <Check className="w-2.5 h-2.5" /> Save
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                <span className="text-slate-500">Region</span><span className="text-slate-300 font-mono truncate">{item.region}</span>
                {settlementNames?.[item.region] && (
                  <><span className="text-slate-500">Region Name</span><span className="text-slate-300 font-mono truncate">{settlementNames[item.region]}</span></>
                )}
                {regionInfo && (
                  <>
                    <span className="text-slate-500">Settlement</span><span className="text-slate-300 font-mono truncate">{regionInfo.settlementName}</span>
                    {settlementNames?.[regionInfo.settlementName] && (
                      <><span className="text-slate-500">Settl. Name</span><span className="text-slate-300 font-mono truncate">{settlementNames[regionInfo.settlementName]}</span></>
                    )}
                    <span className="text-slate-500">RGB</span>
                    <span className="text-slate-300 font-mono flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm border border-white/20 inline-block" style={{ background: `rgb(${regionInfo.r},${regionInfo.g},${regionInfo.b})` }} />
                      {regionInfo.r}, {regionInfo.g}, {regionInfo.b}
                    </span>
                  </>
                )}
                <span className="text-slate-500">Level</span><span className="text-slate-300 font-mono">{item.level}</span>
                <span className="text-slate-500">Faction</span><span className="text-slate-300 font-mono truncate">{item.faction}</span>
                <span className="text-slate-500">Population</span><span className="text-slate-300 font-mono">{item.population}</span>
                <span className="text-slate-500">Founded</span><span className="text-slate-300 font-mono">{item.yearFounded}</span>
              </div>
              {/* City / Port coordinates box */}
              <div className="rounded border border-slate-700/40 bg-slate-800/30 p-1.5 space-y-1">
                <p className="text-[9px] text-slate-500 uppercase font-semibold">Map Positions (TGA pixels)</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-8">City</span>
                  {cityPortPos.city ? (
                    <span className="text-[10px] text-slate-200 font-mono">x:{cityPortPos.city.px} y:{cityPortPos.city.stratY}</span>
                  ) : (
                    <span className="text-[10px] text-slate-600 italic">not found</span>
                  )}
                  {onRelocatePixel && (
                    <button onClick={(e) => { e.stopPropagation(); onRelocatePixel(item, 'city', regionInfo); }}
                      className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 transition-colors">
                      Relocate
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Anchor className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 w-8">Port</span>
                  {cityPortPos.port ? (
                    <span className="text-[10px] text-slate-200 font-mono">x:{cityPortPos.port.px} y:{cityPortPos.port.stratY}</span>
                  ) : (
                    <span className="text-[10px] text-slate-600 italic">none</span>
                  )}
                  {onRelocatePixel && (
                    <button onClick={(e) => { e.stopPropagation(); onRelocatePixel(item, 'port', regionInfo); }}
                      className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/40 transition-colors">
                      {cityPortPos.port ? 'Relocate' : 'Place'}
                    </button>
                  )}
                </div>
              </div>
              {(regionResources.length > 0 || regionHiddenResources.length > 0 || item.buildings?.length > 0) && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                  {regionResources.length > 0 && (
                    <>
                      <span className="text-emerald-400 col-span-2">Resources ({regionResources.length})</span>
                      <span className="text-emerald-300 font-mono col-span-2 text-[9px] break-all">{regionResources.map(r => r.type).join(', ')}</span>
                    </>
                  )}
                  {regionHiddenResources.length > 0 && (
                    <>
                      <span className="text-purple-400 col-span-2">Hidden Res. ({regionHiddenResources.length})</span>
                      <span className="text-purple-300 font-mono col-span-2 text-[9px] break-all">{regionHiddenResources.join(', ')}</span>
                    </>
                  )}
                  {item.buildings?.length > 0 && (
                    <>
                      <span className="text-slate-500 col-span-2">Buildings ({item.buildings.length})</span>
                      <span className="text-slate-300 font-mono col-span-2 text-[9px] break-all">{item.buildings.join(', ')}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StratPanel({
  stratData, regionsData, settlementNames, factionColors,
  onStratLoad, onRegionsLoad, onNamesLoad, onFactionsLoad,
  onRegionsDataUpdate, onStratDataChange,
  onSettlementNamesChange,
  overlayItems, selectedItem, onSelectItem,
  visibleCategories, onToggleCategory,
  onDeleteItem, onAddItem, onSettlementChange,
  cultureList, edbData, regionsLayer,
  onRecolorRegion, onAddNewRegion,
  layers, dirtyLayers, editedSettlements,
  rebelFactionList, hiddenResourceList, musicTypeList, mercenaryPoolList, religionList, naturalResList,
  onRelocatePixel, mapH,
  onLoadTgaLayer,
  descrNames, namesDisplayMap, traitsList, ancillariesList, eduUnits, onPinCharacter,
}) {
  const [addMode, setAddMode] = useState(null);
  const [newType, setNewType] = useState('');
  const [newFortType, setNewFortType] = useState('me_fort_a');
  const [newFortCulture, setNewFortCulture] = useState('');
  const [newFortComment, setNewFortComment] = useState('');
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [showNewRegion, setShowNewRegion] = useState(false);
  const [winConditions, setWinConditions] = useState(() => {
    try {
      const raw = sessionStorage.getItem('m2tw_win_conditions_raw');
      return raw ? parseWinConditions(raw) : null;
    } catch { return null; }
  });

  // Auto-switch to settlements tab when a settlement is selected
  useEffect(() => {
    if (selectedItem?.category === 'settlement') setTab('settlements');
    if (selectedItem?.category === 'character') setTab('characters');
  }, [selectedItem?.id]);

  const loadFile = async (e, type) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    if (type === 'strat')    onStratLoad(text, file.name);
    else if (type === 'regions')  onRegionsLoad(text);
    else if (type === 'names')    onNamesLoad(text);
    else if (type === 'factions') onFactionsLoad(text);
    e.target.value = '';
  };

  const handleExportStrat = () => {
    if (!stratData?.raw) return;
    const text = serializeDescrStrat(stratData, overlayItems, editedSettlements);
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_strat.txt');
  };

  const handleExportRegions = () => {
    if (!regionsData?.length) return;
    const text = serializeDescrRegions(regionsData, religionList);
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_regions.txt');
  };

  const handleExportNames = () => {
    if (!settlementNames || !Object.keys(settlementNames).length) return;
    const lines = Object.entries(settlementNames).map(([k, v]) => `{${k}}${v}`);
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain' }), 'regions_and_settlement_names.txt');
  };

  const handleExportFactions = () => {
    const raw = sessionStorage.getItem('m2tw_factions_raw');
    if (!raw) return;
    downloadBlob(new Blob([raw], { type: 'text/plain' }), 'descr_sm_factions.txt');
  };

  const handleExportWinConditions = () => {
    if (!winConditions) return;
    const text = serializeWinConditions(winConditions);
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_win_conditions.txt');
  };

  const handleExportTGA = (layerId) => {
    const layer = layers?.[layerId];
    if (!layer?.data) return;
    const def = LAYER_DEFS.find(d => d.id === layerId);
    const blob = exportTGA(layer.data, layer.width, layer.height);
    downloadBlob(blob, def?.filename || `${layerId}.tga`);
  };

  // Determine if any campaign data has been modified/loaded
  const hasAnyModifiedData = !!(stratData?.raw || regionsData?.length || settlementNames || factionColors || LAYER_DEFS.some(d => layers?.[d.id]?.data));

  const handleExportCampaignZip = async () => {
    const zip = new JSZip();
    const campaignName = stratData?.campaignName || 'imperial_campaign';
    const basePath = `data/world/maps/campaign/custom/${campaignName}`;

    // descr_strat.txt
    if (stratData?.raw) {
      const text = serializeDescrStrat(stratData, overlayItems, editedSettlements);
      zip.file(`${basePath}/descr_strat.txt`, text);
    }
    // descr_regions.txt
    if (regionsData?.length) {
      zip.file(`${basePath}/descr_regions.txt`, serializeDescrRegions(regionsData, religionList));
    }
    // campaign script file
    const scriptName = stratData?.scriptFile || 'campaign_script.txt';
    const scriptRaw = sessionStorage.getItem('m2tw_script_raw');
    if (scriptRaw) {
      zip.file(`${basePath}/${scriptName}`, scriptRaw);
    }
    // descr_sm_factions.txt — stored via sessionStorage raw
    const factionsRaw = sessionStorage.getItem('m2tw_factions_raw');
    if (factionsRaw) {
      zip.file(`${basePath}/descr_sm_factions.txt`, factionsRaw);  
    }
    // Other text files from sessionStorage if present
    const extraFiles = [
      { key: 'm2tw_events_raw', name: 'descr_events.txt' },
      { key: 'm2tw_mercenaries_raw', name: 'descr_mercenaries.txt' },
      { key: 'm2tw_music_types_raw', name: 'descr_sounds_music_types.txt' },
      { key: 'm2tw_terrain_raw', name: 'descr_terrain.txt' },
      { key: 'm2tw_win_conditions_raw', name: 'descr_win_conditions.txt' },
    ];
    for (const { key, name } of extraFiles) {
      const raw = sessionStorage.getItem(key);
      if (raw) zip.file(`${basePath}/${name}`, raw);
    }
    // TGA map layers
    const tgaLayerMap = {
      heights: 'map_heights.tga',
      ground: 'map_ground_types.tga',
      climates: 'map_climates.tga',
      regions: 'map_regions.tga',
      features: 'map_features.tga',
      fog: 'map_fog.tga',
    };
    for (const [layerId, filename] of Object.entries(tgaLayerMap)) {
      const layer = layers?.[layerId];
      if (layer?.data) {
        const blob = exportTGA(layer.data, layer.width, layer.height);
        zip.file(`${basePath}/${filename}`, blob);
      }
    }
    // Settlement names as .strings.bin
    if (settlementNames && Object.keys(settlementNames).length > 0) {
      const entries = Object.entries(settlementNames).map(([key, value]) => ({ key, value }));
      const binBuf = encodeStringsBin(entries);
      zip.file(`data/text/${campaignName}_regions_and_settlement_names.txt.strings.bin`, binBuf);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, `${campaignName}_campaign.zip`);
  };

  const settlements = useMemo(() =>
    (overlayItems || []).filter(i => i.category === 'settlement'),
  [overlayItems]);

  const filteredSettlements = useMemo(() =>
    settlements.filter(s => !search || s.region?.toLowerCase().includes(search.toLowerCase()) || s.faction?.toLowerCase().includes(search.toLowerCase())),
  [settlements, search]);

  const byFaction = useMemo(() => {
    const map = {};
    for (const s of filteredSettlements) {
      if (!map[s.faction]) map[s.faction] = [];
      map[s.faction].push(s);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSettlements]);

  const allFactions = useMemo(() => {
    const from = (stratData?.factions || []).map(f => f.name).filter(Boolean);
    const fromLists = [...(stratData?.playable || []), ...(stratData?.unlockable || []), ...(stratData?.nonplayable || [])];
    return [...new Set([...from, ...fromLists])].sort();
  }, [stratData]);

  const regionNames = useMemo(() => (regionsData || []).map(r => r.regionName).filter(Boolean), [regionsData]);

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex border-b border-slate-800 shrink-0 flex-wrap">
        {[['overview','Overview'],['settlements','Settlements'],['factions','Factions'],['characters','Characters']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-[9px] font-semibold border-b-2 transition-colors ${tab === id ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">

        {/* ── Overview tab ── */}
        {tab === 'overview' && <>
          {/* Campaign Files */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Campaign Files</p>
            {/* Text files — load + download inline */}
            {[
              { label: 'descr_strat.txt', type: 'strat', loaded: !!stratData, onDl: handleExportStrat, ready: !!stratData?.raw },
              { label: 'descr_regions.txt', type: 'regions', loaded: !!regionsData, onDl: handleExportRegions, ready: !!regionsData?.length },
              { label: 'settlement_names', type: 'names', loaded: !!settlementNames, onDl: handleExportNames, ready: !!settlementNames && Object.keys(settlementNames).length > 0, accept: '.txt,.bin,.strings.bin' },
              { label: 'descr_sm_factions.txt', type: 'factions', loaded: !!factionColors, onDl: handleExportFactions, ready: !!factionColors },
            ].map(({ label, type, loaded, onDl, ready, accept }) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${loaded ? 'bg-green-400' : 'bg-slate-600'}`} />
                <span className="text-[10px] font-mono flex-1 truncate text-slate-400">{label}</span>
                <label className="cursor-pointer text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100 flex items-center gap-0.5 transition-colors">
                  <Upload className="w-2.5 h-2.5" />{loaded ? 'Replace' : 'Load'}
                  <input type="file" accept={accept || '.txt'} className="hidden" onChange={e => loadFile(e, type)} />
                </label>
                <button onClick={onDl} disabled={!ready}
                  className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 transition-colors ${
                    ready ? 'bg-amber-600/20 hover:bg-amber-600/40 border-amber-500/30 text-amber-400' : 'border-slate-700/30 text-slate-600 cursor-not-allowed opacity-40'
                  }`}>
                  <Download className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}

            {/* TGA layers — load + download + eye + opacity slider */}
            {LAYER_DEFS.map(def => {
              const layerState = layers?.[def.id] || {};
              const loaded = !!layerState.data;
              const dirty = dirtyLayers?.has(def.id);
              const visible = layerState.visible ?? def.defaultVisible ?? true;
              const opacity = layerState.opacity ?? def.defaultOpacity ?? 1;
              return (
                <div key={def.id} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => loaded && onLoadTgaLayer && onLoadTgaLayer(def.id, null, { toggleVisible: true })}
                      className={`shrink-0 ${loaded ? 'text-slate-400 hover:text-slate-200' : 'text-slate-700 cursor-default'}`}
                      title={visible ? 'Hide layer' : 'Show layer'}
                    >
                      {(visible && loaded) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${loaded ? 'bg-green-400' : 'bg-slate-600'}`} />
                    <span className="text-[10px] font-mono flex-1 truncate text-slate-400">
                      {def.filename || `${def.id}.tga`}
                      {dirty && <span className="ml-1 text-[8px] text-amber-400">●</span>}
                    </span>
                    {onLoadTgaLayer && (
                      <label className="cursor-pointer text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100 flex items-center gap-0.5 transition-colors">
                        <Upload className="w-2.5 h-2.5" />{loaded ? 'Replace' : 'Load'}
                        <input type="file" accept=".tga" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) { onLoadTgaLayer(def.id, file); e.target.value = ''; }
                        }} />
                      </label>
                    )}
                    <button onClick={() => handleExportTGA(def.id)} disabled={!loaded}
                      className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 transition-colors ${
                        loaded ? 'bg-blue-600/20 hover:bg-blue-600/40 border-blue-500/30 text-blue-400' : 'border-slate-700/30 text-slate-600 cursor-not-allowed opacity-40'
                      }`}>
                      <Download className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  {loaded && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-[9px] text-slate-600 w-7 shrink-0">{Math.round(opacity * 100)}%</span>
                      <input
                        type="range" min="0" max="1" step="0.01"
                        value={opacity}
                        onChange={e => onLoadTgaLayer && onLoadTgaLayer(def.id, null, { setOpacity: parseFloat(e.target.value) })}
                        className="flex-1 h-1.5 accent-amber-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Download Campaign Folder ZIP */}
            <button
              onClick={handleExportCampaignZip}
              disabled={!hasAnyModifiedData}
              className={`w-full flex items-center justify-center gap-1.5 px-2 py-2 mt-1 rounded text-[11px] font-semibold border transition-colors ${
                hasAnyModifiedData ? 'bg-green-600/20 hover:bg-green-600/40 border-green-500/40 text-green-400' : 'border-slate-700/30 text-slate-600 cursor-not-allowed opacity-40'
              }`}>
              <FolderDown className="w-3.5 h-3.5" /> Download Campaign Folder (.zip)
            </button>
          </div>

          {/* Campaign settings editor */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 space-y-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Campaign Settings</p>
            <CampaignInfoEditor stratData={stratData} allFactions={allFactions} onStratDataChange={onStratDataChange} />
          </div>

          {/* Category visibility */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Map Overlay</p>
            {CATEGORIES.map(cat => {
              const visible = visibleCategories?.has(cat.id) ?? true;
              const count = (overlayItems || []).filter(i => i.category === cat.id).length;
              return (
                <button key={cat.id} onClick={() => onToggleCategory(cat.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800/40 transition-colors">
                  {visible ? <Eye className="w-3.5 h-3.5 text-slate-300" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                  <span className="text-[10px] text-slate-300 flex-1 text-left">{cat.emoji} {cat.label}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Add item (resources + fortifications only; characters moved to Characters tab) */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Add to Map (click to place)</p>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.filter(c => c.id !== 'settlement' && c.id !== 'character').map(cat => (
                <button key={cat.id} onClick={() => setAddMode(addMode?.category === cat.id ? null : { category: cat.id })}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${addMode?.category === cat.id ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'border-slate-600/40 text-slate-400 hover:text-slate-200'}`}>
                  {cat.emoji} {cat.label}
                </button>
              ))}
              <span className="text-[9px] text-slate-600 self-center italic">Characters → Characters tab</span>
            </div>
            {addMode && (
              <div className="space-y-1.5 border-t border-slate-700/40 pt-1.5">
                {addMode.category === 'resource' && (
                  <select value={newType} onChange={e => setNewType(e.target.value)}
                    className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                    <option value="">— pick resource —</option>
                    {RESOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                )}
                {addMode.category === 'fortification' && (
                  <div className="space-y-1">
                    <select value={newType} onChange={e => setNewType(e.target.value)}
                      className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                      <option value="fort">Fort</option>
                      <option value="watchtower">Watchtower</option>
                    </select>
                    {(newType === 'fort' || newType === '') && (
                      <>
                        <select value={newFortType} onChange={e => setNewFortType(e.target.value)}
                          className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                          {FORT_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        {cultureList?.length > 0 ? (
                          <select value={newFortCulture} onChange={e => setNewFortCulture(e.target.value)}
                            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                            <option value="">— culture (optional) —</option>
                            {cultureList.map(c => <option key={c}>{c}</option>)}
                          </select>
                        ) : (
                          <input value={newFortCulture} onChange={e => setNewFortCulture(e.target.value)}
                            placeholder="culture name (optional)"
                            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                        )}
                        <input value={newFortComment} onChange={e => setNewFortComment(e.target.value)}
                          placeholder="comment (optional)"
                          className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                      </>
                    )}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!newType && addMode.category === 'resource') return;
                    onAddItem({
                      ...addMode,
                      type: newType || 'fort',
                      fortType: newFortType,
                      culture: newFortCulture,
                      comment: newFortComment,
                    });
                    setAddMode(null); setNewType(''); setNewFortType('me_fort_a'); setNewFortCulture(''); setNewFortComment('');
                  }}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] bg-amber-600/80 hover:bg-amber-600 text-slate-900 font-semibold transition-colors">
                  <Plus className="w-3 h-3" /> Click on map to place
                </button>
              </div>
            )}
          </div>

          {/* Selected item — with inline editor for forts and resources */}
          {selectedItem && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 p-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Selected</p>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getItemIcon(selectedItem)}</span>
                <div className="flex-1 min-w-0">
                  {selectedItem.name && <p className="text-[11px] text-amber-300 font-semibold truncate">{selectedItem.name}</p>}
                  <p className="text-[11px] text-slate-200 font-mono truncate">{selectedItem.region || selectedItem.type || selectedItem.charType}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{selectedItem.x != null ? `x:${selectedItem.x} y:${selectedItem.y}` : 'pos unknown'}</p>
                </div>
                <button onClick={() => onDeleteItem(selectedItem.id)}
                  className="p-1 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Inline editor for resource */}
              {selectedItem.category === 'resource' && (
                <div className="space-y-1 border-t border-amber-500/20 pt-1.5">
                  <p className="text-[9px] text-slate-500 uppercase font-semibold">Edit Resource</p>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <span className="text-[9px] text-slate-500">Type</span>
                      <select value={selectedItem.type || ''} onChange={e => onAddItem && onSelectItem({ ...selectedItem, type: e.target.value }) || null}
                        className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                        {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500">X / Y</span>
                      <div className="flex gap-0.5">
                        <input type="number" value={selectedItem.x ?? ''} placeholder="X"
                          onChange={e => onSelectItem({ ...selectedItem, x: parseInt(e.target.value) || 0 })}
                          className="flex-1 h-6 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                        <input type="number" value={selectedItem.y ?? ''} placeholder="Y"
                          onChange={e => onSelectItem({ ...selectedItem, y: parseInt(e.target.value) || 0 })}
                          className="flex-1 h-6 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Inline editor for fort/watchtower */}
              {selectedItem.category === 'fortification' && (
                <div className="space-y-1 border-t border-amber-500/20 pt-1.5">
                  <p className="text-[9px] text-slate-500 uppercase font-semibold">Edit {selectedItem.type === 'watchtower' ? 'Watchtower' : 'Fort'}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {selectedItem.type === 'fort' && (
                      <>
                        <div>
                          <span className="text-[9px] text-slate-500">Fort Type</span>
                          <select value={selectedItem.fortType || 'me_fort_a'} onChange={e => onSelectItem({ ...selectedItem, fortType: e.target.value })}
                            className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                            {FORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500">Culture</span>
                          {cultureList?.length > 0 ? (
                            <select value={selectedItem.culture || ''} onChange={e => onSelectItem({ ...selectedItem, culture: e.target.value })}
                              className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                              <option value="">— none —</option>
                              {cultureList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <input value={selectedItem.culture || ''} onChange={e => onSelectItem({ ...selectedItem, culture: e.target.value })}
                              placeholder="culture"
                              className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                          )}
                        </div>
                      </>
                    )}
                    <div className={selectedItem.type === 'fort' ? 'col-span-2' : 'col-span-2'}>
                      <span className="text-[9px] text-slate-500">X / Y</span>
                      <div className="flex gap-0.5">
                        <input type="number" value={selectedItem.x ?? ''} placeholder="X"
                          onChange={e => onSelectItem({ ...selectedItem, x: parseInt(e.target.value) || 0 })}
                          className="flex-1 h-6 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                        <input type="number" value={selectedItem.y ?? ''} placeholder="Y"
                          onChange={e => onSelectItem({ ...selectedItem, y: parseInt(e.target.value) || 0 })}
                          className="flex-1 h-6 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                      </div>
                    </div>
                    {selectedItem.type === 'fort' && (
                      <div className="col-span-2">
                        <span className="text-[9px] text-slate-500">Comment</span>
                        <input value={selectedItem.comment || ''} onChange={e => onSelectItem({ ...selectedItem, comment: e.target.value })}
                          placeholder="optional comment"
                          className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-400 font-mono" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>}

        {/* ── Factions tab ── */}
        {tab === 'factions' && (
          <FactionsCampaignTab
            stratData={stratData}
            factionColors={factionColors}
            onStratDataChange={onStratDataChange}
            winConditions={winConditions}
            onWinConditionsChange={(wc) => {
              setWinConditions(wc);
              try { sessionStorage.setItem('m2tw_win_conditions_raw', serializeWinConditions(wc)); } catch {}
            }}
            regionNames={regionNames}
          />
        )}

        {/* ── Characters tab ── */}
        {tab === 'characters' && (
          <CharactersTab
            stratData={stratData}
            onStratDataChange={onStratDataChange}
            onSelectItem={onSelectItem}
            descrNames={descrNames}
            namesDisplayMap={namesDisplayMap}
            traitsList={traitsList}
            ancillariesList={ancillariesList}
            eduUnits={eduUnits}
            onPinCharacter={onPinCharacter}
          />
        )}

        {/* ── Settlements tab ── */}
        {tab === 'settlements' && <>
          <RegionColorDetector
            regionsLayer={regionsLayer}
            regionsData={regionsData}
            onRegionsDataUpdate={onRegionsDataUpdate}
          />
          <div className="flex gap-1.5">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search region or faction…"
              className="flex-1 h-6 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 placeholder-slate-600" />
            <button onClick={() => setShowNewRegion(v => !v)}
              className={`flex items-center gap-0.5 px-2 h-6 rounded text-[10px] border transition-colors shrink-0 ${showNewRegion ? 'bg-green-600/20 border-green-500/40 text-green-400' : 'border-slate-600/40 text-slate-400 hover:text-slate-200'}`}>
              <Plus className="w-3 h-3" /> Region
            </button>
          </div>
          {showNewRegion && (
            <NewRegionForm
              factionColors={factionColors}
              edbData={edbData}
              rebelFactionList={rebelFactionList}
              hiddenResourceList={hiddenResourceList}
              musicTypeList={musicTypeList}
              mercenaryPoolList={mercenaryPoolList}
              religionList={religionList}
              naturalResList={naturalResList}
              onCancel={() => setShowNewRegion(false)}
              onAdd={(draft) => {
                if (onAddNewRegion) onAddNewRegion(draft);
                setShowNewRegion(false);
              }}
            />
          )}
          {settlements.length === 0
            ? <div className="text-[10px] text-slate-600 text-center py-4">Load descr_strat.txt to see settlements</div>
            : byFaction.map(([factionName, setts]) => (
              <div key={factionName}>
                <div className="flex items-center gap-1.5 px-1 py-0.5 mb-0.5">
                  <FactionDot factionColors={factionColors} factionName={factionName} />
                  <span className="text-[10px] font-semibold text-slate-400">{settlementNames?.[factionName] || factionName}</span>
                  <span className="text-[9px] text-slate-600 font-mono">({setts.length})</span>
                </div>
                <div className="space-y-0.5 ml-2">
                  {setts.map(s => (
                    <SettlementRow
                      key={s.id}
                      item={s}
                      isSelected={selectedItem?.id === s.id}
                      factionColors={factionColors}
                      onSelect={item => onSelectItem(item)}
                      onDelete={onDeleteItem}
                      onChange={onSettlementChange}
                      edbData={edbData}
                      regionsData={regionsData}
                      settlementNames={settlementNames}
                      onSettlementNamesChange={onSettlementNamesChange}
                      onRegionsDataChange={(regionName, edits) => {
                        if (onRegionsDataUpdate) {
                          onRegionsDataUpdate(prev => prev ? prev.map(r => r.regionName === regionName ? { ...r, ...edits } : r) : prev);
                        }
                      }}
                      onRecolorRegion={onRecolorRegion}
                      overlayItems={overlayItems}
                      regionsLayer={regionsLayer}
                      onRelocatePixel={onRelocatePixel}
                      mapH={mapH}
                      rebelFactionList={rebelFactionList}
                      musicTypeList={musicTypeList}
                      mercenaryPoolList={mercenaryPoolList}
                      religionList={religionList}
                      allFactions={allFactions}
                    />
                  ))}
                </div>
              </div>
            ))
          }
        </>}


      </div>
    </div>
  );
}