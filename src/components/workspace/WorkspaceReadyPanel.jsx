import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { workspaceEditors } from '@/components/workspace/workspaceFolderCatalog';

export default function WorkspaceReadyPanel({ source }) {
  const editors = useMemo(() => source?.authorized ? workspaceEditors([...source.files.values()]) : [], [source]);
  if (!source?.authorized) return null;
  return <div role="status" aria-live="polite" className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
    <h4 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-5 w-5 text-primary" />{source.name} — Ready to edit</h4>
    <p className="text-xs">Mod folder connected. Open an editor here or from the sidebar; file contents and image previews load locally only when needed. Nothing is uploaded.</p>
    <div className="flex flex-wrap gap-2">{editors.map(editor => <Button key={editor.route} asChild variant="outline" size="sm"><Link to={editor.route}>Open {editor.label}</Link></Button>)}</div>
    {!editors.length && <p className="text-xs text-muted-foreground">No supported editor files were found. Check that this mod’s data subfolder contains unpacked game files.</p>}
    {source.readOnly && <p className="text-xs text-muted-foreground">Editing is enabled; the installed files are read-only. Use Export to download your edited ZIP. Export before refreshing, then select the folder again for a new session.</p>}
  </div>;
}