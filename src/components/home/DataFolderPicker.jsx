import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, CheckCircle2, XCircle, FileText, Image, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

const CATEGORY_LABELS = {
  text:           { label: 'Game Data Files',         defaultOn: true,  icon: FileText },
  images_ui:      { label: 'UI Images (data/ui/)',     defaultOn: false, icon: Image },
  images_terrain: { label: 'Terrain Textures',         defaultOn: false, icon: Image },
  campaign:       { label: 'Campaign Map Files',       defaultOn: true,  icon: FileText },
  strings_bin:    { label: 'Strings (.bin)',           defaultOn: true,  icon: FileText },
};

const TEXT_FILENAMES = new Set([
  'export_descr_buildings.txt','descr_sm_factions.txt','descr_sm_resources.txt',
  'export_descr_unit.txt','descr_events.txt','export_buildings.txt',
  'export_descr_character_traits.txt','export_descr_ancillaries.txt','export_units.txt',
  'descr_cultures.txt','descr_names.txt','descr_rebel_factions.txt','descr_religions.txt',
  'export_descr_guilds.txt','battle_models.modeldb','descr_skeleton.txt','descr_mount.txt',
  'descr_aerial_map_ground_types.txt','descr_strat.txt','descr_regions.txt',
  'descr_mercenaries.txt','descr_win_conditions.txt','campaign_script.txt',
  'descr_event.txt','descr_sounds_music_types.txt','descr_terrain.txt',
]);

