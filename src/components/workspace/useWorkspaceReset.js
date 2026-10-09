import { useEffect, useState } from 'react';
import { workspaceEvent } from '@/components/workspace/localWorkspace';

export default function useWorkspaceReset() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const reset = event => {
      if (event.detail?.reset) setRevision(value => value + 1);
    };
    window.addEventListener(workspaceEvent, reset);
    return () => window.removeEventListener(workspaceEvent, reset);
  }, []);
  return revision;
}