import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Swords, Upload, Download, Plus, FileText, CheckCircle2, Copy } from 'lucide-react';
import UnitList from '../components/units/UnitList';
import UnitEditorPanel from '../components/units/UnitEditor';
import { parseEDU, serializeEDU, serializeUnit, createDefaultUnit } from '../components/units/EDUParser';

const STORAGE_KEY = 'm2tw_edu_units';
const EDU_FILE_KEY = 'm2tw_edu_file';
const EDU_FILE_NAME_KEY = 'm2tw_edu_file_name';
const EXPORT_UNITS_KEY = 'm2tw_export_units_file';
const UNIT_IMAGES_KEY = 'm2tw_unit_images';

function loadUnits() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}
function saveUnits(units) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(units)); } catch {}
}

// Parse export_units.txt into a map: dictionary -> { name, long, short }
// M2TW format: {key}value on one line, or {key}\nvalue on next line, with ¬ or tab or no separator
function parseExportUnits(text) {
  const map = {};
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith(';')) { i++; continue; }

    // Must start with {
    if (!trimmed.startsWith('{')) { i++; continue; }

    // Extract the key between { }
    const keyMatch = trimmed.match(/^\{([^}]+)\}/);
    if (!keyMatch) { i++; continue; }
    const fullKey = keyMatch[1].trim();
    // Everything after the closing }
    const afterBrace = trimmed.slice(keyMatch[0].length);
    // Strip leading separator (¬, tab, space)
    const inlineValue = afterBrace.replace(/^[¬\t ]/, '').trim();

    const isShort = fullKey.endsWith('_descr_short');
    const isLong  = !isShort && fullKey.endsWith('_descr');

    if (isShort) {
      const baseKey = fullKey.slice(0, -'_descr_short'.length);
      map[baseKey] = map[baseKey] || {};
      if (inlineValue) {
        map[baseKey].short = inlineValue;
      } else {
        // value on next line(s) until next {
        const parts = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith('{')) {
          parts.push(lines[i]); i++;
        }
        map[baseKey].short = parts.join('\n').trim();
        continue;
      }
    } else if (isLong) {
      const baseKey = fullKey.slice(0, -'_descr'.length);
      map[baseKey] = map[baseKey] || {};
      if (inlineValue) {
        map[baseKey].long = inlineValue;
      } else {
        const parts = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith('{')) {
          parts.push(lines[i]); i++;
        }
        map[baseKey].long = parts.join('\n').trim();
        continue;
      }
    } else {
      // Name entry
      map[fullKey] = map[fullKey] || {};
      if (inlineValue) {
        map[fullKey].name = inlineValue;
      } else {
        // Next non-empty line is the name
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length && !lines[i].trim().startsWith('{')) {
          map[fullKey].name = lines[i].trim();
          i++;
        }
        continue;
      }
    }
    i++;
  }
  return map;
}

// Serialize descriptions map back to export_units.txt text
function serializeExportUnits(descrMap) {
  const lines = [];
  for (const [key, val] of Object.entries(descrMap)) {
    lines.push(`{${key}}\t${val.name || ''}`);
    lines.push('');
    if (val.long) {
      lines.push(`{${key}_descr}`);
      lines.push(val.long);
      lines.push('');
    }
    if (val.short) {
      lines.push(`{${key}_descr_short}`);
      lines.push(val.short);
      lines.push('');
    }
  }
  return lines.join('\n');
}

