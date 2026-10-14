import React from 'react';
import { RIVER_RULES_URL } from '@/components/newmap/hydrorivers/regions';

export default function HydroRiverRulesNotice() {
  return (
    <div className="rounded border bg-muted p-2 text-[9px] text-muted-foreground space-y-1">
      <p className="font-semibold text-foreground">Draft only, not certified game-correct.</p>
      <p>TWC permits multiple white sources and tributary junctions. Rivers must connect edge-to-edge, have an outlet, contain no 2×2 blocks, and never fork then rejoin. Fords are cyan and must be placed manually.</p>
      <p>The existing validator is unchanged: its single-source and eight-neighbor branching checks conflict with this guidance. Do not use its Auto-Fix to certify or simplify this import; it can remove valid branches and sources.</p>
      <a href={RIVER_RULES_URL} target="_blank" rel="noopener noreferrer" className="underline">Read the M2TW map_features.tga rules</a>
    </div>
  );
}