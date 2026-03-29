import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Download, Plus, X, Search, AlertCircle, Users } from 'lucide-react';
import { encodeStringsBin, parseStringsBin } from '../strings/stringsBinCodec';
import { getStringsBinStore } from '@/lib/stringsBinStore';

// ─── descr_names.txt parser ───────────────────────────────────────────────────
// Format:
//   faction <name>
//     characters
//       name1
//       ...
//     surnames
//       name1
//       ...
//     females
//       name1
//       ...
function parseDescrNames(text) {
  const factions = {};
  let currentFaction = null;
  let currentSection = null; // 'characters' | 'surnames' | 'females'

  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;

    const factionMatch = line.match(/^faction\s+(\S+)/i);
    if (factionMatch) {
      currentFaction = factionMatch[1];
      factions[currentFaction] = { characters: [], surnames: [], females: [] };
      currentSection = null;
      continue;
    }
    if (!currentFaction) continue;

    if (/^characters$/i.test(line)) { currentSection = 'characters'; continue; }
    if (/^surnames$/i.test(line)) { currentSection = 'surnames'; continue; }
    if (/^females$/i.test(line)) { currentSection = 'females'; continue; }

    if (currentSection && factions[currentFaction]) {
      factions[currentFaction][currentSection].push(line);
    }
  }
  return factions;
}

// ─── descr_names.txt serializer ───────────────────────────────────────────────
function serializeDescrNames(factions) {
  return Object.entries(factions).map(([name, data]) => {
    const lines = [`faction\t\t\t\t${name}`];
    lines.push('\tcharacters');
    for (const n of data.characters) lines.push(`\t\t${n}`);
    lines.push('\tsurnames');
    for (const n of data.surnames) lines.push(`\t\t${n}`);
    lines.push('\tfemales');
    for (const n of data.females) lines.push(`\t\t${n}`);
    return lines.join('\n');
  }).join('\n\n');
}


function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const SECTIONS = [
  { key: 'characters', label: 'Male First Names' },
  { key: 'surnames', label: 'Surnames & Bynames' },
  { key: 'females', label: 'Female First Names' },
];

