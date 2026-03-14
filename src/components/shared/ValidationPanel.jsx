import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ValidationPanel
 * Props:
 *   onValidate  () => string[]    — called to get errors
 *   watchData   any               — when this value changes, re-runs validation automatically
 *                                   (pass traitsData or ancData so it stays live)
 */
export default function ValidationPanel({ onValidate, watchData }) {
  const [errors, setErrors] = useState(null);

  // Auto-run whenever watched data changes (if we've already run at least once)
  useEffect(() => {
    if (errors === null) return; // don't auto-run on first mount
    setErrors(onValidate());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchData]);

  const run = () => setErrors(onValidate());

  const errCount = errors?.length ?? null;

  return (
    <div className="rounded border border-border bg-card/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Validation
          {errCount !== null && errCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-semibold">
              {errCount} issue{errCount !== 1 ? 's' : ''}
            </span>
          )}
          {errCount === 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-semibold">
              ✓ OK
            </span>
          )}
        </span>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-white gap-1" onClick={run}>
          <RefreshCw className="w-2.5 h-2.5" />
          {errors === null ? 'Run check' : 'Re-check'}
        </Button>
      </div>

      {errors === null && (
        <p className="text-[10px] text-muted-foreground italic">Click "Run check" to validate data.</p>
      )}

      {errors !== null && errors.length === 0 && (
        <div className="flex items-center gap-1.5 text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="text-xs">No errors found — data looks valid.</span>
        </div>
      )}

      {errors !== null && errors.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-[11px] text-amber-300">{err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}