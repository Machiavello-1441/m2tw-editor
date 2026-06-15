import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MiscTab({ factionName }) {
  const [offmapModelsData, setOffmapModelsData] = useState('');
  const offmapRef = useRef();

  const loadOffmapModels = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setOffmapModelsData(text);
    localStorage.setItem(`m2tw_offmap_models_${factionName}`, text);
    e.target.value = '';
  }, [factionName]);

  const exportOffmapModels = () => {
    if (!offmapModelsData) return;
    const blob = new Blob([offmapModelsData], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'descr_offmap_models.txt';
    a.click();
  };

  useEffect(() => {
    try {
      const data = localStorage.getItem(`m2tw_offmap_models_${factionName}`);
      if (data) setOffmapModelsData(data);
    } catch {}
  }, [factionName]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-600 pb-2">
        <div>
          <p className="text-sm font-semibold text-slate-200">Miscellaneous Files</p>
          <p className="text-xs text-slate-400">Edit descr_offmap_models.txt and other minor files for {factionName}</p>
        </div>
        <div className="flex gap-2">
          <input ref={offmapRef} type="file" accept=".txt" className="hidden" onChange={loadOffmapModels} />
          <Button variant="outline" size="sm" className="text-[10px]" onClick={() => offmapRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Load
          </Button>
          {offmapModelsData && (
            <Button variant="outline" size="sm" className="text-[10px]" onClick={exportOffmapModels}>
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
          )}
        </div>
      </div>
      {offmapModelsData ? (
        <textarea
          className="w-full h-96 bg-slate-800 border border-slate-600 rounded p-3 text-[10px] font-mono text-slate-200"
          value={offmapModelsData}
          onChange={(e) => {
            setOffmapModelsData(e.target.value);
            localStorage.setItem(`m2tw_offmap_models_${factionName}`, e.target.value);
          }}
        />
      ) : (
        <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-lg">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No misc file loaded</p>
          <p className="text-xs mt-1">Click "Load" to import descr_offmap_models.txt</p>
        </div>
      )}
    </div>
  );
}