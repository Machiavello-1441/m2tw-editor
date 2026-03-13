import React, { useRef, useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import { useRefData } from '../components/edb/RefDataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import {
  Swords, FolderOpen, CheckCircle2, AlertCircle, Clock,
  FileText, Users, Package, Zap, ArrowRight, Info, Map, Castle
} from 'lucide-react';

// Files we look for in the data\ folder (matched by filename only, regardless of subfolder)
const DATA_FILE_MAP = {
  'export_descr_buildings.txt': 'edb',
  'descr_sm_factions.txt':      'fac',
  'descr_sm_resources.txt':     'res',
  'export_descr_unit.txt':      'unit',
  'descr_events.txt':           'ev',
  'export_buildings.txt':       'txt',
};

// TGA map files (campaign or base maps folder)
const MAP_TGA_FILES = [
  'map_heights.tga',
  'map_ground_types.tga',
  'map_climates.tga',
  'map_regions.tga',
  'map_features.tga',
  'map_fog.tga',
];

function FileStatus({ label, hint, status }) {
  const colors = {
    idle:    'border-border bg-card text-muted-foreground',
    ok:      'border-green-500/40 bg-green-500/5 text-green-400',
    error:   'border-destructive/40 bg-destructive/5 text-destructive',
    loading: 'border-primary/30 bg-primary/5 text-primary',
  };
  const icons = {
    idle:    <Clock className="w-3.5 h-3.5 shrink-0 opacity-40" />,
    ok:      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-400" />,
    error:   <AlertCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />,
    loading: <div className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />,
  };
  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${colors[status]}`}>
      {icons[status]}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold leading-none">{label}</p>
        <p className="text-[10px] opacity-60 mt-0.5 truncate font-mono">{hint}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { loadEDB, edbData, fileName, loadTextFile } = useEDB();
  const { loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile } = useRefData();

  const [fileStatus, setFileStatus] = useState({
    edb: 'idle', fac: 'idle', res: 'idle', ev: 'idle', unit: 'idle', txt: 'idle',
    map_heights: 'idle', map_ground_types: 'idle', map_climates: 'idle',
    map_regions: 'idle', map_features: 'idle', map_fog: 'idle',
  });

  const [modName, setModName] = useState(() => {
    try { return localStorage.getItem('m2tw_mod_name') || 'my_mod'; } catch { return 'my_mod'; }
  });
  const dataFolderRef = useRef();
  const mapFolderRef = useRef();

  const readText = (file) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsText(file);
  });

  const readBinary = (file) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsArrayBuffer(file);
  });

  const handleDataFolder = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    const loaderMap = {
      fac: loadFactionsFile,
      res: loadResourcesFile,
      ev: loadEventsFile,
      unit: loadUnitsFile,
      txt: loadTextFile,
    };

    for (const file of files) {
      const name = file.name.toLowerCase();
      const key = DATA_FILE_MAP[name];
      if (!key) continue;

      setFileStatus(prev => ({ ...prev, [key]: 'loading' }));
      const text = await readText(file);
      if (key === 'edb') {
        loadEDB(text, file.name);
      } else {
        loaderMap[key]?.(text);
      }
      setFileStatus(prev => ({ ...prev, [key]: 'ok' }));
    }
  };

  const handleMapFolder = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    for (const file of files) {
      const name = file.name.toLowerCase();
      if (!name.endsWith('.tga')) continue;
      const tgaKey = name.replace('.tga', '').replace('map_', 'map_');
      // status key: map_heights, map_ground_types, etc.
      const statusKey = name.replace('.tga', '');
      if (MAP_TGA_FILES.includes(name)) {
        setFileStatus(prev => ({ ...prev, [statusKey]: 'loading' }));
      }
      const buf = await readBinary(file);
      window.dispatchEvent(new CustomEvent('load-map-tga', { detail: { fileName: name, data: buf } }));
      if (MAP_TGA_FILES.includes(name)) {
        setFileStatus(prev => ({ ...prev, [statusKey]: 'ok' }));
      }
    }
  };

  const edbLoaded = fileStatus.edb === 'ok';
  const anyMapLoaded = MAP_TGA_FILES.some(f => fileStatus[f.replace('.tga', '')] === 'ok');

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-start gap-6 pt-12">

      {/* Header */}
      <div className="text-center space-y-2 max-w-xl">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <Swords className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">M2TW Mod Editor</h1>
        <p className="text-sm text-muted-foreground">
          Load your mod's files to begin editing. Use the Export page when done to download a complete
          <code className="text-xs bg-accent px-1 py-0.5 rounded mx-1">[mod name]\data\</code>folder ready to drop into your M2TW mods directory.
        </p>
      </div>

      {/* Mod Name */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <Package className="w-4 h-4 text-primary shrink-0" />
        <label className="text-xs font-semibold text-foreground whitespace-nowrap">Mod Name</label>
        <input
          type="text"
          value={modName}
          onChange={e => {
            const v = e.target.value.replace(/[^a-zA-Z0-9_\-]/g, '_');
            setModName(v);
            try { localStorage.setItem('m2tw_mod_name', v); } catch {}
          }}
          placeholder="my_mod"
          className="flex-1 h-8 px-3 text-xs bg-background border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Used in the exported zip path</span>
      </div>

      {/* Step 1 — data folder */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-accent/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Castle className="w-4 h-4 text-primary" />
            Step 1 — Load <code className="text-xs font-mono bg-accent px-1 py-0.5 rounded">data\</code> Folder
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Finds: <span className="font-mono text-foreground/80">export_descr_buildings.txt</span>,{' '}
            <span className="font-mono text-foreground/80">descr_sm_factions.txt</span>,{' '}
            <span className="font-mono text-foreground/80">descr_sm_resources.txt</span>,{' '}
            <span className="font-mono text-foreground/80">export_descr_unit.txt</span>,{' '}
            <span className="font-mono text-foreground/80">descr_events.txt</span>
          </p>
        </div>
        <div className="p-4 space-y-3">
          <label className="cursor-pointer">
            <input ref={dataFolderRef} type="file" className="hidden"
              webkitdirectory="" directory="" multiple onChange={handleDataFolder} />
            <Button asChild variant="outline"
              className="w-full h-11 border-primary/30 text-primary hover:bg-primary/10 pointer-events-none gap-2">
              <span>
                <FolderOpen className="w-4 h-4" />
                Browse to <code className="text-xs font-mono">…\data\</code> folder
              </span>
            </Button>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <FileStatus label="Buildings (EDB)" hint="export_descr_buildings.txt"    status={fileStatus.edb} />
            <FileStatus label="Building Text"   hint="text\export_buildings.txt"     status={fileStatus.txt} />
            <FileStatus label="Factions"        hint="descr_sm_factions.txt"         status={fileStatus.fac} />
            <FileStatus label="Resources"       hint="descr_sm_resources.txt"        status={fileStatus.res} />
            <FileStatus label="Units"           hint="export_descr_unit.txt"         status={fileStatus.unit} />
            <FileStatus label="Events"          hint="descr_events.txt"              status={fileStatus.ev} />
          </div>
        </div>
      </div>

      {/* Step 2 — map folder */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-accent/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            Step 2 — Load Campaign Map Folder <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Point to <code className="text-xs font-mono">data\world\maps\campaign\imperial_campaign\</code> or your base_maps folder — loads all TGA map layers.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <label className="cursor-pointer">
            <input ref={mapFolderRef} type="file" className="hidden"
              webkitdirectory="" directory="" multiple onChange={handleMapFolder} />
            <Button asChild variant="outline"
              className="w-full h-11 pointer-events-none gap-2">
              <span>
                <FolderOpen className="w-4 h-4" />
                Browse to campaign / base_maps folder
              </span>
            </Button>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <FileStatus label="Heights"      hint="map_heights.tga"      status={fileStatus['map_heights']} />
            <FileStatus label="Ground Types" hint="map_ground_types.tga" status={fileStatus['map_ground_types']} />
            <FileStatus label="Climates"     hint="map_climates.tga"     status={fileStatus['map_climates']} />
            <FileStatus label="Regions"      hint="map_regions.tga"      status={fileStatus['map_regions']} />
            <FileStatus label="Features"     hint="map_features.tga"     status={fileStatus['map_features']} />
            <FileStatus label="Fog of War"   hint="map_fog.tga"          status={fileStatus['map_fog']} />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="w-full max-w-2xl flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Browsers can read but not write to disk. When you're done editing, go to <strong className="text-foreground">Export</strong> to download a zip of your
          complete <code className="text-[10px] font-mono bg-accent px-1 rounded">{modName || 'my_mod'}\data\</code> folder.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full max-w-2xl flex flex-col gap-2">
        {edbLoaded && (
          <Link to={createPageUrl('EDBEditor')}>
            <Button className="w-full h-11 gap-2">
              <Castle className="w-4 h-4" />
              Open EDB Editor
              {fileName && <span className="text-xs opacity-60 font-mono">({fileName})</span>}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </Link>
        )}
        {anyMapLoaded && (
          <Link to={createPageUrl('CampaignMap')}>
            <Button variant="outline" className="w-full h-11 gap-2">
              <Map className="w-4 h-4" />
              Open Campaign Map Editor
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </Link>
        )}
        {edbLoaded && (
          <div className="flex gap-2 flex-wrap justify-center pt-1">
            <Badge variant="outline" className="text-[10px]">{edbData.buildings.length} buildings</Badge>
            <Badge variant="outline" className="text-[10px]">{edbData.buildings.reduce((s, b) => s + b.levels.length, 0)} levels</Badge>
            <Badge variant="outline" className="text-[10px]">{edbData.hiddenResources.length} hidden resources</Badge>
          </div>
        )}
      </div>
    </div>
  );
}