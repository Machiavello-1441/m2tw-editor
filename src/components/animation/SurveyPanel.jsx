import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { surveyCasHeader } from '@/lib/casAnimCodec';

export default function SurveyPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.cas'));
    e.target.value = '';
    if (!files.length) return;
    setLoading(true);
    const results = [];
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const info = surveyCasHeader(buf, file.name);
      if (info) results.push(info);
    }
    setRows(results);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <Search className="w-3 h-3" /> Survey .cas Directory
        </p>
        <p className="text-[10px] text-slate-500">Select multiple .cas files to survey headers and footers.</p>
        <label className="cursor-pointer">
          <input type="file" multiple accept=".cas" className="hidden" onChange={handleFiles} />
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-3 text-center hover:border-blue-500 transition-colors">
            <p className="text-xs text-slate-400">{loading ? 'Processing…' : 'Click or drop .cas files'}</p>
          </div>
        </label>
      </div>

      {rows.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{rows.length} files surveyed</p>
            <button onClick={() => setRows([])} className="text-slate-500 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead className="bg-slate-800 text-slate-500 uppercase text-[9px]">
                <tr>
                  {['Filename', 'Ver', 'AnimTime', 'BodySize', 'nBones', 'Sig1', 'Sig2'].map(h => (
                    <th key={h} className="px-3 py-1.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-1 text-slate-200 max-w-[200px] truncate">{r.filename}</td>
                    <td className="px-3 py-1 text-yellow-400">{r.version}</td>
                    <td className="px-3 py-1 text-slate-300">{r.animTime}s</td>
                    <td className="px-3 py-1 text-slate-400">{r.bodySize}</td>
                    <td className="px-3 py-1 text-blue-400">{r.nBones}</td>
                    <td className="px-3 py-1 text-slate-400">{r.sig1}</td>
                    <td className="px-3 py-1 text-slate-400">{r.sig2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}