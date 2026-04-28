import React, { useState, useMemo, useRef } from 'react';
import { Download, Upload, Plus, Trash2 } from 'lucide-react';
import { parseStringsBin, encodeStringsBin } from '../strings/stringsBinCodec';
import { downloadBlob } from './tgaExporter';

/**
 * Reads / writes campaign_descriptions.txt.strings.bin
 * Shows:
 *  - [campaignName]_TITLE
 *  - [campaignName]_[FACTION]_TITLE  (for each playable/unlockable/nonplayable faction)
 *  - [campaignName]_[FACTION]_DESCR
 */

function getCampaignDescStrings() {
  try {
    const raw = sessionStorage.getItem('m2tw_campaign_desc_strings');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCampaignDescStrings(map) {
  try { sessionStorage.setItem('m2tw_campaign_desc_strings', JSON.stringify(map)); } catch {}
}

export default function CampaignDescriptionsStrings({ stratData }) {
  const fileRef = useRef();

  // The strings map: key -> value
  const [stringsMap, setStringsMap] = useState(() => getCampaignDescStrings() || {});
  const [binMeta, setBinMeta] = useState({ magic1: 2, magic2: 2048 });

  const campaignName = (stratData?.campaignName || 'imperial_campaign').toUpperCase();

  const allFactions = useMemo(() => {
    const from = (stratData?.factions || []).map(f => f.name).filter(Boolean);
    const fromLists = [
      ...(stratData?.playable || []),
      ...(stratData?.unlockable || []),
      ...(stratData?.nonplayable || []),
    ];
    return [...new Set([...from, ...fromLists])];
  }, [stratData]);

  // Generate the expected keys
  const titleKey = `${campaignName}_TITLE`;
  const factionKeys = useMemo(() => {
    const keys = [];
    for (const f of allFactions) {
      const fu = f.toUpperCase();
      keys.push({ faction: f, titleKey: `${campaignName}_${fu}_TITLE`, descrKey: `${campaignName}_${fu}_DESCR` });
    }
    return keys;
  }, [allFactions, campaignName]);

  // Also show any extra keys from the bin not in the auto-generated list
  const autoKeySet = useMemo(() => {
    const s = new Set([titleKey]);
    for (const { titleKey: tk, descrKey: dk } of factionKeys) { s.add(tk); s.add(dk); }
    return s;
  }, [titleKey, factionKeys]);
  const extraKeys = useMemo(() => Object.keys(stringsMap).filter(k => !autoKeySet.has(k)), [stringsMap, autoKeySet]);

  const set = (key, value) => {
    const next = { ...stringsMap, [key]: value };
    setStringsMap(next);
    setCampaignDescStrings(next);
  };
  const del = (key) => {
    const next = { ...stringsMap };
    delete next[key];
    setStringsMap(next);
    setCampaignDescStrings(next);
  };

  const handleLoadBin = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const buf = await file.arrayBuffer();
    const parsed = parseStringsBin(buf);
    if (!parsed) return;
    const map = {};
    for (const { key, value } of parsed.entries) if (key) map[key] = value;
    setStringsMap(map);
    setCampaignDescStrings(map);
    setBinMeta({ magic1: parsed.magic1, magic2: parsed.magic2 });
  };

  const handleExportBin = () => {
    const entries = Object.entries(stringsMap).map(([key, value]) => ({ key, value }));
    const buf = encodeStringsBin(entries, binMeta.magic1, binMeta.magic2);
    downloadBlob(new Blob([buf]), 'campaign_descriptions.txt.strings.bin');
  };

  const fieldClass = "w-full px-1.5 py-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono resize-none";

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="text-[9px] text-slate-500 uppercase font-semibold flex-1">Campaign Descriptions (.strings.bin)</p>
        <label className="cursor-pointer flex items-center gap-0.5 h-5 px-1.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100 text-[9px]">
          <Upload className="w-2.5 h-2.5" /> Load .bin
          <input ref={fileRef} type="file" accept=".bin,.strings.bin" className="hidden" onChange={handleLoadBin} />
        </label>
        <button onClick={handleExportBin} disabled={Object.keys(stringsMap).length === 0}
          className={`flex items-center gap-0.5 h-5 px-1.5 rounded border text-[9px] transition-colors ${Object.keys(stringsMap).length > 0 ? 'bg-amber-600/20 hover:bg-amber-600/40 border-amber-500/30 text-amber-400' : 'border-slate-700/30 text-slate-600 opacity-40 cursor-not-allowed'}`}>
          <Download className="w-2.5 h-2.5" /> Export .bin
        </button>
      </div>

      {/* Campaign title */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-amber-400 font-mono">{titleKey}</span>
          <span className="text-[8px] text-slate-600">(campaign screen title)</span>
        </div>
        <input
          value={stringsMap[titleKey] || ''}
          onChange={e => set(titleKey, e.target.value)}
          placeholder="Campaign title…"
          className={fieldClass}
        />
      </div>

      {/* Per-faction entries */}
      {factionKeys.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-700/40">
          <p className="text-[9px] text-slate-500 uppercase font-semibold">Faction Entries ({allFactions.length})</p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {factionKeys.map(({ faction, titleKey: tk, descrKey: dk }) => (
              <div key={faction} className="rounded border border-slate-700/30 bg-slate-900/30 p-1.5 space-y-1">
                <span className="text-[10px] font-mono text-slate-300">{faction}</span>
                <div>
                  <span className="text-[8px] text-cyan-600 font-mono">{tk}</span>
                  <input
                    value={stringsMap[tk] || ''}
                    onChange={e => set(tk, e.target.value)}
                    placeholder="Faction title…"
                    className={fieldClass + ' h-6'}
                  />
                </div>
                <div>
                  <span className="text-[8px] text-cyan-600 font-mono">{dk}</span>
                  <textarea
                    value={stringsMap[dk] || ''}
                    onChange={e => set(dk, e.target.value)}
                    placeholder="Faction description…"
                    rows={2}
                    className={fieldClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extra keys from loaded .bin not covered by auto-generation */}
      {extraKeys.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-slate-700/40">
          <p className="text-[9px] text-slate-500 uppercase font-semibold">Other Keys ({extraKeys.length})</p>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {extraKeys.map(k => (
              <div key={k} className="flex items-center gap-1">
                <span className="text-[8px] font-mono text-slate-500 flex-1 truncate" title={k}>{k}</span>
                <input
                  value={stringsMap[k] || ''}
                  onChange={e => set(k, e.target.value)}
                  className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono"
                />
                <button onClick={() => del(k)} className="text-slate-600 hover:text-red-400 shrink-0">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {allFactions.length === 0 && Object.keys(stringsMap).length === 0 && (
        <p className="text-[9px] text-slate-600 italic text-center py-2">
          Load descr_strat.txt to generate faction entries, or load campaign_descriptions.txt.strings.bin directly.
        </p>
      )}
    </div>
  );
}