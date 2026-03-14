import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ValidationPanel
 * Props:
 *   onValidate — () => string[]  — returns array of error strings
 *   watchData  — any             — when this value changes, re-run automatically
 *                                  (pass traitsData or ancData so it stays live)
 */
export default function ValidationPanel({ onValidate, watchData }) {
  const [errors, setErrors] = useState(null);
  const debounceRef = useRef(null);

  const run = () => {
    const errs = onValidate();
    setErrors(errs);
  };

  // Auto-run whenever watchData changes, debounced 600ms
  useEffect(() => {
    if (watchData === undefined) return; // no auto-run if not provided
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const errs = onValidate();
      setErrors(errs);
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [watchData]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorCount = errors?.length ?? null;

  return (
    <div className={`rounded border ${errorCount === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : errorCount > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card/40'} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Validation
          {errorCount !== null && errorCount > 0 && (
            <span className="ml-1 bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">{errorCount}</span>
          )}
          {errorCount === 0 && (
            <span className="ml-1 bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">✓</span>
          )}
        </span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-white" onClick={run} title="Re-run validation">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {errors === null && (
        <p className="text-[10px] text-muted-foreground italic">Validating…</p>
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