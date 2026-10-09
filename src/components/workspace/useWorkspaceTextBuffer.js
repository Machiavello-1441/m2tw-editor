import { useEffect } from 'react';
import { getWorkspace } from '@/components/workspace/localWorkspace';
import { setFile } from '@/lib/bigFileStore';

// Keep local-mode edits in the working buffer; never write to the source disk here.
export default function useWorkspaceTextBuffer(key, value, serialize, enabled = true) {
  useEffect(() => {
    if (enabled && getWorkspace()?.authorized) setFile(key, serialize(value));
  }, [key, value, serialize, enabled]);
}