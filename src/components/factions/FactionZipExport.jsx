import React, { useState } from 'react';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { getAllSymbols } from '@/lib/factionSymbolStore';
import { addSharedEditedFilesToZip } from '@/components/export/sharedEditedFilesExport';

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


      // Faction symbol TGAs (uploaded previews + generated sets)
      try {
        for (const [path, s] of Object.entries(getAllSymbols())) {
          if (s?.buffer) zip.file(path, s.buffer);
        }
      } catch {}

      addSharedEditedFilesToZip(zip.folder('data'));
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