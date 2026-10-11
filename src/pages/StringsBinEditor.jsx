import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { decodeStringsBin, encodeStoredStringsBin } from '@/components/strings/stringsBinCodec';
import { getStringsBinStore, updateStringsBinFile } from '@/lib/stringsBinStore';
import { FILES_CHANGED_EVENT, STRINGS_STORE_KEY, normalizedFileName } from '@/lib/modFileRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Plus, Trash2, Search, X, FileText, ChevronUp, ChevronDown, Save } from 'lucide-react';

function loadFilesFromStore() {
  const store = getStringsBinStore();
  return Object.entries(store).map(([name, data]) => ({
    name,
    ...data,
    dirty: false,
  }));
}

export default function StringsBinEditor() {
  const [files, setFiles] = useState(() => loadFilesFromStore());
  const [activeFile, setActiveFile] = useState(() => {
    const f = loadFilesFromStore();
    return f.length > 0 ? 0 : null;
  });
  const [selected, setSelected] = useState(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [search, setSearch] = useState('');
  const [isNew, setIsNew] = useState(false);
  const fileInputRef = useRef();
  const [fileError, setFileError] = useState('');

  // Re-sync when another editor or Home updates the store
  useEffect(() => {
    const handler = event => {
      if (event?.detail?.keys && !event.detail.keys.includes(STRINGS_STORE_KEY)) return;
      const fresh = loadFilesFromStore();
      setFiles((prev) => {
        // Saved edits already live in the shared store. Dirty means not exported,
        // not a separate unsaved copy that should override a newly imported file.
        const prevByName = Object.fromEntries(prev.map((f) => [f.name, f]));
        const merged = fresh.map((f) => {
          const existing = prevByName[f.name];
          return { ...f, dirty: existing?.dirty || false };
        });
        // Also keep any local-only files not yet in store (shouldn't happen but safety)
        for (const p of prev) {
          if (!merged.find((m) => m.name === p.name)) merged.push(p);
        }
        return merged;
      });
    };
    window.addEventListener(FILES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, handler);
  }, []);

  const currentFile = activeFile !== null ? files[activeFile] : null;
  const ordered = currentFile?.magic1 === 1;
  const structureLocked = ordered || !!currentFile?.readOnly;

  const filteredEntries = useMemo(() => {
    if (!currentFile) return [];
    const q = search.toLowerCase();
    if (!q) return currentFile.entries.map((e, i) => ({ ...e, originalIndex: i }));
    return currentFile.entries
      .map((e, i) => ({ ...e, originalIndex: i }))
      .filter((e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q));
  }, [currentFile, search]);

  const updateFiles = useCallback((updater) => {
    setFiles((prev) => {
      const next = [...prev];
      next[activeFile] = updater(next[activeFile]);
      return next;
    });
  }, [activeFile]);

  // Load from file picker (in addition to shared store)
  const handleLoad = async (e) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    const failures = [];
    let lastLoadedName = null;
    for (const f of fileList) {
      try {
        const parsed = decodeStringsBin(await f.arrayBuffer());
        updateStringsBinFile(f.name, parsed);
        lastLoadedName = normalizedFileName(f.name);
        const loadedName = lastLoadedName;
        setFiles(prev => prev.map(existing => existing.name === loadedName ? { ...parsed, name: loadedName, dirty: false } : existing));
      } catch (error) {
        failures.push(`${f.name}: ${error.message}`);
      }
    }
    setFileError(failures.join('\n'));
    // Select the last successfully loaded file, not a rejected one.
    if (lastLoadedName) {
      setTimeout(() => {
        setFiles((prev) => {
          const idx = prev.findIndex((f) => f.name === lastLoadedName);
          if (idx >= 0) setActiveFile(idx);
          return prev;
        });
        setSelected(null); setEditKey(''); setEditValue('');
      }, 50);
    }
  };

  const handleSelectEntry = (entry) => {
    setSelected(entry.originalIndex);
    setEditKey(entry.key);
    setEditValue(entry.value);
    setIsNew(false);
  };

  const handleSaveEntry = () => {
    if (!currentFile || currentFile.readOnly || (ordered && isNew)) return;
    let newEntries;
    if (isNew) {
      newEntries = [...currentFile.entries, { key: editKey, value: editValue }];
      setIsNew(false);
    } else if (selected !== null) {
      newEntries = [...currentFile.entries];
      newEntries[selected] = { ...newEntries[selected], key: ordered ? newEntries[selected].key : editKey, value: editValue };
    } else return;

    updateFiles((f) => ({ ...f, entries: newEntries, dirty: true }));
    // Immediately persist to shared store so other editors see the change
    updateStringsBinFile(currentFile.name, { ...currentFile, entries: newEntries });
  };

  const handleDelete = (idx) => {
    if (structureLocked) return;
    const newEntries = currentFile.entries.filter((_, i) => i !== idx);
    updateFiles((f) => ({ ...f, entries: newEntries, dirty: true }));
    updateStringsBinFile(currentFile.name, { ...currentFile, entries: newEntries });
    if (selected === idx) { setSelected(null); setEditKey(''); setEditValue(''); }
    else if (selected > idx) setSelected(selected - 1);
  };

  const handleMove = (idx, dir) => {
    if (structureLocked) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= currentFile.entries.length) return;
    const newEntries = [...currentFile.entries];
    [newEntries[idx], newEntries[newIdx]] = [newEntries[newIdx], newEntries[idx]];
    updateFiles((f) => ({ ...f, entries: newEntries, dirty: true }));
    updateStringsBinFile(currentFile.name, { ...currentFile, entries: newEntries });
    if (selected === idx) setSelected(newIdx);
  };

  const handleExport = () => {
    if (!currentFile) return;
    let buf;
    try { buf = encodeStoredStringsBin(currentFile); setFileError(''); }
    catch (error) { setFileError(error.message); return; }
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    let outName = currentFile.name;
    if (!outName.endsWith('.txt.strings.bin')) outName = outName.replace(/\.strings\.bin$/i, '') + '.txt.strings.bin';
    a.href = url; a.download = outName; a.click();
    URL.revokeObjectURL(url);
    updateFiles((f) => ({ ...f, dirty: false }));
  };

  const handleCloseFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    if (activeFile === idx) {
      setActiveFile(files.length > 1 ? (idx > 0 ? idx - 1 : 0) : null);
      setSelected(null); setEditKey(''); setEditValue('');
    } else if (activeFile > idx) {
      setActiveFile(activeFile - 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-900 shrink-0">
        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">Strings Bin Editor</h1>
        <span className="text-[11px] text-slate-400">.txt.strings.bin</span>
        <div className="flex-1" />
        <label className="cursor-pointer">
          <input ref={fileInputRef} type="file" className="hidden" multiple accept=".bin,.strings.bin" onChange={handleLoad} />
          <Button asChild variant="outline" size="sm" className="gap-1.5 pointer-events-none h-8 border-slate-500 text-slate-200 hover:bg-slate-700">
            <span><Upload className="w-3.5 h-3.5" /> Open File(s)</span>
          </Button>
        </label>
        {currentFile && (
          <Button size="sm" onClick={handleExport} className="gap-1.5 h-8 bg-blue-600 hover:bg-blue-500 text-white">
            <Download className="w-3.5 h-3.5" /> Export .bin
          </Button>
        )}
      </div>

      {fileError && <p role="alert" className="px-4 py-3 text-xs text-red-300 whitespace-pre-wrap">{fileError}</p>}
      {ordered && <p className="px-4 py-3 text-xs text-amber-200 bg-amber-950/30">Ordered / index-based strings: this file stores values without named keys. Numeric labels are display-only. Edit text values only; record order and count are locked to preserve game references.</p>}
      {currentFile?.readOnly && <p className="px-4 py-3 text-xs text-amber-200">This file has an unknown binary trailer. It is available for viewing and unchanged export; editing is locked to avoid damaging it.</p>}
      {/* File tabs */}
      {files.length > 0 && (
        <div className="flex gap-1 px-3 pt-2 pb-0 border-b border-slate-700 bg-slate-900 overflow-x-auto">
          {files.map((f, i) => (
            <button
              key={f.name}
              onClick={() => { setActiveFile(i); setSelected(null); setEditKey(''); setEditValue(''); setSearch(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-[11px] font-medium border border-b-0 transition-all shrink-0 ${i === activeFile ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-900 text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'}`}
            >
              {f.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
              {f.name}
              <X className="w-3 h-3 ml-0.5 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleCloseFile(i); }} />
            </button>
          ))}
        </div>
      )}

      {/* Main area */}
      {!currentFile ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 p-8">
          <FileText className="w-14 h-14 opacity-20" />
          <p className="text-sm font-medium text-slate-300">No file loaded</p>
          <p className="text-xs text-slate-500 text-center max-w-xs">
            Load your <code className="font-mono bg-slate-800 text-slate-300 px-1 rounded">text\</code> folder from the Home page,
            or open a <code className="font-mono bg-slate-800 text-slate-300 px-1 rounded">.txt.strings.bin</code> file directly.
          </p>
          <label className="cursor-pointer">
            <input type="file" className="hidden" multiple accept=".bin,.strings.bin" onChange={handleLoad} />
            <Button asChild variant="outline" className="gap-2 pointer-events-none border-slate-600 text-slate-200 hover:bg-slate-700">
              <span><Upload className="w-4 h-4" /> Open .txt.strings.bin</span>
            </Button>
          </label>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left: entry list */}
          <div className="w-80 shrink-0 border-r border-slate-700 flex flex-col bg-slate-900">
            <div className="p-2 border-b border-slate-700 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search keys or values…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-7 pl-7 pr-2 text-[11px] bg-slate-800 border border-slate-600 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0 border-slate-600 text-slate-300">{filteredEntries.length}</Badge>
            </div>

            <div className="flex-1 overflow-y-auto" id="strings-entry-list">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.originalIndex}
                  onClick={() => handleSelectEntry(entry)}
                  className={`group flex items-center gap-1 px-3 py-2 cursor-pointer border-b border-slate-800 transition-colors ${selected === entry.originalIndex ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-slate-800'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono font-semibold truncate text-slate-200">{entry.key || <span className="opacity-30">(empty key)</span>}</p>
                    <p className="text-[10px] text-slate-400 truncate">{entry.value || <span className="opacity-30">(no value)</span>}</p>
                  </div>
                  {!structureLocked && <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); handleMove(entry.originalIndex, -1); }} className="p-0.5 rounded hover:bg-slate-600 text-slate-300">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleMove(entry.originalIndex, 1); }} className="p-0.5 rounded hover:bg-slate-600 text-slate-300">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.originalIndex); }} className="p-0.5 rounded hover:bg-red-900 text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>}
                </div>
              ))}
            </div>

            <div className="p-2 border-t border-slate-700">
              <Button size="sm" variant="outline" className="w-full gap-1.5 h-8 border-slate-600 text-slate-200 hover:bg-slate-700"
                disabled={structureLocked}
                onClick={() => { setIsNew(true); setSelected(null); setEditKey(''); setEditValue(''); }}>
                <Plus className="w-3.5 h-3.5" /> New Entry
              </Button>
            </div>
          </div>

          {/* Right: editor */}
          <div className="flex-1 flex flex-col p-4 gap-4 bg-slate-950">
            {(selected !== null || isNew) ? (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{ordered ? 'Record index (read-only)' : 'Internal Key (identifier)'}</label>
                  <Input
                    value={editKey}
                    readOnly={structureLocked}
                    onChange={(e) => setEditKey(e.target.value)}
                    className="font-mono text-sm h-9 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                    placeholder="KEY_NAME"
                  />
                </div>
                <div className="space-y-1 flex-1 flex flex-col">
                  <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Display Text (value)</label>
                  <Textarea
                    value={editValue}
                    readOnly={!!currentFile.readOnly}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 font-mono text-sm resize-none min-h-[200px] bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                    placeholder="Text displayed in-game…"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveEntry} disabled={!!currentFile.readOnly} className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white">
                    <Save className="w-3.5 h-3.5" />
                    {isNew ? 'Add Entry' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700"
                    onClick={() => { setSelected(null); setIsNew(false); setEditKey(''); setEditValue(''); }}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500">
                <FileText className="w-10 h-10 opacity-20" />
                <p className="text-sm text-slate-400">Select an entry to edit, or create a new one.</p>
                <p className="text-[11px] text-slate-600">{currentFile.entries.length} entries in {currentFile.name}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}