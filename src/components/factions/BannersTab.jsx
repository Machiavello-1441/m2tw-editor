import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseBannersXml, serialiseBannersXml } from '@/components/minorfiles/banners/bannersParser';

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

  const updateFactionBanner = (bannerIdx, field, value) => {
    if (!parsedData) return;
    const updated = { ...parsedData };
    updated.factionBanners = updated.factionBanners.map((b, i) =>
      i === bannerIdx ? { ...b, [field]: value } : b
    );
    setParsedData(updated);
    const text = serialiseBannersXml(updated);
    setBannersData(text);
    localStorage.setItem(`m2tw_banners_${factionName}`, text);
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

  const addTextureToFactionBanner = (bannerIdx) => {
    if (!parsedData) return;
    const updated = { ...parsedData };
    updated.factionBanners = updated.factionBanners.map((b, i) => {
      if (i !== bannerIdx) return b;
      return {
        ...b,
        textures: [...b.textures, { faction: factionName, diffuseMap: '', translucencyMap: '' }]
      };
    });
    setParsedData(updated);
    const text = serialiseBannersXml(updated);
    setBannersData(text);
    localStorage.setItem(`m2tw_banners_${factionName}`, text);
  };

  const removeTextureFromFactionBanner = (bannerIdx, textureIdx) => {
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

  useEffect(() => {
    try {
      const data = localStorage.getItem(`m2tw_banners_${factionName}`);
      if (data) {
        setBannersData(data);
        const parsed = parseBannersXml(data);
        setParsedData(parsed);
      }
    } catch {}
  }, [factionName]);

  // Get all faction banners and filter textures for this faction
  const factionBanners = parsedData?.factionBanners || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-600 pb-2">
        <div>
          <p className="text-sm font-semibold text-slate-200">Banners Configuration</p>
          <p className="text-xs text-slate-400">Edit faction-specific entries in descr_banners_new.xml for {factionName}</p>
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
        <div className="space-y-4">
          <div className="border border-slate-600 rounded-lg p-4 bg-slate-800/50">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Faction Banners
            </h3>
            
            {factionBanners.length === 0 ? (
              <div className="text-center py-6 text-slate-500 border border-dashed border-slate-700 rounded">
                <p className="text-xs">No faction banners in this file</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-auto">
                {factionBanners.map((banner, bIdx) => {
                  const factionTextures = banner.textures.filter(t => 
                    t.faction.toLowerCase() === factionName.toLowerCase()
                  );
                  
                  return (
                    <div key={banner.name} className="border border-slate-700 rounded p-3 space-y-3">
                      <div className="flex items-center gap-4 border-b border-slate-700 pb-2">
                        <span className="text-[10px] text-slate-400 w-24">Banner Name:</span>
                        <Input
                          className="h-6 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100 font-mono"
                          value={banner.name}
                          onChange={(e) => updateFactionBanner(bIdx, 'name', e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-20">Main Mesh:</span>
                          <Input
                            className="h-6 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100 font-mono flex-1"
                            value={banner.mainMesh}
                            onChange={(e) => updateFactionBanner(bIdx, 'mainMesh', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-20">Mini Mesh:</span>
                          <Input
                            className="h-6 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100 font-mono flex-1"
                            value={banner.miniMesh}
                            onChange={(e) => updateFactionBanner(bIdx, 'miniMesh', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-20">General Mesh:</span>
                          <Input
                            className="h-6 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100 font-mono flex-1"
                            value={banner.generalMesh}
                            onChange={(e) => updateFactionBanner(bIdx, 'generalMesh', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-20">Building Mesh:</span>
                          <Input
                            className="h-6 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100 font-mono flex-1"
                            value={banner.buildingMesh}
                            onChange={(e) => updateFactionBanner(bIdx, 'buildingMesh', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="border-t border-slate-700 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-slate-300 font-semibold">
                            Textures for {factionName} ({factionTextures.length})
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[9px]"
                            onClick={() => addTextureToFactionBanner(bIdx)}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add Texture
                          </Button>
                        </div>
                        
                        {factionTextures.length === 0 ? (
                          <p className="text-[10px] text-slate-500 italic">No textures for this faction</p>
                        ) : (
                          factionTextures.map((texture, tIdx) => {
                            const originalTextureIdx = banner.textures.indexOf(texture);
                            return (
                              <div key={tIdx} className="grid grid-cols-3 gap-2 mb-2 p-2 bg-slate-700/50 rounded">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-400 w-16">Faction:</span>
                                  <Input
                                    className="h-5 text-[9px] px-1 bg-slate-600 border-slate-500 text-slate-100 font-mono"
                                    value={texture.faction}
                                    onChange={(e) => updateFactionTexture(bIdx, originalTextureIdx, 'faction', e.target.value)}
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-400 w-16">Diffuse:</span>
                                  <Input
                                    className="h-5 text-[9px] px-1 bg-slate-600 border-slate-500 text-slate-100 font-mono"
                                    value={texture.diffuseMap}
                                    onChange={(e) => updateFactionTexture(bIdx, originalTextureIdx, 'diffuseMap', e.target.value)}
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-400 w-16">Translucency:</span>
                                  <Input
                                    className="h-5 text-[9px] px-1 bg-slate-600 border-slate-500 text-slate-100 font-mono flex-1"
                                    value={texture.translucencyMap}
                                    onChange={(e) => updateFactionTexture(bIdx, originalTextureIdx, 'translucencyMap', e.target.value)}
                                  />
                                  <button
                                    onClick={() => removeTextureFromFactionBanner(bIdx, originalTextureIdx)}
                                    className="text-red-400 hover:text-red-300 p-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="border border-slate-600 rounded p-3 bg-slate-800/30">
              <p className="text-[10px] text-slate-400">Unit Banners</p>
              <p className="text-lg font-semibold text-slate-200">{parsedData.unitBanners?.length || 0}</p>
            </div>
            <div className="border border-slate-600 rounded p-3 bg-slate-800/30">
              <p className="text-[10px] text-slate-400">Holy Banners</p>
              <p className="text-lg font-semibold text-slate-200">{parsedData.holyBanners?.length || 0}</p>
            </div>
            <div className="border border-slate-600 rounded p-3 bg-slate-800/30">
              <p className="text-[10px] text-slate-400">Royal Banner</p>
              <p className="text-lg font-semibold text-slate-200">{parsedData.royalBanner?.name || 'N/A'}</p>
            </div>
          </div>
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