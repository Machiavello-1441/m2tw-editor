import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight } from 'lucide-react';

const SECTIONS = [
  { severity: 'error', label: 'Errors', Icon: AlertCircle, color: 'text-red-400', border: 'border-red-700/40', bg: 'bg-red-900/15' },
  { severity: 'warning', label: 'Warnings', Icon: AlertTriangle, color: 'text-yellow-400', border: 'border-yellow-700/40', bg: 'bg-yellow-900/15' },
  { severity: 'info', label: 'Info', Icon: Info, color: 'text-sky-400', border: 'border-sky-700/40', bg: 'bg-sky-900/15' },
];

// Coordinates are stored on the issue itself, so they are stripped from the
// message before grouping — otherwise every pixel becomes its own group.
const cleanMessage = (message) => String(message || '')
  .replace(/\s*\bat\b\s*\(\s*-?\d+\s*,\s*-?\d+\s*\)/gi, '')
  .replace(/\s*\(\s*-?\d+\s*,\s*-?\d+\s*\)/g, '')
  .trim();

function groupIssues(issues) {
  const result = new Map(SECTIONS.map(s => [s.severity, new Map()]));
  for (const issue of issues) {
    const severity = result.has(issue.severity) ? issue.severity : 'info';
    const message = cleanMessage(issue.message);
    const key = `${issue.layer}|${message}`;
    const groups = result.get(severity);
    if (!groups.has(key)) groups.set(key, { key, layer: issue.layer, message, count: 0, points: [] });
    const group = groups.get(key);
    group.count += 1;
    if (issue.x != null && issue.y != null) group.points.push({ id: issue.id, x: issue.x, y: issue.y });
  }
  return [...result.entries()].map(([severity, groups]) => ({
    severity,
    total: [...groups.values()].reduce((sum, g) => sum + g.count, 0),
    groups: [...groups.values()].sort((a, b) => b.count - a.count || a.message.localeCompare(b.message)),
  }));
}

export default function ValidationIssueGroups({ issues, onJumpTo }) {
  const sections = useMemo(() => groupIssues(issues), [issues]);
  const [openSections, setOpenSections] = useState({ error: true, warning: true, info: false });
  const [openGroups, setOpenGroups] = useState({});

  const toggleSection = (severity) => setOpenSections(prev => ({ ...prev, [severity]: !prev[severity] }));
  const toggleGroup = (key) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-2">
      {sections.filter(s => s.total > 0).map(({ severity, total, groups }) => {
        const cfg = SECTIONS.find(s => s.severity === severity);
        const sectionOpen = !!openSections[severity];
        const { Icon } = cfg;
        return (
          <div key={severity} className={`rounded-lg border ${cfg.border} ${cfg.bg}`}>
            <button onClick={() => toggleSection(severity)} aria-expanded={sectionOpen}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-left">
              {sectionOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
              <span className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
              <span className="ml-auto text-[10px] font-mono text-slate-400">{total}</span>
            </button>
            {sectionOpen && (
              <div className="border-t border-slate-700/40 p-1.5 space-y-1">
                {groups.map(group => {
                  const groupKey = `${severity}|${group.key}`;
                  const open = !!openGroups[groupKey];
                  const expandable = group.points.length > 0;
                  return (
                    <div key={groupKey} className="rounded border border-slate-700/40 bg-slate-900/50">
                      <button
                        onClick={() => expandable && toggleGroup(groupKey)}
                        aria-expanded={expandable ? open : undefined}
                        className={`w-full flex items-start gap-1.5 px-2 py-1.5 text-left ${expandable ? '' : 'cursor-default'}`}>
                        {expandable
                          ? (open ? <ChevronDown className="w-3 h-3 mt-0.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3 h-3 mt-0.5 text-slate-500 shrink-0" />)
                          : <span className="w-3 shrink-0" />}
                        <span className="flex-1 text-[10px] text-slate-300 leading-relaxed">{group.message}</span>
                        <span className="text-[9px] text-slate-600 font-mono shrink-0">{group.layer}</span>
                        <span className="text-[9px] text-slate-400 font-mono shrink-0 w-6 text-right">{group.count}</span>
                      </button>
                      {open && expandable && (
                        <div className="border-t border-slate-700/40 px-2 py-1.5 max-h-40 overflow-y-auto flex flex-wrap gap-1">
                          {group.points.map(point => (
                            <button key={point.id} onClick={() => onJumpTo && onJumpTo(point.x, point.y)}
                              title={`Jump to (${point.x}, ${point.y})`}
                              className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-600/40 text-[9px] font-mono text-amber-400 hover:text-amber-300 hover:border-amber-500/60 transition-colors">
                              {point.x}, {point.y}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}