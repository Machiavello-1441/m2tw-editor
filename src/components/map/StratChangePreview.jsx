import React, { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import ChangePreviewDialog from './ChangePreviewDialog';

const KEY = 'm2tw_strat_original';

// Remember the descr_strat text exactly as first loaded (for diff + backup).
export function rememberOriginalStrat(text) {
  try { sessionStorage.setItem(KEY, text); } catch {}
}

export default function StratChangePreview({ stratData, buildCurrent, onDownload }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');

  useEffect(() => {
    if (stratData?.raw && !sessionStorage.getItem(KEY)) rememberOriginalStrat(stratData.raw);
  }, [stratData?.raw]);

  if (!stratData?.raw) return null;
  const original = sessionStorage.getItem(KEY) || '';
  return (
    <>
      <button onClick={() => { setCurrent(buildCurrent()); setOpen(true); }}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-semibold border border-slate-600/40 text-slate-300 hover:text-white">
        <Eye className="w-3 h-3" /> Preview changes to descr_strat.txt
      </button>
      {open && (
        <ChangePreviewDialog name="descr_strat.txt" original={original} current={current}
          onClose={() => setOpen(false)} onDownloadOriginal={() => onDownload(original)} />
      )}
    </>
  );
}