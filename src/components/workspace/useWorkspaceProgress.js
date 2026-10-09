import { useEffect, useState } from 'react';
import { getWorkspaceProgress, workspaceProgressEvent } from '@/components/workspace/workspaceProgress';

export default function useWorkspaceProgress() {
  const [progress, setProgress] = useState(getWorkspaceProgress);
  useEffect(() => {
    const update = () => setProgress(getWorkspaceProgress());
    window.addEventListener(workspaceProgressEvent, update);
    update();
    return () => window.removeEventListener(workspaceProgressEvent, update);
  }, []);
  return progress;
}