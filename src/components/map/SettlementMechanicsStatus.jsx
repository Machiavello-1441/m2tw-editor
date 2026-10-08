import React, { useRef, useState } from 'react';
import { loadSettlementMechanicsFile, useSettlementMechanics } from '@/components/map/settlementMechanics';

export default function SettlementMechanicsStatus() {
  const mechanics = useSettlementMechanics();
  const input = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setLoading(true);
    try { if (!await loadSettlementMechanicsFile(file)) throw new Error('Choose descr_settlement_mechanics.xml.'); setError(''); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  return <div className="space-y-1 text-[9px] text-muted-foreground">
    <p>{mechanics ? 'Level follows population using the loaded settlement mechanics upgrade thresholds.' : 'Load data/descr_settlement_mechanics.xml to set levels automatically from population; otherwise levels remain manual.'}</p>
    <button type="button" disabled={loading} onClick={() => input.current?.click()} className="underline">{loading ? 'Reading mechanics…' : mechanics ? 'Replace settlement mechanics XML' : 'Load settlement mechanics XML'}</button>
    <input ref={input} type="file" accept=".xml" className="hidden" onChange={load} />
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}