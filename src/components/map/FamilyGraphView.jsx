import React, { useMemo, useState } from 'react';
import { Plus, Maximize2, Minimize2, Image, X } from 'lucide-react';
import { layoutForest } from './familyGraphLayout';
import { addChild, setParent, setSpouse, detach } from './familyGraphOps';
import FamilyGraphCard, { usePortraits, portraitFor } from './FamilyGraphCard';
import FamilyTreeProblems from './FamilyTreeProblems';
import FamilyGraphLines from '@/components/map/FamilyGraphLines';
import FamilyRulesStatus from '@/components/map/FamilyRulesStatus';
import FamilyRelationActions from '@/components/map/FamilyRelationActions';
import FamilyMemberSlot from '@/components/map/FamilyMemberSlot';

function Pill({ pill, onDropChar, onSelect }) {
  const [over, setOver] = useState(false);
  return (
    <div style={{ left: pill.x, top: pill.y }}
      role="button" tabIndex={0} onClick={() => onSelect?.(pill)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(pill); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDropChar(pill, e.dataTransfer.getData('charId')); }}
      className={`absolute w-[72px] h-[18px] rounded-full border border-dashed text-[9px] text-center leading-[16px] ${
        over ? 'border-amber-400 bg-amber-900/40 text-amber-300' : 'border-slate-600/60 text-slate-500'}`}>
      + child
    </div>
  );
}

