import React, { useRef, useState } from 'react';
import { HYDRO_REGIONS } from '@/components/newmap/hydrorivers/regions';

export default function HydroRegionImport({ busy, names, onImport }) {
  const [region, setRegion] = useState('eu'), input = useRef(null);
  const selected = HYDRO_REGIONS.find(item => item.id === region);
  return (
    <div className="space-y-2">
      <label className="block text-[10px] text-muted-foreground">1. Download regional data
        <select value={region} onChange={event => setRegion(event.target.value)} className="mt-1 w-full rounded border bg-background text-foreground p-1.5">
          {HYDRO_REGIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <a href={selected.url} target="_blank" rel="noopener noreferrer" className="block rounded border bg-secondary text-secondary-foreground p-1.5 text-center text-[10px]">Download official ZIP ({selected.size} MB)</a>
      <p className="text-[9px] text-muted-foreground">Keep the ZIP intact. For maps crossing data regions, import each regional package. HydroSHEDS may ask you to complete browser verification before downloading.</p>
      <input ref={input} type="file" accept=".zip,.geojson,.json" multiple className="hidden" aria-label="Import HydroRIVERS regional data" onChange={event => { onImport(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <button type="button" disabled={!!busy} onClick={() => input.current.click()} className="w-full rounded border bg-primary text-primary-foreground p-1.5 text-[10px] disabled:opacity-50">2. Import downloaded ZIP / GeoJSON</button>
      <p className="text-[9px] text-muted-foreground">Processed locally in your browser; no files are uploaded. GeoJSON must retain HydroRIVERS attributes. Data remains available in this tab.</p>
      {names.length > 0 && <p className="text-[9px] text-muted-foreground break-all">Loaded: {names.join(', ')}</p>}
      <a href="https://www.hydrosheds.org/products/hydrorivers" target="_blank" rel="noopener noreferrer" className="block text-[9px] underline text-muted-foreground">HydroRIVERS v1 • Lehner &amp; Grill (2013) • Data and license terms</a>
    </div>
  );
}