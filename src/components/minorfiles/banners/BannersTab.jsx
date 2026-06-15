import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Plus, Trash2, Copy, ChevronDown, ChevronRight, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseBannersXml, serialiseBannersXml } from './bannersParser';
import { loadTextureFiles, getTexturePreview, getStoreSize } from './TextureStore';

const STORAGE_KEY = 'm2tw_banners_file';

// ── Small helpers ────────────────────────────────────────────────────────────

function TextureThumb({ path }) {
  const url = getTexturePreview(path);
  const [ok, setOk] = useState(true);
  if (!url) return <span className="w-5 h-5 shrink-0" />;
  return ok ? (
    <img src={url} alt="" title={path}
      onError={() => setOk(false)}
      className="w-5 h-5 object-contain rounded shrink-0 border border-slate-600 bg-slate-800 cursor-pointer"
      onClick={() => window.open(url, '_blank')} />
  ) : (
    <span className="w-5 h-5 shrink-0 rounded border border-slate-700 bg-slate-800 flex items-center justify-center text-[7px] text-slate-500" title="No preview">?</span>
  );
}

function TexRow({ t, onChange, onDelete, onDuplicate, showMesh, texCount }) {
  const diffUrl = getTexturePreview(t.diffuseMap);
  const transUrl = getTexturePreview(t.translucencyMap);
  const cols = showMesh
    ? `20px 1fr 1fr 1fr 1fr 20px 20px auto auto`
    : `20px 1fr 1fr 1fr 20px 20px auto auto`;
  return (
    <div className="grid items-center gap-1 py-0.5 border-b border-slate-800 last:border-0 text-[10px] group"
      style={{ gridTemplateColumns: cols }}>
      {/* faction colour swatch placeholder */}
      <span />
      <Input className="h-5 text-[9px] px-1" value={t.faction}
        onChange={e => onChange('faction', e.target.value)} placeholder="Faction" />
      {showMesh && (
        <Input className="h-5 text-[9px] px-1" value={t.mesh || ''}
          onChange={e => onChange('mesh', e.target.value)} placeholder="Mesh path" />
      )}
      <Input className="h-5 text-[9px] px-1" value={t.diffuseMap}
        onChange={e => onChange('diffuseMap', e.target.value)} placeholder="DiffuseMap" />
      <Input className="h-5 text-[9px] px-1" value={t.translucencyMap}
        onChange={e => onChange('translucencyMap', e.target.value)} placeholder="TranslucencyMap" />
      <TextureThumb path={t.diffuseMap} key={`d-${t.diffuseMap}-${texCount}`} />
      <TextureThumb path={t.translucencyMap} key={`tr-${t.translucencyMap}-${texCount}`} />
      <button onClick={onDuplicate} title="Duplicate"
        className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 transition-opacity px-0.5">
        <Copy className="w-3 h-3" />
      </button>
      <button onClick={onDelete} title="Delete"
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity px-0.5">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function TexHeader({ showMesh }) {
  const cols = showMesh
    ? `20px 1fr 1fr 1fr 1fr 20px 20px auto auto`
    : `20px 1fr 1fr 1fr 20px 20px auto auto`;
  return (
    <div className="grid gap-1 pb-0.5 mb-1 border-b border-slate-700 text-[9px] text-slate-500 font-mono"
      style={{ gridTemplateColumns: cols }}>
      <span />
      <span>Faction</span>
      {showMesh && <span>Mesh</span>}
      <span>DiffuseMap</span>
      <span>TranslucencyMap</span>
      <span title="Diffuse preview" className="text-[8px] text-center">D</span>
      <span title="Translucency preview" className="text-[8px] text-center">T</span>
      <span className="w-3" /><span className="w-3" />
    </div>
  );
}

// ── Banner card ──────────────────────────────────────────────────────────────

function FactionBannerCard({ banner, onChange, onDelete, onDuplicate, texCount }) {
  const [open, setOpen] = useState(false);

  const updateField = (field, val) => onChange({ ...banner, [field]: val });
  const updateTex = (i, field, val) => {
    const textures = banner.textures.map((t, idx) => idx === i ? { ...t, [field]: val } : t);
    onChange({ ...banner, textures });
  };
  const addTex = () => onChange({ ...banner, textures: [...banner.textures, { faction: '', diffuseMap: '', translucencyMap: '' }] });
  const dupTex = (i) => {
    const copy = { ...banner.textures[i], faction: banner.textures[i].faction + '_COPY' };
    const textures = [...banner.textures.slice(0, i + 1), copy, ...banner.textures.slice(i + 1)];
    onChange({ ...banner, textures });
  };
  const delTex = (i) => onChange({ ...banner, textures: banner.textures.filter((_, idx) => idx !== i) });

  return (
    <div className="border border-slate-700 rounded bg-slate-900/50 mb-2">
      <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none hover:bg-slate-800/60 rounded-t"
        onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />}
        <span className="text-[11px] font-mono text-amber-400 flex-1">{banner.name || '(unnamed)'}</span>
        <span className="text-[9px] text-slate-500">{banner.textures.length} textures</span>
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }}
          title="Duplicate banner" className="text-blue-400 hover:text-blue-300 p-0.5">
          <Copy className="w-3 h-3" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete banner" className="text-red-500 hover:text-red-400 p-0.5">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          {/* Banner attributes */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
            {[['name','Name'],['mainMesh','MainMesh'],['miniMesh','MiniMesh'],['generalMesh','GeneralMesh'],
              ['buildingMesh','BuildingMesh'],['effectOffsetX','EffectOffsetX'],['effectOffsetY','EffectOffsetY'],['effectOffsetZ','EffectOffsetZ']
            ].map(([field, label]) => (
              <React.Fragment key={field}>
                <label className="text-slate-400 self-center font-mono">{label}</label>
                <Input className="h-5 text-[9px] px-1" value={banner[field] || ''}
                  onChange={e => updateField(field, e.target.value)} />
              </React.Fragment>
            ))}
          </div>
          {/* Textures */}
          <div className="mt-2">
            <TexHeader showMesh={false} />
            {banner.textures.map((t, i) => (
              <TexRow key={i} t={t} showMesh={false} texCount={texCount}
                onChange={(field, val) => updateTex(i, field, val)}
                onDuplicate={() => dupTex(i)}
                onDelete={() => delTex(i)} />
            ))}
            <button onClick={addTex}
              className="mt-1 flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300">
              <Plus className="w-3 h-3" /> Add texture entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MeshBannerCard({ banner, onChange, onDelete, onDuplicate, texCount }) {
  const [open, setOpen] = useState(false);

  const updateMT = (i, field, val) => {
    const meshesAndTextures = banner.meshesAndTextures.map((t, idx) => idx === i ? { ...t, [field]: val } : t);
    onChange({ ...banner, meshesAndTextures });
  };
  const addMT = () => onChange({ ...banner, meshesAndTextures: [...banner.meshesAndTextures, { faction: '', mesh: '', diffuseMap: '', translucencyMap: '' }] });
  const dupMT = (i) => {
    const copy = { ...banner.meshesAndTextures[i], faction: banner.meshesAndTextures[i].faction + '_COPY' };
    const mt = [...banner.meshesAndTextures.slice(0, i + 1), copy, ...banner.meshesAndTextures.slice(i + 1)];
    onChange({ ...banner, meshesAndTextures: mt });
  };
  const delMT = (i) => onChange({ ...banner, meshesAndTextures: banner.meshesAndTextures.filter((_, idx) => idx !== i) });

  return (
    <div className="border border-slate-700 rounded bg-slate-900/50 mb-2">
      <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none hover:bg-slate-800/60 rounded-t"
        onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />}
        <span className="text-[11px] font-mono text-amber-400 flex-1">{banner.name || '(unnamed)'}</span>
        <span className="text-[9px] text-slate-500">{banner.meshesAndTextures.length} entries</span>
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }}
          title="Duplicate banner" className="text-blue-400 hover:text-blue-300 p-0.5">
          <Copy className="w-3 h-3" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete banner" className="text-red-500 hover:text-red-400 p-0.5">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] text-slate-400 font-mono">Name</span>
            <Input className="h-5 text-[9px] px-1 w-48" value={banner.name}
              onChange={e => onChange({ ...banner, name: e.target.value })} />
          </div>
          <TexHeader showMesh={true} />
          {banner.meshesAndTextures.map((t, i) => (
            <TexRow key={i} t={t} showMesh={true} texCount={texCount}
              onChange={(field, val) => updateMT(i, field, val)}
              onDuplicate={() => dupMT(i)}
              onDelete={() => delMT(i)} />
          ))}
          <button onClick={addMT}
            className="mt-1 flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300">
            <Plus className="w-3 h-3" /> Add entry
          </button>
        </div>
      )}
    </div>
  );
}

