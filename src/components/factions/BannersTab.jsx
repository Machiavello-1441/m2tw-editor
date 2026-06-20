import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, FileText, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseBannersXml, serialiseBannersXml } from '@/components/minorfiles/banners/bannersParser';

function EmptyFactionEntries({ factionName, parsedData, onCopy }) {
  const [selectedSource, setSelectedSource] = useState('');

  // Collect all unique factions present in the parsed data
  const availableFactions = React.useMemo(() => {
    if (!parsedData) return [];
    const set = new Set();
    parsedData.factionBanners.forEach(b => b.textures.forEach(t => { if (t.faction) set.add(t.faction); }));
    parsedData.unitBanners.forEach(b => b.meshesAndTextures.forEach(t => { if (t.faction) set.add(t.faction); }));
    parsedData.holyBanners.forEach(b => b.meshesAndTextures.forEach(t => { if (t.faction) set.add(t.faction); }));
    parsedData.royalBanner.meshesAndTextures.forEach(t => { if (t.faction) set.add(t.faction); });
    return [...set].filter(f => f.toLowerCase() !== factionName.toLowerCase()).sort();
  }, [parsedData, factionName]);

  return (
    <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-lg space-y-4">
      <FileText className="w-12 h-12 mx-auto mb-1 opacity-30" />
      <p className="text-sm">No texture entries for <span className="font-mono text-slate-300">{factionName}</span></p>
      {availableFactions.length > 0 ? (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="text-xs text-slate-400">Copy entries from another faction:</p>
          <div className="flex items-center gap-2">
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="h-7 px-2 text-[11px] font-mono bg-slate-800 border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200"
            >
              <option value="">(choose source faction)</option>
              {availableFactions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedSource}
              onClick={() => onCopy(selectedSource)}
              className="h-7 text-[10px] gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs mt-1">Load a banners XML file that contains entries for this faction</p>
      )}
    </div>
  );
}