// Visual family tree: drag characters onto slots (parents), cards (spouse) or "+ child" pills.
export default function FamilyGraphView({ faction, chars, factionTrees, onTreesChange, onAddTree, problems, rules, onSelectCharacter, selectedCharacterId, onSelectTree, hideCharacterList = false, showPortraits: externalShowPortraits, onShowPortraitsChange, onClose, onRequestMember, pendingMember, onOpenMember }) {
  const portraits = usePortraits();
  const [localShowPortraits, setLocalShowPortraits] = useState(true);
  const showPortraits = externalShowPortraits ?? localShowPortraits;
  const setShowPortraits = onShowPortraitsChange || setLocalShowPortraits;
  const [full, setFull] = useState(false);
  const [message, setMessage] = useState('');
  const forest = useMemo(() => layoutForest(factionTrees), [factionTrees]);
  const [selectedTreeId, setSelectedTreeId] = useState('');
  const activeTreeId = forest.some(tree => String(tree.rootId) === selectedTreeId) ? selectedTreeId : String(forest.find(tree => tree.nodes.some(node => String(node.char?.id) === selectedCharacterId))?.rootId ?? forest[0]?.rootId ?? '');
  const pendingNode = pendingMember?.anchorId != null ? forest.flatMap(tree => tree.nodes).find(node => String(node.char?.id) === String(pendingMember.anchorId)) : null;
  const visibleForest = forest.filter(tree => String(tree.rootId) === activeTreeId);

  const apply = (result) => {
    if (result.error) { setMessage(result.error); return; }
    setMessage('');
    onTreesChange((prev) => ({ ...prev, [faction]: result.trees }));
  };
  const findChar = (id) => chars.find((c) => String(c.id) === id);

  const dropOnNode = (node, id) => {
    const c = findChar(id);
    if (!c) return;
    if (node.kind === 'slot' && !node.char) return apply(setParent(factionTrees, node.unit.treeId, node.slot, c, rules?.values));
    if (node.kind === 'child' && !node.unit.isRoot && node.char && !node.unit.parents[1]) {
      return apply(setSpouse(factionTrees, node.unit.treeId, node.char, c, rules?.values));
    }
    setMessage('Drop on an empty slot, a single person (spouse), or a "+ child" pill');
  };
  const dropOnPill = (pill, id) => {
    const c = findChar(id);
    if (c) apply(addChild(factionTrees, chars, pill.unit, c, rules?.values));
  };

  const placedIds = new Set(forest.flatMap((f) => f.nodes.map((n) => n.char?.id)).filter((x) => x != null));
  const wrap = full ? 'fixed inset-4 z-50 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl' : 'h-full';
  const withPortrait = chars.filter((c) => c.portrait).length;

  return (
    <div className={`flex flex-col ${wrap}`}>
      <div className="flex items-center gap-2 p-2 border-b border-slate-800 shrink-0 flex-wrap">
        <label className="text-xs flex items-center gap-2">Family tree<select aria-label="Family tree" value={activeTreeId} onChange={event => { setSelectedTreeId(event.target.value); onSelectTree?.(); }} className="h-7 max-w-64 rounded border border-input bg-background text-foreground px-2">
          {!forest.length && <option value="">No family trees</option>}
          {forest.map((tree, index) => <option key={tree.rootId} value={String(tree.rootId)}>{index + 1}. {tree.title}</option>)}
        </select></label>
        <button onClick={() => { setSelectedTreeId(String(onAddTree())); onSelectTree?.(); }} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-slate-600/40 text-slate-300 hover:text-white">
          <Plus className="w-3 h-3" /> New tree
        </button>
        <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showPortraits} onChange={(e) => setShowPortraits(e.target.checked)} className="accent-amber-500" />
          <Image className="w-3 h-3" /> Portraits ({withPortrait} unique)
        </label>
        {onClose ? <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground" title="Close visual family tree" aria-label="Close visual family tree"><X className="w-4 h-4" /></button> : <button onClick={() => setFull((v) => !v)} className="ml-auto text-slate-400 hover:text-white" title="Toggle full screen">
          {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>}
      </div>

      {!hideCharacterList && <div className="flex gap-1 flex-wrap p-2 border-b border-slate-800 shrink-0 max-h-24 overflow-y-auto">
        {chars.map((c) => {
          const src = showPortraits ? portraitFor(c, portraits) : null;
          return (
            <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData('charId', String(c.id))}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono cursor-grab bg-slate-800 ${
                c.sex === 'female' ? 'border-pink-500/40' : 'border-sky-500/40'} ${placedIds.has(c.id) ? 'opacity-50' : 'text-slate-200'}`}
              title="Drag onto the tree">
              {src && <img src={src} alt="" className="w-4 h-4 rounded-sm object-cover" />}
              {c.name}<span className="text-slate-500">{c.age}</span>
            </div>
          );
        })}
      </div>}

      {onRequestMember && <FamilyRelationActions character={chars.find(c => String(c.id) === selectedCharacterId)} onRequest={onRequestMember} />}
      <FamilyRulesStatus rules={rules} />
      {message && <p role="alert" className="px-2 py-1 text-xs text-destructive bg-destructive/10 shrink-0">{message}</p>}
      <div className="px-2 pt-2 shrink-0 max-h-32 overflow-y-auto"><FamilyTreeProblems problems={problems} /></div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-5">
        {forest.length === 0 && <p className="text-[10px] text-slate-600 italic text-center py-4">No family trees for {faction} — click "New tree"</p>}
        {visibleForest.map((f, i) => (
          <div key={i}>
            <p className="text-[10px] font-semibold text-amber-300 mb-1">{f.title}</p>
            <div className="relative" style={{ width: f.width + (f.nodes.includes(pendingNode) && pendingMember.kind === 'spouse' ? 140 : 0), height: f.height + (f.nodes.includes(pendingNode) && pendingMember.kind !== 'spouse' ? 100 : 0), minWidth: 240 }}>
              <div className="relative" style={{ top: f.nodes.includes(pendingNode) && pendingMember.kind === 'parent' ? 100 : 0 }}>
              <FamilyGraphLines forest={f} />
              {f.nodes.map((n) => (
                <FamilyGraphCard key={n.key} node={n} portraits={portraits} showPortraits={showPortraits}
                  onDropChar={dropOnNode} onSelect={onSelectCharacter} onSelectSlot={node => onRequestMember?.({ kind: 'slot', treeId: node.unit.treeId, slot: node.slot, sex: node.slot === 'father' ? 'male' : 'female', label: node.slot }, true)} selected={String(n.char?.id) === selectedCharacterId} errorMessages={problems.characterErrors?.[String(n.char?.id)]}
                  onDetach={(node) => onTreesChange((prev) => ({ ...prev, [faction]: detach(factionTrees, { ...node, treeId: node.unit.treeId, charId: node.char?.id }) }))} />
              ))}
              {f.pills.map((p) => <Pill key={p.key} pill={p} onDropChar={dropOnPill} onSelect={pill => { const parent = pill.unit.parents[0]; if (parent) onRequestMember?.({ kind: 'child', anchorId: parent.id, label: 'child' }, true); }} />)}
              </div>
              {f.nodes.includes(pendingNode) && <FamilyMemberSlot request={pendingMember} node={pendingNode} forest={f} onClick={onOpenMember} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}