// ── Section panel ────────────────────────────────────────────────────────────

function SectionPanel({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full text-left mb-2 group">
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">{title}</span>
      </button>
      {open && children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BannersTab() {
  const [data, setData] = useState(null);
  const [texCount, setTexCount] = useState(0); // bumped after texture upload to force re-render
  const fileRef = useRef();
  const texRef = useRef();

  // Load from file
  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseBannersXml(text);
    setData(parsed);
    try { localStorage.setItem(STORAGE_KEY, text); } catch {}
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && !data) setData(parseBannersXml(saved));
    } catch {}
  }, []);

  const handleTextures = useCallback(async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    await loadTextureFiles(files);
    setTexCount(getStoreSize());
    e.target.value = '';
  }, []);

  const exportXml = () => {
    if (!data) return;
    const xml = serialiseBannersXml(data);
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'descr_banners_new.xml';
    a.click();
  };

  // ── Faction banners mutations ────────────────────────────────────────────
  const updateFB = (i, banner) => setData(d => ({ ...d, factionBanners: d.factionBanners.map((b, idx) => idx === i ? banner : b) }));
  const deleteFB = (i) => setData(d => ({ ...d, factionBanners: d.factionBanners.filter((_, idx) => idx !== i) }));
  const dupFB = (i) => setData(d => {
    const src = d.factionBanners[i];
    const copy = { ...src, name: src.name + '_COPY', textures: src.textures.map(t => ({ ...t })) };
    const arr = [...d.factionBanners.slice(0, i + 1), copy, ...d.factionBanners.slice(i + 1)];
    return { ...d, factionBanners: arr };
  });
  const addFB = () => setData(d => ({
    ...d, factionBanners: [...d.factionBanners, {
      name: 'new_banner', mainMesh: 'data\\banners\\main_spear.mesh', miniMesh: 'data\\banners\\mini_spear.mesh',
      generalMesh: 'data\\banners\\main_general.mesh', buildingMesh: 'data\\banners\\main_spear.mesh',
      effectOffsetX: '0.0', effectOffsetY: '8.1', effectOffsetZ: '-0.1', textures: []
    }]
  }));

  // ── Unit/Holy/Royal mutations ─────────────────────────────────────────────
  const makeMeshBannerMutations = (key) => ({
    update: (i, banner) => setData(d => ({ ...d, [key]: d[key].map((b, idx) => idx === i ? banner : b) })),
    delete: (i) => setData(d => ({ ...d, [key]: d[key].filter((_, idx) => idx !== i) })),
    dup: (i) => setData(d => {
      const src = d[key][i];
      const copy = { ...src, name: src.name + '_COPY', meshesAndTextures: src.meshesAndTextures.map(t => ({ ...t })) };
      const arr = [...d[key].slice(0, i + 1), copy, ...d[key].slice(i + 1)];
      return { ...d, [key]: arr };
    }),
    add: () => setData(d => ({ ...d, [key]: [...d[key], { name: 'new_banner', meshesAndTextures: [] }] })),
  });

  const ub = makeMeshBannerMutations('unitBanners');
  const hb = makeMeshBannerMutations('holyBanners');

  const updateRoyalMT = (i, field, val) => setData(d => ({
    ...d, royalBanner: { ...d.royalBanner, meshesAndTextures: d.royalBanner.meshesAndTextures.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }
  }));
  const addRoyalMT = () => setData(d => ({ ...d, royalBanner: { ...d.royalBanner, meshesAndTextures: [...d.royalBanner.meshesAndTextures, { faction: '', mesh: '', diffuseMap: '', translucencyMap: '' }] } }));
  const dupRoyalMT = (i) => setData(d => {
    const copy = { ...d.royalBanner.meshesAndTextures[i], faction: d.royalBanner.meshesAndTextures[i].faction + '_COPY' };
    const mt = [...d.royalBanner.meshesAndTextures.slice(0, i + 1), copy, ...d.royalBanner.meshesAndTextures.slice(i + 1)];
    return { ...d, royalBanner: { ...d.royalBanner, meshesAndTextures: mt } };
  });
  const delRoyalMT = (i) => setData(d => ({ ...d, royalBanner: { ...d.royalBanner, meshesAndTextures: d.royalBanner.meshesAndTextures.filter((_, idx) => idx !== i) } }));

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Upload className="w-10 h-10 text-slate-500" />
        <p className="text-sm text-slate-400">Load <span className="font-mono text-amber-400">descr_banners_new.xml</span></p>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Load Banners XML</Button>
        <input ref={fileRef} type="file" accept=".xml,.txt" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="w-3.5 h-3.5 mr-1" /> Reload
        </Button>
        <input ref={fileRef} type="file" accept=".xml,.txt" className="hidden" onChange={handleFile} />
        <Button variant="outline" size="sm" onClick={() => texRef.current?.click()}
          className="text-violet-400 border-violet-700 hover:bg-violet-900/30">
          <Images className="w-3.5 h-3.5 mr-1" />
          {texCount > 0 ? `${texCount} textures loaded` : 'Upload Textures'}
        </Button>
        <input ref={texRef} type="file" multiple accept=".texture,.dds,.png,.tga" className="hidden" onChange={handleTextures} />
        <span className="text-[10px] text-slate-500 font-mono">
          {data.factionBanners.length} faction · {data.unitBanners.length} unit · {data.holyBanners.length} holy banners
        </span>
        <div className="flex-1" />
        <Button size="sm" onClick={exportXml}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export XML
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0 border border-slate-700 rounded bg-slate-900/30 p-3">
        {/* ── Faction Banners ─────────────────────────────────────────────── */}
        <SectionPanel title="Faction Banners">
          {data.factionBanners.map((b, i) => (
            <FactionBannerCard key={i} banner={b} texCount={texCount}
              onChange={(nb) => updateFB(i, nb)}
              onDelete={() => deleteFB(i)}
              onDuplicate={() => dupFB(i)} />
          ))}
          <Button variant="outline" size="sm" className="text-[10px] h-7 mt-1" onClick={addFB}>
            <Plus className="w-3 h-3 mr-1" /> Add Faction Banner
          </Button>
        </SectionPanel>

        {/* ── Unit-Specific Banners ────────────────────────────────────────── */}
        <SectionPanel title="Unit-Specific Banners">
          {data.unitBanners.map((b, i) => (
            <MeshBannerCard key={i} banner={b} texCount={texCount}
              onChange={(nb) => ub.update(i, nb)}
              onDelete={() => ub.delete(i)}
              onDuplicate={() => ub.dup(i)} />
          ))}
          <Button variant="outline" size="sm" className="text-[10px] h-7 mt-1" onClick={ub.add}>
            <Plus className="w-3 h-3 mr-1" /> Add Unit Banner
          </Button>
        </SectionPanel>

        {/* ── Holy Banners ─────────────────────────────────────────────────── */}
        <SectionPanel title="Holy Banners">
          {data.holyBanners.map((b, i) => (
            <MeshBannerCard key={i} banner={b} texCount={texCount}
              onChange={(nb) => hb.update(i, nb)}
              onDelete={() => hb.delete(i)}
              onDuplicate={() => hb.dup(i)} />
          ))}
          <Button variant="outline" size="sm" className="text-[10px] h-7 mt-1" onClick={hb.add}>
            <Plus className="w-3 h-3 mr-1" /> Add Holy Banner
          </Button>
        </SectionPanel>

        {/* ── Royal Banner ─────────────────────────────────────────────────── */}
        <SectionPanel title="Royal Banner">
          <div className="border border-slate-700 rounded bg-slate-900/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] text-slate-400 font-mono">Name</span>
              <Input className="h-5 text-[9px] px-1 w-32"
                value={data.royalBanner.name}
                onChange={e => setData(d => ({ ...d, royalBanner: { ...d.royalBanner, name: e.target.value } }))} />
            </div>
            <TexHeader showMesh={true} />
            {data.royalBanner.meshesAndTextures.map((t, i) => (
              <TexRow key={i} t={t} showMesh={true} texCount={texCount}
                onChange={(field, val) => updateRoyalMT(i, field, val)}
                onDuplicate={() => dupRoyalMT(i)}
                onDelete={() => delRoyalMT(i)} />
            ))}
            <button onClick={addRoyalMT}
              className="mt-1 flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300">
              <Plus className="w-3 h-3" /> Add entry
            </button>
          </div>
        </SectionPanel>
      </ScrollArea>
    </div>
  );
}