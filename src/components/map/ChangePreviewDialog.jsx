import React, { useMemo } from 'react';
import { Download, X } from 'lucide-react';
import { diffLines } from '@/lib/lineDiff';

const COLORS = { '+': 'bg-green-900/30 text-green-300', '-': 'bg-red-900/30 text-red-300', ' ': 'text-slate-500', '…': 'text-slate-600 italic' };

// Shows what will change in a file versus the original that was loaded.
export default function ChangePreviewDialog({ name, original, current, onClose, onDownloadOriginal }) {
  const diff = useMemo(() => diffLines(original || '', current || ''), [original, current]);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-full flex flex-col rounded-lg border border-slate-700 bg-slate-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-800">
          <p className="text-xs font-semibold text-slate-200 flex-1">Changes to {name}
            <span className="ml-2 text-green-400">+{diff.added}</span> <span className="text-red-400">-{diff.removed}</span>
          </p>
          <button onClick={onDownloadOriginal} disabled={!original}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-slate-600/40 text-slate-300 hover:text-white disabled:opacity-40">
            <Download className="w-3 h-3" /> Download original (backup)
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-auto p-2 font-mono text-[10px] leading-4">
          {diff.added + diff.removed === 0 && <p className="text-slate-500 p-2">No changes compared with the loaded file.</p>}
          {diff.added + diff.removed > 0 && diff.lines.map((l, i) => (
            <div key={i} className={`whitespace-pre px-1 ${COLORS[l.t]}`}>{l.t === '…' ? `… ${l.s}` : `${l.t} ${l.s}`}</div>
          ))}
        </div>
      </div>
    </div>
  );
}