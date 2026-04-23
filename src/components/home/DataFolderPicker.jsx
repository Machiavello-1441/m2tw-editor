import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FolderOpen, CheckCircle2, XCircle, FileText, Image, Map, Archive, Loader2, ChevronDown, ChevronRight, Square, CheckSquare } from 'lucide-react';

// ─── Category definitions ───────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'text',
    label: 'Game Data Files',
    icon: FileText,
    desc: 'Core mod data text files',
    defaultOn: true,
    match: (name, path) => {
      const TEXT = new Set([
        'export_descr_buildings.txt','descr_sm_factions.txt','descr_sm_resources.txt',
        'export_descr_unit.txt','export_buildings.txt','export_descr_character_traits.txt',
        'export_descr_ancillaries.txt','export_units.txt','descr_cultures.txt',
        'descr_names.txt','descr_rebel_factions.txt','descr_religions.txt',
        'battle_models.modeldb','descr_skeleton.txt','descr_mount.txt',
        'descr_aerial_map_ground_types.txt','descr_events.txt',
      ]);
      return TEXT.has(name) && !path.includes('/maps/');
    },
  },
  {
    id: 'ui_images',
    label: 'UI Images',
    icon: Image,
    desc: 'data\\ui\\ — ancillaries, units, buildings, resources',
    defaultOn: true,
    match: (name, path) => name.endsWith('.tga') && path.includes('/ui/'),
  },
  {
    id: 'terrain',
    label: 'Terrain Textures',
    icon: Image,
    desc: 'data\\terrain\\aerial_map\\ground_types\\',
    defaultOn: false,
    match: (name, path) => name.endsWith('.tga') && path.includes('/terrain/'),
  },
  {
    id: 'campaign',
    label: 'Campaign Map Files',
    icon: Map,
    desc: 'data\\world\\maps\\ — strat, regions, TGAs',
    defaultOn: true,
    match: (name, path) => {
      const CAMP_TXT = new Set([
        'descr_strat.txt','descr_regions.txt','descr_mercenaries.txt',
        'descr_win_conditions.txt','campaign_script.txt','descr_event.txt',
        'descr_events.txt','descr_sounds_music_types.txt','descr_terrain.txt',
      ]);
      return path.includes('/maps/') && (name.endsWith('.tga') || CAMP_TXT.has(name));
    },
  },
  {
    id: 'strings',
    label: 'Strings (.bin)',
    icon: Archive,
    desc: 'data\\text\\*.strings.bin — localisation, settlement names, VnVs…',
    defaultOn: true,
    match: (name, path) => name.endsWith('.strings.bin') || (name.endsWith('.bin') && path.includes('/text/')),
  },
];

