import React, { useRef, useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import { useRefData } from '../components/edb/RefDataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import {
  Castle, FolderOpen, CheckCircle2, AlertCircle, Clock,
  FileText, Users, Package, Zap, ArrowRight, Info, BookOpen, Swords
} from 'lucide-react';

const REF_FILE_MAP = {
  'descr_sm_factions.txt': 'fac',
  'descr_sm_resources.txt': 'res',
  'descr_events.txt': 'ev',
  'export_descr_unit.txt': 'unit',
};

const CAMPAIGN_FILE_MAP = {
  'descr_events.txt': 'ev',
};

function FileStatus({ label, hint, status, icon: FileIconComp }) {
  const Icon = FileIconComp || null;
  const colors = {
    idle:    'border-border bg-card text-muted-foreground',
    ok:      'border-green-500/40 bg-green-500/5 text-green-400',
    error:   'border-destructive/40 bg-destructive/5 text-destructive',
    loading: 'border-primary/30 bg-primary/5 text-primary',
  };
  const icons = {
    idle:    <Clock className="w-3.5 h-3.5 shrink-0" />,
    ok:      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-400" />,
    error:   <AlertCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />,
    loading: <div className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />,
  };
  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${colors[status]}`}>
      {icons[status]}
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold leading-none">{label}</p>
        <p className="text-[10px] opacity-70 mt-0.5 truncate">{hint}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { loadEDB, edbData, fileName } = useEDB();
  const { loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile } = useRefData();
  const [fileStatus, setFileStatus] = useState({
    edb: 'idle', fac: 'idle', res: 'idle', ev: 'idle', unit: 'idle'
  });
  const dataFolderRef = useRef();
  const campaignFolderRef = useRef();

  const readText = (file) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsText(file);
  });

  const handleDataFolder = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    // Show loading for expected files
    const foundKeys = {};
    for (const file of files) {
      const name = file.name.toLowerCase();
      const key = REF_FILE_MAP[name];
      if (key) foundKeys[key] = file;
      if (name === 'export_descr_buildings.txt') foundKeys['edb'] = file;
    }

    // Update status for what we found
    setFileStatus(prev => {
      const next = { ...prev };
      for (const k of ['edb', 'fac', 'res', 'ev', 'unit']) {
        next[k] = foundKeys[k] ? 'loading' : 'idle';
      }
      return next;
    });

    const loaderMap = {
      fac: loadFactionsFile,
      res: loadResourcesFile,
      ev: loadEventsFile,
      unit: loadUnitsFile,
    };

    for (const [key, file] of Object.entries(foundKeys)) {
      const text = await readText(file);
      if (key === 'edb') {
        loadEDB(text, file.name);
      } else {
        loaderMap[key]?.(text);
      }
      setFileStatus(prev => ({ ...prev, [key]: 'ok' }));
    }
  };

  const handleCampaignFolder = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    for (const file of files) {
      const name = file.name.toLowerCase();
      if (name === 'descr_events.txt') {
        setFileStatus(prev => ({ ...prev, ev: 'loading' }));
        const text = await readText(file);
        loadEventsFile(text);
        setFileStatus(prev => ({ ...prev, ev: 'ok' }));
      }
    }
  };

  const allLoaded = fileStatus.edb === 'ok';
  const coreReady = ['fac', 'res', 'unit'].every(k => fileStatus[k] === 'ok');

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-start gap-6 pt-16">

      {/* Header */}
      <div className="text-center space-y-2 max-w-xl">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <Castle className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">M2TW Building Editor</h1>
        <p className="text-sm text-muted-foreground">
          Load your M2TW mod files to get started. Point to the <code className="text-xs bg-accent px-1 py-0.5 rounded">data\</code> folder
          and the editor will automatically find all required files.
        </p>
      </div>

      {/* Main load card */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-accent/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            Step 1 — Load M2TW <code className="text-xs font-mono bg-accent px-1 py-0.5 rounded">data\</code> Folder
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Automatically finds: <span className="font-mono text-foreground">export_descr_buildings.txt</span>,{' '}
            <span className="font-mono text-foreground">descr_sm_factions.txt</span>,{' '}
            <span className="font-mono text-foreground">descr_sm_resources.txt</span>,{' '}
            <span className="font-mono text-foreground">export_descr_unit.txt</span>
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

          <div className="grid grid-cols-2 gap-2">
            <FileStatus label="EDB File" hint="export_descr_buildings.txt" status={fileStatus.edb} icon={Castle} />
            <FileStatus label="Factions" hint="descr_sm_factions.txt" status={fileStatus.fac} icon={Users} />
            <FileStatus label="Resources" hint="descr_sm_resources.txt" status={fileStatus.res} icon={Package} />
            <FileStatus label="Units" hint="export_descr_unit.txt" status={fileStatus.unit} icon={Sword} />
          </div>
        </div>

        {/* Campaign folder */}
        <div className="p-4 border-t border-border bg-accent/5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Step 2 — Load Campaign Folder <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Default: <code className="text-xs font-mono">data\world\maps\campaign\imperial_campaign\</code> — finds <code className="text-xs font-mono">descr_events.txt</code>
            </p>
          </div>
          <label className="cursor-pointer">
            <input ref={campaignFolderRef} type="file" className="hidden"
              webkitdirectory="" directory="" multiple onChange={handleCampaignFolder} />
            <Button asChild variant="outline"
              className="w-full h-9 pointer-events-none gap-2 text-xs">
              <span>
                <FolderOpen className="w-3.5 h-3.5" />
                Browse to campaign folder
              </span>
            </Button>
          </label>
          <FileStatus label="Events" hint="descr_events.txt" status={fileStatus.ev} icon={Zap} />
        </div>
      </div>

      {/* Manual upload fallback */}
      <div className="w-full max-w-2xl">
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 select-none">
            <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
            Load individual files manually
          </summary>
          <div className="mt-2 p-3 bg-card border border-border rounded-lg">
            <ManualFileLoader setFileStatus={setFileStatus} />
          </div>
        </details>
      </div>

      {/* Info block */}
      <div className="w-full max-w-2xl flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Folder permissions:</strong> Browsers can read files from a selected folder but cannot write back to disk.
          Edited files are downloaded via the <strong className="text-foreground">Export</strong> page.
          Only the files matching the expected names are read; all others are ignored.
        </p>
      </div>

      {/* Proceed button */}
      {allLoaded && (
        <Link to={createPageUrl('EDBEditor')} className="w-full max-w-2xl">
          <Button className="w-full h-12 text-base gap-2">
            Open EDB Editor
            {fileName && <span className="text-xs opacity-70 font-mono">({fileName})</span>}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      )}
      {!allLoaded && (
        <div className="text-[11px] text-muted-foreground text-center">
          Load the <code className="font-mono bg-accent px-1 rounded">data\</code> folder above to enable the editor
        </div>
      )}

      {/* Summary badges */}
      {edbData && (
        <div className="flex gap-2 flex-wrap justify-center">
          <Badge variant="outline" className="text-[10px]">
            {edbData.buildings.length} buildings
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {edbData.buildings.reduce((s, b) => s + b.levels.length, 0)} levels
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {edbData.hiddenResources.length} hidden resources
          </Badge>
        </div>
      )}
    </div>
  );
}

function ManualFileLoader({ setFileStatus }) {
  const { loadEDB } = useEDB();
  const { loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile } = useRefData();

  const readAndLoad = (key, loader) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      loader(ev.target.result, file.name);
      setFileStatus(p => ({ ...p, [key]: 'ok' }));
    };
    r.readAsText(file);
    e.target.value = '';
  };

  const files = [
    { key: 'edb',  label: 'EDB',       hint: 'export_descr_buildings.txt', loader: loadEDB },
    { key: 'fac',  label: 'Factions',  hint: 'descr_sm_factions.txt',      loader: loadFactionsFile },
    { key: 'res',  label: 'Resources', hint: 'descr_sm_resources.txt',      loader: loadResourcesFile },
    { key: 'ev',   label: 'Events',    hint: 'descr_events.txt',            loader: loadEventsFile },
    { key: 'unit', label: 'Units',     hint: 'export_descr_unit.txt',       loader: loadUnitsFile },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {files.map(f => (
        <label key={f.key} className="cursor-pointer">
          <input type="file" accept=".txt" className="hidden" onChange={readAndLoad(f.key, f.loader)} />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-accent/30 hover:bg-accent/60 transition-colors">
            <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] font-semibold">{f.label}</p>
              <p className="text-[9px] text-muted-foreground truncate">{f.hint}</p>
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}