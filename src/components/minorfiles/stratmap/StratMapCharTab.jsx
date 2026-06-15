import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Plus, Trash2, Copy, ChevronDown, ChevronRight, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseDescrCharacter, serialiseDescrCharacter, parseDescrModelStrat, serialiseDescrModelStrat } from './stratCharParser';
import { loadTextureFiles, getTexturePreview, getStoreSize } from '../banners/TextureStore';

const CHAR_KEY = 'm2tw_descr_character';
const STRAT_KEY = 'm2tw_descr_model_strat';

// ── Texture preview modal ─────────────────────────────────────────────────────

function TextureModal({ items, onClose }) {
  // items: [{faction, path, url}]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 max-w-3xl w-full mx-4 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 shrink-0">
          <span className="text-xs font-semibold text-amber-400">Texture Previews</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-1 text-lg leading-none"><X className="w-4 h-4" /></button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pr-1">
            {items.map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                {item.url ? (
                  <img src={item.url} alt={item.faction}
                    className="w-full aspect-square object-contain rounded border border-slate-700 bg-slate-800" />
                ) : (
                  <div className="w-full aspect-square rounded border border-slate-700 bg-slate-800 flex items-center justify-center text-[9px] text-slate-500 text-center px-1">
                    No preview<br />{item.path.split('/').pop()}
                  </div>
                )}
                <span className="text-[9px] font-mono text-amber-300">{item.faction}</span>
                <span className="text-[8px] text-slate-500 truncate w-full text-center" title={item.path}>{item.path.split('/').pop()}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ── Faction row for descr_character ──────────────────────────────────────────

function FactionRow({ f, stratModels, onChange, onDelete, onViewTextures }) {
  const stratModelStr = f.stratModels.join(', ');
  const hasTextures = f.stratModels.some(sm => stratModels[sm]?.textures?.some(t => t.faction === f.faction));
  return (
    <div className="grid gap-1 items-center py-0.5 border-b border-slate-800 last:border-0 group text-[10px]"
      style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto' }}>
      <Input className="h-5 text-[9px] px-1" value={f.faction}
        onChange={e => onChange({ ...f, faction: e.target.value })} placeholder="faction" />
      <Input className="h-5 text-[9px] px-1" value={stratModelStr}
        onChange={e => onChange({ ...f, stratModels: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        placeholder="strat_model(s)" />
      <Input className="h-5 text-[9px] px-1" value={f.battleModel}
        onChange={e => onChange({ ...f, battleModel: e.target.value })} placeholder="battle_model" />
      <Input className="h-5 text-[9px] px-1" value={f.dictionary}
        onChange={e => onChange({ ...f, dictionary: e.target.value })} placeholder="dict" />
      <button onClick={onViewTextures} title="Preview textures"
        className={`px-0.5 ${hasTextures ? 'text-violet-400 hover:text-violet-300' : 'text-slate-600 hover:text-slate-400'}`}>
        <Eye className="w-3 h-3" />
      </button>
      <button onClick={onDelete} title="Delete"
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity px-0.5">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function FactionHeader() {
  return (
    <div className="grid gap-1 pb-0.5 mb-1 border-b border-slate-700 text-[9px] text-slate-500 font-mono"
      style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto' }}>
      <span>Faction</span><span>Strat Model(s)</span><span>Battle Model</span><span>Dict</span>
      <span className="w-4" /><span className="w-4" />
    </div>
  );
}

// ── Character type card ───────────────────────────────────────────────────────

function CharTypeCard({ charType, stratModels, onChange, onDelete, texCount }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null); // [{faction, path, url}]

  const updateFaction = (i, f) => onChange({ ...charType, factions: charType.factions.map((x, idx) => idx === i ? f : x) });
  const deleteFaction = (i) => onChange({ ...charType, factions: charType.factions.filter((_, idx) => idx !== i) });
  const addFaction = () => onChange({ ...charType, factions: [...charType.factions, { faction: '', dictionary: '2', stratModels: [], battleModel: '', battleEquip: '' }] });

  const viewTextures = (f) => {
    const items = f.stratModels.flatMap(smName => {
      const sm = stratModels[smName];
      if (!sm) return [{ faction: f.faction, path: `(model "${smName}" not in strat file)`, url: null }];
      const tex = sm.textures.find(t => t.faction === f.faction);
      if (!tex) return [{ faction: f.faction, path: `(no texture for "${smName}")`, url: null }];
      return [{ faction: f.faction, path: tex.path, url: getTexturePreview(tex.path) }];
    });
    setModal(items.length ? items : [{ faction: f.faction, path: '(no strat models assigned)', url: null }]);
  };

  return (
    <div className="border border-slate-700 rounded bg-slate-900/50 mb-2">
      <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none hover:bg-slate-800/60 rounded-t"
        onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />}
        <span className="text-[11px] font-mono text-amber-400 flex-1">{charType.type || '(unnamed)'}</span>
        <span className="text-[9px] text-slate-500">{charType.factions.length} factions</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="text-red-500 hover:text-red-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[9px]">
            {[['type', 'Type'], ['actions', 'Actions'], ['wageBase', 'Wage Base'], ['startingActionPoints', 'Action Points']].map(([field, label]) => (
              <React.Fragment key={field}>
                <label className="text-slate-400 self-center font-mono">{label}</label>
                <Input className="h-5 text-[9px] px-1 col-span-2" value={charType[field] ?? ''}
                  onChange={e => onChange({ ...charType, [field]: e.target.value })} />
              </React.Fragment>
            ))}
          </div>
          <div className="mt-2">
            <FactionHeader />
            {charType.factions.map((f, i) => (
              <FactionRow key={i} f={f} stratModels={stratModels}
                onChange={nf => updateFaction(i, nf)}
                onDelete={() => deleteFaction(i)}
                onViewTextures={() => viewTextures(f)}
                texCount={texCount} />
            ))}
            <button onClick={addFaction}
              className="mt-1 flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300">
              <Plus className="w-3 h-3" /> Add faction
            </button>
          </div>
        </div>
      )}
      {modal && <TextureModal items={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Strat model row ───────────────────────────────────────────────────────────

function StratModelCard({ model, onChange, onDelete, texCount }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  const updateTex = (i, field, val) => {
    const textures = model.textures.map((t, idx) => idx === i ? { ...t, [field]: val } : t);
    onChange({ ...model, textures });
  };
  const addTex = () => onChange({ ...model, textures: [...model.textures, { faction: '', path: '' }] });
  const delTex = (i) => onChange({ ...model, textures: model.textures.filter((_, idx) => idx !== i) });

  const updateModelEntry = (i, field, val) => {
    const models = model.models.map((m, idx) => idx === i ? { ...m, [field]: val } : m);
    onChange({ ...model, models });
  };
  const addModel = () => onChange({ ...model, models: [...model.models, { keyword: 'model_flexi_m', path: '', range: 'max' }] });
  const delModel = (i) => onChange({ ...model, models: model.models.filter((_, idx) => idx !== i) });

  const allTextures = model.textures.map(t => ({ faction: t.faction, path: t.path, url: getTexturePreview(t.path) }));

  return (
    <div className="border border-slate-700 rounded bg-slate-900/50 mb-2">
      <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none hover:bg-slate-800/60 rounded-t"
        onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />}
        <span className="text-[11px] font-mono text-teal-400 flex-1">{model.name || '(unnamed)'}</span>
        <span className="text-[9px] text-slate-500">{model.textures.length} textures</span>
        <button onClick={e => { e.stopPropagation(); setPreview(allTextures); }}
          title="Preview all textures"
          className="text-violet-400 hover:text-violet-300 p-0.5"><Eye className="w-3 h-3" /></button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="text-red-500 hover:text-red-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-[9px]">
            {[['name', 'Name'], ['skeleton', 'Skeleton'], ['scale', 'Scale'], ['indivRange', 'Indiv Range']].map(([field, label]) => (
              <React.Fragment key={field}>
                <label className="text-slate-400 self-center font-mono">{label}</label>
                <Input className="h-5 text-[9px] px-1 col-span-3" value={model[field] ?? ''}
                  onChange={e => onChange({ ...model, [field]: e.target.value })} />
              </React.Fragment>
            ))}
          </div>
          {/* Textures */}
          <div className="mt-2">
            <div className="text-[9px] text-slate-500 font-mono mb-1 border-b border-slate-700 pb-0.5 grid gap-1"
              style={{ gridTemplateColumns: '1fr 2fr 32px auto' }}>
              <span>Faction</span><span>Texture Path</span><span className="text-center">Prev</span><span />
            </div>
            {model.textures.map((t, i) => (
              <div key={i} className="grid gap-1 items-center py-0.5 border-b border-slate-800 last:border-0 group"
                style={{ gridTemplateColumns: '1fr 2fr 32px auto' }}>
                <Input className="h-5 text-[9px] px-1" value={t.faction}
                  onChange={e => updateTex(i, 'faction', e.target.value)} placeholder="faction" />
                <Input className="h-5 text-[9px] px-1" value={t.path}
                  onChange={e => updateTex(i, 'path', e.target.value)} placeholder="path" />
                <TexThumbInline path={t.path} texCount={texCount} />
                <button onClick={() => delTex(i)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity px-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button onClick={addTex}
              className="mt-1 flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300">
              <Plus className="w-3 h-3" /> Add texture
            </button>
          </div>
          {/* Model entries */}
          <div className="mt-2">
            <div className="text-[9px] text-slate-500 font-mono mb-1 border-b border-slate-700 pb-0.5 grid gap-1"
              style={{ gridTemplateColumns: '1fr 2fr 60px auto' }}>
              <span>Keyword</span><span>Path</span><span>Range</span><span />
            </div>
            {model.models.map((md, i) => (
              <div key={i} className="grid gap-1 items-center py-0.5 border-b border-slate-800 last:border-0 group"
                style={{ gridTemplateColumns: '1fr 2fr 60px auto' }}>
                <Input className="h-5 text-[9px] px-1" value={md.keyword}
                  onChange={e => updateModelEntry(i, 'keyword', e.target.value)} />
                <Input className="h-5 text-[9px] px-1" value={md.path}
                  onChange={e => updateModelEntry(i, 'path', e.target.value)} />
                <Input className="h-5 text-[9px] px-1" value={md.range}
                  onChange={e => updateModelEntry(i, 'range', e.target.value)} />
                <button onClick={() => delModel(i)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity px-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button onClick={addModel}
              className="mt-1 flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300">
              <Plus className="w-3 h-3" /> Add model entry
            </button>
          </div>
        </div>
      )}
      {preview && <TextureModal items={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function TexThumbInline({ path, texCount }) {
  const url = getTexturePreview(path);
  const [ok, setOk] = useState(true);
  const [open, setOpen] = useState(false);
  if (!url) return <span className="w-8 h-8 shrink-0" />;
  return (
    <>
      {ok ? (
        <img src={url} alt="" title={path}
          onError={() => setOk(false)}
          key={`${path}-${texCount}`}
          className="w-8 h-8 object-contain rounded shrink-0 border border-slate-600 bg-slate-800 cursor-pointer hover:border-violet-400 transition-colors"
          onClick={() => setOpen(true)} />
      ) : (
        <span className="w-8 h-8 shrink-0 rounded border border-slate-700 bg-slate-800 flex items-center justify-center text-[7px] text-slate-500">?</span>
      )}
      {open && <TextureModal items={[{ faction: '', path, url }]} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StratMapCharTab() {
  const [charData, setCharData] = useState(null);
  const [stratData, setStratData] = useState(null); // array of models
  const [stratModelMap, setStratModelMap] = useState({}); // name → model
  const [texCount, setTexCount] = useState(0);
  const [activeView, setActiveView] = useState('characters'); // 'characters' | 'strat_models'

  const charRef = useRef();
  const stratRef = useRef();
  const texRef = useRef();

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAR_KEY);
      if (saved) setCharData(parseDescrCharacter(saved));
    } catch {}
    try {
      const saved = localStorage.getItem(STRAT_KEY);
      if (saved) {
        const models = parseDescrModelStrat(saved);
        setStratData(models);
        setStratModelMap(buildModelMap(models));
      }
    } catch {}
  }, []);

  function buildModelMap(models) {
    const map = {};
    for (const m of models) map[m.name] = m;
    return map;
  }

  const handleCharFile = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    setCharData(parseDescrCharacter(text));
    try { localStorage.setItem(CHAR_KEY, text); } catch {}
    e.target.value = '';
  }, []);

  const handleStratFile = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const models = parseDescrModelStrat(text);
    setStratData(models);
    setStratModelMap(buildModelMap(models));
    try { localStorage.setItem(STRAT_KEY, text); } catch {}
    e.target.value = '';
  }, []);

  const handleTextures = useCallback(async (e) => {
    const files = e.target.files; if (!files?.length) return;
    await loadTextureFiles(files);
    setTexCount(getStoreSize());
    e.target.value = '';
  }, []);

  const exportChar = () => {
    if (!charData) return;
    const blob = new Blob([serialiseDescrCharacter(charData)], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'descr_character.txt'; a.click();
  };

  const exportStrat = () => {
    if (!stratData) return;
    const blob = new Blob([serialiseDescrModelStrat(stratData)], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'descr_model_strat.txt'; a.click();
  };

  const updateCharType = (i, t) => setCharData(d => ({ ...d, types: d.types.map((x, idx) => idx === i ? t : x) }));
  const deleteCharType = (i) => setCharData(d => ({ ...d, types: d.types.filter((_, idx) => idx !== i) }));
  const addCharType = () => setCharData(d => ({ ...d, types: [...d.types, { type: 'new_type', actions: '', wageBase: 0, startingActionPoints: 80, factions: [] }] }));

  const updateStratModel = (i, m) => {
    const updated = stratData.map((x, idx) => idx === i ? m : x);
    setStratData(updated); setStratModelMap(buildModelMap(updated));
  };
  const deleteStratModel = (i) => {
    const updated = stratData.filter((_, idx) => idx !== i);
    setStratData(updated); setStratModelMap(buildModelMap(updated));
  };
  const addStratModel = () => {
    const updated = [...stratData, { name: 'new_model', skeleton: '', scale: '0.7', indivRange: '40', textures: [], models: [] }];
    setStratData(updated); setStratModelMap(buildModelMap(updated));
  };

  const filesLoaded = charData || stratData;

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <Button variant="outline" size="sm"
          className={`text-[10px] h-7 ${charData ? 'text-green-400 border-green-700' : ''}`}
          onClick={() => charRef.current?.click()}>
          <Upload className="w-3 h-3 mr-1" />
          {charData ? `descr_character ✓` : 'Load descr_character.txt'}
        </Button>
        <input ref={charRef} type="file" accept=".txt" className="hidden" onChange={handleCharFile} />

        <Button variant="outline" size="sm"
          className={`text-[10px] h-7 ${stratData ? 'text-green-400 border-green-700' : ''}`}
          onClick={() => stratRef.current?.click()}>
          <Upload className="w-3 h-3 mr-1" />
          {stratData ? `descr_model_strat ✓` : 'Load descr_model_strat.txt'}
        </Button>
        <input ref={stratRef} type="file" accept=".txt" className="hidden" onChange={handleStratFile} />

        <Button variant="outline" size="sm" className="text-[10px] h-7 text-violet-400 border-violet-700 hover:bg-violet-900/30"
          onClick={() => texRef.current?.click()}>
          <Eye className="w-3 h-3 mr-1" />
          {texCount > 0 ? `${texCount} textures loaded` : 'Upload Textures (.tga)'}
        </Button>
        <input ref={texRef} type="file" multiple accept=".tga,.texture,.dds,.png" className="hidden" onChange={handleTextures} />

        <div className="flex-1" />

        {charData && (
          <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={exportChar}>
            <Download className="w-3 h-3 mr-1" /> Export descr_character
          </Button>
        )}
        {stratData && (
          <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={exportStrat}>
            <Download className="w-3 h-3 mr-1" /> Export descr_model_strat
          </Button>
        )}
      </div>

      {!filesLoaded ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
          <Upload className="w-8 h-8" />
          <p className="text-sm">Load <span className="font-mono text-amber-400">descr_character.txt</span> and/or <span className="font-mono text-amber-400">descr_model_strat.txt</span></p>
          <p className="text-[10px]">Load both for full cross-referencing and texture previews</p>
        </div>
      ) : (
        <>
          {/* Sub-tab toggle */}
          <div className="flex gap-1 shrink-0">
            {charData && (
              <button onClick={() => setActiveView('characters')}
                className={`text-[10px] px-3 py-1 rounded border font-mono transition-colors ${activeView === 'characters' ? 'border-amber-600 bg-amber-900/30 text-amber-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                Character Types ({charData.types.length})
              </button>
            )}
            {stratData && (
              <button onClick={() => setActiveView('strat_models')}
                className={`text-[10px] px-3 py-1 rounded border font-mono transition-colors ${activeView === 'strat_models' ? 'border-teal-600 bg-teal-900/30 text-teal-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                Strat Models ({stratData.length})
              </button>
            )}
          </div>

          <ScrollArea className="flex-1 min-h-0 border border-slate-700 rounded bg-slate-900/30 p-3">
            {activeView === 'characters' && charData && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] text-slate-400 font-mono">global starting_action_points</span>
                  <Input className="h-5 text-[9px] px-1 w-16" value={charData.globalActionPoints}
                    onChange={e => setCharData(d => ({ ...d, globalActionPoints: e.target.value }))} />
                </div>
                {charData.types.map((t, i) => (
                  <CharTypeCard key={i} charType={t} stratModels={stratModelMap}
                    onChange={nt => updateCharType(i, nt)}
                    onDelete={() => deleteCharType(i)}
                    texCount={texCount} />
                ))}
                <Button variant="outline" size="sm" className="text-[10px] h-7 mt-1" onClick={addCharType}>
                  <Plus className="w-3 h-3 mr-1" /> Add Character Type
                </Button>
              </div>
            )}

            {activeView === 'strat_models' && stratData && (
              <div>
                {stratData.map((m, i) => (
                  <StratModelCard key={i} model={m} texCount={texCount}
                    onChange={nm => updateStratModel(i, nm)}
                    onDelete={() => deleteStratModel(i)} />
                ))}
                <Button variant="outline" size="sm" className="text-[10px] h-7 mt-1" onClick={addStratModel}>
                  <Plus className="w-3 h-3 mr-1" /> Add Strat Model
                </Button>
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}