export default function BannersTab({ factionName }) {
  const [bannersData, setBannersData] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const fileRef = useRef();

  const loadBanners = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBannersData(text);
    const parsed = parseBannersXml(text);
    setParsedData(parsed);
    localStorage.setItem(`m2tw_banners_${factionName}`, text);
    e.target.value = '';
  }, [factionName]);

  const exportBanners = () => {
    if (!parsedData) return;
    const text = serialiseBannersXml(parsedData);
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'descr_banners_new.xml';
    a.click();
  };

  const updateFactionTexture = (bannerIdx, textureIdx, field, value) => {
    if (!parsedData) return;
    const updated = { ...parsedData };
    updated.factionBanners = updated.factionBanners.map((b, i) => {
      if (i !== bannerIdx) return b;
      const newTextures = b.textures.map((t, j) =>
        j === textureIdx ? { ...t, [field]: value } : t
      );
      return { ...b, textures: newTextures };
    });
    setParsedData(updated);
    const text = serialiseBannersXml(updated);
    setBannersData(text);
    localStorage.setItem(`m2tw_banners_${factionName}`, text);
  };

  const updateMeshTexture = (section, bannerIdx, textureIdx, field, value) => {
    if (!parsedData) return;
    const updated = { ...parsedData };
    const banners = updated[section];
    const banner = Array.isArray(banners) ? banners[bannerIdx] : banners;
    
    if (banner) {
      banner.meshesAndTextures = banner.meshesAndTextures.map((m, i) =>
        i === textureIdx ? { ...m, [field]: value } : m
      );
    }
    
    setParsedData(updated);
    const text = serialiseBannersXml(updated);
    setBannersData(text);
    localStorage.setItem(`m2tw_banners_${factionName}`, text);
  };

  const removeFactionTexture = (bannerIdx, textureIdx) => {
    if (!parsedData) return;
    const updated = { ...parsedData };
    updated.factionBanners = updated.factionBanners.map((b, i) => {
      if (i !== bannerIdx) return b;
      return { ...b, textures: b.textures.filter((_, j) => j !== textureIdx) };
    });
    setParsedData(updated);
    const text = serialiseBannersXml(updated);
    setBannersData(text);
    localStorage.setItem(`m2tw_banners_${factionName}`, text);
  };

  const removeMeshTexture = (section, bannerIdx, textureIdx) => {
    if (!parsedData) return;
    const updated = { ...parsedData };
    const banners = updated[section];
    
    if (Array.isArray(banners)) {
      const banner = banners[bannerIdx];
      if (banner) {
        banner.meshesAndTextures = banner.meshesAndTextures.filter((_, i) => i !== textureIdx);
      }
    } else {
      banners.meshesAndTextures = banners.meshesAndTextures.filter((_, i) => i !== textureIdx);
    }
    
    setParsedData(updated);
    const text = serialiseBannersXml(updated);
    setBannersData(text);
    localStorage.setItem(`m2tw_banners_${factionName}`, text);
  };

  useEffect(() => {
    try {
      const data = localStorage.getItem(`m2tw_banners_${factionName}`);
      if (data) {
        setBannersData(data);
        const parsed = parseBannersXml(data);
        setParsedData(parsed);
      } else {
        // Clear state if no data for this faction
        setBannersData(null);
        setParsedData(null);
      }
    } catch {}
  }, [factionName]);

  // Listen for custom banners update event (from faction duplication)
  useEffect(() => {
    const handleBannersUpdate = (e) => {
      if (e.detail?.factionName === factionName && e.detail?.data) {
        setBannersData(e.detail.data);
        const parsed = parseBannersXml(e.detail.data);
        setParsedData(parsed);
      }
    };
    window.addEventListener('banners-updated', handleBannersUpdate);
    return () => window.removeEventListener('banners-updated', handleBannersUpdate);
  }, [factionName]);

  // Collect all texture entries for this faction from all sections
  const textureEntries = [];
  
  if (parsedData) {
    // Faction Banners
    parsedData.factionBanners.forEach((banner, bIdx) => {
      banner.textures.forEach((texture, tIdx) => {
        if (texture.faction.toLowerCase() === factionName.toLowerCase()) {
          textureEntries.push({
            section: 'factionBanners',
            sectionLabel: 'Faction Banner',
            bannerIdx: bIdx,
            textureIdx: tIdx,
            bannerName: banner.name,
            texture,
            hasMesh: false
          });
        }
      });
    });

    // Holy Banners
    parsedData.holyBanners.forEach((banner, bIdx) => {
      banner.meshesAndTextures.forEach((mesh, tIdx) => {
        if (mesh.faction.toLowerCase() === factionName.toLowerCase()) {
          textureEntries.push({
            section: 'holyBanners',
            sectionLabel: 'Holy Banner',
            bannerIdx: bIdx,
            textureIdx: tIdx,
            bannerName: banner.name,
            texture: mesh,
            hasMesh: true
          });
        }
      });
    });

    // Unit Banners
    parsedData.unitBanners.forEach((banner, bIdx) => {
      banner.meshesAndTextures.forEach((mesh, tIdx) => {
        if (mesh.faction.toLowerCase() === factionName.toLowerCase()) {
          textureEntries.push({
            section: 'unitBanners',
            sectionLabel: 'Unit Banner',
            bannerIdx: bIdx,
            textureIdx: tIdx,
            bannerName: banner.name,
            texture: mesh,
            hasMesh: true
          });
        }
      });
    });

    // Royal Banner
    parsedData.royalBanner.meshesAndTextures.forEach((mesh, tIdx) => {
      if (mesh.faction.toLowerCase() === factionName.toLowerCase()) {
        textureEntries.push({
          section: 'royalBanner',
          sectionLabel: 'Royal Banner',
          bannerIdx: 0,
          textureIdx: tIdx,
          bannerName: parsedData.royalBanner.name,
          texture: mesh,
          hasMesh: true
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-600 pb-2">
        <div>
          <p className="text-sm font-semibold text-slate-200">Banner Textures</p>
          <p className="text-xs text-slate-400">Edit texture paths for {factionName}</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={loadBanners} />
          <Button variant="outline" size="sm" className="text-[10px]" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Load XML
          </Button>
          {parsedData && (
            <Button variant="outline" size="sm" className="text-[10px]" onClick={exportBanners}>
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
          )}
        </div>
      </div>

      {parsedData ? (
        <div className="space-y-3">
          {textureEntries.length === 0 ? (
            <EmptyFactionEntries
              factionName={factionName}
              parsedData={parsedData}
              onCopy={(srcFaction) => {
                // Copy all entries from srcFaction, remapping faction name to factionName
                const updated = {
                  ...parsedData,
                  factionBanners: parsedData.factionBanners.map(b => ({
                    ...b,
                    textures: [
                      ...b.textures,
                      ...b.textures
                        .filter(t => t.faction.toLowerCase() === srcFaction.toLowerCase())
                        .map(t => ({ ...t, faction: factionName }))
                    ].filter((t, i, arr) => {
                      // Remove any pre-existing entry for factionName before adding the copy
                      if (t.faction.toLowerCase() === factionName.toLowerCase()) {
                        return arr.findIndex(x => x.faction.toLowerCase() === factionName.toLowerCase()) === i;
                      }
                      return true;
                    })
                  })),
                  unitBanners: parsedData.unitBanners.map(b => ({
                    ...b,
                    meshesAndTextures: [
                      ...b.meshesAndTextures,
                      ...b.meshesAndTextures
                        .filter(t => t.faction.toLowerCase() === srcFaction.toLowerCase())
                        .map(t => ({ ...t, faction: factionName }))
                    ].filter((t, i, arr) => {
                      if (t.faction.toLowerCase() === factionName.toLowerCase()) {
                        return arr.findIndex(x => x.faction.toLowerCase() === factionName.toLowerCase()) === i;
                      }
                      return true;
                    })
                  })),
                  holyBanners: parsedData.holyBanners.map(b => ({
                    ...b,
                    meshesAndTextures: [
                      ...b.meshesAndTextures,
                      ...b.meshesAndTextures
                        .filter(t => t.faction.toLowerCase() === srcFaction.toLowerCase())
                        .map(t => ({ ...t, faction: factionName }))
                    ].filter((t, i, arr) => {
                      if (t.faction.toLowerCase() === factionName.toLowerCase()) {
                        return arr.findIndex(x => x.faction.toLowerCase() === factionName.toLowerCase()) === i;
                      }
                      return true;
                    })
                  })),
                  royalBanner: {
                    ...parsedData.royalBanner,
                    meshesAndTextures: [
                      ...parsedData.royalBanner.meshesAndTextures,
                      ...parsedData.royalBanner.meshesAndTextures
                        .filter(t => t.faction.toLowerCase() === srcFaction.toLowerCase())
                        .map(t => ({ ...t, faction: factionName }))
                    ].filter((t, i, arr) => {
                      if (t.faction.toLowerCase() === factionName.toLowerCase()) {
                        return arr.findIndex(x => x.faction.toLowerCase() === factionName.toLowerCase()) === i;
                      }
                      return true;
                    })
                  }
                };
                const text = serialiseBannersXml(updated);
                setParsedData(updated);
                setBannersData(text);
                localStorage.setItem(`m2tw_banners_${factionName}`, text);
              }}
            />
          ) : (
            textureEntries.map((entry, idx) => (
              <div key={idx} className="border border-slate-600 rounded p-3 bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-semibold">
                      {entry.sectionLabel}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">{entry.bannerName}</span>
                  </div>
                  <button
                    onClick={() => entry.section === 'factionBanners' 
                      ? removeFactionTexture(entry.bannerIdx, entry.textureIdx)
                      : removeMeshTexture(entry.section, entry.bannerIdx, entry.textureIdx)
                    }
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {entry.hasMesh && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-20">Mesh:</span>
                      <Input
                        className="h-7 text-[10px] bg-slate-700 border-slate-600 text-slate-200 font-mono flex-1"
                        value={entry.texture.mesh || ''}
                        onChange={(e) => updateMeshTexture(entry.section, entry.bannerIdx, entry.textureIdx, 'mesh', e.target.value)}
                        placeholder="path/to/mesh.cas"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-20">Diffuse Map:</span>
                    <Input
                      className="h-7 text-[10px] bg-slate-700 border-slate-600 text-slate-200 font-mono flex-1"
                      value={entry.texture.diffuseMap}
                      onChange={(e) => entry.section === 'factionBanners'
                        ? updateFactionTexture(entry.bannerIdx, entry.textureIdx, 'diffuseMap', e.target.value)
                        : updateMeshTexture(entry.section, entry.bannerIdx, entry.textureIdx, 'diffuseMap', e.target.value)
                      }
                      placeholder="path/to/texture.tga"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-20">Translucency Map:</span>
                    <Input
                      className="h-7 text-[10px] bg-slate-700 border-slate-600 text-slate-200 font-mono flex-1"
                      value={entry.texture.translucencyMap}
                      onChange={(e) => entry.section === 'factionBanners'
                        ? updateFactionTexture(entry.bannerIdx, entry.textureIdx, 'translucencyMap', e.target.value)
                        : updateMeshTexture(entry.section, entry.bannerIdx, entry.textureIdx, 'translucencyMap', e.target.value)
                      }
                      placeholder="path/to/translucency.tga"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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