import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, FolderOpen } from 'lucide-react';
import { useRefData } from './RefDataContext';
import { useEDB } from './EDBContext';

const REF_FILE_MAP = {
  'descr_sm_factions.txt': 'fac',
  'descr_sm_resources.txt': 'res',
  'descr_events.txt': 'ev',
  'export_descr_unit.txt': 'unit',
};

function FileBtn({ label, hint, onLoad, loaded }) {
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
      <input type="file" accept=".txt" className="hidden" onChange={handleFile} />
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
  const { loadEDB } = useEDB();
  const folderRef = useRef();

  const [loaded, setLoaded] = React.useState({});
  const load = (key, fn) => (text) => { fn(text); setLoaded(p => ({ ...p, [key]: true })); };

  const loaderMap = {
    fac: load('fac', loadFactionsFile),
    res: load('res', loadResourcesFile),
    ev: load('ev', loadEventsFile),
    unit: load('unit', loadUnitsFile),
  };

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files || []);
    let edbFile = null;
    for (const file of files) {
      const name = file.name.toLowerCase();
      const key = REF_FILE_MAP[name];
      if (key) {
        const reader = new FileReader();
        reader.onload = ev => loaderMap[key](ev.target.result);
        reader.readAsText(file);
      }
      if (name === 'export_descr_buildings.txt') {
        edbFile = file;
      }
    }
    if (edbFile) {
      const reader = new FileReader();
      reader.onload = ev => loadEDB(ev.target.result, edbFile.name);
      reader.readAsText(edbFile);
    }
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground hidden lg:block">Ref files:</span>

      {/* Folder load button */}
      <label className="cursor-pointer">
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] pointer-events-none gap-1.5 border-primary/40 text-primary"
        >
          <FolderOpen className="w-3 h-3" />
          Load M2TW/data folder
        </Button>
      </label>

      <span className="text-[10px] text-muted-foreground hidden lg:block">or:</span>

      <FileBtn label="Factions" hint="descr_sm_factions.txt" onLoad={loaderMap.fac} loaded={loaded.fac} />
      <FileBtn label="Resources" hint="descr_sm_resources.txt" onLoad={loaderMap.res} loaded={loaded.res} />
      <FileBtn label="Events" hint="descr_events.txt" onLoad={loaderMap.ev} loaded={loaded.ev} />
      <FileBtn label="Units" hint="export_descr_unit.txt" onLoad={loaderMap.unit} loaded={loaded.unit} />
    </div>
  );
}