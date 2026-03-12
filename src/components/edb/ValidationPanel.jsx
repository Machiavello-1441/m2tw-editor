import React, { useMemo, useState } from 'react';
import { useEDB } from './EDBContext';
import { validateEDB } from './EDBValidator';
import { AlertTriangle, XCircle, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export default function ValidationPanel() {
  const { edbData, setSelectedBuilding, setSelectedLevel } = useEDB();
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState('all');

  const issues = useMemo(() => validateEDB(edbData), [edbData]);
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const filtered = filter === 'all' ? issues : issues.filter(i => i.severity === filter);

  const navigate = (issue) => {
    setSelectedBuilding(issue.building);
    setSelectedLevel(issue.level || null);
  };

  const icon = (severity) => severity === 'error'
    ? <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
    : <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />;

  return (
    <div className="border-t border-border bg-card/30 shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 text-left">Validation</span>
        {errors.length > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1">{errors.length}</Badge>}
        {warnings.length > 0 && <span className="text-[9px] text-yellow-500 font-medium">{warnings.length}⚠</span>}
        {issues.length === 0 && edbData && <CheckCircle2 className="w-3 h-3 text-green-500" />}
      </button>

      {expanded && (
        <div className="flex flex-col" style={{ height: 180 }}>
          <div className="flex gap-1 px-2 pb-1 shrink-0">
            {['all', 'error', 'warning'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-[9px] px-2 py-0.5 rounded transition-colors
                  ${filter === f ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'all' ? `All (${issues.length})` : f === 'error' ? `Err (${errors.length})` : `Warn (${warnings.length})`}
              </button>
            ))}
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 pb-2 space-y-0.5">
              {filtered.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">
                  {edbData ? '✓ No issues found' : 'Load an EDB to validate'}
                </p>
              )}
              {filtered.map((issue, i) => (
                <button key={i} onClick={() => navigate(issue)}
                  className="w-full text-left flex items-start gap-2 px-2 py-1 rounded hover:bg-accent/50 transition-colors"
                >
                  {icon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-primary font-medium truncate block">
                      {issue.building}{issue.level ? ` / ${issue.level}` : ''}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{issue.message}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}