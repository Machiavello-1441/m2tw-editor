import React, { useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useEDB } from '../components/edb/EDBContext';
import { useRefData } from '../components/edb/RefDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Upload, Castle, ArrowRight, FolderOpen, CheckCircle2, AlertCircle,
  Loader2, Sword, Users, Package, Zap, FileText
} from 'lucide-react';

const FILE_MAP = {
  'export_descr_buildings.txt': 'edb',
  'descr_sm_factions.txt': 'factions',
  'descr_sm_resources.txt': 'resources',
  'export_descr_unit.txt': 'units',
  'descr_events.txt': 'events',
};

const FILE_INFO = {
  edb:       { label: 'EDB File',   desc: 'export_descr_buildings.txt',       icon: Castle,   required: true,  hint: 'Main building database file' },
  factions:  { label: 'Factions',   desc: 'descr_sm_factions.txt',            icon: Users,    required: false, hint: 'Enables faction/culture selectors' },
  resources: { label: 'Resources',  desc: 'descr_sm_resources.txt',           icon: Package,  required: false, hint: 'Enables resource requirements' },
  units:     { label: 'Units',      desc: 'export_descr_unit.txt',            icon: Sword,    required: false, hint: 'Enables recruit pool autocomplete' },
  events:    { label: 'Events',     desc: 'descr_events.txt',                 icon: Zap,      required: false, hint: 'From campaign folder (e.g. imperial_campaign/)' },
};

export default function Home() {
  const { loadEDB, edbData } = useEDB();
  const { loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile } = useRefData();
  const navigate = useNavigate();
  const [fileStatus, setFileStatus] = useState({});
  const folderRef = useRef();
  const campaignRef = useRef();

  const setStatus = (key, status) => setFileStatus(p => ({ ...p, [key]: status }));

  const processFile = useCallback((file, key) => {
    setStatus(key, 'loading');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      try {
        if (key === 'edb')       loadEDB(text, file.name);
        else if (key === 'factions')  loadFactionsFile(text);
        else if (key === 'resources') loadResourcesFile(text);
        else if (key === 'units')     loadUnitsFile(text);
        else if (key === 'events')    loadEventsFile(text);
        setStatus(key, 'ok');
      } catch {
        setStatus(key, 'error');
      }
    };
    reader.onerror = () => setStatus(key, 'error');
    reader.readAsText(file);
  }, [loadEDB, loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile]);

  const handleFolderSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const key = FILE_MAP[file.name.toLowerCase()];
      if (key) processFile(file, key);
    }
    e.target.value = '';
  }, [processFile]);

  const handleCampaignFolder = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.name.toLowerCase() === 'descr_events.txt') {
        processFile(file, 'events');
        break;
      }
    }
    e.target.value = '';
  }, [processFile]);

  const handleSingleFile = (key) => (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file, key);
    e.target.value = '';
  };

  const isEdbLoaded = !!edbData || fileStatus.edb === 'ok';

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sword className="w-3 h-3" />
            Medieval II: Total War Modding Tool
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3 tracking-tight">M2TW Building Editor</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Load your mod's data files below. Point the editor at your <code className="bg-accent px-1 py-0.5 rounded text-[11px] font-mono">/data</code> folder to auto-import all files at once.
          </p>
        </div>

        {/* Folder Load */}
        <Card className="mb-5 border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Quick Load — Select M2TW Folders
            </h2>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Select your mod's <code className="bg-background/50 px-1 rounded font-mono text-[10px]">/data</code> folder to auto-load EDB + factions + resources + units.
              Then select your campaign folder (default: <code className="bg-background/50 px-1 rounded font-mono text-[10px]">imperial_campaign/</code>) to load events.
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="cursor-pointer">
                <input ref={folderRef} type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={handleFolderSelect} />
                <Button className="pointer-events-none gap-2">
                  <FolderOpen className="w-4 h-4" /> Select /data folder
                </Button>
              </label>
              <label className="cursor-pointer">
                <input ref={campaignRef} type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={handleCampaignFolder} />
                <Button variant="outline" className="pointer-events-none gap-2">
                  <FolderOpen className="w-4 h-4" /> Select campaign folder
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* File status cards */}
        <div className="space-y-2 mb-6">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Files</h3>
          {Object.entries(FILE_INFO).map(([key, info]) => {
            const status = fileStatus[key];
            const isLoaded = (key === 'edb' && !!edbData) || status === 'ok';
            const isError = status === 'error';
            const Icon = info.icon;
            return (
              <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                ${isLoaded ? 'border-green-500/30 bg-green-500/5' : isError ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
                  ${isLoaded ? 'bg-green-500/15' : isError ? 'bg-destructive/15' : 'bg-accent'}`}>
                  {status === 'loading'
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    : isLoaded
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      : isError
                        ? <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                        : <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-foreground">{info.label}</span>
                    {info.required && <span className="text-[9px] text-destructive font-medium">required</span>}
                    {!info.required && !isLoaded && <span className="text-[9px] text-muted-foreground">optional</span>}
                    {isLoaded && key === 'edb' && edbData && (
                      <span className="text-[9px] text-green-500">{edbData.buildings.length} buildings</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{info.desc}</p>
                  <p className="text-[10px] text-muted-foreground/60">{info.hint}</p>
                </div>
                <label className="cursor-pointer shrink-0">
                  <input type="file" accept=".txt" className="hidden" onChange={handleSingleFile(key)} />
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] pointer-events-none gap-1">
                    <Upload className="w-2.5 h-2.5" />
                    {isLoaded ? 'Reload' : 'Load'}
                  </Button>
                </label>
              </div>
            );
          })}
        </div>

        {/* Continue */}
        <div className={`text-center transition-all duration-300 ${isEdbLoaded ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <Button
            size="lg"
            className="gap-2"
            onClick={() => navigate(createPageUrl('EDBEditor'))}
            disabled={!isEdbLoaded}
          >
            Open Editor <ArrowRight className="w-4 h-4" />
          </Button>
          {isEdbLoaded ? (
            <p className="text-xs text-muted-foreground mt-2">
              EDB loaded — {Object.values(fileStatus).filter(s => s === 'ok').length} of {Object.keys(FILE_INFO).length} files ready
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">Load the EDB file to continue</p>
          )}
        </div>
      </div>
    </div>
  );
}