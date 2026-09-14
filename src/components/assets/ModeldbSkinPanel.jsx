import React, { useState, useEffect, useMemo, useRef } from 'react';
import { parseModeldb } from '@/lib/modeldbCodec';
import { modeldbStore } from '@/lib/modeldbStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Dices, Bone, FolderOpen, Check, AlertTriangle } from 'lucide-react';

const baseName = (p) => (p || '').split(/[\\/]/).pop().toLowerCase();

/**
 * Ties the loaded .mesh to its battle_models.modeldb entry: faction skin
 * selection (the two texture sheets + normal map the entry names), the
 * per-group randomiser, and the skeletons the entry declares.
 */
export default function ModeldbSkinPanel({ modelName, onApplySkin, onRandomize }) {
  const [db, setDb] = useState(() => modeldbStore.get());
  const [entryName, setEntryName] = useState('');
  const [factionIdx, setFactionIdx] = useState(0);
  const [texFiles, setTexFiles] = useState({});
  const [status, setStatus] = useState(null); // { ok: bool, text }
  const dirRef = useRef(null);

  useEffect(() => {
    const onLoaded = (e) => setDb(e.detail);
    window.addEventListener('modeldb-loaded', onLoaded);
    return () => window.removeEventListener('modeldb-loaded', onLoaded);
  }, []);

  // Auto-match the loaded model to the entry whose LOD paths name it
  useEffect(() => {
    if (!db?.entries?.length || !modelName) return;
    const target = baseName(modelName);
    const hit = db.entries.find(en => (en.meshes || []).some(m => baseName(m.path) === target));
    setEntryName(hit ? hit.name : '');
    setFactionIdx(0);
  }, [db, modelName]);

  const entry = useMemo(
    () => db?.entries?.find(en => en.name === entryName) || null,
    [db, entryName]
  );
  const faction = entry?.factions?.[factionIdx] || null;
  const attachTex = useMemo(() => {
    if (!entry || !faction) return '';
    const a = (entry.attachFactions || []).find(f => f.faction === faction.faction);
    return a?.diffTex || '';
  }, [entry, faction]);

  const loadModeldb = async (file) => {
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = parseModeldb(text);
      modeldbStore.set(parsed);
      setStatus({ ok: true, text: `${parsed.entries.length} entries loaded` });
    } catch (err) {
      setStatus({ ok: false, text: `modeldb parse failed: ${err.message}` });
    }
  };

  const addTextures = (fileList) => {
    setTexFiles(prev => {
      const next = { ...prev };
      for (const f of fileList) {
        if (/\.(texture|tga|dds)$/i.test(f.name)) next[f.name.toLowerCase()] = f;
      }
      return next;
    });
  };

  const applySkin = async (fIdx = factionIdx) => {
    const f = entry?.factions?.[fIdx];
    if (!f) return;
    const a = (entry.attachFactions || []).find(x => x.faction === f.faction);
    const want = {
      main: baseName(f.texture),
      attach: baseName(a?.diffTex || ''),
      normal: baseName(f.normalTex),
    };
    const missing = [];
    const pick = (name) => {
      if (!name) return null;
      const file = texFiles[name];
      if (!file) missing.push(name);
      return file || null;
    };
    const main = pick(want.main);
    const attach = pick(want.attach);
    const normal = pick(want.normal);

    if (!main) {
      setStatus({ ok: false, text: `Missing texture file(s): ${missing.join(', ')}` });
      return;
    }
    await onApplySkin(main, attach, normal);
    setStatus(missing.length
      ? { ok: false, text: `Applied ${f.faction}, but not found: ${missing.join(', ')}` }
      : { ok: true, text: `Applied ${f.faction} skin` });
  };

  const randomSkin = () => {
    const n = entry?.factions?.length || 0;
    if (!n) return;
    const idx = Math.floor(Math.random() * n);
    setFactionIdx(idx);
    applySkin(idx);
  };

  const texCount = Object.keys(texFiles).length;

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-2.5 space-y-3 text-[11px]">
        {/* ── modeldb ── */}
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">battle_models.modeldb</p>
          <label className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors">
            <input type="file" className="hidden" accept=".modeldb,.txt"
              onChange={(e) => { loadModeldb(e.target.files[0]); e.target.value = ''; }} />
            <Upload className="w-3 h-3" /> {db ? `Reload (${db.entries.length})` : 'Load modeldb…'}
          </label>
        </div>

        {/* ── entry + faction ── */}
        {db?.entries?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Model Entry</p>
            <select
              value={entryName}
              onChange={(e) => { setEntryName(e.target.value); setFactionIdx(0); }}
              className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-slate-200 text-[10px]"
            >
              <option value="">— pick an entry —</option>
              {db.entries.map(en => (
                <option key={en.name} value={en.name}>{en.name}</option>
              ))}
            </select>

            {entry && (
              <>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold pt-1">
                  Faction Skin ({entry.factions.length})
                </p>
                <select
                  value={factionIdx}
                  onChange={(e) => setFactionIdx(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-slate-200 text-[10px]"
                >
                  {entry.factions.map((f, i) => (
                    <option key={f.faction + i} value={i}>{f.faction}</option>
                  ))}
                </select>

                {faction && (
                  <div className="bg-slate-800/60 rounded p-1.5 space-y-0.5 text-[9px] font-mono text-slate-400">
                    <p className="truncate" title={faction.texture}>main: {baseName(faction.texture) || '—'}</p>
                    <p className="truncate" title={attachTex}>attach: {baseName(attachTex) || '—'}</p>
                    <p className="truncate" title={faction.normalTex}>normal: {baseName(faction.normalTex) || '—'}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── texture pool ── */}
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            Texture Files ({texCount})
          </p>
          <label className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors">
            <input type="file" className="hidden" multiple accept=".texture,.tga,.dds"
              onChange={(e) => { addTextures(e.target.files); e.target.value = ''; }} />
            <Upload className="w-3 h-3" /> Add texture files…
          </label>
          <button
            onClick={() => dirRef.current?.click()}
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <FolderOpen className="w-3 h-3" /> Add a whole folder…
          </button>
          <input ref={dirRef} type="file" className="hidden" multiple webkitdirectory="" directory=""
            onChange={(e) => { addTextures(e.target.files); e.target.value = ''; }} />
        </div>

        {/* ── actions ── */}
        <div className="space-y-1 pt-1 border-t border-slate-700">
          <button
            onClick={() => applySkin()}
            disabled={!faction || texCount === 0}
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition-colors disabled:opacity-40"
          >
            <Check className="w-3 h-3" /> Apply Skin
          </button>
          <button
            onClick={randomSkin}
            disabled={!entry?.factions?.length || texCount === 0}
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            <Dices className="w-3 h-3" /> Random Faction Skin
          </button>
          <button
            onClick={onRandomize}
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-600/25 text-yellow-300 hover:bg-yellow-600/40 transition-colors"
            title="One variant per group slot, as the engine picks them per soldier"
          >
            <Dices className="w-3 h-3" /> Randomise Mesh Groups
          </button>
        </div>

        {status && (
          <p className={`flex items-start gap-1 text-[9px] ${status.ok ? 'text-green-400' : 'text-amber-400'}`}>
            {status.ok ? <Check className="w-3 h-3 shrink-0 mt-px" /> : <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />}
            <span className="break-all">{status.text}</span>
          </p>
        )}

        {/* ── skeletons ── */}
        {entry?.mountTypes?.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-slate-700">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Bone className="w-3 h-3" /> Skeletons ({entry.mountTypes.length})
            </p>
            {entry.mountTypes.map((mt, i) => (
              <div key={mt.mountType + i} className="bg-slate-800/60 rounded p-1.5 space-y-0.5">
                <p className="text-slate-200 text-[10px]">{mt.mountType || 'none'}</p>
                <p className="text-[9px] font-mono text-green-400 break-all">{mt.primarySkeleton || '—'}</p>
                {mt.secondarySkeleton && (
                  <p className="text-[9px] font-mono text-slate-500 break-all">{mt.secondarySkeleton}</p>
                )}
              </div>
            ))}
            <p className="text-[9px] text-slate-500 leading-snug">
              These are the skeleton names the entry declares — the animations live in
              <span className="font-mono"> data/animations/&lt;name&gt;/</span>. Posing this .mesh also needs its
              bone-weight streams, which aren’t decoded yet.
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}