import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, CheckCircle2, XCircle, FileText, Image, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

// Categories of files found in the data folder
const CATEGORY_LABELS = {
  text: { label: 'Game Data Files', defaultOn: true, icon: FileText },
  images_ui: { label: 'UI Images (ui\\)', defaultOn: false, icon: Image },
  images_terrain: { label: 'Terrain Textures', defaultOn: false, icon: Image },
  campaign: { label: 'Campaign Map Files', defaultOn: true, icon: FileText },
  strings_bin: { label: 'Strings (.bin)', defaultOn: true, icon: FileText },
};

// Known text file names
const TEXT_FILENAMES = new Set([
  'export_descr_buildings.txt','descr_sm_factions.txt','descr_sm_resources.txt',
  'export_descr_unit.txt','descr_events.txt','export_buildings.txt',
  'export_descr_character_traits.txt','export_descr_ancillaries.txt','export_units.txt',
  'descr_cultures.txt','descr_names.txt','descr_rebel_factions.txt','descr_religions.txt',
  'battle_models.modeldb','descr_skeleton.txt','descr_mount.txt',
  'descr_aerial_map_ground_types.txt','descr_strat.txt','descr_regions.txt',
  'descr_mercenaries.txt','descr_win_conditions.txt','campaign_script.txt',
  'descr_event.txt','descr_sounds_music_types.txt','descr_terrain.txt',
]);

function categorizeFile(file) {
  const name = file.name.toLowerCase();
  const path = (file.webkitRelativePath || file.name).toLowerCase().replace(/\\/g, '/');

  if (name.endsWith('.strings.bin') || (name.endsWith('.bin') && path.includes('/text/'))) {
    return 'strings_bin';
  }
  if (name.endsWith('.tga')) {
    if (path.includes('/terrain/')) return 'images_terrain';
    return 'images_ui';
  }
  if (TEXT_FILENAMES.has(name)) {
    if (path.includes('/maps/campaign/')) return 'campaign';
    return 'text';
  }
  return null; // skip
}

function summarizeFiles(files) {
  const byCategory = {};
  for (const file of files) {
    const cat = categorizeFile(file);
    if (!cat) continue;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(file);
  }
  return byCategory;
}

