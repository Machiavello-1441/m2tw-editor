import { isUndoStorageEvent } from '@/components/map/campaignUndoStorage';
import { FILES_CHANGED_EVENT } from '@/lib/modFileRegistry';

/** Keep pending drafts moving to disk, including after a suspended tab or failed write. */
export default function campaignAutoSaveLifecycle(writer, current) {
  const flush = () => {
    const draft = current.current;
    if (draft.enabled && draft.ready && writer.revision > writer.durable) void writer.flush();
  };
  const changed = event => { if (isUndoStorageEvent(event)) writer.changed(); };
  const beforeUnload = event => {
    const draft = current.current;
    if (draft.ready && (writer.revision > writer.durable || (!draft.enabled && draft.protect))) {
      flush();
      event.preventDefault(); event.returnValue = '';
    }
  };
  const wakeEvents = ['focus', 'pageshow', 'pagehide'];
  window.addEventListener(FILES_CHANGED_EVENT, changed);
  window.addEventListener('beforeunload', beforeUnload);
  wakeEvents.forEach(name => window.addEventListener(name, flush));
  document.addEventListener('visibilitychange', flush);
  // No writes when unchanged. This also retries a pending draft after a transient failure.
  const timer = window.setInterval(flush, 5000);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener(FILES_CHANGED_EVENT, changed);
    window.removeEventListener('beforeunload', beforeUnload);
    wakeEvents.forEach(name => window.removeEventListener(name, flush));
    document.removeEventListener('visibilitychange', flush);
  };
}