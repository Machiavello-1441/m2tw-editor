import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Copy, ChevronDown, ChevronRight, Map, Users } from 'lucide-react';

export default function CampaignCard({ campaign, onEdit, onDelete, onDuplicate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <Map className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{campaign.title}</p>
          <code className="text-[10px] font-mono text-muted-foreground">custom/{campaign.name}/</code>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDuplicate} title="Duplicate">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-accent/10 space-y-2.5 text-[11px]">
          {campaign.description && (
            <p className="text-muted-foreground">{campaign.description}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1">Files generated</p>
              <ul className="space-y-0.5 text-muted-foreground font-mono">
                <li>custom/{campaign.name}/descr_strat.txt</li>
                <li>custom/{campaign.name}/descr_win_conditions.txt</li>
                <li>text/campaign_descriptions.txt</li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1">Map files needed</p>
              <ul className="space-y-0.5 text-muted-foreground font-mono">
                <li>map_regions.tga</li>
                <li>map_heights.tga</li>
                <li>map_ground_types.tga</li>
                <li>map_climates.tga</li>
                <li>map_features.tga</li>
              </ul>
            </div>
          </div>
          {campaign.factions && (
            <div>
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> Factions
              </p>
              <div className="flex flex-wrap gap-1">
                {campaign.factions.split(',').map(f => f.trim()).filter(Boolean).map(f => (
                  <span key={f} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-mono">{f}</span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Template: <span className="text-foreground">{campaign.template || 'blank'}</span>
            {campaign.createdAt && <span className="ml-3">Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>}
          </p>
        </div>
      )}
    </div>
  );
}