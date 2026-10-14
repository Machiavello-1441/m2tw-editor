import React from 'react';

import RiverIssueBrowser from '@/components/newmap/RiverIssueBrowser';

export default function RiverValidationResult({ result, repairs, onIssueSelect }) {
  if (!result) return null;
  return <div className="text-[10px] space-y-1.5">
    <p className={result.errors ? 'text-destructive font-semibold' : 'text-foreground font-semibold'}>{!result.stats.pixels ? 'No river pixels to check.' : result.errors ? `${result.errors.toLocaleString()} errors, ${result.warnings} review warnings` : `Pixel topology checks pass${result.warnings ? `; ${result.warnings} estuary/source warnings` : '.'}`}</p>
    <p className="text-muted-foreground">{result.stats.networks} networks · {result.stats.sources} sources · {result.stats.outlets} outlets</p>
    <RiverIssueBrowser result={result} onSelect={onIssueSelect} />
    {repairs && <p className="text-muted-foreground">Repaired: {repairs.blocksThinned.toLocaleString()} thick-block pixels, {repairs.loopsOpened} loop pixels, {repairs.diagonalsJoined} diagonal gaps; relocated {repairs.relocated} sources, merged {repairs.merged} coincident heads.</p>}
    {!!repairs?.inferred && <p className="text-muted-foreground">{repairs.inferred} source/outlet decisions were inferred from endpoints. Check their geographic direction.</p>}
    {repairs && <p className="text-muted-foreground">Removed {repairs.shortFragmentsRemoved} fragments shorter than 3 pixels and {repairs.branchesPruned} minor-stub pixels where needed to retain a single loop-free channel. Fords moved: {repairs.fordsMoved}; removed: {repairs.fordsRemoved}. Undo restores all changes.</p>}
    <p className="text-muted-foreground">Allows tributaries, multiple sources and forked outlets. Checks use edge connections, not diagonal-neighbour counts; game loading and ford accessibility still need verification.</p>
  </div>;
}