function categorizeFile(file) {
  const name = file.name.toLowerCase();
  const path = (file.webkitRelativePath || file.name).toLowerCase().replace(/\\/g, '/');

  // Strings .bin
  if (name.endsWith('.strings.bin') || (name.endsWith('.bin') && path.includes('/text/'))) {
    return 'strings_bin';
  }

  // Campaign map files — must come BEFORE generic TGA check
  if (path.includes('/maps/campaign/') || path.includes('/maps/base/')) {
    if (name.endsWith('.tga') || name.endsWith('.txt')) return 'campaign';
    return null;
  }

  // TGA images — split between terrain and UI
  if (name.endsWith('.tga')) {
    // Must be under data/ui/ to be counted as UI
    if (!path.includes('/ui/')) return null; // skip terrain TGAs outside /ui/
    if (path.includes('/terrain/')) return 'images_terrain';
    return 'images_ui';
  }

  // Known text files
  if (TEXT_FILENAMES.has(name)) {
    return 'text';
  }

  return null;
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

// Detect direct campaign sub-folders from /maps/campaign/<name>/ (e.g. imperial_campaign)
// Returns { direct: string[], custom: string[] }
// direct = non-"custom" folders (always included, no checkbox)
// custom = sub-folders found under /maps/campaign/custom/<name>/
function detectCampaignFolders(files) {
  const direct = new Set();
  const custom = new Set();
  for (const file of files) {
    const path = (file.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
    const customMatch = path.match(/\/maps\/campaign\/custom\/([^/]+)\//);
    if (customMatch) { custom.add(customMatch[1]); continue; }
    const directMatch = path.match(/\/maps\/campaign\/([^/]+)\//);
    if (directMatch && directMatch[1] !== 'custom') direct.add(directMatch[1]);
  }
  return { direct: [...direct], custom: [...custom] };
}

// Detect UI sub-folders from /ui/<subfolder>/
function detectUiFolders(files) {
  const folders = new Set();
  for (const file of files) {
    const path = (file.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
    const match = path.match(/\/ui\/([^/]+)\//);
    if (match) folders.add(match[1]);
  }
  return [...folders];
}

export default function DataFolderPicker({ onLoad, loading }) {
  const inputRef = useRef();
  const [scanned, setScanned] = useState(null);
  const [checked, setChecked] = useState({});
  const [expanded, setExpanded] = useState({});
  // campaign folder selection
  const [selectedCampaigns, setSelectedCampaigns] = useState(new Set());
  // ui sub-folder selection
  const [selectedUiFolders, setSelectedUiFolders] = useState(new Set());
  // per-campaign-folder expand (to show files inside)
  const [expandedCampaign, setExpandedCampaign] = useState(new Set());
  const [expandedUiFolder, setExpandedUiFolder] = useState(new Set());

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const byCategory = summarizeFiles(files);
    const { direct: directCampaigns, custom: customCampaigns } = detectCampaignFolders(files);
    const uiFolders = detectUiFolders(byCategory['images_ui'] || []);

    const initChecked = {};
    for (const cat of Object.keys(byCategory)) {
      initChecked[cat] = CATEGORY_LABELS[cat]?.defaultOn ?? true;
    }
    setChecked(initChecked);
    setScanned({ byCategory, allFiles: files, directCampaigns, customCampaigns, uiFolders });
    // All campaign folders (direct + custom) start checked
    setSelectedCampaigns(new Set([...directCampaigns, ...customCampaigns]));
    setSelectedUiFolders(new Set(uiFolders));
    setExpanded({});
    setExpandedCampaign(new Set());
    setExpandedUiFolder(new Set());
  };

  const toggleCat = (cat) => setChecked(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleExpand = (cat) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));

  const toggleCampaign = (name) => setSelectedCampaigns(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const toggleUiFolder = (name) => setSelectedUiFolders(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const toggleExpandCampaign = (name) => setExpandedCampaign(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const toggleExpandUiFolder = (name) => setExpandedUiFolder(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  // Files in a direct campaign folder (e.g. imperial_campaign)
  const directCampaignFiles = (folder) => {
    if (!scanned) return [];
    return (scanned.byCategory['campaign'] || []).filter(f => {
      const path = (f.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
      return path.includes(`/campaign/${folder}/`);
    });
  };

  // Files in a custom sub-folder
  const customCampaignFiles = (folder) => {
    if (!scanned) return [];
    return (scanned.byCategory['campaign'] || []).filter(f => {
      const path = (f.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
      return path.includes(`/campaign/custom/${folder}/`);
    });
  };

  // Files in a UI sub-folder
  const uiFolderFiles = (folder) => {
    if (!scanned) return [];
    return (scanned.byCategory['images_ui'] || []).filter(f => {
      const path = (f.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
      return path.includes(`/ui/${folder}/`);
    });
  };

  const handleConfirm = () => {
    if (!scanned) return;
    const toLoad = [];
    for (const [cat, files] of Object.entries(scanned.byCategory)) {
      if (!checked[cat]) continue;
      if (cat === 'campaign') {
        for (const file of files) {
          const path = (file.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
          const customMatch = path.match(/\/maps\/campaign\/custom\/([^/]+)\//);
          if (customMatch) {
            if (selectedCampaigns.has(customMatch[1])) toLoad.push(file);
            continue;
          }
          const directMatch = path.match(/\/maps\/campaign\/([^/]+)\//);
          if (directMatch && directMatch[1] !== 'custom') {
            if (selectedCampaigns.has(directMatch[1])) toLoad.push(file);
            continue;
          }
          // base/ files always included
          toLoad.push(file);
        }
      } else if (cat === 'images_ui') {
        for (const file of files) {
          const path = (file.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
          const match = path.match(/\/ui\/([^/]+)\//);
          if (!match || selectedUiFolders.has(match[1])) toLoad.push(file);
        }
      } else {
        toLoad.push(...files);
      }
    }
    onLoad(toLoad, [...(scanned.directCampaigns || []), ...(scanned.customCampaigns || [])], [...selectedCampaigns]);
  };

  const countSelected = () => {
    if (!scanned) return 0;
    let s = 0;
    for (const [cat, files] of Object.entries(scanned.byCategory)) {
      if (!checked[cat]) continue;
      if (cat === 'campaign') {
        s += files.filter(f => {
          const path = (f.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
          const customMatch = path.match(/\/maps\/campaign\/custom\/([^/]+)\//);
          if (customMatch) return selectedCampaigns.has(customMatch[1]);
          const directMatch = path.match(/\/maps\/campaign\/([^/]+)\//);
          if (directMatch && directMatch[1] !== 'custom') return selectedCampaigns.has(directMatch[1]);
          return true; // base/ files always counted
        }).length;
      } else if (cat === 'images_ui') {
        s += files.filter(f => {
          const path = (f.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/');
          const m = path.match(/\/ui\/([^/]+)\//);
          return !m || selectedUiFolders.has(m[1]);
        }).length;
      } else {
        s += files.length;
      }
    }
    return s;
  };

  const totalSelected = countSelected();

  return (
    <div className="space-y-3">
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

      {!scanned && (
        <p className="text-[10px] text-muted-foreground text-center">
          After selecting the folder, a checklist will appear so you can choose what to load.
        </p>
      )}

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
                  {/* Category header row */}
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

                  {/* Expanded content */}
                  {isExp && (
                    <div className="bg-accent/5 px-4 py-2 space-y-1 max-h-64 overflow-y-auto">

                      {/* Campaign: base + direct (always on, expandable) + custom sub-folders (checkboxes) */}
                      {cat === 'campaign' ? (
                        <div className="space-y-1">
                          {/* Base map files — always included */}
                          {(() => {
                            const baseFiles = (scanned.byCategory['campaign'] || []).filter(f =>
                              (f.webkitRelativePath || '').toLowerCase().replace(/\\/g, '/').includes('/maps/base/')
                            );
                            if (baseFiles.length === 0) return null;
                            const isExp = expandedCampaign.has('__base__');
                            return (
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 shrink-0" />
                                  <span className="text-[11px] font-mono text-foreground flex-1">maps/base/</span>
                                  <span className="text-[9px] text-green-400 font-medium">always</span>
                                  <span className="text-[10px] text-muted-foreground">{baseFiles.length} files</span>
                                  <button onClick={() => toggleExpandCampaign('__base__')} className="text-muted-foreground hover:text-foreground">
                                    {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>
                                </div>
                                {isExp && (
                                  <div className="ml-5 mt-1 space-y-0.5">
                                    {baseFiles.map((f, i) => <p key={i} className="text-[10px] font-mono text-muted-foreground truncate">{f.name}</p>)}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Direct campaign folders (e.g. imperial_campaign) — checkboxes */}
                          {scanned.directCampaigns.map(folder => {
                            const folderFiles = directCampaignFiles(folder);
                            const isExp = expandedCampaign.has(folder);
                            return (
                              <div key={folder}>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedCampaigns.has(folder)}
                                    onChange={() => toggleCampaign(folder)}
                                    className="accent-primary w-3 h-3 shrink-0"
                                  />
                                  <span className="text-[11px] font-mono text-foreground flex-1">{folder}/</span>
                                  <span className="text-[10px] text-muted-foreground">{folderFiles.length} files</span>
                                  <button onClick={() => toggleExpandCampaign(folder)} className="text-muted-foreground hover:text-foreground">
                                    {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>
                                </div>
                                {isExp && (
                                  <div className="ml-5 mt-1 space-y-0.5">
                                    {folderFiles.map((f, i) => <p key={i} className="text-[10px] font-mono text-muted-foreground truncate">{f.name}</p>)}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Custom sub-folders — individually selectable */}
                          {scanned.customCampaigns.length > 0 && (
                            <>
                              <p className="text-[10px] text-muted-foreground pt-1 pb-0.5 border-t border-border mt-1">custom/ sub-folders — select to include:</p>
                              {scanned.customCampaigns.map(folder => {
                                const folderFiles = customCampaignFiles(folder);
                                const isExp = expandedCampaign.has(`custom:${folder}`);
                                return (
                                  <div key={folder}>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedCampaigns.has(folder)}
                                        onChange={() => toggleCampaign(folder)}
                                        className="accent-primary w-3 h-3 shrink-0"
                                      />
                                      <span className="text-[11px] font-mono text-foreground flex-1">custom/{folder}/</span>
                                      <span className="text-[10px] text-muted-foreground">{folderFiles.length} files</span>
                                      <button onClick={() => toggleExpandCampaign(`custom:${folder}`)} className="text-muted-foreground hover:text-foreground">
                                        {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      </button>
                                    </div>
                                    {isExp && (
                                      <div className="ml-5 mt-1 space-y-0.5">
                                        {folderFiles.map((f, i) => <p key={i} className="text-[10px] font-mono text-muted-foreground truncate">{f.name}</p>)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>

                      /* UI images: show sub-folder checkboxes with file lists */
                      ) : cat === 'images_ui' && scanned.uiFolders.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground mb-1.5">Select UI sub-folders to include:</p>
                          {scanned.uiFolders.map(folder => {
                            const folderFiles = uiFolderFiles(folder);
                            const isFolderExp = expandedUiFolder.has(folder);
                            return (
                              <div key={folder}>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedUiFolders.has(folder)}
                                    onChange={() => toggleUiFolder(folder)}
                                    className="accent-primary w-3 h-3 shrink-0"
                                  />
                                  <span className="text-[11px] font-mono text-foreground flex-1">ui/{folder}/</span>
                                  <span className="text-[10px] text-muted-foreground">{folderFiles.length} files</span>
                                  <button onClick={() => toggleExpandUiFolder(folder)} className="text-muted-foreground hover:text-foreground">
                                    {isFolderExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>
                                </div>
                                {isFolderExp && (
                                  <div className="ml-5 mt-1 space-y-0.5">
                                    {folderFiles.map((f, i) => (
                                      <p key={i} className="text-[10px] font-mono text-muted-foreground truncate">{f.name}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                      /* Default: flat file list */
                      ) : (
                        files.map((f, i) => (
                          <p key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                            {f.name}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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