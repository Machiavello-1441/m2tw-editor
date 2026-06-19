import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Settings, CheckCircle, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LS_KEY = 'm2tw_offmap_models';

export const NAVY_ENTRY_TEMPLATE = (name) =>
  `\n\tfaction ${name}\n\t{\n\t\tlarge \tdata/models_off_map/bireme_OFF_MAP.CAS\t100 0\n\t\tmedium\tdata/models_off_map/bireme_OFF_MAP.CAS\t100 0\n\t\tsmall\tdata/models_off_map/bireme_OFF_MAP.CAS\t100 0\n\t}`;

export function hasFactionNavyEntry(text, name) {
  const m = text.match(/navy\s*\{([\s\S]*?)\n\}/);
  if (!m) return false;
  return new RegExp(`\\bfaction\\s+${name}\\b`).test(m[1]);
}

export function insertFactionNavyEntry(text, name) {
  return text.replace(/(navy\s*\{[\s\S]*?)(\n\})/, `$1${NAVY_ENTRY_TEMPLATE(name)}$2`);
}

// Parse the navy block's faction entry for a given faction name
// Returns { large, medium, small } or null
function parseFactionNavy(text, name) {
  const factionBlockRe = new RegExp(
    `faction\\s+${name}\\s*\\{([^}]*)\\}`, 'i'
  );
  // Only search inside the navy block
  const navyMatch = text.match(/navy\s*\{([\s\S]*?)\n\}/);
  if (!navyMatch) return null;
  const navyBody = navyMatch[1];
  const m = navyBody.match(factionBlockRe);
  if (!m) return null;
  const body = m[1];
  const parseLine = (type) => {
    const r = new RegExp(`${type}\\s+(\\S+)\\s+(\\d+)\\s+(\\d+)`);
    const lm = body.match(r);
    return lm ? { path: lm[1], lod1: lm[2], lod2: lm[3] } : { path: '', lod1: '100', lod2: '0' };
  };
  return {
    large: parseLine('large'),
    medium: parseLine('medium'),
    small: parseLine('small'),
  };
}

// Serialize updated faction navy entry back into the full text
function serializeFactionNavy(text, name, entry) {
  const navyMatch = text.match(/(navy\s*\{)([\s\S]*?)(\n\})/);
  if (!navyMatch) return text;
  const factionBlockRe = new RegExp(
    `(faction\\s+${name}\\s*\\{)[^}]*(\\})`, 'i'
  );
  const newBlock = `$1\n\t\tlarge \t${entry.large.path}\t${entry.large.lod1} ${entry.large.lod2}\n\t\tmedium\t${entry.medium.path}\t${entry.medium.lod1} ${entry.medium.lod2}\n\t\tsmall\t${entry.small.path}\t${entry.small.lod1} ${entry.small.lod2}\n\t$2`;
  const updatedNavyBody = navyMatch[2].replace(factionBlockRe, newBlock);
  return text.replace(/(navy\s*\{)([\s\S]*?)(\n\})/, `$1${updatedNavyBody}$3`);
}

function NavyModelRow({ label, value, onChange }) {
  return (
    <div className="grid grid-cols-[60px_1fr_60px_40px] gap-2 items-center">
      <span className="text-[10px] font-mono text-slate-400 text-right">{label}</span>
      <input
        value={value.path}
        onChange={e => onChange({ ...value, path: e.target.value })}
        className="h-7 px-2 text-[10px] font-mono bg-slate-900 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
        placeholder="data/models_off_map/..."
      />
      <input
        value={value.lod1}
        onChange={e => onChange({ ...value, lod1: e.target.value })}
        className="h-7 px-2 text-[10px] font-mono bg-slate-900 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500 text-center"
      />
      <input
        value={value.lod2}
        onChange={e => onChange({ ...value, lod2: e.target.value })}
        className="h-7 px-2 text-[10px] font-mono bg-slate-900 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500 text-center"
      />
    </div>
  );
}

export default function MiscTab({ factionName }) {
  const [fileData, setFileData] = useState('');
  const [navyEntry, setNavyEntry] = useState(null);
  const fileRef = useRef();

  const syncFromStorage = useCallback(() => {
    try {
      const data = localStorage.getItem(LS_KEY);
      if (data) {
        setFileData(data);
        setNavyEntry(parseFactionNavy(data, factionName));
      }
    } catch {}
  }, [factionName]);

  useEffect(() => {
    syncFromStorage();
    window.addEventListener('offmap-models-updated', syncFromStorage);
    return () => window.removeEventListener('offmap-models-updated', syncFromStorage);
  }, [syncFromStorage]);

  const loadFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileData(text);
    setNavyEntry(parseFactionNavy(text, factionName));
    localStorage.setItem(LS_KEY, text);
    e.target.value = '';
  }, [factionName]);

  const exportFile = () => {
    if (!fileData) return;
    const blob = new Blob([fileData], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'descr_offmap_models.txt';
    a.click();
  };

  const addNavyEntry = () => {
    const updated = insertFactionNavyEntry(fileData, factionName);
    setFileData(updated);
    setNavyEntry(parseFactionNavy(updated, factionName));
    localStorage.setItem(LS_KEY, updated);
  };

  const updateNavyRow = (type, rowValue) => {
    const updated = { ...navyEntry, [type]: rowValue };
    setNavyEntry(updated);
    const newText = serializeFactionNavy(fileData, factionName, updated);
    setFileData(newText);
    localStorage.setItem(LS_KEY, newText);
  };

  const present = fileData ? hasFactionNavyEntry(fileData, factionName) : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-600 pb-2">
        <div>
          <p className="text-sm font-semibold text-slate-200">Miscellaneous Files</p>
          <p className="text-xs text-slate-400">descr_offmap_models.txt — navy entry for <span className="font-mono text-amber-400">{factionName}</span></p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={loadFile} />
          <Button variant="outline" size="sm" className="text-[10px]" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Load
          </Button>
          {fileData && (
            <Button variant="outline" size="sm" className="text-[10px]" onClick={exportFile}>
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
          )}
        </div>
      </div>

      {fileData ? (
        <>
          {present && navyEntry ? (
            <div className="space-y-2 p-3 rounded border bg-slate-800/50 border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400 font-semibold">Navy models for <span className="font-mono text-amber-400">{factionName}</span></span>
              </div>
              <div className="grid grid-cols-[60px_1fr_60px_40px] gap-2 mb-1">
                <div />
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Model path</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold text-center">LOD</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold text-center">Dist</span>
              </div>
              <NavyModelRow label="large" value={navyEntry.large} onChange={v => updateNavyRow('large', v)} />
              <NavyModelRow label="medium" value={navyEntry.medium} onChange={v => updateNavyRow('medium', v)} />
              <NavyModelRow label="small" value={navyEntry.small} onChange={v => updateNavyRow('small', v)} />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded border bg-slate-800/50 border-slate-700">
              <span className="text-xs text-slate-400">No navy entry for <span className="font-mono text-amber-400">{factionName}</span></span>
              <Button
                variant="outline" size="sm"
                className="text-[10px] h-7 text-blue-300 border-blue-600 hover:bg-blue-900/30 ml-auto"
                onClick={addNavyEntry}>
                <PlusCircle className="w-3 h-3 mr-1" /> Add Entry
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-lg">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No file loaded</p>
          <p className="text-xs mt-1">Click "Load" to import descr_offmap_models.txt</p>
        </div>
      )}
    </div>
  );
}