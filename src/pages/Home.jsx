import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useEDB } from '../components/edb/EDBContext';
import { useRefData } from '../components/edb/RefDataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Castle, CheckCircle2, AlertCircle, FolderOpen, FileText, Swords, ArrowRight, Loader2 } from 'lucide-react';

const FILE_DEFS = [
  { key: 'edb', name: 'export_descr_buildings.txt', label: 'EDB', desc: 'Main building definitions', required: true },
  { key: 'fac', name: 'descr_sm_factions.txt', label: 'Factions', desc: 'Faction & culture list', required: false },
  { key: 'res', name: 'descr_sm_resources.txt', label: 'Resources', desc: 'Map resources', required: false },
  { key: 'unit', name: 'export_descr_unit.txt', label: 'Units (EDU)', desc: 'Unit types for recruit_pool', required: false },
];

const CAMPAIGN_FILES = [
  { key: 'ev', name: 'descr_events.txt', label: 'Events', desc: 'Event counters (in campaign folder)', required: false },
];

function FileCard({ def, status, onLoad }) {
  const inputRef = useRef();
  const s = status || 'idle';

  const colorMap = {
    idle: 'border-border bg-card/50',
    loading: 'border-primary/40 bg-primary/5',
    ok: 'border-green-500/40 bg-green-500/5',
    error: 'border-destructive/40 bg-destructive/5',
  };

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${colorMap[s]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-foreground">{def.label}</span>
            {def.required && <Badge variant="outline" className="text-[9px] h-4 px-1">Required</Badge>}
            {s === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            {s === 'error' && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
            {s === 'loading' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
          </div>
          <p className="text-[10px] text-muted-foreground">{def.desc}</p>
          <p className="text-[10px] font-mono text-muted-foreground/60 truncate mt-0.5">{def.name}</p>
        </div>
        <label className="cursor-pointer shrink-0">
          <input ref={inputRef} type="file" accept=".txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onLoad(f); e.target.value = ''; }}
          />
          <Button variant={s === 'ok' ? 'outline' : 'default'} size="sm" className="h-7 text-xs pointer-events-none">
            <Upload className="w-3 h-3 mr-1" />
            {s === 'ok' ? 'Reload' : 'Load'}
          </Button>
        </label>
      </div>
      {status === 'ok' && <div className="mt-2 h-1 rounded-full bg-green-500/30"><div className="h-full w-full rounded-full bg-green-500" /></div>}
    </div>
  );
}

export default function Home() {
  const { loadEDB, edbData } = useEDB();
  const { loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile } = useRefData();
  const navigate = useNavigate();
  const folderRef = useRef();
  const campaignFolderRef = useRef();

  const [statuses, setStatuses] = useState({});
  const [loadedNames, setLoadedNames] = useState({});

  const setStatus = (key, st, name) => {
    setStatuses(p => ({ ...p, [key]: st }));
    if (name) setLoadedNames(p => ({ ...p, [key]: name }));
  };

  const handleFile = useCallback((key, file) => {
    setStatus(key, 'loading');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      try {
        if (key === 'edb') loadEDB(text, file.name);
        else if (key === 'fac') loadFactionsFile(text);
        else if (key === 'res') loadResourcesFile(text);
        else if (key === 'ev') loadEventsFile(text);
        else if (key === 'unit') loadUnitsFile(text);
        setStatus(key, 'ok', file.name);
      } catch {
        setStatus(key, 'error');
      }
    };
    reader.readAsText(file);
  }, [loadEDB, loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile]);

  const handleDataFolder = (e) => {
    const files = Array.from(e.target.files || []);
    const nameMap = {
      'export_descr_buildings.txt': 'edb',
      'descr_sm_factions.txt': 'fac',
      'descr_sm_resources.txt': 'res',
      'export_descr_unit.txt': 'unit',
    };
    for (const file of files) {
      const key = nameMap[file.name.toLowerCase()];
      if (key) handleFile(key, file);
    }
    e.target.value = '';
  };

  const handleCampaignFolder = (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.name.toLowerCase() === 'descr_events.txt') handleFile('ev', file);
    }
    e.target.value = '';
  };

  const allRequired = statuses['edb'] === 'ok';

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Swords className="w-3 h-3" />
            Medieval II: Total War Modding Tool
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3 tracking-tight">EDB Building Editor</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Load your M2TW data folder to automatically pick up all required files, then open the editor to start modding.
          </p>
        </div>

        {/* Folder shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mx-auto">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Load M2TW /data folder</h3>
              <p className="text-[10px] text-muted-foreground">Auto-picks EDB, factions, resources & units</p>
            </div>
            <label className="cursor-pointer">
              <input ref={folderRef} type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={handleDataFolder} />
              <Button size="sm" className="pointer-events-none text-xs">
                <FolderOpen className="w-3 h-3 mr-1.5" /> Select /data Folder
              </Button>
            </label>
          </div>

          <div className="rounded-xl border-2 border-dashed border-border bg-card/50 p-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mx-auto">
              <Castle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Load Campaign Folder</h3>
              <p className="text-[10px] text-muted-foreground">Picks up descr_events.txt (default: /imperial_campaign)</p>
            </div>
            <label className="cursor-pointer">
              <input ref={campaignFolderRef} type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={handleCampaignFolder} />
              <Button variant="outline" size="sm" className="pointer-events-none text-xs">
                <FolderOpen className="w-3 h-3 mr-1.5" /> Select Campaign Folder
              </Button>
            </label>
          </div>
        </div>

        {/* Individual file cards */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Individual Files</h3>
          <div className="space-y-2">
            {[...FILE_DEFS, ...CAMPAIGN_FILES].map(def => (
              <FileCard key={def.key} def={def} status={statuses[def.key]} onLoad={(f) => handleFile(def.key, f)} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center pt-2">
          {allRequired ? (
            <Button size="lg" onClick={() => navigate(createPageUrl('EDBEditor'))}>
              Open Editor <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              Load the EDB file above to unlock the editor
            </p>
          )}
        </div>

        {edbData && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <div className="text-xs text-foreground">
              <span className="font-semibold">{loadedNames['edb'] || 'EDB'}</span> loaded —{' '}
              <span className="text-green-400">{edbData.buildings.length} buildings</span>,{' '}
              <span className="text-muted-foreground">{edbData.hiddenResources.length} hidden resources</span>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => navigate(createPageUrl('EDBEditor'))}>
              Edit <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}