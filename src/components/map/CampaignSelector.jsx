import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { campaignLibrary } from '@/components/map/campaignLibrary';

export default function CampaignSelector({ value, onChange, loading, error }) {
  const { campaigns } = campaignLibrary();
  const selected = campaigns.find(c => c.id === value);
  return <div className="ml-auto flex items-center gap-2 text-[11px] relative">
    {campaigns.length ? <>
      <select aria-label="Campaign folder" disabled={loading} value={value} onChange={e => onChange(e.target.value)} className="bg-card text-foreground border border-border rounded px-2 py-1 max-w-56">
        {campaigns.map(c => <option key={c.id} value={c.id}>{c.id} ({c.files.length} files)</option>)}
      </select>
      <details className="relative">
        <summary className="cursor-pointer text-muted-foreground">Files</summary>
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-80 overflow-auto rounded border border-border bg-popover text-popover-foreground p-3 shadow-lg">
          <p className="font-semibold mb-2">{selected?.id} — resolved files</p>
          <p className="text-muted-foreground mb-2">Campaign files override shared base files.</p>
          {selected?.files.map(f => <div key={f.webkitRelativePath || f.name} className="py-1 border-b border-border break-all"><div>{f.name}</div><div className="text-[9px] text-muted-foreground">{f.webkitRelativePath || f.name}</div></div>)}
        </div>
      </details>
    </> : <Link to="/" className="text-primary underline">Load campaigns from Home</Link>}
    {loading && <Loader2 className="w-3 h-3 animate-spin" />}
    {error && <span role="alert" className="text-destructive">{error}</span>}
  </div>;
}