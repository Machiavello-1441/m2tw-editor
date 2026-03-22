import React, { useMemo, useState } from 'react';
import { AlertTriangle, XCircle, CheckCircle2, ChevronDown, ChevronRight, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateMod } from './ModValidator';

const CATEGORY_ORDER = ['EDB', 'Map'];

function IssueRow({ issue }) {
  const [open, setOpen] = useState(false);
  const isError = issue.severity === 'error';

  return (
    <div
      className={`rounded-lg border transition-all ${isError
        ? 'border-destructive/30 bg-destructive/5'
        : 'border-yellow-500/25 bg-yellow-500/5'
        }`}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-2.5 p-2.5 text-left"
      >
        {isError
          ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          : <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
        }
        <span className={`text-xs font-medium flex-1 ${isError ? 'text-destructive' : 'text-yellow-300'}`}>
          {issue.title}
        </span>
        {open
          ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
        }
      </button>
      {open && (
        <div className="px-3 pb-2.5 pt-0 text-[11px] text-muted-foreground leading-relaxed border-t border-border/40 mt-0">
          <p className="pt-2">{issue.detail}</p>
          {issue.context && (
            <p className="mt-1 font-mono text-[10px] opacity-60">
              {Object.entries(issue.context).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, issues }) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{category}</span>
        {errors.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">
            {errors.length} error{errors.length > 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-semibold">
            {warnings.length} warning{warnings.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {[...errors, ...warnings].map(issue => (
        <IssueRow key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

export default function ValidationDashboard({ edbData }) {
  const [runKey, setRunKey] = useState(0);

  const { errors, warnings } = useMemo(() => {
    return validateMod(edbData, window.__campaignLayers || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edbData, runKey]);

  const total = errors.length + warnings.length;
  const allClear = total === 0;

  // Group by category
  const byCategory = useMemo(() => {
    const map = {};
    for (const issue of [...errors, ...warnings]) {
      if (!map[issue.category]) map[issue.category] = [];
      map[issue.category].push(issue);
    }
    return map;
  }, [errors, warnings]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-border ${allClear ? 'bg-green-500/5' : errors.length > 0 ? 'bg-destructive/5' : 'bg-yellow-500/5'}`}>
        <Shield className={`w-4 h-4 shrink-0 ${allClear ? 'text-green-400' : errors.length > 0 ? 'text-destructive' : 'text-yellow-400'}`} />
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">Validation</p>
          <p className="text-[10px] text-muted-foreground">
            {allClear
              ? 'No issues found — your mod looks good to export.'
              : `${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''} found`
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allClear
            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
            : (
              <>
                {errors.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-destructive">
                    <XCircle className="w-3.5 h-3.5" />{errors.length}
                  </span>
                )}
                {warnings.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-400">
                    <AlertTriangle className="w-3.5 h-3.5" />{warnings.length}
                  </span>
                )}
              </>
            )
          }
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setRunKey(k => k + 1)} title="Re-run validation">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Body */}
      {!allClear && (
        <div className="p-4 space-y-5 max-h-[800px] overflow-y-auto">
          {CATEGORY_ORDER.filter(cat => byCategory[cat]).map(cat => (
            <CategorySection key={cat} category={cat} issues={byCategory[cat]} />
          ))}
          {/* any other categories not in CATEGORY_ORDER */}
          {Object.keys(byCategory)
            .filter(cat => !CATEGORY_ORDER.includes(cat))
            .map(cat => (
              <CategorySection key={cat} category={cat} issues={byCategory[cat]} />
            ))}
        </div>
      )}
    </div>
  );
}