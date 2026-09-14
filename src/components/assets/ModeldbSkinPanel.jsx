import React, { useState, useEffect, useMemo } from 'react';
import { parseModeldb } from '@/lib/modeldbCodec';
import { modeldbStore } from '@/lib/modeldbStore';
import { indexFolder, getFolderIndex, resolveFile, loadFolderModeldb } from '@/lib/modFolderStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import ModFolderPicker from './ModFolderPicker';
import { Upload, Dices, Bone, Check, AlertTriangle, Eye } from 'lucide-react';

const baseName = (p) => (p || '').split(/[\\/]/).pop().toLowerCase();
/** Variants of a part share a name up to a trailing number: shield0, shield1. */
const slotOf = (m) => (m.groupType || m.name || '').toLowerCase().replace(/[\s_]*\d+$/, '');

/**
 * Ties the loaded model to its battle_models.modeldb entry: browse the entry's
 * LOD files, apply a faction's skin, randomise the parts, and see which
 * skeletons the entry declares. Everything is resolved out of one picked mod
 * folder.
 */
export default function ModeldbSkinPanel({ modelName, parsedMesh, onApplySkin, onRandomize, onLoadModel }) {
  const [db, setDb] = useState(() => modeldbStore.get());
  const [folder, setFolder] = useState(() => getFolderIndex());
  const [entryName, setEntryName] = useState('');
  const [factionIdx, setFactionIdx] = useState(0);
  const [status, setStatus] = useState(null); // { ok, text }

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
    if (hit) { setEntryName(hit.name); setFactionIdx(0); }
  }, [db, modelName]);

  const entry = useMemo(
    () => db?.entries?.find(en => en.name === entryName) || null,
    [db, entryName]
  );
  const faction = entry?.factions?.[factionIdx] || null;
  const attachTex = useMemo(() => {
    if (!entry || !faction) return '';
    return (entry.attachFactions || []).find(f => f.faction === faction.faction)?.diffTex || '';
  }, [entry, faction]);

  const variants = useMemo(() => {
    const slots = new Map();
    for (const m of parsedMesh?.meshes || []) {
      const s = slotOf(m);
      slots.set(s, (slots.get(s) || 0) + 1);
    }
    return {
      slots: [...slots.entries()].filter(([, n]) => n > 1),
      optional: (parsedMesh?.meshes || []).filter(m => m.optional).length,
    };
  }, [parsedMesh]);

  const parseModeldbFile = async (file) => {
    try {
      const parsed = parseModeldb(await file.text());
      modeldbStore.set(parsed);
      setDb(parsed);
      setStatus({ ok: true, text: `${parsed.entries.length} modeldb entries loaded` });
    } catch (err) {
      setStatus({ ok: false, text: `modeldb parse failed: ${err.message}` });
    }
  };

  const pickFolder = async (fileList) => {
    const idx = indexFolder(fileList);
    setFolder(idx);
    if (!idx.modeldbFile) {
      setStatus({ ok: false, text: 'No battle_models.modeldb in that folder — load it below.' });
      return;
    }
    const parsed = await loadFolderModeldb(idx);
    setDb(parsed);
    setStatus({ ok: true, text: `${parsed.entries.length} modeldb entries loaded` });
  };

  const viewLod = async (lodPath) => {
    const file = resolveFile(lodPath);
    if (!file) {
      setStatus({ ok: false, text: `${baseName(lodPath)} is not in the picked folder` });
      return;
    }
    await onLoadModel(file);
    setStatus({ ok: true, text: `Opened ${baseName(lodPath)}` });
  };

  const applySkin = async (fIdx = factionIdx) => {
    const f = entry?.factions?.[fIdx];
    if (!f) return;
    const attach = (entry.attachFactions || []).find(x => x.faction === f.faction)?.diffTex || '';
    const missing = [];
    const pick = (path) => {
      if (!path) return null;
      const file = resolveFile(path);
      if (!file) missing.push(baseName(path));
      return file;
    };
    const main = pick(f.texture);
    const attachFile = pick(attach);
    const normal = pick(f.normalTex);

    if (!main) {
      setStatus({ ok: false, text: `Texture not found in folder: ${missing.join(', ')}` });
      return;
    }
    await onApplySkin(main, attachFile, normal);
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

  const canRandomise = variants.slots.length > 0 || variants.optional > 0;

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-2.5 space-y-3 text-[11px]">
        <ModFolderPicker folder={folder} onPick={pickFolder} />

        <label className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors">
          <input type="file" className="hidden" accept=".modeldb,.txt"
            onChange={(e) => { if (e.target.files[0]) parseModeldbFile(e.target.files[0]); e.target.value = ''; }} />
          <Upload className="w-3 h-3" /> {db ? `Reload modeldb (${db.entries.length})` : 'Load modeldb file…'}
        </label>

        {/* ── entry + its LOD files ── */}
        {db?.entries?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Model Entry</p>
            <select
              value={entryName}
              onChange={(e) => { setEntryName(e.target.value); setFactionIdx(0); }}
              className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-slate-200 text-[10px]"
            >
              <option value="">— pick an entry —</option>
              {db.entries.map(en => <option key={en.name} value={en.name}>{en.name}</option>)}
            </select>

            {entry && (
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold pt-1">
                  LOD Models ({entry.meshes.length})
                </p>
                {entry.meshes.map((m, i) => (
                  <button
                    key={m.path + i}
                    onClick={() => viewLod(m.path)}
                    disabled={!folder || !onLoadModel}
                    className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded bg-slate-800/60 hover:bg-slate-700 text-left transition-colors disabled:opacity-40"
                    title={m.path}
                  >
                    <Eye className="w-3 h-3 shrink-0 text-blue-400" />
                    <span className="truncate font-mono text-[9px] text-slate-300">{baseName(m.path)}</span>
                    <span className="ml-auto text-[9px] text-slate-500 shrink-0">{m.dist}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── faction skin ── */}
        {entry && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
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
            <button
              onClick={() => applySkin()}
              disabled={!faction || !folder}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition-colors disabled:opacity-40"
            >
              <Check className="w-3 h-3" /> Apply Skin
            </button>
            <button
              onClick={randomSkin}
              disabled={!entry.factions.length || !folder}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              <Dices className="w-3 h-3" /> Random Faction Skin
            </button>
          </div>
        )}

        {/* ── part randomiser ── */}
        <div className="space-y-1 pt-1 border-t border-slate-700">
          <button
            onClick={onRandomize}
            disabled={!canRandomise}
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-600/25 text-yellow-300 hover:bg-yellow-600/40 transition-colors disabled:opacity-40"
          >
            <Dices className="w-3 h-3" /> Randomise Mesh Groups
          </button>
          {canRandomise ? (
            <p className="text-[9px] text-slate-500 leading-snug">
              {variants.slots.length
                ? `Varies: ${variants.slots.map(([s, n]) => `${s} (${n})`).join(', ')}`
                : `${variants.optional} optional group(s) toggle on and off.`}
            </p>
          ) : (
            <p className="text-[9px] text-amber-400 leading-snug">
              This model has nothing to vary — every group is required and none share a
              numbered name, so the engine always draws all {parsedMesh?.meshes?.length || 0} of them.
            </p>
          )}
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
            <p className={`text-[9px] leading-snug ${parsedMesh?.skinWeights ? 'text-green-400' : 'text-amber-400'}`}>
              {parsedMesh?.skinWeights
                ? `Rigging read: ${parsedMesh.weightsPerVertex} weights per vertex over ${parsedMesh.bones?.length || 0} bones.`
                : 'No rigging streams in this model, so it cannot be posed.'}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}