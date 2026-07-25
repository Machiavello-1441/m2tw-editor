import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Fixed banner pinned to the top of the Home page while a data load is in
 * flight. Shows the live phase, the currently-processed file, and a
 * progress bar so the user can see *that* something is happening and *what*
 * — rather than just a spinner on a button that may be scrolled out of view.
 *
 * progress shape: { current: number, total: number, name: string, phase?: string }
 *
 * When post-processing loops tick past `total`, we switch the counter to a
 * "Finalizing" label and clamp the bar at ~92% so the bar never visually
 * stalls at 100% before work is actually done.
 */
export default function DataLoadingBanner({ progress }) {
  if (!progress) return null;
  const { current = 0, total = 0, name = '', phase = 'Loading' } = progress;
  const over = current > total;
  const pct = total > 0 ? Math.min(over ? 92 : 100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl pointer-events-none">
      <div className="bg-card border border-primary/40 shadow-2xl rounded-xl px-4 py-2.5 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {over ? 'Finalizing images…' : `${phase}…`}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {over ? `+${current - total}` : `${current}/${total}`}
            </span>
          </div>
          <div className="text-[10px] font-mono truncate text-muted-foreground leading-tight mt-0.5">
            {name || 'preparing…'}
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-accent overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}