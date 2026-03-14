import React, { useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Info, Play, Loader2, CheckCircle2, X } from 'lucide-react';
import { validateLayers } from './mapValidator';

const SEV_CONFIG = {
  error:   { Icon: AlertCircle,   color: 'text-red-400',    bg: 'bg-red-900/20 border-red-700/40',    label: 'Error' },
  warning: { Icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/40', label: 'Warning' },
  info:    { Icon: Info,          color: 'text-sky-400',    bg: 'bg-sky-900/20 border-sky-700/40',    label: 'Info' },
};

export default function MapValidationPanel({ layers, onJumpTo }) {
  const [issues, setIssues] = useState(null);
  const [running, setRunning] = useState(false);

  const runValidation = useCallback(() => {
    setRunning(true);
    setIssues(null);
    setTimeout(() => {
      const result = validateLayers(layers, 3);
      setIssues(result);
      setRunning(false);
    }, 20);
  }, [layers]);

  const loadedLayers = Object.values(layers).filter(s => s?.data).length;
  const errors   = issues ? issues.filter(i => i.severity === 'error').length : 0;
  const warnings = issues ? issues.filter(i => i.severity === 'warning').length : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-3 border-b border-slate-800 space-y-2">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Scans loaded layer pixel data for common modding errors: invalid river placements,
          mismatched map sizes, orphan city/port markers, and unknown feature colours.
        </p>
        <button
          onClick={runValidation}
          disabled={running || loadedLayers === 0}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
            bg-amber-600/90 hover:bg-amber-600 text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {running
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…</>
            : <><Play className="w-3.5 h-3.5" /> Run Validation</>}
        </button>
        {loadedLayers === 0 && <p className="text-[10px] text-slate-600 text-center">Load at least one layer first</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {issues === null && !running && (
          <div className="text-[10px] text-slate-600 text-center mt-6">Press "Run Validation" to scan for errors.</div>
        )}
        {issues !== null && issues.length === 0 && (
          <div className="flex flex-col items-center gap-2 mt-6 text-xs text-green-400">
            <CheckCircle2 className="w-8 h-8" />
            No issues found!
          </div>
        )}
        {issues !== null && issues.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs">
              {errors > 0 && <span className="flex items-center gap-1 text-red-400"><AlertCircle className="w-3.5 h-3.5" />{errors} error{errors !== 1 ? 's' : ''}</span>}
              {warnings > 0 && <span className="flex items-center gap-1 text-yellow-400"><AlertTriangle className="w-3.5 h-3.5" />{warnings} warning{warnings !== 1 ? 's' : ''}</span>}
              {errors === 0 && warnings === 0 && <span className="text-sky-400">Informational only</span>}
              <button onClick={() => setIssues(null)} className="ml-auto text-slate-500 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button>
            </div>
            {issues.map(issue => {
              const cfg = SEV_CONFIG[issue.severity] || SEV_CONFIG.info;
              const { Icon } = cfg;
              const canJump = issue.x != null && issue.y != null;
              return (
                <div key={issue.id} className={`rounded-lg border p-2.5 space-y-1.5 ${cfg.bg}`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label} · <span className="font-mono font-normal">{issue.layer}</span></div>
                      <div className="text-[10px] text-slate-300 leading-relaxed mt-0.5">{issue.message}</div>
                    </div>
                  </div>
                  {canJump && (
                    <button onClick={() => onJumpTo && onJumpTo(issue.x, issue.y)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-mono underline underline-offset-2">
                      Jump to ({issue.x}, {issue.y})
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}