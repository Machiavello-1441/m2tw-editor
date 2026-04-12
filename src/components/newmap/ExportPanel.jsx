import React, { useState } from 'react';
import { Download, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { LAYER_DEFS } from '@/lib/mapLayerStore';
import { downloadTGA, validateRegionMap } from '@/lib/tgaEncoder';
import JSZip from 'jszip';

export default function ExportPanel({ layers, baseResolution }) {
  const [results, setResults] = useState([]);
  const [exporting, setExporting] = useState(false);

  const validateAll = () => {
    const res = [];
    for (const def of LAYER_DEFS) {
      const layer = layers[def.id];
      if (!layer?.imageData) { res.push({ id: def.id, label: def.label, status: 'missing' }); continue; }
      if (def.id === 'map_regions') {
        const v = validateRegionMap(layer.imageData);
        res.push({ id: def.id, label: def.label, status: v.valid ? 'ok' : 'warn', detail: `${v.regionCount} regions` });
      } else {
        res.push({ id: def.id, label: def.label, status: 'ok' });
      }
    }
    setResults(res);
    return res;
  };

  const exportSingle = (defId) => {
    const def = LAYER_DEFS.find(d => d.id === defId);
    const layer = layers[defId];
    if (!def || !layer?.imageData) return;
    downloadTGA(layer.imageData, def.filename, def.mode);
  };

  const exportAll = async () => {
    setExporting(true);
    const validation = validateAll();
    const zip = new JSZip();
    for (const def of LAYER_DEFS) {
      const layer = layers[def.id];
      if (!layer?.imageData) continue;
      const { encodeTGA } = await import('@/lib/tgaEncoder');
      const buf = encodeTGA(layer.imageData, def.mode);
      zip.file(def.filename, buf);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'm2tw_map_layers.zip'; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={validateAll}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition-colors">
          <CheckCircle className="w-3.5 h-3.5" /> Validate Layers
        </button>
        <button onClick={exportAll} disabled={exporting}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors">
          <Package className="w-3.5 h-3.5" /> {exporting ? 'Exporting…' : 'Export Bundle'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map(r => (
            <div key={r.id} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-800 border border-slate-700">
              {r.status === 'ok' && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
              {r.status === 'warn' && <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />}
              {r.status === 'missing' && <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />}
              <span className="text-[11px] text-slate-300 flex-1">{r.label}</span>
              {r.detail && <span className="text-[9px] text-slate-500">{r.detail}</span>}
              {r.status !== 'missing' && (
                <button onClick={() => exportSingle(r.id)}
                  className="text-slate-500 hover:text-amber-400 transition-colors">
                  <Download className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-[10px] text-slate-500 font-semibold">Export Individual</p>
        {LAYER_DEFS.map(def => (
          <div key={def.id} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: def.defaultColor }} />
            <span className="text-[11px] text-slate-400 flex-1 font-mono">{def.filename}</span>
            <button onClick={() => exportSingle(def.id)}
              disabled={!layers[def.id]?.imageData}
              className="text-slate-500 hover:text-amber-400 disabled:opacity-30 transition-colors">
              <Download className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}