import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2 } from 'lucide-react';
import { useRefData } from './RefDataContext';

function FileBtn({ label, hint, onLoad, loaded }) {
  const ref = useRef();
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onLoad(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  };
  return (
    <label className="cursor-pointer">
      <input type="file" accept=".txt" className="hidden" onChange={handleFile} ref={ref} />
      <Button
        variant="outline"
        size="sm"
        className={`h-7 text-[10px] pointer-events-none gap-1.5 ${loaded ? 'border-green-500/40 text-green-400' : ''}`}
      >
        {loaded ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Upload className="w-3 h-3" />}
        {label}
        {hint && <span className="text-muted-foreground hidden lg:inline">({hint})</span>}
      </Button>
    </label>
  );
}

export default function RefFileLoader() {
  const {
    loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile,
    factions, mapResources, eventCounters, units
  } = useRefData();

  // Use length changes as "loaded" indicator
  const [loaded, setLoaded] = React.useState({});
  const load = (key, fn) => (text) => { fn(text); setLoaded(p => ({ ...p, [key]: true })); };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground hidden lg:block">Ref files:</span>
      <FileBtn label="Factions" hint="descr_sm_factions.txt" onLoad={load('fac', loadFactionsFile)} loaded={loaded.fac} />
      <FileBtn label="Resources" hint="descr_sm_resources.txt" onLoad={load('res', loadResourcesFile)} loaded={loaded.res} />
      <FileBtn label="Events" hint="descr_events.txt" onLoad={load('ev', loadEventsFile)} loaded={loaded.ev} />
      <FileBtn label="Units" hint="export_descr_unit.txt" onLoad={load('unit', loadUnitsFile)} loaded={loaded.unit} />
    </div>
  );
}