import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEDB } from '@/components/edb/EDBContext';
import { useRefData } from '@/components/edb/RefDataContext';
import { useTraits } from '@/components/traits/TraitsContext';
import { useAncillaries } from '@/components/ancillaries/AncillariesContext';
import { restoreWorkspace, workspaceEvent } from '@/components/workspace/localWorkspace';
import { loadWorkspacePage } from '@/components/workspace/loadWorkspacePage';
import FolderProcessingIndicator from '@/components/workspace/FolderProcessingIndicator';
import useWorkspaceProgress from '@/components/workspace/useWorkspaceProgress';

export default function LocalWorkspaceGate({ page, children }) {
  const progress = useWorkspaceProgress();
  const indicator = <FolderProcessingIndicator progress={progress} />;
  const bindings = useRef();
  bindings.current = { edb: useEDB(), refs: useRefData(), traits: useTraits(), anc: useAncillaries() };
  const [state, setState] = useState({ page: '', error: '', needsAccess: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const change = () => setRevision(value => value + 1);
    window.addEventListener(workspaceEvent, change);
    return () => window.removeEventListener(workspaceEvent, change);
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      const source = await restoreWorkspace();
      const home = page === 'Home';
      if (source?.authorized && !home) await loadWorkspacePage(page, bindings.current);
      if (active) setState({ page, error: '', needsAccess: !!source && !source.authorized && !home });
    })().catch(error => { if (active) setState({ page, error: page === 'Home' ? '' : error.message, needsAccess: false }); });
    return () => { active = false; };
  }, [page, revision]);
  if (state.page !== page) return <>{indicator}<div className="p-6 text-sm text-muted-foreground">Reading this editor’s files from your PC…</div></>;
  if (state.error || state.needsAccess) return <>{indicator}<div className="p-6 space-y-3"><p role="alert" className="text-sm text-destructive">{state.error || 'Grant access to your local folder to open this editor.'}</p><Link to="/Home" className="text-primary underline">Return to Home to reconnect</Link></div></>;
  return <>{indicator}{children}</>;
}