function loadUnitImages() {
  try {
    const s = localStorage.getItem(UNIT_IMAGES_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return null;
}

export default function UnitEditorPage() {
  const [units, setUnits] = useState(loadUnits);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filename, setFilename] = useState('export_descr_unit.txt');
  const [copied, setCopied] = useState(false);
  const [descrMap, setDescrMap] = useState(() => {
    try {
      // Parse raw file, then overlay any manual edits saved on top
      const raw = localStorage.getItem(EXPORT_UNITS_KEY);
      const base = raw ? parseExportUnits(raw) : {};
      const editsRaw = localStorage.getItem(EXPORT_UNITS_KEY + '_edits');
      const edits = editsRaw ? JSON.parse(editsRaw) : {};
      // Merge: edits override parsed values per-key per-field
      const merged = { ...base };
      for (const [k, v] of Object.entries(edits)) {
        merged[k] = { ...(merged[k] || {}), ...v };
      }
      return merged;
    } catch { return {}; }
  });
  const [unitImages, setUnitImages] = useState(() => window._m2tw_unit_images || loadUnitImages());
  const fileRef = useRef();

  // Auto-load from EDU file and export_units.txt if Home page cached them
  useEffect(() => {
    try {
      const eduContent = localStorage.getItem(EDU_FILE_KEY);
      const eduName = localStorage.getItem(EDU_FILE_NAME_KEY);
      if (eduContent && units.length === 0) {
        const parsed = parseEDU(eduContent);
        setUnits(parsed);
        if (eduName) setFilename(eduName);
      }
    } catch {}
  }, []);

  // Listen for unit images loaded from Home page
  useEffect(() => {
    const handler = (e) => {
      setUnitImages(e.detail);
      try { localStorage.setItem(UNIT_IMAGES_KEY, JSON.stringify(e.detail)); } catch {}
    };
    window.addEventListener('load-unit-images', handler);
    return () => window.removeEventListener('load-unit-images', handler);
  }, []);

  // Live-reload descriptions when Home page loads export_units.txt
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(EXPORT_UNITS_KEY);
        if (!raw) return;
        const base = parseExportUnits(raw);
        const editsRaw = localStorage.getItem(EXPORT_UNITS_KEY + '_edits');
        const edits = editsRaw ? JSON.parse(editsRaw) : {};
        const merged = { ...base };
        for (const [k, v] of Object.entries(edits)) {
          merged[k] = { ...(merged[k] || {}), ...v };
        }
        setDescrMap(merged);
      } catch {}
    };
    window.addEventListener('load-export-units', handler);
    return () => window.removeEventListener('load-export-units', handler);
  }, []);

  const active = units[activeIndex] || null;
  const activeDescr = active ? (descrMap[active.dictionary] ?? null) : null;

  const update = (units) => { setUnits(units); saveUnits(units); };

  const handleDescrChange = (val) => {
    if (!active) return;
    const updated = { ...descrMap, [active.dictionary]: val };
    setDescrMap(updated);
    // Save edits back as a JSON overlay; the raw file is preserved separately
    try { localStorage.setItem(EXPORT_UNITS_KEY + '_edits', JSON.stringify(updated)); } catch {}
  };

  const handleFileLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseEDU(ev.target.result);
      update(parsed);
      setActiveIndex(0);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAdd = () => {
    const newUnit = createDefaultUnit();
    const updated = [...units, newUnit];
    update(updated);
    setActiveIndex(updated.length - 1);
  };

  const handleDelete = (i) => {
    const updated = units.filter((_, idx) => idx !== i);
    update(updated);
    setActiveIndex(Math.max(0, i - 1));
  };

  const handleDuplicate = (i) => {
    const copy = { ...units[i], type: units[i].type + '_copy', dictionary: units[i].dictionary + '_copy' };
    const updated = [...units.slice(0, i + 1), copy, ...units.slice(i + 1)];
    update(updated);
    setActiveIndex(i + 1);
  };

  const handleChange = (unit) => {
    const updated = units.map((u, i) => i === activeIndex ? unit : u);
    update(updated);
  };

  const handleImageUpload = (key, dataUrl) => {
    const updated = { ...(unitImages || {}), [key]: dataUrl };
    window._m2tw_unit_images = updated;
    setUnitImages(updated);
    try { localStorage.setItem(UNIT_IMAGES_KEY, JSON.stringify(updated)); } catch {}
  };

  const handleImageDelete = (key) => {
    const updated = { ...(unitImages || {}) };
    // Try exact key and lowercase
    delete updated[key];
    for (const k of Object.keys(updated)) {
      if (k.toLowerCase() === key.toLowerCase()) delete updated[k];
    }
    window._m2tw_unit_images = updated;
    setUnitImages(updated);
    try { localStorage.setItem(UNIT_IMAGES_KEY, JSON.stringify(updated)); } catch {}
  };

  const handleDownload = () => {
    const text = serializeEDU(units);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyUnit = () => {
    if (!active) return;
    navigator.clipboard.writeText(serializeUnit(active));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-2 shrink-0 bg-card/50">
        <Swords className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground">Unit Editor</span>
        <span className="text-[10px] text-muted-foreground font-mono">— export_descr_unit.txt</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <Upload className="w-3 h-3" />
            Load EDU file
          </button>
          <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFileLoad} />
          {active && (
            <button
              onClick={handleCopyUnit}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              {copied ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy unit'}
            </button>
          )}
          <Button size="sm" className="h-7 text-[11px] gap-1.5" onClick={handleDownload} disabled={units.length === 0}>
            <Download className="w-3.5 h-3.5" />
            Download EDU
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left: unit list */}
        <div className="w-48 lg:w-56 border-r border-border shrink-0">
          <UnitList
            units={units}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </div>

        {/* Center: unit editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          {active ? (
            <UnitEditorPanel
              unit={active}
              onChange={handleChange}
              descr={activeDescr}
              onDescrChange={handleDescrChange}
              unitImages={unitImages}
              onImageUpload={handleImageUpload}
              onImageDelete={handleImageDelete}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <FileText className="w-12 h-12 opacity-20" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground">No units loaded</p>
                <p className="text-xs">Load an existing <code className="font-mono bg-accent px-1 rounded">export_descr_unit.txt</code><br />or add a new unit to get started.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" />
                  Load EDU file
                </Button>
                <Button size="sm" onClick={handleAdd}>
                  <Plus className="w-3.5 h-3.5" />
                  New unit
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}