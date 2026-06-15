import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BannersTab({ factionName }) {
  const [bannersData, setBannersData] = useState('');
  const fileRef = useRef();

  const loadBanners = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBannersData(text);
    localStorage.setItem(`m2tw_banners_${factionName}`, text);
    e.target.value = '';
  }, [factionName]);

  const exportBanners = () => {
    if (!bannersData) return;
    const blob = new Blob([bannersData], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'descr_banners_new.xml';
    a.click();
  };

  useEffect(() => {
    try {
      const data = localStorage.getItem(`m2tw_banners_${factionName}`);
      if (data) setBannersData(data);
    } catch {}
  }, [factionName]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-600 pb-2">
        <div>
          <p className="text-sm font-semibold text-slate-200">Banners Configuration</p>
          <p className="text-xs text-slate-400">Upload and edit descr_banners_new.xml for {factionName}</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={loadBanners} />
          <Button variant="outline" size="sm" className="text-[10px]" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Load XML
          </Button>
          {bannersData && (
            <Button variant="outline" size="sm" className="text-[10px]" onClick={exportBanners}>
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
          )}
        </div>
      </div>
      {bannersData ? (
        <textarea
          className="w-full h-96 bg-slate-800 border border-slate-600 rounded p-3 text-[10px] font-mono text-slate-200"
          value={bannersData}
          onChange={(e) => {
            setBannersData(e.target.value);
            localStorage.setItem(`m2tw_banners_${factionName}`, e.target.value);
          }}
        />
      ) : (
        <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-lg">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No banners file loaded</p>
          <p className="text-xs mt-1">Click "Load XML" to import descr_banners_new.xml</p>
        </div>
      )}
    </div>
  );
}