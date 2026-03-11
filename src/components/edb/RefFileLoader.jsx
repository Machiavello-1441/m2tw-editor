import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, FolderOpen } from 'lucide-react';
import { useRefData } from './RefDataContext';

// Map of known filenames to which loader to call
const FILE_MAP = {
  'descr_sm_factions.txt': 'loadFactionsFile',
  'descr_sm_resources.txt': 'loadResourcesFile',
  'descr_events.txt': 'loadEventsFile',
  'export_descr_unit.txt': 'loadUnitsFile',
};

function FileBtn({ label, hint, onLoad, loaded }) {
  return (
    <label className="cursor-pointer">
      <input type="file" accept=".txt" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => onLoad(ev.target.result);
        reader.readAsText(file);
        e.target.value = '';
      }} />
      <Button
        variant="outline"
        size="sm"
        className={`h-7 text-[10px] pointer-events-none gap-1.5 ${loaded ? 'border-green-500/40 text-green-400' : ''}`}
      >
        {loaded ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Upload className="w-3 h-3" />}
        {label}
        {hint && <span className="text-muted-foreground hidden xl:inline">({hint})</span>}
      </Button>
    </label>
  );
}

export default function RefFileLoader() {
  const {
    loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile,
  } = useRefData();

  const [loaded, setLoaded] = useState({});
  const folderRef = useRef();

  const loaders = { loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile };

  const load = (key, fn) => (text) => {
    fn(text);
    setLoaded(p => ({ ...p, [key]: true }));
  };

  const handleFolderLoad = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const name = file.name.toLowerCase();
      const loaderKey = FILE_MAP[name];
      if (!loaderKey) return;
      const shortKey = { loadFactionsFile: 'fac', loadResourcesFile: 'res', loadEventsFile: 'ev', loadUnitsFile: 'unit' }[loaderKey];
      const reader = new FileReader();
      reader.onload = (ev) => {
        loaders[loaderKey](ev.target.result);
        setLoaded(p => ({ ...p, [shortKey]: true }));
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground hidden lg:block">Ref:</span>

      {/* Folder shortcut */}
      <label className="cursor-pointer" title="Select your M2TW/data folder to auto-load all ref files">
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderLoad}
        />
        <Button variant="outline" size="sm" className="h-7 text-[10px] pointer-events-none gap-1.5 border-primary/30 text-primary">
          <FolderOpen className="w-3 h-3" /> Load data/ folder
        </Button>
      </label>

      <span className="text-[10px] text-muted-foreground">or:</span>

      <FileBtn label="Factions" hint="descr_sm_factions.txt" onLoad={load('fac', loadFactionsFile)} loaded={loaded.fac} />
      <FileBtn label="Resources" hint="descr_sm_resources.txt" onLoad={load('res', loadResourcesFile)} loaded={loaded.res} />
      <FileBtn label="Events" hint="descr_events.txt" onLoad={load('ev', loadEventsFile)} loaded={loaded.ev} />
      <FileBtn label="Units" hint="export_descr_unit.txt" onLoad={load('unit', loadUnitsFile)} loaded={loaded.unit} />
    </div>
  );
}