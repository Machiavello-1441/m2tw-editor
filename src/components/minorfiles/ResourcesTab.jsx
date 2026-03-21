import React, { useState, useMemo } from 'react';
import { Upload, Download, Plus, X, AlertCircle } from 'lucide-react';
import { encodeStringsBin, parseStringsBin } from '../strings/stringsBinCodec';

function parseResourcesFull(text) {
  const resources = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^type\s+(\S+)/i);
    if (m) {
      if (current) resources.push(current);
      current = { name: m[1], tradeValue: 0, model: '', icon: '', hasMine: false };
      continue;
    }
    if (!current) continue;
    let pm;
    if ((pm = line.match(/^trade_value\s+(\d+)/i))) { current.tradeValue = parseInt(pm[1]); continue; }
    if ((pm = line.match(/^model\s+(.+)/i))) { current.model = pm[1].trim(); continue; }
    if ((pm = line.match(/^icon\s+(.+)/i))) { current.icon = pm[1].trim(); continue; }
    if (/^has_mine/i.test(line)) { current.hasMine = true; continue; }
  }
  if (current) resources.push(current);
  return resources;
}

function serializeResources(resources) {
  return resources.map(r => {
    const lines = [`type\t\t\t${r.name}`];
    lines.push(`trade_value\t\t${r.tradeValue}`);
    if (r.model) lines.push(`model\t\t\t${r.model}`);
    if (r.icon) lines.push(`icon\t\t\t${r.icon}`);
    if (r.hasMine) lines.push('has_mine');
    return lines.join('\n');
  }).join('\n\n');
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ResourcesTab() {
  const [resources, setResources] = useState([]);
  const [names, setNames] = useState({}); // display_name → display_name2 (strat.txt.strings.bin special format)
  const [binMeta, setBinMeta] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const handleLoadTxt = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    setResources(parseResourcesFull(text));
    try { sessionStorage.setItem('m2tw_sm_resources_raw', text); } catch {}
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
    const text = serializeResources(resources);
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_sm_resources.txt');
  };

  const handleExportBin = () => {
    const entries = Object.entries(names).map(([key, value]) => ({ key, value }));
    const buf = encodeStringsBin(entries, binMeta?.magic1, binMeta?.magic2);
    downloadBlob(new Blob([new Uint8Array(buf)]), 'strat.txt.strings.bin');
  };

  const addResource = () => {
    setResources(prev => [...prev, { name: 'new_resource', tradeValue: 0, model: '', icon: '', hasMine: false }]);
  };

  const updateResource = (idx, field, value) => {
    setResources(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeResource = (idx) => {
    setResources(prev => prev.filter((_, i) => i !== idx));
  };

  const issues = useMemo(() => {
    const iss = [];
    const seen = new Set();
    for (const r of resources) {
      if (!r.name) iss.push('Empty resource name');
      if (seen.has(r.name)) iss.push(`Duplicate: ${r.name}`);
      seen.add(r.name);
    }
    return iss;
  }, [resources]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <Upload className="w-3 h-3" /> Load descr_sm_resources.txt
          <input type="file" accept=".txt" className="hidden" onChange={handleLoadTxt} />
        </label>
        <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <Upload className="w-3 h-3" /> Load strat.txt.strings.bin
          <input type="file" accept=".bin,.strings.bin" className="hidden" onChange={handleLoadBin} />
        </label>
        <button onClick={handleExportTxt} disabled={!resources.length}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 disabled:opacity-40 transition-colors">
          <Download className="w-3 h-3" /> Export .txt
        </button>
        <button onClick={handleExportBin} disabled={!Object.keys(names).length}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 disabled:opacity-40 transition-colors">
          <Download className="w-3 h-3" /> Export .strings.bin
        </button>
      </div>

      <p className="text-[9px] text-slate-500 italic">
        Note: strat.txt.strings.bin uses a special format where keys are display names (not internal names).
        Each entry maps "{`{Display Name 1}`}Display Name 2".
      </p>

      {issues.length > 0 && (
        <div className="rounded border border-red-500/30 bg-red-900/10 p-2 space-y-0.5">
          {issues.map((iss, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px] text-red-400">
              <AlertCircle className="w-3 h-3 shrink-0" /> {iss}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {resources.map((r, idx) => (
          <div key={idx} className="rounded border border-slate-700/40 bg-slate-900/20 p-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <input value={r.name} onChange={e => updateResource(idx, 'name', e.target.value)}
                className="flex-1 h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono"
                placeholder="Internal name" />
              <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                <input type="checkbox" checked={r.hasMine}
                  onChange={e => updateResource(idx, 'hasMine', e.target.checked)}
                  className="w-3 h-3 accent-amber-500" />
                mine
              </label>
              <button onClick={() => removeResource(idx)} className="text-slate-600 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <span className="text-[9px] text-slate-500">Trade Value</span>
                <input type="number" value={r.tradeValue} onChange={e => updateResource(idx, 'tradeValue', parseInt(e.target.value) || 0)}
                  className="w-full h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500">Model (.cas)</span>
                <input value={r.model} onChange={e => updateResource(idx, 'model', e.target.value)}
                  className="w-full h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500">Icon (.tga)</span>
                <input value={r.icon} onChange={e => updateResource(idx, 'icon', e.target.value)}
                  className="w-full h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              </div>
            </div>
            {/* Display names from strings.bin */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[9px] text-slate-500">Display Name 1 (key)</span>
                <input value={Object.keys(names).find(k => k.toLowerCase().includes(r.name.toLowerCase())) || ''}
                  onChange={e => {
                    // This is the key in the strings.bin
                    const oldKey = Object.keys(names).find(k => k.toLowerCase().includes(r.name.toLowerCase()));
                    const newNames = { ...names };
                    if (oldKey) { newNames[e.target.value] = newNames[oldKey]; delete newNames[oldKey]; }
                    else newNames[e.target.value] = '';
                    setNames(newNames);
                  }}
                  className="w-full h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500">Display Name 2 (value)</span>
                <input value={(() => {
                    const key = Object.keys(names).find(k => k.toLowerCase().includes(r.name.toLowerCase()));
                    return key ? names[key] : '';
                  })()}
                  onChange={e => {
                    const key = Object.keys(names).find(k => k.toLowerCase().includes(r.name.toLowerCase()));
                    if (key) setNames(prev => ({ ...prev, [key]: e.target.value }));
                  }}
                  className="w-full h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addResource}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-dashed border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors">
        <Plus className="w-3 h-3" /> Add Resource
      </button>

      {!loaded && resources.length === 0 && (
        <p className="text-[10px] text-slate-600 text-center py-4">Load descr_sm_resources.txt to start editing</p>
      )}
    </div>
  );
}