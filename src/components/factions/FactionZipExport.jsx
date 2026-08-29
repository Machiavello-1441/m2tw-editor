import React, { useState } from 'react';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { encodeStringsBin } from '@/components/strings/stringsBinCodec';
import { BANNERS_GLOBAL_KEY } from './BannersTab';
import { getFile } from '@/lib/bigFileStore';
import { getAllSymbols } from '@/lib/factionSymbolStore';
import { toUtf16leBytes } from '@/lib/utf16';

const entriesToTxt = (entries) =>
  entries.map((e) => `{${String(e.key).replace(/[{}]/g, '')}}${e.value}`).join('\n');

/**
 * Bulk download of all faction-related files as a zip preserving the
 * data\ folder structure, ready to drop into a mod folder.
 */
export default function FactionZipExport({ getFactionsText }) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const zip = new JSZip();
      const factionsText = getFactionsText?.();
      if (factionsText) zip.file('data/descr_sm_factions.txt', factionsText);

      const addLs = (path, key) => {
        try { const v = getFile(key); if (v) zip.file(path, v); } catch {}
      };
      addLs('data/descr_banners_new.xml', BANNERS_GLOBAL_KEY);
      addLs('data/descr_offmap_models.txt', 'm2tw_offmap_models');
      addLs('data/descr_character.txt', 'm2tw_descr_character');
      addLs('data/descr_model_strat.txt', 'm2tw_descr_model_strat');
      addLs('data/descr_names.txt', 'm2tw_names_file');
      addLs('data/descr_cultures.txt', 'm2tw_cultures_file');
      addLs('data/descr_religions.txt', 'm2tw_religions_file');
      addLs('data/export_descr_unit.txt', 'm2tw_units_file');

      // Strings — export both the .strings.bin and a plain .txt version
      const addBin = (baseName, key) => {
        try {
          const raw = getFile(key);
          if (!raw) return;
          const { entries, magic1, magic2 } = JSON.parse(raw);
          if (!entries?.length) return;
          zip.file(`data/text/${baseName}.strings.bin`, encodeStringsBin(entries, magic1 ?? 2, magic2 ?? 2048));
          // M2TW data/text files must be UTF-16LE with BOM, not UTF-8
          zip.file(`data/text/${baseName}`, toUtf16leBytes(entriesToTxt(entries)));
        } catch {}
      };
      addBin('expanded.txt', 'm2tw_strings_bin_global');
      addBin('menu_english.txt', 'm2tw_menu_strings_bin');

      // Faction symbol TGAs (uploaded previews + generated sets)
      try {
        for (const [path, s] of Object.entries(getAllSymbols())) {
          if (s?.buffer) zip.file(path, s.buffer);
        }
      } catch {}

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'faction_files.zip';
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm"
      className="text-[10px] h-7 text-blue-300 border-blue-700 hover:bg-blue-900/30"
      onClick={handleDownload} disabled={busy}>
      <Package className="w-3 h-3 mr-1" />
      {busy ? 'Packing…' : 'Download all (zip)'}
    </Button>
  );
}