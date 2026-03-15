import React, { useRef, useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import { useRefData } from '../components/edb/RefDataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import {
  Swords, FolderOpen, CheckCircle2, AlertCircle, Clock,
  FileText, Package, ArrowRight, Info, Castle, Image, Map, Layers
} from 'lucide-react';

function decodeTgaToDataUrl(buffer) {
  const data = new Uint8Array(buffer);
  if (data.length < 18) return null;
  const idLength = data[0], colorMapType = data[1], imageType = data[2];
  const width = data[12] | (data[13] << 8), height = data[14] | (data[15] << 8);
  const bpp = data[16], imageDescriptor = data[17];
  const topOrigin = !!(imageDescriptor & 0x20);
  if (colorMapType !== 0 || (imageType !== 2 && imageType !== 10)) return null;
  if (bpp !== 24 && bpp !== 32) return null;
  if (width === 0 || height === 0) return null;
  const headerSize = 18 + idLength;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let srcIdx = headerSize, pixIdx = 0;
  if (imageType === 2) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
      const a = bpp === 32 ? data[srcIdx++] : 255;
      pixels[pixIdx++] = r; pixels[pixIdx++] = g; pixels[pixIdx++] = b; pixels[pixIdx++] = a;
    }
  } else {
    let pixel = 0;
    while (pixel < width * height) {
      const rc = data[srcIdx++], count = (rc & 0x7f) + 1;
      if (rc & 0x80) {
        const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
        const a = bpp === 32 ? data[srcIdx++] : 255;
        for (let i = 0; i < count; i++, pixel++) { pixels[pixIdx++]=r; pixels[pixIdx++]=g; pixels[pixIdx++]=b; pixels[pixIdx++]=a; }
      } else {
        for (let i = 0; i < count; i++, pixel++) {
          const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
          const a = bpp === 32 ? data[srcIdx++] : 255;
          pixels[pixIdx++]=r; pixels[pixIdx++]=g; pixels[pixIdx++]=b; pixels[pixIdx++]=a;
        }
      }
    }
  }
  if (!topOrigin) {
    const rowSize = width * 4;
    for (let y = 0; y < Math.floor(height / 2); y++) {
      const top = y * rowSize, bot = (height - 1 - y) * rowSize;
      for (let i = 0; i < rowSize; i++) { const tmp = pixels[top+i]; pixels[top+i]=pixels[bot+i]; pixels[bot+i]=tmp; }
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

// Files we look for in the data\ folder (matched by filename only, regardless of subfolder)
const DATA_FILE_MAP = {
  'export_descr_buildings.txt':         'edb',
  'descr_sm_factions.txt':              'fac',
  'descr_sm_resources.txt':             'res',
  'export_descr_unit.txt':              'unit',
  'descr_events.txt':                   'ev',
  'export_buildings.txt':               'txt',
  'export_descr_character_traits.txt':  'traits',
  'export_descr_ancillaries.txt':       'anc',
  'export_vnvs.txt':                    'vnvs',   // lower-cased for matching
  'export_ancillaries.txt':             'anctxt',
  'export_units.txt':                   'expunits',
};



function FileStatus({ label, hint, status }) {
  const colors = {
    idle:    'border-border bg-card text-muted-foreground',
    ok:      'border-green-500/40 bg-green-500/5 text-green-400',
    error:   'border-destructive/40 bg-destructive/5 text-destructive',
    loading: 'border-primary/30 bg-primary/5 text-primary',
  };
  const icons = {
    idle:    <Clock className="w-3.5 h-3.5 shrink-0 opacity-40" />,
    ok:      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-400" />,
    error:   <AlertCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />,
    loading: <div className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />,
  };
  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${colors[status]}`}>
      {icons[status]}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold leading-none">{label}</p>
        <p className="text-[10px] opacity-60 mt-0.5 truncate font-mono">{hint}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { loadEDB, edbData, fileName, loadTextFile } = useEDB();
  const { loadFactionsFile, loadResourcesFile, loadEventsFile, loadUnitsFile } = useRefData();

  const [fileStatus, setFileStatus] = useState(() => {
    // Show 'ok' for files already cached in localStorage from a previous session
    const ls = (k) => { try { return !!localStorage.getItem(k); } catch { return false; } };
    return {
      edb:        ls('m2tw_edb_file')          ? 'ok' : 'idle',
      fac:        ls('m2tw_factions_file')     ? 'ok' : 'idle',
      res:        ls('m2tw_resources_file')    ? 'ok' : 'idle',
      ev:         ls('m2tw_events_file')       ? 'ok' : 'idle',
      unit:       ls('m2tw_units_file')        ? 'ok' : 'idle',
      txt:        ls('m2tw_edb_txt_file')      ? 'ok' : 'idle',
      traits:     ls('m2tw_traits_file')       ? 'ok' : 'idle',
      anc:        ls('m2tw_anc_file')          ? 'ok' : 'idle',
      vnvs:       ls('m2tw_vnvs_file')         ? 'ok' : 'idle',
      anctxt:     ls('m2tw_anctxt_file')       ? 'ok' : 'idle',
      expunits:   ls('m2tw_export_units_file') ? 'ok' : 'idle',
      anc_images: 'idle',
      unit_images:'idle',
    };
  });

  const [modName, setModName] = useState(() => {
    try { return localStorage.getItem('m2tw_mod_name') || 'my_mod'; } catch { return 'my_mod'; }
  });
  const [ancImgCount, setAncImgCount] = useState(0);
  const [mapFileCount, setMapFileCount] = useState(0);
  const [unitImgCount, setUnitImgCount] = useState(0);
  const dataFolderRef = useRef();
  const ancImagesFolderRef = useRef();
  const mapFolderRef = useRef();
  const unitUiFolderRef = useRef();

  const readText = (file) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsText(file);
  });

  const handleDataFolder = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    const loaderMap = {
      fac: loadFactionsFile,
      res: loadResourcesFile,
      ev: loadEventsFile,
      unit: loadUnitsFile,
      txt: loadTextFile,
    };

    // Storage keys for files loaded by their own editors
    const storeKeys = {
      traits:    'm2tw_traits_file',
      anc:       'm2tw_anc_file',
      vnvs:      'm2tw_vnvs_file',
      anctxt:    'm2tw_anctxt_file',
      expunits:  'm2tw_export_units_file',
    };

    for (const file of files) {
      const name = file.name.toLowerCase();
      const key = DATA_FILE_MAP[name];
      if (!key) continue;

      setFileStatus(prev => ({ ...prev, [key]: 'loading' }));
      const text = await readText(file);
      if (key === 'edb') {
        loadEDB(text, file.name);
      } else if (storeKeys[key]) {
        // Persist in localStorage so the dedicated editors can pick it up
        try {
          localStorage.setItem(storeKeys[key], text);
          localStorage.setItem(storeKeys[key] + '_name', file.name);
        } catch {}
      } else {
        loaderMap[key]?.(text);
      }
      setFileStatus(prev => ({ ...prev, [key]: 'ok' }));
    }
  };

  const handleAncImagesFolder = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.tga'));
    e.target.value = '';
    if (files.length === 0) return;
    setFileStatus(prev => ({ ...prev, anc_images: 'loading' }));
    const images = {};
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const dataUrl = decodeTgaToDataUrl(buf);
      if (dataUrl) {
        const key = file.name.replace(/\.tga$/i, '').toLowerCase();
        images[key] = dataUrl;
      }
    }
    window.dispatchEvent(new CustomEvent('load-anc-tga-batch', { detail: images }));
    setAncImgCount(Object.keys(images).length);
    setFileStatus(prev => ({ ...prev, anc_images: 'ok' }));
  };

  const handleUnitUiFolder = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.tga'));
    e.target.value = '';
    if (files.length === 0) return;
    setFileStatus(prev => ({ ...prev, unit_images: 'loading' }));
    const images = {};
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const dataUrl = decodeTgaToDataUrl(buf);
      if (dataUrl) {
        // Strip .tga, lowercase; keep filename only (not path)
        const key = file.name.replace(/\.tga$/i, '').toLowerCase();
        images[key] = dataUrl;
      }
    }
    window.dispatchEvent(new CustomEvent('load-unit-images', { detail: images }));
    setUnitImgCount(Object.keys(images).length);
    setFileStatus(prev => ({ ...prev, unit_images: 'ok' }));
  };

  const handleMapFolder = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const mapTgaFiles = files.filter(f => f.name.toLowerCase().endsWith('.tga') || f.name.toLowerCase().endsWith('.txt'));
    if (mapTgaFiles.length === 0) return;
    // Store raw files in sessionStorage key for CampaignMap to pick up
    // We dispatch a custom event so CampaignMap can react if open, or store names for reference
    const tgaNames = mapTgaFiles.filter(f => f.name.toLowerCase().endsWith('.tga')).map(f => f.name.toLowerCase());
    const txtNames = mapTgaFiles.filter(f => f.name.toLowerCase().endsWith('.txt')).map(f => f.name.toLowerCase());
    setMapFileCount(mapTgaFiles.length);
    setFileStatus(prev => ({ ...prev, map_folder: 'ok' }));
    // Cache files globally so CampaignMap page can load them
    window._m2tw_map_files = mapTgaFiles;
    window.dispatchEvent(new CustomEvent('m2tw-map-folder-loaded', { detail: { files: mapTgaFiles } }));
  };

  const edbLoaded = fileStatus.edb === 'ok' || !!edbData?.buildings?.length;

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-start gap-6 pt-12">

      {/* Header */}
      <div className="text-center space-y-2 max-w-xl">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <Swords className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">M2TW Mod Editor</h1>
        <p className="text-sm text-muted-foreground">
          Load your mod's files to begin editing. Use the Export page when done to download a complete
          <code className="text-xs bg-accent px-1 py-0.5 rounded mx-1">[mod name]\data\</code>folder ready to drop into your M2TW mods directory.
        </p>
      </div>

      {/* Mod Name */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <Package className="w-4 h-4 text-primary shrink-0" />
        <label className="text-xs font-semibold text-foreground whitespace-nowrap">Mod Name</label>
        <input
          type="text"
          value={modName}
          onChange={e => {
            const v = e.target.value.replace(/[^a-zA-Z0-9_\-]/g, '_');
            setModName(v);
            try { localStorage.setItem('m2tw_mod_name', v); } catch {}
          }}
          placeholder="my_mod"
          className="flex-1 h-8 px-3 text-xs bg-background border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Used in the exported zip path</span>
      </div>

      {/* Step 1 — data folder */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-accent/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Castle className="w-4 h-4 text-primary" />
            Step 1 — Load <code className="text-xs font-mono bg-accent px-1 py-0.5 rounded">data\</code> Folder
          </h2>

          <p className="text-[11px] text-muted-foreground mt-1">
            Finds buildings, traits, ancillaries, factions, resources, units, events and text files — just browse the whole <code className="text-[10px] font-mono bg-accent px-1 rounded">data\</code> folder.
            Traits &amp; ancillaries files are cached and auto-loaded when you open their editors.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <label className="cursor-pointer">
            <input ref={dataFolderRef} type="file" className="hidden"
              webkitdirectory="" directory="" multiple onChange={handleDataFolder} />
            <Button asChild variant="outline"
              className="w-full h-11 border-primary/30 text-primary hover:bg-primary/10 pointer-events-none gap-2">
              <span>
                <FolderOpen className="w-4 h-4" />
                Browse to <code className="text-xs font-mono">…\data\</code> folder
              </span>
            </Button>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <FileStatus label="Buildings (EDB)" hint="export_descr_buildings.txt"        status={fileStatus.edb} />
            <FileStatus label="Building Text"   hint="text\export_buildings.txt"         status={fileStatus.txt} />
            <FileStatus label="Factions"        hint="descr_sm_factions.txt"             status={fileStatus.fac} />
            <FileStatus label="Resources"       hint="descr_sm_resources.txt"            status={fileStatus.res} />
            <FileStatus label="Units"           hint="export_descr_unit.txt"             status={fileStatus.unit} />
            <FileStatus label="Events"          hint="descr_events.txt"                  status={fileStatus.ev} />
            <FileStatus label="Traits"          hint="export_descr_character_traits.txt" status={fileStatus.traits} />
            <FileStatus label="Traits Text"     hint="text\export_VnVs.txt"              status={fileStatus.vnvs} />
            <FileStatus label="Ancillaries"     hint="export_descr_ancillaries.txt"      status={fileStatus.anc} />
            <FileStatus label="Ancillaries Text" hint="text\export_ancillaries.txt"      status={fileStatus.anctxt} />
            <FileStatus label="Unit Descriptions" hint="text\export_units.txt"           status={fileStatus.expunits} />
          </div>
        </div>
      </div>

      {/* Step 2 — Campaign Map folder */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-accent/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            Step 2 — Load Campaign Map Folder <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Browse to your mod's <code className="text-[10px] font-mono bg-accent px-1 rounded">data\world\maps\campaign\[campaign_name]\</code> or the
            <code className="text-[10px] font-mono bg-accent px-1 rounded ml-1">base\</code> folder.
            Loads <code className="text-[10px] font-mono bg-accent px-1 rounded">map_*.tga</code>,{' '}
            <code className="text-[10px] font-mono bg-accent px-1 rounded">descr_strat.txt</code>, and <code className="text-[10px] font-mono bg-accent px-1 rounded">descr_regions.txt</code> into the Campaign Map editor.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <label className="cursor-pointer">
            <input ref={mapFolderRef} type="file" className="hidden"
              webkitdirectory="" directory="" multiple onChange={handleMapFolder} />
            <Button asChild variant="outline"
              className="w-full h-11 border-primary/30 text-primary hover:bg-primary/10 pointer-events-none gap-2">
              <span>
                <FolderOpen className="w-4 h-4" />
                Browse to <code className="text-xs font-mono">…\maps\campaign\[name]\</code> folder
              </span>
            </Button>
          </label>
          <div className="grid grid-cols-1 gap-2">
            <FileStatus
              label="Campaign Map Files"
              hint={fileStatus.map_folder === 'ok' ? `${mapFileCount} files loaded — open Campaign Map editor to start editing` : 'map_*.tga, descr_strat.txt, descr_regions.txt'}
              status={fileStatus.map_folder || 'idle'}
            />
          </div>
          {fileStatus.map_folder === 'ok' && (
            <Link to="/CampaignMap">
              <Button className="w-full h-10 gap-2" variant="outline">
                <Map className="w-4 h-4" />
                Open Campaign Map Editor
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Step 3 — Ancillaries UI images */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-accent/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Image className="w-4 h-4 text-primary" />
            Step 3 — Load Ancillary UI Images <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Browse to <code className="text-[10px] font-mono bg-accent px-1 rounded">data\ui\ancillaries\</code> to load all <code className="text-[10px] font-mono bg-accent px-1 rounded">.tga</code> images for live previews in the Ancillaries editor.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <label className="cursor-pointer">
            <input ref={ancImagesFolderRef} type="file" className="hidden"
              webkitdirectory="" directory="" multiple onChange={handleAncImagesFolder} />
            <Button asChild variant="outline" className="w-full h-11 pointer-events-none gap-2">
              <span>
                <FolderOpen className="w-4 h-4" />
                Browse to <code className="text-xs font-mono">…\data\ui\ancillaries\</code> folder
              </span>
            </Button>
          </label>
          <div className="grid grid-cols-1 gap-2">
            <FileStatus
              label="Ancillary Images"
              hint={fileStatus.anc_images === 'ok' ? `${ancImgCount} .tga images loaded` : 'data\\ui\\ancillaries\\'}
              status={fileStatus.anc_images}
            />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="w-full max-w-2xl flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Browsers can read but not write to disk. When you're done editing, go to <strong className="text-foreground">Export</strong> to download a zip of your
          complete <code className="text-[10px] font-mono bg-accent px-1 rounded">{modName || 'my_mod'}\data\</code> folder.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full max-w-2xl flex flex-col gap-2">
        {edbLoaded && (
          <Link to={createPageUrl('EDBEditor')}>
            <Button className="w-full h-11 gap-2">
              <Castle className="w-4 h-4" />
              Open EDB Editor
              {fileName && <span className="text-xs opacity-60 font-mono">({fileName})</span>}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </Link>
        )}
        {edbLoaded && (
          <div className="flex gap-2 flex-wrap justify-center pt-1">
            <Badge variant="outline" className="text-[10px]">{edbData.buildings.length} buildings</Badge>
            <Badge variant="outline" className="text-[10px]">{edbData.buildings.reduce((s, b) => s + b.levels.length, 0)} levels</Badge>
            <Badge variant="outline" className="text-[10px]">{edbData.hiddenResources.length} hidden resources</Badge>
          </div>
        )}
      </div>
    </div>
  );
}