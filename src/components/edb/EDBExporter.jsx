/**
 * EDBExporter — exports a ZIP containing:
 *   data/export_descr_buildings.txt
 *   data/text/export_buildings.txt.strings.bin
 *
 * The strings.bin is built by:
 *  1. Loading the user's existing export_buildings.txt.strings.bin (optional)
 *  2. Collecting all text keys needed for every building/level in edbData
 *  3. Merging: existing entries are kept; new keys are appended with values
 *     from textData (falling back to base desc if culture-specific is empty)
 */

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileArchive, Upload } from 'lucide-react';
import { useEDB } from './EDBContext';
import { useRefData } from './RefDataContext';
import { serializeEDB } from './EDBParser';
import { parseStringsBin, encodeStringsBin } from '../strings/stringsBinCodec';

// Collect all text entries needed from the current edbData + textData
function buildExpectedEntries(edbData, textData, cultures) {
  const entries = []; // [{ key, value }] in desired order

  const get = (key, fallback = '') => {
    const v = textData[key];
    return (v !== undefined && v !== null && v !== '') ? v : fallback;
  };

  for (const building of edbData.buildings) {
    // Building tree name
    const treeNameKey = `${building.name}_name`;
    entries.push({ key: treeNameKey, value: get(treeNameKey) });

    for (const level of building.levels) {
      const baseName = get(level.name, level.name);
      const baseDesc = get(`${level.name}_desc`, '');
      const baseShort = get(`${level.name}_desc_short`, '');

      // Base level entries
      entries.push({ key: level.name,                    value: baseName });
      entries.push({ key: `${level.name}_desc`,          value: baseDesc });
      entries.push({ key: `${level.name}_desc_short`,    value: baseShort });

      // Per-culture entries
      for (const culture of cultures) {
        const cName  = get(`${level.name}_${culture}`,            baseName);
        const cDesc  = get(`${level.name}_${culture}_desc`,       baseDesc);
        const cShort = get(`${level.name}_${culture}_desc_short`, baseShort);

        entries.push({ key: `${level.name}_${culture}`,            value: cName });
        entries.push({ key: `${level.name}_${culture}_desc`,       value: cDesc });
        entries.push({ key: `${level.name}_${culture}_desc_short`, value: cShort });
      }
    }
  }

  return entries;
}

// Merge new entries into existing entries list (keyed by key string)
function mergeEntries(existingEntries, newEntries) {
  const map = new Map();
  for (const e of existingEntries) map.set(e.key, e.value);
  // Add missing keys at the end
  for (const e of newEntries) {
    if (!map.has(e.key)) {
      map.set(e.key, e.value);
    }
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

export default function EDBExporter() {
  const { edbData, textData, fileName } = useEDB();
  const { cultures } = useRefData();
  const [existingBin, setExistingBin] = useState(null); // { entries, magic1, magic2 }
  const [binFileName, setBinFileName] = useState('');
  const [exporting, setExporting] = useState(false);
  const binRef = useRef();

  const handleBinLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseStringsBin(ev.target.result);
      if (parsed) {
        setExistingBin(parsed);
        setBinFileName(file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = async () => {
    if (!edbData) return;
    setExporting(true);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // 1. EDB file — encode as UTF-8 with Windows line endings (CRLF)
      const edbText = serializeEDB(edbData).replace(/\n/g, '\r\n');
      zip.file('data/export_descr_buildings.txt', edbText);

      // 2. Strings.bin
      const expectedEntries = buildExpectedEntries(edbData, textData, cultures);
      const baseEntries = existingBin ? existingBin.entries : [];
      const merged = mergeEntries(baseEntries, expectedEntries);
      const magic1 = existingBin?.magic1 ?? 2;
      const magic2 = existingBin?.magic2 ?? 2048;
      const binBuffer = encodeStringsBin(merged, magic1, magic2);
      zip.file('data/text/export_buildings.txt.strings.bin', binBuffer);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'edb_export.zip';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Optional: load existing .strings.bin to merge into */}
      <input ref={binRef} type="file" className="hidden" accept=".bin,.strings.bin" onChange={handleBinLoad} />
      <button
        onClick={() => binRef.current?.click()}
        className="h-7 px-2 rounded text-[10px] font-medium flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors shrink-0"
        title="Load existing export_buildings.txt.strings.bin to merge new entries into it"
      >
        <Upload className="w-3 h-3" />
        <span className="hidden xl:block">{binFileName || 'Load .bin'}</span>
        {binFileName && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
      </button>

      <Button
        size="sm"
        disabled={!edbData || exporting}
        onClick={handleExport}
        className="bg-green-700 text-white px-3 text-xs font-medium rounded-md inline-flex items-center justify-center h-7 gap-1 shrink-0 hover:bg-green-600 disabled:opacity-50"
        title="Export ZIP: export_descr_buildings.txt + export_buildings.txt.strings.bin"
      >
        <FileArchive className="w-3 h-3" />
        <span className="hidden lg:block">{exporting ? 'Exporting…' : 'Export EDB+Desc'}</span>
      </Button>
    </div>
  );
}