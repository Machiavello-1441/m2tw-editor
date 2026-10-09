import { useEffect, useRef, useState } from 'react';
import { awaitWorkspaceOperation } from '@/components/workspace/workspaceOperation';

export default function useFolderOperation() {
  const active = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => () => {
    const controller = active.current;
    active.current = null;
    controller?.abort(new Error('Folder connection stopped.'));
  }, []);
  const run = async (initial, task) => {
    active.current?.abort(new Error('Another folder selection was started.'));
    const controller = new AbortController();
    active.current = controller;
    setError(''); setProgress(initial);
    const timer = setTimeout(() => controller.abort(new Error('Folder processing did not finish within one minute. Select the base game’s data folder or one mod folder instead of the entire installation.')), 60000);
    const update = value => { if (active.current === controller && !controller.signal.aborted) setProgress(value); };
    try {
      await awaitWorkspaceOperation(task(controller.signal, update), controller.signal);
      controller.signal.throwIfAborted();
      return true;
    } catch (error) {
      if (active.current === controller) setError(error.message || 'Folder connection could not finish.');
      return false;
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { active.current = null; setProgress(null); }
    }
  };
  const cancel = () => active.current?.abort(new Error('Stopped. Your installed files were not changed. Choose a smaller folder to try again.'));
  return { progress, error, run, cancel };
}