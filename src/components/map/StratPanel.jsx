import React, { useState } from 'react';
import { Upload, Download, Eye, EyeOff, Trash2, Plus, Map } from 'lucide-react';
import { getItemIcon } from './StratOverlay';
import { serializeDescrStrat } from './stratParser';
import { downloadBlob } from './tgaExporter';

const CATEGORIES = [
  { id: 'resource',      label: 'Resources',     emoji: '💎' },
  { id: 'character',     label: 'Characters',    emoji: '⚔️' },
  { id: 'fortification', label: 'Fortifications',emoji: '🏰' },
];

const CHARACTER_TYPES = ['general','admiral','spy','merchant','diplomat','priest','assassin','princess','heretic','witch','inquisitor','named character'];
const RESOURCE_TYPES = ['coal','fish','amber','furs','gold','silver','iron','timber','wine','wool','grain','silk','dyes','tin','marble','ivory','sugar','spices','tobacco','chocolate','cotton','sulfur','slaves'];

export default function StratPanel({
  stratData, regionsData, settlementNames, factionColors,
  onStratLoad, onRegionsLoad, onNamesLoad, onFactionsLoad,
  overlayItems, selectedItem, onSelectItem,
  visibleCategories, onToggleCategory,
  onDeleteItem, onAddItem,
}) {
  const [addMode, setAddMode] = useState(null);
  const [newType, setNewType] = useState('');
  const [newFaction, setNewFaction] = useState('');

  const loadFile = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (type === 'strat') onStratLoad(text, file.name);
    else if (type === 'regions') onRegionsLoad(text);
    else if (type === 'names') onNamesLoad(text);
    else if (type === 'factions') onFactionsLoad(text);
    e.target.value = '';
  };

  const handleExport = () => {
    if (!stratData?.raw) return;
    const text = serializeDescrStrat(stratData, overlayItems);
    const blob = new Blob([text], { type: 'text/plain' });
    downloadBlob(blob, 'descr_strat.txt');
  };

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto p-2">

      {/* File loaders */}
      <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Load Files</p>
        {[
          { label: 'descr_strat.txt',                     type: 'strat',   loaded: !!stratData },
          { label: 'descr_regions.txt',                   type: 'regions', loaded: !!regionsData },
          { label: '*_regions_and_settlement_names.txt',  type: 'names',   loaded: !!settlementNames },
          { label: 'descr_sm_factions.txt',               type: 'factions',loaded: !!factionColors },
        ].map(({ label, type, loaded }) => (
          <label key={type} className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${loaded ? 'bg-green-400' : 'bg-slate-600'}`} />
            <span className="text-[10px] font-mono flex-1 truncate text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 flex items-center gap-1">
              <Upload className="w-2.5 h-2.5" />{loaded ? 'Replace' : 'Load'}
            </span>
            <input type="file" accept=".txt" className="hidden" onChange={e => loadFile(e, type)} />
          </label>
        ))}
        {stratData && (
          <button onClick={handleExport}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-400 transition-colors font-semibold">
            <Download className="w-3 h-3" /> Export descr_strat.txt
          </button>
        )}
      </div>

      {/* Category visibility */}
      <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Overlay Visibility</p>
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

      {/* Add item */}
      <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Add Item (click map to place)</p>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setAddMode(addMode?.category === cat.id ? null : { category: cat.id })}
              className={`px-2 py-1 rounded text-[10px] border transition-colors ${addMode?.category === cat.id ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'border-slate-600/40 text-slate-400 hover:text-slate-200'}`}>
              {cat.emoji} {cat.label}
            </button>
          ))}
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
            {addMode.category === 'character' && (
              <>
                <select value={newType} onChange={e => setNewType(e.target.value)}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                  <option value="">— pick type —</option>
                  {CHARACTER_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input value={newFaction} onChange={e => setNewFaction(e.target.value)}
                  placeholder="Faction name"
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              </>
            )}
            {addMode.category === 'fortification' && (
              <select value={newType} onChange={e => setNewType(e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="fort">Fort</option>
                <option value="watchtower">Watchtower</option>
              </select>
            )}
            <button
              onClick={() => {
                if (!newType && addMode.category !== 'fortification') return;
                onAddItem({ ...addMode, type: newType || 'fort', charType: newType, faction: newFaction });
                setAddMode(null); setNewType(''); setNewFaction('');
              }}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] bg-amber-600/80 hover:bg-amber-600 text-slate-900 font-semibold transition-colors">
              <Plus className="w-3 h-3" /> Click on map to place
            </button>
          </div>
        )}
      </div>

      {/* Selected item info */}
      {selectedItem && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 p-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Selected</p>
          <div className="flex items-center gap-2">
            <span className="text-lg">{getItemIcon(selectedItem)}</span>
            <div className="flex-1 min-w-0">
              {selectedItem.name && <p className="text-[11px] text-amber-300 font-semibold truncate">{selectedItem.name}</p>}
              <p className="text-[11px] text-slate-200 font-mono truncate">{selectedItem.type || selectedItem.charType}</p>
              <p className="text-[10px] text-slate-500 font-mono">x:{selectedItem.x} y:{selectedItem.y}</p>
            </div>
            <button onClick={() => onDeleteItem(selectedItem.id)}
              className="p-1 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      {overlayItems && overlayItems.length > 0 && (
        <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2 space-y-0.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Items ({overlayItems.length})</p>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {overlayItems.map(item => (
              <button key={item.id} onClick={() => onSelectItem(item)}
                className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors ${selectedItem?.id === item.id ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-slate-800/40 text-slate-400'}`}>
                <span className="text-sm">{getItemIcon(item)}</span>
                <span className="text-[10px] font-mono flex-1 truncate">{item.name || item.type || item.charType}</span>
                <span className="text-[9px] text-slate-600 font-mono">{item.x},{item.y}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}