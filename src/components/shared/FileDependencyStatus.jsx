import React, { useEffect, useState } from 'react';
import { getFile, getFileStorageWarning } from '@/lib/bigFileStore';
import { FILES_CHANGED_EVENT, FILE_STORAGE_WARNING_EVENT } from '@/lib/modFileRegistry';

/** Reports actual shared file availability rather than old per-page upload flags. */
export default function FileDependencyStatus({ files, title = 'Shared file availability' }) {
  const snapshot = () => files.map(([name, key]) => {
    try { return { name, available: getFile(key) !== null }; }
    catch { return { name, available: false }; }
  });
  const [items, setItems] = useState(snapshot);
  const [warning, setWarning] = useState(getFileStorageWarning);
  useEffect(() => {
    const refresh = () => { setItems(snapshot()); setWarning(getFileStorageWarning()); };
    refresh();
    window.addEventListener(FILES_CHANGED_EVENT, refresh);
    window.addEventListener(FILE_STORAGE_WARNING_EVENT, refresh);
    return () => {
      window.removeEventListener(FILES_CHANGED_EVENT, refresh);
      window.removeEventListener(FILE_STORAGE_WARNING_EVENT, refresh);
    };
  }, [files]);
  const count = items.filter(item => item.available).length;
  return (
    <div className="border-b border-border bg-card/40 px-4 py-2 text-xs text-foreground">
      {warning && <p role="alert" className="mb-2 text-amber-400">{warning}</p>}
      <details data-testid="file-dependencies">
        <summary className="cursor-pointer font-medium">{title}: {count}/{items.length} available</summary>
        <p className="mt-2 text-[11px] text-muted-foreground">Files loaded on Home are shared by the editors. Expand this list to check dependencies before editing or duplicating. Some mods do not use every optional file.</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ name, available }) => (
            <div key={name} className={available ? 'text-green-400' : 'text-muted-foreground'}>
              <span className="mr-2">{available ? 'Available' : 'Not loaded'}</span><code className="break-all text-[10px]">{name}</code>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