// ─── Inline editable name row ─────────────────────────────────────────────────
function NameRow({ internalName, displayName, onDisplayChange, onRemoveInternal, onInternalChange, isNew }) {
  const [editInternal, setEditInternal] = useState(internalName);

  return (
    <div className="flex items-center gap-1.5 py-0.5 group">
      <input
        value={editInternal}
        onChange={e => setEditInternal(e.target.value)}
        onBlur={() => { if (editInternal !== internalName) onInternalChange(editInternal); }}
        placeholder="internal_name"
        className="w-36 h-6 px-2 text-[11px] bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono placeholder-slate-600 focus:border-slate-500 focus:outline-none"
      />
      <span className="text-slate-600 text-[11px] shrink-0">→</span>
      <input
        value={displayName}
        onChange={e => onDisplayChange(e.target.value)}
        placeholder="Display Name"
        className="flex-1 h-6 px-2 text-[11px] bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-600 focus:border-slate-500 focus:outline-none"
      />
      <button onClick={onRemoveInternal}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-all">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CharacterNamesTab() {
  // descr_names.txt data: { [factionName]: { characters: [], surnames: [], females: [] } }
  const [descrNames, setDescrNames] = useState({});
  // names.txt.bin data: { [internalKey]: displayValue }
  const [displayNames, setDisplayNames] = useState({});
  const [binMeta, setBinMeta] = useState(null);

  const [selectedFaction, setSelectedFaction] = useState('');
  const [activeSection, setActiveSection] = useState('characters');
  const [search, setSearch] = useState('');

  const descrRef = useRef(null);
  const binRef = useRef(null);

  const applyDescrNames = (raw) => {
    const parsed = parseDescrNames(raw);
    setDescrNames(parsed);
    const factions = Object.keys(parsed);
    if (factions.length) setSelectedFaction(f => f || factions[0]);
  };

  const applyNamesBin = (buf) => {
    const decoded = parseStringsBin(buf);
    if (decoded?.entries) {
      const map = {};
      for (const { key, value } of decoded.entries) if (key) map[key] = value;
      setDisplayNames(map);
      setBinMeta({ magic1: decoded.magic1 ?? 2, magic2: decoded.magic2 ?? 2048 });
      try {
        localStorage.setItem('m2tw_names_bin_entries', JSON.stringify(map));
        localStorage.setItem('m2tw_names_bin_meta', JSON.stringify({ magic1: decoded.magic1 ?? 2, magic2: decoded.magic2 ?? 2048 }));
      } catch {}
    }
  };

  const applyNamesBinEntries = (entries, meta) => {
    const map = {};
    for (const { key, value } of entries) if (key) map[key] = value;
    setDisplayNames(map);
    if (meta) setBinMeta(meta);
    try {
      localStorage.setItem('m2tw_names_bin_entries', JSON.stringify(map));
      localStorage.setItem('m2tw_names_bin_meta', JSON.stringify(meta));
    } catch {}
  };

  // Auto-restore from localStorage / stringsBinStore on mount
  useEffect(() => {
    // descr_names.txt — Home stores it as 'm2tw_names_file'
    try {
      const raw = localStorage.getItem('m2tw_names_file');
      if (raw) applyDescrNames(raw);
    } catch {}

    // names.txt.strings.bin — loaded by Home into the shared stringsBinStore
    try {
      const store = getStringsBinStore();
      const entry = Object.entries(store).find(([k]) => k.toLowerCase().includes('names'));
      if (entry?.[1]) {
        applyNamesBinEntries(entry[1].entries, { magic1: entry[1].magic1 ?? 2, magic2: entry[1].magic2 ?? 2048 });
      }
    } catch {}

    // Fallback: cached bin entries from a direct manual load
    try {
      const raw = localStorage.getItem('m2tw_names_bin_entries');
      if (raw) {
        setDisplayNames(JSON.parse(raw));
        const meta = localStorage.getItem('m2tw_names_bin_meta');
        if (meta) setBinMeta(JSON.parse(meta));
      }
    } catch {}

    // Listen for Home re-loading the data folder
    const onNamesLoaded = (e) => {
      if (e.detail?.raw) applyDescrNames(e.detail.raw);
    };
    const onStringsBinUpdated = () => {
      try {
        const store = getStringsBinStore();
        const entry = Object.entries(store).find(([k]) => k.toLowerCase().includes('names'));
        if (entry?.[1]) {
          applyNamesBinEntries(entry[1].entries, { magic1: entry[1].magic1 ?? 2, magic2: entry[1].magic2 ?? 2048 });
        }
      } catch {}
    };
    window.addEventListener('load-character-names', onNamesLoaded);
    window.addEventListener('strings-bin-updated', onStringsBinUpdated);
    return () => {
      window.removeEventListener('load-character-names', onNamesLoaded);
      window.removeEventListener('strings-bin-updated', onStringsBinUpdated);
    };
  }, []);

  const factionList = useMemo(() => Object.keys(descrNames), [descrNames]);

  // Current faction's data for the active section
  const currentNames = useMemo(() => {
    if (!selectedFaction || !descrNames[selectedFaction]) return [];
    return descrNames[selectedFaction][activeSection] || [];
  }, [descrNames, selectedFaction, activeSection]);

  const filteredNames = useMemo(() => {
    if (!search) return currentNames;
    const s = search.toLowerCase();
    return currentNames.filter(n =>
      n.toLowerCase().includes(s) || (displayNames[n] || '').toLowerCase().includes(s)
    );
  }, [currentNames, search, displayNames]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleLoadDescr = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    applyDescrNames(text);
    try { localStorage.setItem('m2tw_names_file', text); } catch {}
    e.target.value = '';
  };

  const handleLoadBin = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const buf = await file.arrayBuffer();
    applyNamesBin(buf);
    e.target.value = '';
  };

  const handleExportDescr = () => {
    const text = serializeDescrNames(descrNames);
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_names.txt');
  };

  const handleExportBin = () => {
    const entries = Object.entries(displayNames).map(([key, value]) => ({ key, value }));
    const buf = encodeStringsBin(entries, binMeta?.magic1, binMeta?.magic2);
    downloadBlob(new Blob([new Uint8Array(buf)]), 'names.txt.bin');
  };

  const updateSection = (newList) => {
    setDescrNames(prev => ({
      ...prev,
      [selectedFaction]: { ...prev[selectedFaction], [activeSection]: newList }
    }));
  };

  const addName = () => {
    const newKey = `new_name_${Date.now()}`;
    updateSection([...currentNames, newKey]);
    setDisplayNames(prev => ({ ...prev, [newKey]: '' }));
  };

  const removeNameAt = (internalName) => {
    updateSection(currentNames.filter(n => n !== internalName));
  };

  const renameInternal = (oldKey, newKey) => {
    if (!newKey || newKey === oldKey) return;
    // Update the section list
    updateSection(currentNames.map(n => n === oldKey ? newKey : n));
    // Migrate display name
    setDisplayNames(prev => {
      const next = { ...prev, [newKey]: prev[oldKey] ?? '' };
      delete next[oldKey];
      return next;
    });
  };

  const setDisplay = (internalName, value) => {
    setDisplayNames(prev => {
      const next = { ...prev, [internalName]: value };
      try { localStorage.setItem('m2tw_names_bin_entries', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const addFaction = () => {
    const name = `new_faction_${Date.now()}`;
    setDescrNames(prev => ({ ...prev, [name]: { characters: [], surnames: [], females: [] } }));
    setSelectedFaction(name);
  };

  const noneLoaded = factionList.length === 0;

  return (
    <div className="space-y-3">
      {/* Hidden inputs */}
      <input ref={descrRef} type="file" accept=".txt" className="hidden" onChange={handleLoadDescr} />
      <input ref={binRef} type="file" accept=".bin" className="hidden" onChange={handleLoadBin} />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => descrRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <Upload className="w-3 h-3" /> Load descr_names.txt
        </button>
        <button onClick={() => binRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <Upload className="w-3 h-3" /> Load names.txt.bin
        </button>
        <button onClick={handleExportDescr} disabled={noneLoaded}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 disabled:opacity-40 transition-colors">
          <Download className="w-3 h-3" /> Export descr_names.txt
        </button>
        <button onClick={handleExportBin} disabled={!Object.keys(displayNames).length}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 disabled:opacity-40 transition-colors">
          <Download className="w-3 h-3" /> Export names.txt.bin
        </button>
      </div>

      {noneLoaded ? (
        <p className="text-[10px] text-slate-600 text-center py-6">
          Load <span className="font-mono text-slate-500">descr_names.txt</span> and/or <span className="font-mono text-slate-500">names.txt.bin</span> to start editing.
        </p>
      ) : (
        <div className="flex gap-3">
          {/* Faction sidebar */}
          <div className="w-40 shrink-0 space-y-1">
            <p className="text-[9px] text-slate-500 uppercase font-semibold tracking-wider mb-1.5">Factions</p>
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {factionList.map(f => (
                <button key={f} onClick={() => setSelectedFaction(f)}
                  className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono transition-colors truncate ${
                    selectedFaction === f
                      ? 'bg-primary/20 text-primary'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={addFaction}
              className="w-full flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-dashed border-slate-600/40 text-slate-500 hover:text-slate-300 hover:border-slate-400 transition-colors mt-2">
              <Plus className="w-3 h-3" /> Add Faction
            </button>
          </div>

          {/* Right panel */}
          {selectedFaction && (
            <div className="flex-1 min-w-0 space-y-2">
              {/* Section tabs */}
              <div className="flex gap-1 border-b border-slate-800 pb-2">
                {SECTIONS.map(s => (
                  <button key={s.key} onClick={() => setActiveSection(s.key)}
                    className={`px-3 py-1 rounded-t text-[11px] font-semibold transition-colors ${
                      activeSection === s.key
                        ? 'bg-slate-700 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    {s.label}
                    <span className="ml-1 text-[9px] text-slate-500">
                      ({descrNames[selectedFaction]?.[s.key]?.length ?? 0})
                    </span>
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[9px] text-slate-600">
                <span className="font-mono w-36">internal_name</span>
                <span>→</span>
                <span>Display Name (names.txt.bin)</span>
              </div>

              {/* Search */}
              {currentNames.length > 8 && (
                <div className="flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-slate-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                    className="flex-1 h-6 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 placeholder-slate-600 focus:outline-none" />
                  <span className="text-[9px] text-slate-600">{filteredNames.length}/{currentNames.length}</span>
                </div>
              )}

              {/* Names list */}
              <div className="space-y-0.5">
                {filteredNames.map(name => (
                  <NameRow
                    key={name}
                    internalName={name}
                    displayName={displayNames[name] ?? ''}
                    onDisplayChange={val => setDisplay(name, val)}
                    onRemoveInternal={() => removeNameAt(name)}
                    onInternalChange={newKey => renameInternal(name, newKey)}
                  />
                ))}
              </div>

              <button onClick={addName}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-dashed border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors">
                <Plus className="w-3 h-3" /> Add Name
              </button>

              {currentNames.length === 0 && (
                <p className="text-[10px] text-slate-600 py-2">No names in this section yet.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}