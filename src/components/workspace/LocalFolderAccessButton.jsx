import React from 'react';
import { ExternalLink, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supportsLocalWorkspace } from '@/components/workspace/localWorkspace';

export default function LocalFolderAccessButton({ busy, source, onConnect }) {
  const embedded = window.self !== window.top;
  const className = 'text-foreground bg-card hover:text-foreground border-border';
  if (embedded) return <div className="space-y-2">
    <Button asChild variant="outline" className={className}>
      <a href="https://m2tw-editor.base44.app" target="_blank" rel="noopener noreferrer">
        <ExternalLink className="w-4 h-4" /> Open app to select a mod folder
      </a>
    </Button>
    <p className="text-xs text-foreground">The embedded preview cannot open the browser’s directory-access picker. Open the app in a separate Chrome or Edge tab, then select your mod folder containing data. This grants folder access without selecting or uploading every file.</p>
  </div>;
  return <Button variant="outline" className={className} disabled={busy || !supportsLocalWorkspace()} onClick={onConnect}>
    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
    {source?.name ? 'Change mod folder' : 'Select mod folder'}
  </Button>;
}