function categorize(files) {
  const byId = {};
  for (const cat of CATEGORIES) byId[cat.id] = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    const path = (file.webkitRelativePath || file.name).toLowerCase().replace(/\\/g, '/');
    for (const cat of CATEGORIES) {
      if (cat.match(name, path)) {
        byId[cat.id].push(file);
        break;
      }
    }
  }
  return byId;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FileRow({ file, checked, onChange, status }) {
  const name = file.webkitRelativePath || file.name;
  const short = file.name;

  const statusEl = status === 'ok'
    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
    : status === 'error'
    ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
    : status === 'loading'
    ? <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
    : null;

  const rowBg = status === 'ok'
    ? 'bg-green-500/5 border-green-500/20'
    : status === 'error'
    ? 'bg-destructive/5 border-destructive/20'
    : 'border-transparent';

  return (
    <label className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer hover:bg-accent/10 border ${rowBg} transition-colors`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-primary w-3 h-3 shrink-0"
        disabled={!!status}
      />
      <span className={`text-[11px] font-mono flex-1 truncate ${status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
        title={name}>
        {short}
      </span>
      {statusEl}
    </label>
  );
}

function CategoryBlock({ cat, files, checkedFiles, onToggleFile, onToggleAll, expanded, onToggleExpand, fileStatuses, catOn, onToggleCat }) {
  const Icon = cat.icon;
  const anyOn = files.some(f => checkedFiles.has(f.name));
  const allOn = files.every(f => checkedFiles.has(f.name));
  const doneCount = files.filter(f => fileStatuses[f.name] === 'ok').length;
  const errCount = files.filter(f => fileStatuses[f.name] === 'error').length;
  const hasStatus = doneCount + errCount > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 bg-accent/10 cursor-pointer select-none`}
        onClick={onToggleExpand}>
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={e => { e.stopPropagation(); onToggleExpand(); }}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <button
          className="shrink-0"
          onClick={e => { e.stopPropagation(); onToggleAll(!allOn); }}
        >
          {allOn
            ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
            : anyOn
            ? <CheckSquare className="w-3.5 h-3.5 text-primary opacity-50" />
            : <Square className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{cat.label}</p>
          <p className="text-[10px] text-muted-foreground truncate">{cat.desc}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasStatus && doneCount > 0 && (
            <span className="text-[10px] text-green-400 font-medium">{doneCount} ok</span>
          )}
          {hasStatus && errCount > 0 && (
            <span className="text-[10px] text-destructive font-medium">{errCount} err</span>
          )}
          <span className="text-[10px] text-muted-foreground">{files.length} files</span>
        </div>
      </div>

      {/* File list */}
      {expanded && (
        <div className="p-1.5 space-y-0.5 max-h-48 overflow-y-auto bg-background/50">
          {files.map(file => (
            <FileRow
              key={file.name + file.webkitRelativePath}
              file={file}
              checked={checkedFiles.has(file.name)}
              onChange={() => onToggleFile(file)}
              status={fileStatuses[file.name]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function DataFolderPicker({ onLoad, loading, fileStatuses = {} }) {
  const inputRef = useRef();
  const [byCategory, setByCategory] = useState(null); // { id -> File[] }
  const [checkedFiles, setCheckedFiles] = useState(new Set()); // by file.name
  const [expanded, setExpanded] = useState({});

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const grouped = categorize(files);
    setByCategory(grouped);

    // Default-check files for categories that are defaultOn
    const initChecked = new Set();
    for (const cat of CATEGORIES) {
      if (cat.defaultOn) {
        for (const f of grouped[cat.id] || []) initChecked.add(f.name);
      }
    }
    setCheckedFiles(initChecked);
    // Default: expand all categories that have files
    const initExpanded = {};
    for (const cat of CATEGORIES) {
      if ((grouped[cat.id] || []).length > 0) initExpanded[cat.id] = true;
    }
    setExpanded(initExpanded);
  };

  const toggleFile = (file) => {
    setCheckedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file.name)) next.delete(file.name); else next.add(file.name);
      return next;
    });
  };

  const toggleAll = (catId, on) => {
    const files = byCategory?.[catId] || [];
    setCheckedFiles(prev => {
      const next = new Set(prev);
      for (const f of files) { on ? next.add(f.name) : next.delete(f.name); }
      return next;
    });
  };

  const toggleExpand = (catId) => setExpanded(prev => ({ ...prev, [catId]: !prev[catId] }));

  const handleLoad = () => {
    if (!byCategory) return;
    const toLoad = [];
    for (const cat of CATEGORIES) {
      for (const f of byCategory[cat.id] || []) {
        if (checkedFiles.has(f.name)) toLoad.push(f);
      }
    }
    onLoad(toLoad);
  };

  const selectedCount = byCategory
    ? CATEGORIES.reduce((s, cat) => s + (byCategory[cat.id] || []).filter(f => checkedFiles.has(f.name)).length, 0)
    : 0;

  const hasAny = byCategory && CATEGORIES.some(c => (byCategory[c.id] || []).length > 0);
  const allLoaded = byCategory && CATEGORIES.every(c =>
    (byCategory[c.id] || []).every(f => !checkedFiles.has(f.name) || fileStatuses[f.name] === 'ok' || fileStatuses[f.name] === 'error')
  );

  return (
    <div className="space-y-3">
      {/* Browse button — always shown */}
      <label className="cursor-pointer block">
        <input ref={inputRef} type="file" className="hidden"
          webkitdirectory="" directory="" multiple onChange={handleFolderSelect} />
        <Button asChild variant="outline"
          className="w-full h-11 border-primary/30 text-primary hover:bg-primary/10 pointer-events-none gap-2">
          <span>
            <FolderOpen className="w-4 h-4" />
            Browse to <code className="text-xs font-mono">…\data\</code> folder
          </span>
        </Button>
      </label>

      {!hasAny && (
        <p className="text-[10px] text-muted-foreground text-center">
          Select your mod's <code className="font-mono bg-accent px-1 rounded">data\</code> folder — a checklist of all recognised files will appear.
        </p>
      )}

      {/* Category blocks */}
      {hasAny && (
        <div className="space-y-2">
          {CATEGORIES.map(cat => {
            const files = byCategory[cat.id] || [];
            if (!files.length) return null;
            return (
              <CategoryBlock
                key={cat.id}
                cat={cat}
                files={files}
                checkedFiles={checkedFiles}
                onToggleFile={toggleFile}
                onToggleAll={(on) => toggleAll(cat.id, on)}
                expanded={!!expanded[cat.id]}
                onToggleExpand={() => toggleExpand(cat.id)}
                fileStatuses={fileStatuses}
                catOn={files.some(f => checkedFiles.has(f.name))}
                onToggleCat={() => {}}
              />
            );
          })}

          {/* Load button */}
          <Button
            className="w-full h-10 gap-2 text-sm mt-1"
            onClick={handleLoad}
            disabled={loading || selectedCount === 0}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading files…</>
              : <><CheckCircle2 className="w-4 h-4" /> Load {selectedCount} selected files</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}