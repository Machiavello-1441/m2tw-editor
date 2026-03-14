import React, { useState, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import {
  Plus, Copy, Trash2, Download, FolderOpen, Globe2,
  FileText, CheckCircle2, AlertCircle, Edit2, ChevronRight,
  Map, Settings, Info, Wand2, Loader2
} from 'lucide-react';
import JSZip from 'jszip';
import CampaignEditor from '../components/campaigns/CampaignEditor';
import CampaignDescriptionsEditor from '../components/campaigns/CampaignDescriptionsEditor';

const STORAGE_KEY = 'm2tw_campaigns';

function loadCampaigns() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

function saveCampaigns(campaigns) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns)); } catch {}
}

const DEFAULT_DESCR_STRAT = (name) => `; Campaign script for ${name}
campaign        ${name}

;;; --- Factions ---
;;; Define playable factions here

;;; --- Starting positions ---
;;; Define starting positions and settlements here
`;

const DEFAULT_CAMPAIGN_DESCR_STRINGS = (upperName) => `{${upperName}_TITLE}${upperName.replace(/_/g, ' ')}
{${upperName}_DESCRIPTION}A new campaign for Medieval 2: Total War.
`;

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState(loadCampaigns);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'descr_strat' | 'descriptions'
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState('scratch'); // 'scratch' | 'duplicate'
  const [duplicateFrom, setDuplicateFrom] = useState('');
  const [buildingZip, setBuildingZip] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  const campaign = campaigns.find(c => c.id === selected) || null;

  const update = useCallback((id, updater) => {
    setCampaigns(prev => {
      const next = prev.map(c => c.id === id ? (typeof updater === 'function' ? updater(c) : { ...c, ...updater }) : c);
      saveCampaigns(next);
      return next;
    });
  }, []);

  const handleCreate = () => {
    const trimmed = newName.trim().replace(/\s+/g, '_').toLowerCase();
    if (!trimmed) return;
    let base = {
      id: `campaign_${Date.now()}`,
      name: trimmed,
      displayName: newName.trim(),
      description: '',
      descrStrat: DEFAULT_DESCR_STRAT(trimmed),
      descriptions: DEFAULT_CAMPAIGN_DESCR_STRINGS(trimmed.toUpperCase()),
      settings: {
        type: 'custom', // 'custom' | 'imperial_clone'
        playableFactions: [],
        startYear: 1080,
        seasons: true,
      }
    };
    if (newMode === 'duplicate' && duplicateFrom) {
      const src = campaigns.find(c => c.id === duplicateFrom);
      if (src) {
        base = {
          ...src,
          id: `campaign_${Date.now()}`,
          name: trimmed,
          displayName: newName.trim(),
          descrStrat: src.descrStrat.replace(new RegExp(src.name, 'g'), trimmed),
          descriptions: DEFAULT_CAMPAIGN_DESCR_STRINGS(trimmed.toUpperCase()),
        };
      }
    }
    const next = [...campaigns, base];
    setCampaigns(next);
    saveCampaigns(next);
    setSelected(base.id);
    setShowNewDialog(false);
    setNewName('');
  };

  const handleDelete = (id) => {
    const next = campaigns.filter(c => c.id !== id);
    setCampaigns(next);
    saveCampaigns(next);
    if (selected === id) setSelected(null);
  };

  const handleExport = async (id) => {
    const c = campaigns.find(x => x.id === id);
    if (!c) return;
    setBuildingZip(true);
    const zip = new JSZip();
    const modName = (() => { try { return localStorage.getItem('m2tw_mod_name') || 'my_mod'; } catch { return 'my_mod'; } })();

    // Campaign folder structure as per TWCenter tutorial
    const campFolder = zip.folder(`${modName}/data/world/maps/campaign/custom/${c.name}`);
    campFolder.file('descr_strat.txt', c.descrStrat || DEFAULT_DESCR_STRAT(c.name));

    // campaign_descriptions.txt
    const textFolder = zip.folder(`${modName}/data/text`);
    textFolder.file('campaign_descriptions.txt', `¬\n${c.descriptions || DEFAULT_CAMPAIGN_DESCR_STRINGS(c.name.toUpperCase())}`);

    // README instructions
    zip.file('_INSTALL_INSTRUCTIONS.txt',
      `Campaign: ${c.displayName}\n\n` +
      `1. Copy the '${modName}' folder into your Medieval 2: Total War 'mods' directory.\n` +
      `2. Make sure your mod's cfg file has the correct settings.\n` +
      `3. The campaign folder goes to:\n   data/world/maps/campaign/custom/${c.name}/\n\n` +
      `Note: You also need to copy map TGA files and other assets into the campaign folder.\n` +
      `See: https://www.twcenter.net/threads/how-to-add-multiple-campaigns-aka-provincial-campaigns.93141/\n`
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_${c.name}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setBuildingZip(false);
  };

  const handleAiHelp = async () => {
    if (!campaign) return;
    setAiLoading(true);
    setAiSuggestion('');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert Medieval 2: Total War modder. Generate a well-structured descr_strat.txt file for a campaign named "${campaign.name}" (display name: "${campaign.displayName}"). 
Description: ${campaign.description || 'A custom campaign'}
Start year: ${campaign.settings?.startYear || 1080}

Include:
- campaign declaration line
- A few example faction entries with starting positions
- Example settlement entries 
- Comments explaining key sections

Keep it concise but functional. Use proper M2TW syntax.`,
      });
      setAiSuggestion(typeof result === 'string' ? result : result?.text || '');
    } catch (e) {
      setAiSuggestion('-- AI generation failed. Please try again.');
    }
    setAiLoading(false);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
        <Globe2 className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground">Campaign Manager</span>
        <span className="text-[10px] text-muted-foreground">— Multiple / Provincial Campaigns</span>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => setShowNewDialog(true)}>
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-52 border-r border-border shrink-0 flex flex-col bg-card/30">
          <div className="p-2 border-b border-border">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1">Campaigns ({campaigns.length})</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1 space-y-0.5">
              {campaigns.length === 0 && (
                <div className="p-4 text-center">
                  <Globe2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground">No campaigns yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Click "+ New Campaign" to start</p>
                </div>
              )}
              {campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors flex items-center gap-2 group ${selected === c.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                >
                  <Globe2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 truncate font-medium">{c.displayName || c.name}</span>
                  <ChevronRight className={`w-3 h-3 shrink-0 transition-opacity ${selected === c.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Quick export all */}
          {campaigns.length > 0 && (
            <div className="p-2 border-t border-border">
              <p className="text-[9px] text-muted-foreground text-center">Click a campaign to edit & export</p>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {!campaign ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <Globe2 className="w-12 h-12 text-muted-foreground/20" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">No Campaign Selected</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Create a new campaign or select one from the sidebar.<br/>
                  Each campaign generates its own <code className="font-mono text-[10px] bg-accent px-1 rounded">descr_strat.txt</code> and goes in{' '}
                  <code className="font-mono text-[10px] bg-accent px-1 rounded">data/world/maps/campaign/custom/</code>
                </p>
              </div>
              <Button onClick={() => setShowNewDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Create First Campaign
              </Button>
              <div className="mt-4 p-3 bg-accent/20 rounded-lg border border-border text-left max-w-sm">
                <p className="text-[11px] font-semibold text-foreground mb-1 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-primary" /> How Multiple Campaigns Work</p>
                <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc ml-3">
                  <li>Create a subfolder under <code className="font-mono bg-accent px-0.5 rounded">campaign/custom/</code></li>
                  <li>Copy <code className="font-mono bg-accent px-0.5 rounded">base/</code> + <code className="font-mono bg-accent px-0.5 rounded">imperial_campaign/</code> map TGAs into it</li>
                  <li>Edit <code className="font-mono bg-accent px-0.5 rounded">descr_strat.txt</code> campaign name</li>
                  <li>Add strings to <code className="font-mono bg-accent px-0.5 rounded">campaign_descriptions.txt</code></li>
                  <li>Enable via main menu unlock in <code className="font-mono bg-accent px-0.5 rounded">descr_menu_campaigns.txt</code></li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {/* Campaign header */}
              <div className="border-b border-border bg-card/20 px-4 py-3 flex items-center gap-3 shrink-0">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{campaign.displayName}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">data/world/maps/campaign/custom/{campaign.name}/</p>
                </div>
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[11px] gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => handleDelete(campaign.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
                <Button
                  size="sm" className="h-7 text-[11px] gap-1.5"
                  onClick={() => handleExport(campaign.id)}
                  disabled={buildingZip}
                >
                  {buildingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Export ZIP
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-0 border-b border-border shrink-0 px-3 h-9">
                {[
                  { id: 'settings', label: 'Settings', icon: Settings },
                  { id: 'descr_strat', label: 'descr_strat.txt', icon: FileText },
                  { id: 'descriptions', label: 'campaign_descriptions.txt', icon: Globe2 },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                      <Icon className="w-3.5 h-3.5" />{tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="flex-1 min-h-0 overflow-auto">
                {activeTab === 'settings' && (
                  <CampaignEditor
                    campaign={campaign}
                    onChange={(updater) => update(campaign.id, updater)}
                  />
                )}
                {activeTab === 'descr_strat' && (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/20 shrink-0">
                      <span className="text-[10px] text-muted-foreground flex-1">Edit the campaign's descr_strat.txt — defines campaign name, factions, starting positions, and more</span>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={handleAiHelp} disabled={aiLoading}>
                        {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        AI Generate
                      </Button>
                      {aiSuggestion && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-green-400 border-green-400/30" onClick={() => {
                          update(campaign.id, { descrStrat: aiSuggestion });
                          setAiSuggestion('');
                        }}>
                          <CheckCircle2 className="w-3 h-3" /> Use AI Result
                        </Button>
                      )}
                    </div>
                    {aiSuggestion && (
                      <div className="border-b border-border p-2 bg-green-950/20 shrink-0 max-h-40 overflow-auto">
                        <p className="text-[10px] text-green-400 font-semibold mb-1">AI Generated (preview):</p>
                        <pre className="text-[10px] font-mono text-green-300/80 whitespace-pre-wrap">{aiSuggestion.slice(0, 500)}{aiSuggestion.length > 500 ? '…' : ''}</pre>
                      </div>
                    )}
                    <textarea
                      className="flex-1 bg-background font-mono text-xs text-foreground p-3 resize-none focus:outline-none border-0"
                      value={campaign.descrStrat || ''}
                      onChange={e => update(campaign.id, { descrStrat: e.target.value })}
                      spellCheck={false}
                    />
                  </div>
                )}
                {activeTab === 'descriptions' && (
                  <CampaignDescriptionsEditor
                    campaign={campaign}
                    onChange={(updater) => update(campaign.id, updater)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Campaign Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 shadow-xl">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> New Campaign
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Campaign Name (folder name)</label>
                <input
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  placeholder="my_campaign"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
                {newName && (
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    → data/world/maps/campaign/custom/{newName.trim().replace(/\s+/g, '_').toLowerCase()}/
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1.5">Creation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'scratch', icon: Globe2, label: 'From Scratch', desc: 'Blank template' },
                    { id: 'duplicate', icon: Copy, label: 'Duplicate', desc: 'Copy existing campaign' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setNewMode(m.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${newMode === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-border/60 hover:bg-accent'}`}
                    >
                      <m.icon className="w-5 h-5" />
                      <span className="text-[11px] font-medium">{m.label}</span>
                      <span className="text-[10px] opacity-70">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {newMode === 'duplicate' && campaigns.length > 0 && (
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Source Campaign</label>
                  <select
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    value={duplicateFrom}
                    onChange={e => setDuplicateFrom(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {newMode === 'duplicate' && campaigns.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No existing campaigns to duplicate. Create one from scratch first.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => { setShowNewDialog(false); setNewName(''); }}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || (newMode === 'duplicate' && !duplicateFrom)}>
                Create Campaign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}