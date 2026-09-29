import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function FamilyTreeProblems({ problems }) {
  if (!problems.errors.length && !problems.warnings.length) return null;
  return (
    <div className="rounded border border-amber-500/30 bg-amber-900/10 p-1.5 space-y-0.5">
      {problems.errors.map((m) => (
        <p key={m} className="text-[9px] text-red-400 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{m}</p>
      ))}
      {problems.warnings.map((m) => (
        <p key={m} className="text-[9px] text-amber-400 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{m}</p>
      ))}
    </div>
  );
}