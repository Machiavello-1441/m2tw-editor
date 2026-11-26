import React, { useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Play, Loader2, CheckCircle2, X } from 'lucide-react';
import { validateLayers } from './mapValidator';
import ValidationIssueGroups from './ValidationIssueGroups';
import validateCampaignNames from '@/components/map/validateCampaignNames';

export default function MapValidationPanel({ layers, regionsData, settlementNames, settlements = [], onJumpTo }) {
  const [layerIssues, setIssues] = useState(null);
  const [running, setRunning] = useState(false);
  const issues = layerIssues === null ? null : [...layerIssues, ...validateCampaignNames({ regionsData, settlementNames, settlements })];

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
  const hasData = loadedLayers > 0 || regionsData?.length > 0 || settlements.length > 0;
  const errors   = issues ? issues.filter(i => i.severity === 'error').length : 0;
  const warnings = issues ? issues.filter(i => i.severity === 'warning').length : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-3 border-b border-slate-800 space-y-2">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Scans loaded layer pixel data for common modding errors: river loops, 2×2 river
          blocks, diagonal gaps, invalid/missing sources or outlets, isolated pixels, invalid feature
          colours, mismatched map sizes, and city/port markers on impassable or feature pixels.
          Also checks missing province/settlement identifiers, region definitions, and empty or missing localized names.
        </p>
        <button
          onClick={runValidation}
          disabled={running || !hasData}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
            bg-amber-600/90 hover:bg-amber-600 text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {running
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…</>
            : <><Play className="w-3.5 h-3.5" /> Run Validation</>}
        </button>
        {!hasData && <p className="text-[10px] text-slate-600 text-center">Load a map layer or campaign region data first</p>}
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
            <ValidationIssueGroups issues={issues} onJumpTo={onJumpTo} />
          </>
        )}
      </div>
    </div>
  );
}