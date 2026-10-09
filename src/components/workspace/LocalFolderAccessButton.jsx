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
        <ExternalLink className="w-4 h-4" /> Open app to connect folder
      </a>
    </Button>
    <p className="text-xs text-foreground">The embedded preview cannot use direct folder access. Use the read-only folder option below, or open the app in its own tab for direct access.</p>
  </div>;
  return <Button variant="outline" className={className} disabled={busy || !supportsLocalWorkspace()} onClick={onConnect}>
    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
    {source?.root && !source.authorized ? 'Grant folder access' : source?.root ? 'Change local folder' : 'Connect local folder'}
  </Button>;
}