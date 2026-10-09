import React from 'react';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function CampaignRecoveryStatus({ status, recovered }) {
  if (status.phase === 'idle' && !recovered) return null;
  const failed = status.phase === 'error';
  const Icon = failed ? AlertCircle : status.phase === 'saving' ? Loader2 : ShieldCheck;
  const text = failed ? 'Local recovery unavailable. Export your ZIP now.' : status.phase === 'saving' ? 'Saving recovery draft…' : status.savedAt ? `Saved locally at ${new Date(status.savedAt).toLocaleTimeString()}` : 'Recovered your local campaign draft';
  return <div role={failed ? 'alert' : 'status'} className={`flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-1.5 text-xs ${failed ? 'text-destructive' : 'text-muted-foreground'}`} title={failed ? status.error : 'Local recovery protects the campaign draft; export a ZIP for an independent backup.'}>
    <Icon aria-hidden="true" className={status.phase === 'saving' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
    <span>{recovered && status.savedAt ? 'Recovered draft · ' : ''}{text}</span>
  </div>;
}