import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Swords, Upload, Download, Plus, FileText, CheckCircle2, Copy } from 'lucide-react';
import UnitList from '../components/units/UnitList';
import UnitEditorPanel from '../components/units/UnitEditor';
import { parseEDU, serializeEDU, serializeUnit, createDefaultUnit } from '../components/units/EDUParser';

const STORAGE_KEY = 'm2tw_edu_units';

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

export default function UnitEditorPage() {
  const [units, setUnits] = useState(loadUnits);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filename, setFilename] = useState('export_descr_unit.txt');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef();

  const active = units[activeIndex] || null;

  const update = (units) => { setUnits(units); saveUnits(units); };

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
            <UnitEditorPanel unit={active} onChange={handleChange} />
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