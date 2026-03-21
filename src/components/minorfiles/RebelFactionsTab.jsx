import React, { useState, useMemo } from 'react';
import { Upload, Download, Plus, X, Check, AlertCircle } from 'lucide-react';
import { encodeStringsBin, parseStringsBin } from '../strings/stringsBinCodec';

// Parser: extract rebel factions with full details
function parseRebelFactionsFull(text) {
  const factions = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^rebel_faction\s+(\S+)/i) || line.match(/^faction\s+(\S+)/i);
    if (m) {
      if (current) factions.push(current);
      current = { name: m[1], category: '', description: '' };
      continue;
    }
    if (!current) continue;
    const cm = line.match(/^category\s+(.+)/i);
    if (cm) { current.category = cm[1].trim(); continue; }
    const dm = line.match(/^description\s+(.+)/i);
    if (dm) { current.description = dm[1].trim(); continue; }
  }
  if (current) factions.push(current);
  return factions;
}

function serializeRebelFactions(factions) {
  return factions.map(f => {
    const lines = [`rebel_faction\t\t\t${f.name}`];
    if (f.category) lines.push(`\tcategory\t\t\t${f.category}`);
    if (f.description) lines.push(`\tdescription\t\t\t${f.description}`);
    return lines.join('\n');
  }).join('\n\n');
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function RebelFactionsTab() {
  const [factions, setFactions] = useState([]);
  const [names, setNames] = useState({}); // key→display name from .strings.bin
  const [binMeta, setBinMeta] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const handleLoadTxt = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    setFactions(parseRebelFactionsFull(text));
    try { sessionStorage.setItem('m2tw_rebel_factions_raw', text); } catch {}
    setLoaded(true);
    e.target.value = '';
  };

  const handleLoadBin = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const buf = await file.arrayBuffer();
    const decoded = parseStringsBin(buf);
    if (decoded?.entries) {
      const map = {};
      for (const { key, value } of decoded.entries) if (key) map[key] = value;
      setNames(map);
      setBinMeta({ magic1: decoded.magic1, magic2: decoded.magic2 });
    }
    e.target.value = '';
  };

  const handleExportTxt = () => {
    const text = serializeRebelFactions(factions);
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_rebel_factions.txt');
  };

  const handleExportBin = () => {
    const entries = Object.entries(names).map(([key, value]) => ({ key, value }));
    const buf = encodeStringsBin(entries, binMeta?.magic1, binMeta?.magic2);
    downloadBlob(new Blob([new Uint8Array(buf)]), 'rebel_faction_descr.txt.strings.bin');
  };

  const addFaction = () => {
    setFactions(prev => [...prev, { name: 'new_rebel_faction', category: '', description: '' }]);
  };

  const updateFaction = (idx, field, value) => {
    setFactions(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f));
  };

  const removeFaction = (idx) => {
    setFactions(prev => prev.filter((_, i) => i !== idx));
  };

  const issues = useMemo(() => {
    const iss = [];
    const seen = new Set();
    for (const f of factions) {
      if (!f.name) iss.push('Empty faction name');
      if (seen.has(f.name)) iss.push(`Duplicate: ${f.name}`);
      seen.add(f.name);
    }
    return iss;
  }, [factions]);

  return (
    <div className="space-y-3">
      {/* Load / Export */}
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <Upload className="w-3 h-3" /> Load .txt
          <input type="file" accept=".txt" className="hidden" onChange={handleLoadTxt} />
        </label>
        <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <Upload className="w-3 h-3" /> Load .strings.bin
          <input type="file" accept=".bin,.strings.bin" className="hidden" onChange={handleLoadBin} />
        </label>
        <button onClick={handleExportTxt} disabled={!factions.length}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 disabled:opacity-40 transition-colors">
          <Download className="w-3 h-3" /> Export .txt
        </button>
        <button onClick={handleExportBin} disabled={!Object.keys(names).length}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 disabled:opacity-40 transition-colors">
          <Download className="w-3 h-3" /> Export .strings.bin
        </button>
      </div>

      {/* Validation */}
      {issues.length > 0 && (
        <div className="rounded border border-red-500/30 bg-red-900/10 p-2 space-y-0.5">
          {issues.map((iss, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px] text-red-400">
              <AlertCircle className="w-3 h-3 shrink-0" /> {iss}
            </div>
          ))}
        </div>
      )}

      {/* Faction list */}
      <div className="space-y-1.5">
        {factions.map((f, idx) => (
          <div key={idx} className="rounded border border-slate-700/40 bg-slate-900/20 p-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <input value={f.name} onChange={e => updateFaction(idx, 'name', e.target.value)}
                className="flex-1 h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              <button onClick={() => removeFaction(idx)} className="text-slate-600 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[9px] text-slate-500">Category</span>
                <input value={f.category} onChange={e => updateFaction(idx, 'category', e.target.value)}
                  className="w-full h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500">Display Name</span>
                <input value={names[f.name] || ''} onChange={e => setNames(prev => ({ ...prev, [f.name]: e.target.value }))}
                  className="w-full h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addFaction}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-dashed border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors">
        <Plus className="w-3 h-3" /> Add Rebel Faction
      </button>

      {!loaded && factions.length === 0 && (
        <p className="text-[10px] text-slate-600 text-center py-4">Load descr_rebel_factions.txt to start editing</p>
      )}
    </div>
  );
}