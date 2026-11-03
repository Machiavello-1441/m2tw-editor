import React from 'react';
import CampaignDropdown from '@/components/map/CampaignDropdown';
import { GROUND_TYPE_PALETTE } from '@/lib/mapLayerStore';
import { GT } from '@/lib/autoGroundTypes';
import { colorHex, defaultGround } from '@/components/newmap/osmpacks/osmPackDefaults';

export default function OsmPackClassRow({ item, value = {}, onChange, disabled }) {
  const gt = value.gt ?? defaultGround[item.classification] ?? '';
  const color = gt === 'custom' ? value.color || '#60a040' : colorHex(GT[gt] || GT.fertile_medium);
  return <div className="space-y-1 border-b border-border py-2 last:border-0">
    <label className="flex items-start gap-2">
      <input type="checkbox" checked={!!value.enabled} disabled={disabled || !item.count || !gt} onChange={event => onChange({ ...value, enabled: event.target.checked })} className="mt-0.5" />
      <span className="min-w-0 flex-1 break-words text-[11px]">{item.classification}<span className="ml-1 text-muted-foreground">({item.count.toLocaleString()})</span></span>
    </label>
    <div className="flex items-center gap-1.5">
      <CampaignDropdown aria-label={`Ground type for ${item.classification}`} value={gt} disabled={disabled || !item.count} onChange={event => onChange({ ...value, gt: event.target.value, enabled: event.target.value ? !!value.enabled : false })} className="min-w-0 flex-1 rounded border bg-background px-1.5 py-1 text-[10px]">
        <option value="">Unassigned</option>
        {GROUND_TYPE_PALETTE.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        <option value="custom">Custom colour</option>
      </CampaignDropdown>
      <input type="color" aria-label={`Custom colour for ${item.classification}`} value={color} disabled={disabled || !item.count} onChange={event => onChange({ ...value, gt: 'custom', color: event.target.value })} className="h-6 w-7 shrink-0 cursor-pointer rounded border bg-background p-0.5" />
    </div>
    {!item.count && <p className="text-[9px] text-muted-foreground">Included in pack; no matching areas in this map.</p>}
  </div>;
}