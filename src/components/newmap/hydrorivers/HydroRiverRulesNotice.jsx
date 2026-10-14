import React from 'react';
import { RIVER_RULES_URL } from '@/components/newmap/hydrorivers/regions';

export default function HydroRiverRulesNotice() {
  return (
    <div className="rounded border bg-muted p-2 text-[9px] text-muted-foreground space-y-1">
      <p className="font-semibold text-foreground">Drafts are automatically topology-repaired.</p>
      <p>TWC permits multiple white sources, tributary junctions and forks into separate outlets. Rivers must connect edge-to-edge, have an unmarked outlet, contain no 2×2 blocks, and never fork then rejoin. Fords are cyan.</p>
      <p>The importer and validators share these rules. Rivers shorter than 3 pixels are removed. Loops are simplified to a single route; minor stubs may be pruned and fords relocated when necessary. Heightmap water guides sources and estuaries. Validate again after merging; review inferred geography and ford changes before export.</p>
      <a href={RIVER_RULES_URL} target="_blank" rel="noopener noreferrer" className="underline">Read the M2TW map_features.tga rules</a>
    </div>
  );
}