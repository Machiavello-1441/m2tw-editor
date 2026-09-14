import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Upload } from 'lucide-react';
import { useCustomClimates } from '@/lib/climateStore';
import { buildDescrClimates, buildLookup, buildTextClimates, buildAerialGroundTypes } from '@/lib/climateFilesGen';
import CustomClimateForm from './CustomClimateForm';
import CustomClimateList from './CustomClimateList';

/**
 * Custom strat-map climates: duplicate a vanilla climate under a new name and
 * colour, then generate the mod files the TWC tutorial lists. Generated files
 * are registered as reference assets so they land in the export bundle.
 */
export default function CustomClimatesPanel({ onAssetReady }) {
  const [expanded, setExpanded] = useState(false);
  const customs = useCustomClimates();
  const [descrSrc, setDescrSrc] = useState(null);   // uploaded descr_climates.txt
  const [aerialSrc, setAerialSrc] = useState(null); // uploaded descr_aerial_map_ground_types.txt
  const [status, setStatus] = useState('');

  const readTxt = (setter) => async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (f) setter({ name: f.name, text: await f.text() });
  };

  const generate = () => {
    const descr = buildDescrClimates(descrSrc?.text, customs);
    const asset = (filename, data) => onAssetReady({ filename, type: 'txt', getData: () => data });
    asset('descr_climates.txt', descr.text);
    asset('descr_climates_lookup.txt', buildLookup(descr.names));
    asset('text_climates.txt', buildTextClimates(customs));
    const aerial = buildAerialGroundTypes(aerialSrc?.text, customs);
    if (aerial) asset('descr_aerial_map_ground_types.txt', aerial.text);
    const notes = [`${customs.length} climate(s) written to descr_climates.txt, lookup and text/climates.txt`];
    if (!aerial) notes.push('upload descr_aerial_map_ground_types.txt to have its blocks duplicated too');
    if (descr.missing.length) notes.push(`source block not found for: ${descr.missing.join(', ')}`);
    setStatus(notes.join(' · ') + '. Files are in the Export tab.');
  };

  const UploadBtn = ({ label, file, onChange }) => (
    <label className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[8.5px] border cursor-pointer truncate ${file ? 'bg-green-800/30 border-green-600/40 text-green-300' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`} title={file?.name || label}>
      <Upload className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{file ? file.name : label}</span>
      <input type="file" accept=".txt" className="hidden" onChange={onChange} />
    </label>
  );

  return (
    <div className="rounded border border-slate-700 bg-slate-900/60">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] text-slate-300 font-semibold hover:bg-slate-800/60 transition-colors">
        <span className="flex items-center gap-1.5">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Custom Climates
        </span>
        <span className="text-[9px] text-slate-500">{customs.length} custom</span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-slate-700/50">
          <p className="text-[9px] text-slate-500 pt-1.5 leading-relaxed">
            Duplicate a vanilla climate under a new codename and colour. Custom climates appear in the paint palette, the fill list and the Köppen zone mapping.
          </p>
          <CustomClimateForm />
          <CustomClimateList customs={customs} />

          <div className="space-y-1 pt-1 border-t border-slate-700/50">
            <p className="text-[9px] text-slate-500">Source files (optional — vanilla used otherwise)</p>
            <div className="flex gap-1">
              <UploadBtn label="descr_climates.txt" file={descrSrc} onChange={readTxt(setDescrSrc)} />
              <UploadBtn label="descr_aerial_map_ground_types.txt" file={aerialSrc} onChange={readTxt(setAerialSrc)} />
            </div>
            <button onClick={generate} disabled={customs.length === 0}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-amber-700 border border-amber-600 text-white hover:bg-amber-600 disabled:opacity-50 font-semibold">
              <FileText className="w-3 h-3" /> Generate climate mod files
            </button>
            {status && <p className="text-[9px] text-green-400 leading-snug">{status}</p>}
          </div>
        </div>
      )}
    </div>
  );
}