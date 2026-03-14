import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ValidationPanel({ onValidate }) {
  const [errors, setErrors] = useState(null);

  const run = () => {
    const errs = onValidate();
    setErrors(errs);
  };

  return (
    <div className="rounded border border-border bg-card/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Validation
        </span>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-white" onClick={run}>
          Run check
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