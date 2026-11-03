import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

export default function OsmPackImportControls({ disabled, onImport }) {
  const input = useRef(null);
  const choose = event => {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (!files.length) return;
    if (files.some(file => file.size > 536870912) && !window.confirm('This selection contains an archive larger than 512 MiB. It may require substantial browser memory. Smaller Geofabrik subregions are safer. Continue?')) return;
    onImport(files);
  };
  return <div className="space-y-1.5">
    <input ref={input} type="file" accept=".zip" multiple hidden aria-label="Import Geofabrik shapefile ZIPs" onChange={choose} />
    <button type="button" disabled={disabled} onClick={() => input.current.click()} className="flex w-full items-center justify-center gap-1.5 rounded border bg-primary px-2 py-2 text-[11px] text-primary-foreground disabled:opacity-50"><Upload className="h-3 w-3" />Import downloaded shapefile ZIPs</button>
    <p className="text-[9px] text-muted-foreground">Processed locally; no files are uploaded. Map-relevant polygons are saved in this browser. Import multiple packs for cross-border maps.</p>
    <p className="text-[9px] text-muted-foreground">Shapefile ZIP only, up to 1.2 GiB per archive and 384 MiB expanded per layer. Buildings, point and line layers are skipped. PBF and GeoPackage are not supported yet.</p>
  </div>;
}