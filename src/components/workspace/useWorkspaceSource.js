import { useEffect, useState } from 'react';
import { getWorkspace, workspaceEvent } from '@/components/workspace/localWorkspace';

export default function useWorkspaceSource() {
  const [source, setSource] = useState(getWorkspace);
  useEffect(() => {
    const update = () => setSource(getWorkspace());
    window.addEventListener(workspaceEvent, update);
    update();
    return () => window.removeEventListener(workspaceEvent, update);
  }, []);
  return source;
}