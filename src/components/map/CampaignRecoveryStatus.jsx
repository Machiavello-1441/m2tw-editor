import React from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function CampaignRecoveryStatus({ status, recoveredAt }) {
  if (status.error) return <p role="alert" className="border-b border-destructive bg-card px-3 py-2 text-xs text-destructive">{status.error}</p>;
  if (!status.pending && !status.savedAt && !recoveredAt) return null;
  return <div role="status" className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5 text-[10px] text-muted-foreground">
    {status.pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
    <span>{status.pending ? 'Saving recovery copy…' : `Recovery copy saved on this browser at ${new Date(status.savedAt || recoveredAt).toLocaleTimeString()}.`}
      {recoveredAt ? ' Your previous work was restored.' : ''}</span>
  </div>;
}