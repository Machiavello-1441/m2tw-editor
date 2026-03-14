import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Info, Globe2, Calendar } from 'lucide-react';

const VANILLA_FACTIONS = [
  'england','france','hre','spain','venice','sicily','milan','papal_states',
  'byzantium','russia','moors','turks','egypt','mongols','timurids','aztecs',
  'scotland','portugal','poland','hungary','denmark','norway'
];

export default function CampaignEditor({ campaign, onChange }) {
  const s = campaign.settings || {};

  const set = (key, val) => onChange(c => ({ ...c, settings: { ...c.settings, [key]: val } }));

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-5 max-w-xl">

        {/* Basic info */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-primary" /> Campaign Info
          </h3>
          <div className="grid gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Display Name</label>
              <input
                className="w-full bg-input border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={campaign.displayName || campaign.name}
                onChange={e => onChange({ displayName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Description (for campaign_descriptions.txt)</label>
              <textarea
                className="w-full bg-input border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none h-20"
                value={campaign.description || ''}
                onChange={e => onChange({ description: e.target.value })}
                placeholder="Brief description shown in the campaign selection screen…"
              />
            </div>
          </div>
        </section>

        {/* Settings */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" /> Campaign Settings
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Start Year</label>
              <input
                type="number"
                className="w-full bg-input border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={s.startYear || 1080}
                onChange={e => set('startYear', parseInt(e.target.value) || 1080)}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Campaign Type</label>
              <select
                className="w-full bg-input border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={s.type || 'custom'}
                onChange={e => set('type', e.target.value)}
              >
                <option value="custom">Custom</option>
                <option value="imperial_clone">Imperial Campaign Clone</option>
                <option value="provincial">Provincial Campaign</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">
              Seasons enabled?
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={s.seasons !== false}
                onChange={e => set('seasons', e.target.checked)}
              />
              <span className="text-xs text-foreground">Enable seasons (spring/summer/autumn/winter turns)</span>
            </label>
          </div>
        </section>

        {/* Playable factions */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground">Playable Factions</h3>
          <p className="text-[10px] text-muted-foreground">Select which factions are playable in this campaign (reflected in descr_strat.txt)</p>
          <div className="grid grid-cols-3 gap-1.5">
            {VANILLA_FACTIONS.map(f => {
              const active = (s.playableFactions || []).includes(f);
              return (
                <button key={f}
                  onClick={() => {
                    const current = s.playableFactions || [];
                    set('playableFactions', active ? current.filter(x => x !== f) : [...current, f]);
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors capitalize ${active ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                >
                  {f.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </section>

        {/* How-to notes */}
        <section className="bg-accent/20 border border-border rounded-lg p-3 space-y-2">
          <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-primary" /> Export Checklist</p>
          <ul className="text-[10px] text-muted-foreground space-y-1 list-disc ml-3">
            <li>Export ZIP downloads <code className="font-mono bg-accent px-0.5 rounded">descr_strat.txt</code> + <code className="font-mono bg-accent px-0.5 rounded">campaign_descriptions.txt</code></li>
            <li>Copy map TGA files from <code className="font-mono bg-accent px-0.5 rounded">base/</code> and <code className="font-mono bg-accent px-0.5 rounded">imperial_campaign/</code> into the campaign folder</li>
            <li>Add menu entry to <code className="font-mono bg-accent px-0.5 rounded">data/text/campaign_descriptions.txt</code></li>
            <li>Add entry to <code className="font-mono bg-accent px-0.5 rounded">descr_menu_campaigns.txt</code> to show in main menu</li>
            <li>Optionally customize <code className="font-mono bg-accent px-0.5 rounded">descr_regions.txt</code> and <code className="font-mono bg-accent px-0.5 rounded">descr_sm_factions.txt</code></li>
          </ul>
        </section>
      </div>
    </ScrollArea>
  );
}