// Detect campaign folders from the file list
function detectCampaignFolders(files) {
  const folders = new Set();
  for (const file of files) {
    const path = (file.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
    const match = path.match(/\/maps\/campaign\/([^/]+)\//);
    if (match) folders.add(match[1]);
  }
  return [...folders];
}

export default function DataFolderPicker({ onLoad, loading }) {
  const inputRef = useRef();
  const [scanned, setScanned] = useState(null); // { byCategory, allFiles, campaignFolders }
  const [checked, setChecked] = useState({});
  const [expanded, setExpanded] = useState({});
  const [selectedCampaigns, setSelectedCampaigns] = useState(new Set());

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const byCategory = summarizeFiles(files);
    const campaignFolders = detectCampaignFolders(files);

    // Default checks
    const initChecked = {};
    for (const [cat, catFiles] of Object.entries(byCategory)) {
      initChecked[cat] = CATEGORY_LABELS[cat]?.defaultOn ?? true;
    }
    setChecked(initChecked);
    setScanned({ byCategory, allFiles: files, campaignFolders });
    // Default: select all campaign folders
    setSelectedCampaigns(new Set(campaignFolders));
    setExpanded({});
  };

  const toggleCat = (cat) => setChecked(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleExpand = (cat) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleCampaign = (name) => setSelectedCampaigns(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const handleConfirm = () => {
    if (!scanned) return;
    // Build filtered file list
    const toLoad = [];
    for (const [cat, files] of Object.entries(scanned.byCategory)) {
      if (!checked[cat]) continue;
      if (cat === 'campaign') {
        // Only include files from selected campaign folders
        for (const file of files) {
          const path = (file.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
          const match = path.match(/\/maps\/campaign\/([^/]+)\//);
          if (match && selectedCampaigns.has(match[1])) toLoad.push(file);
        }
      } else {
        toLoad.push(...files);
      }
    }
    onLoad(toLoad, scanned.campaignFolders, [...selectedCampaigns]);
  };

  const totalSelected = scanned
    ? Object.entries(scanned.byCategory).reduce((s, [cat, files]) => {
        if (!checked[cat]) return s;
        if (cat === 'campaign') {
          return s + files.filter(f => {
            const path = (f.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
            const m = path.match(/\/maps\/campaign\/([^/]+)\//);
            return m && selectedCampaigns.has(m[1]);
          }).length;
        }
        return s + files.length;
      }, 0)
    : 0;

  return (
    <div className="space-y-3">
      {/* Browse button */}
      <label className="cursor-pointer">
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

      {/* Hint before scan */}
      {!scanned && (
        <p className="text-[10px] text-muted-foreground text-center">
          After selecting the folder, a checklist will appear so you can choose what to load.
        </p>
      )}

      {/* File list with checkboxes */}
      {scanned && (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="px-3 py-2 border-b border-border bg-accent/10 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground">
              {scanned.allFiles.length} files detected — select what to load
            </span>
            <span className="text-[10px] text-muted-foreground">{totalSelected} selected</span>
          </div>

          <div className="divide-y divide-border">
            {Object.entries(CATEGORY_LABELS).map(([cat, meta]) => {
              const files = scanned.byCategory[cat];
              if (!files || files.length === 0) return null;
              const Icon = meta.icon;
              const isOn = !!checked[cat];
              const isExp = !!expanded[cat];

              return (
                <div key={cat}>
                  {/* Category row */}
                  <div className="flex items-center gap-2 px-3 py-2 hover:bg-accent/5">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggleCat(cat)}
                      className="accent-primary w-3.5 h-3.5 shrink-0"
                    />
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isOn ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs flex-1 font-medium ${isOn ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {meta.label}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4">{files.length}</Badge>
                    {!meta.defaultOn && (
                      <span className="text-[9px] text-amber-400 font-medium">large</span>
                    )}
                    <button onClick={() => toggleExpand(cat)} className="text-muted-foreground hover:text-foreground ml-1">
                      {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Expanded file list */}
                  {isExp && (
                    <div className="bg-accent/5 px-5 py-1.5 space-y-0.5 max-h-40 overflow-y-auto">
                      {cat === 'campaign' && scanned.campaignFolders.length > 0 ? (
                        // Show campaign sub-folder selection
                        <div className="space-y-1 py-1">
                          <p className="text-[10px] text-muted-foreground mb-1">Campaign folders found:</p>
                          {scanned.campaignFolders.map(name => (
                            <label key={name} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedCampaigns.has(name)}
                                onChange={() => toggleCampaign(name)}
                                className="accent-primary w-3 h-3"
                              />
                              <span className="text-[11px] font-mono text-foreground">{name}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {files.filter(f => (f.webkitRelativePath || '').toLowerCase().includes(`/${name}/`)).length} files
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        files.map((f, i) => (
                          <p key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                            {f.webkitRelativePath || f.name}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Campaign folder selector (always visible if campaigns detected) */}
          {scanned.campaignFolders.length > 0 && !expanded['campaign'] && (
            <div className="px-3 py-2 border-t border-border bg-accent/5">
              <p className="text-[10px] text-muted-foreground mb-1.5">
                <span className="font-semibold text-foreground">{scanned.campaignFolders.length}</span> campaign folder(s) detected:
              </p>
              <div className="flex flex-wrap gap-2">
                {scanned.campaignFolders.map(name => (
                  <label key={name} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCampaigns.has(name)}
                      onChange={() => toggleCampaign(name)}
                      disabled={!checked['campaign']}
                      className="accent-primary w-3 h-3"
                    />
                    <span className={`text-[11px] font-mono ${checked['campaign'] ? 'text-foreground' : 'text-muted-foreground'}`}>{name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Load button */}
          <div className="px-3 py-2 border-t border-border bg-accent/10">
            <Button
              className="w-full h-9 gap-2 text-xs"
              onClick={handleConfirm}
              disabled={loading || totalSelected === 0}
            >
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading files…</>
                : <><CheckCircle2 className="w-3.5 h-3.5" /> Load {totalSelected} selected files</>
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}