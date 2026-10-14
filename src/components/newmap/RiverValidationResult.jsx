import React from 'react';

const LABELS = { block: 'Solid 2×2 blocks', loop: 'Fork/rejoin loops', diagonal: 'Diagonal-only connections', isolated: 'Isolated pixels', source_position: 'Invalid source positions', missing_source: 'Networks missing sources', missing_outlet: 'Networks missing outlets', impure: 'Impure river colours' };
export default function RiverValidationResult({ result, repairs }) {
  if (!result) return null;
  return <div className="text-[10px] space-y-1.5">
    <p className={result.total ? 'text-destructive font-semibold' : 'text-foreground font-semibold'}>{!result.stats.pixels ? 'No river pixels to check.' : result.total ? `${result.total.toLocaleString()} remaining issues` : 'Pixel topology checks pass.'}</p>
    <p className="text-muted-foreground">{result.stats.networks} networks · {result.stats.sources} sources · {result.stats.outlets} outlets</p>
    {Object.entries(result.counts).map(([type,count]) => <p key={type} className="text-destructive">{LABELS[type] || type}: {count.toLocaleString()}</p>)}
    {repairs && <p className="text-muted-foreground">Repaired: {repairs.blocksThinned.toLocaleString()} thick-block pixels, {repairs.loopsOpened} loop pixels, {repairs.diagonalsJoined} diagonal gaps; relocated {repairs.relocated} sources, merged {repairs.merged} coincident heads.</p>}
    {!!repairs?.inferred && <p className="text-muted-foreground">{repairs.inferred} source/outlet decisions were inferred from endpoints. Check their geographic direction.</p>}
    {!!result.total && <p className="text-muted-foreground">Protected fords and non-river features are kept. Conflicts that cannot be repaired without disconnecting channels remain flagged.</p>}
    <p className="text-muted-foreground">Allows tributaries, multiple sources and forked outlets. Checks use edge connections, not diagonal-neighbour counts; game loading and ford accessibility still need verification.</p>
  </div>;
}