import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Users, AlertTriangle, X, ChevronDown, ChevronRight } from 'lucide-react';

const MIN_PARENT_CHILD_AGE_DIFF = 16;
const MAX_CHILDREN = 4;

// Build a flat list of all characters including character_record entries
function buildAllChars(stratData) {
  const chars = (stratData?.items || []).filter(i => i.category === 'character');
  const charNames = new Set(chars.map(c => c.name?.toLowerCase()));

  // Add character_record entries not already present as full characters
  for (const faction of (stratData?.factions || [])) {
    for (const rec of (faction.characterRecords || [])) {
      if (!charNames.has(rec.name?.toLowerCase())) {
        chars.push({
          id: `rec_${faction.name}_${rec.name}`,
          category: 'character',
          name: rec.name,
          sex: rec.sex || 'male',
          age: rec.age || 30,
          faction: faction.name,
          charType: 'named character',
          status: rec.status,
          traits: [],
          ancillaries: [],
          army: [],
        });
        charNames.add(rec.name?.toLowerCase());
      }
    }
  }
  return chars;
}

// Parse relative lines from factions into family tree objects
function buildInitialTrees(stratData, allChars) {
  const treesByFaction = {};
  const charByName = {};
  for (const c of allChars) {
    if (c.name) charByName[c.name.toLowerCase()] = c;
  }

  for (const faction of (stratData?.factions || [])) {
    const trees = [];
    for (const rel of (faction.relatives || [])) {
      // rel is an array of names: [head/father, wife/mother, child1, child2, ...]
      if (!rel || rel.length === 0) continue;
      const father = rel[0] ? charByName[rel[0].toLowerCase()] || null : null;
      const mother = rel[1] ? charByName[rel[1].toLowerCase()] || null : null;
      const childNames = rel.slice(2);
      const children = childNames.map(n => charByName[n?.toLowerCase()]).filter(Boolean);
      trees.push({
        id: Date.now() + Math.random(),
        father,
        mother,
        children,
        spouses: {},
        nestedChildren: {},
        fromFile: true,
      });
    }
    if (trees.length > 0) {
      treesByFaction[faction.name] = trees;
    }
  }
  return treesByFaction;
}

function CharacterDragCard({ onDrop, slot, assigned, onClear, allChars }) {
  const [dragOver, setDragOver] = useState(false);
  const isFather = slot === 'father';
  const acceptedSex = isFather ? 'male' : 'female';

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const charId = e.dataTransfer.getData('charId');
    const found = allChars.find(c => String(c.id) === charId);
    if (!found) return;
    if (found.sex !== acceptedSex) return; // enforce sex constraint
    onDrop(slot, found);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded border-2 border-dashed p-2 min-h-16 flex flex-col items-center justify-center transition-colors ${
        dragOver ? 'border-amber-400 bg-amber-900/20' : 'border-slate-600/40 bg-slate-800/30'
      }`}
    >
      <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">
        {isFather ? '👨 Father (male)' : '👩 Mother (female)'}
      </p>
      {assigned ? (
        <div className="text-center w-full">
          <p className="text-[11px] font-mono text-amber-300 truncate">{assigned.name}</p>
          <p className="text-[9px] text-slate-500">{assigned.charType} · age {assigned.age}</p>
          <button onClick={() => onClear(slot)} className="mt-1 text-[9px] text-slate-600 hover:text-red-400"><X className="w-3 h-3 mx-auto" /></button>
        </div>
      ) : (
        <p className="text-[9px] text-slate-600 italic">Drop {acceptedSex} here</p>
      )}
    </div>
  );
}

function ChildNode({ char, depth, allChars, onRemove, onAssignSpouse, onAddChild, onRemoveChild, spouses, children, faction }) {
  const [expanded, setExpanded] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const spouse = spouses?.[char.id];
  const myChildren = children?.[char.id] || [];
  const canAddChild = myChildren.length < MAX_CHILDREN;
  const ageLimit = (char.age || 0) - MIN_PARENT_CHILD_AGE_DIFF;
  const opposSex = char.sex === 'male' ? 'female' : 'male';

  const eligibleSpouses = useMemo(() =>
    allChars.filter(c => c.faction === faction && c.id !== char.id && c.sex === opposSex && !Object.values(spouses || {}).find(s => s?.id === c.id)),
    [allChars, char, faction, spouses, opposSex]
  );
  const eligibleChildren = useMemo(() =>
    allChars.filter(c => c.faction === faction && (c.age || 0) <= ageLimit && c.id !== char.id && !myChildren.find(mc => mc.id === c.id) && !(spouse && c.id === spouse.id)),
    [allChars, char, faction, ageLimit, myChildren, spouse]
  );

  return (
    <div className={`ml-2 border-l border-slate-700/30 pl-1.5 ${depth > 0 ? 'mt-0.5' : ''}`}>
      <div className="flex items-center gap-1 mb-1">
        <button onClick={() => setExpanded(v => !v)} className="text-slate-600 hover:text-slate-400">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <span className="text-[10px] font-mono text-slate-200">{char.name}</span>
        <span className="text-[9px] text-slate-500">({char.sex}, age {char.age})</span>
        {spouse && <span className="text-[9px] text-pink-400 ml-1">♥ {spouse.name}</span>}
        <button onClick={() => onRemove(char.id)} className="ml-auto text-slate-600 hover:text-red-400"><X className="w-3 h-3" /></button>
      </div>

      {expanded && (
        <div className="ml-1 space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-500 w-12 shrink-0">Spouse:</span>
            {spouse ? (
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-pink-300 font-mono">{spouse.name}</span>
                <button onClick={() => onAssignSpouse(char.id, null)} className="text-slate-600 hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
              </div>
            ) : (
              <select
                defaultValue=""
                onChange={e => {
                  const s = allChars.find(c => String(c.id) === e.target.value);
                  if (s) onAssignSpouse(char.id, s);
                  e.target.value = '';
                }}
                className="h-5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-400 flex-1"
              >
                <option value="">— assign spouse ({opposSex}) —</option>
                {eligibleSpouses.map(c => <option key={c.id} value={c.id}>{c.name} (age {c.age})</option>)}
              </select>
            )}
          </div>

          {myChildren.map(child => (
            <ChildNode
              key={child.id}
              char={child}
              depth={depth + 1}
              allChars={allChars}
              onRemove={(cid) => onRemoveChild(char.id, cid)}
              onAssignSpouse={onAssignSpouse}
              onAddChild={onAddChild}
              onRemoveChild={onRemoveChild}
              spouses={spouses}
              children={children}
              faction={faction}
            />
          ))}

          {canAddChild ? (
            showAddChild ? (
              <div className="flex items-center gap-1">
                <select
                  defaultValue=""
                  onChange={e => {
                    const c = allChars.find(x => String(x.id) === e.target.value);
                    if (c) { onAddChild(char.id, c); setShowAddChild(false); }
                    e.target.value = '';
                  }}
                  className="h-5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-400 flex-1"
                >
                  <option value="">— select child (max age {ageLimit}) —</option>
                  {eligibleChildren.map(c => <option key={c.id} value={c.id}>{c.name} (age {c.age}, {c.sex})</option>)}
                </select>
                <button onClick={() => setShowAddChild(false)} className="text-slate-600 hover:text-red-400"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddChild(true)} className="text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5">
                <Plus className="w-2.5 h-2.5" /> Add child
              </button>
            )
          ) : (
            <div className="flex items-center gap-1 text-[9px] text-amber-500">
              <AlertTriangle className="w-3 h-3" />
              Max {MAX_CHILDREN} children (5th requires EOP/MEX mod)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FamilyTree({ tree, allChars, onUpdate, onDelete, faction }) {
  const treeId = tree.id;
  const father = tree.father;
  const mother = tree.mother;
  const children = tree.children;
  const spouses = tree.spouses;
  const [showAddChild, setShowAddChild] = useState(false);

  const set = (patch) => onUpdate(treeId, { ...tree, ...patch });

  const handleDrop = (slot, char) => set({ [slot]: char });
  const handleClear = (slot) => set({ [slot]: null });

  const handleAddRootChild = (charId) => {
    const char = allChars.find(c => String(c.id) === charId);
    if (!char) return;
    if ((children || []).find(c => c.id === char.id)) return;
    if ((children || []).length >= MAX_CHILDREN) return;
    set({ children: [...(children || []), char] });
  };

  const handleRemoveRootChild = (charId) => {
    set({ children: (children || []).filter(c => c.id !== charId) });
  };

  const handleAssignSpouse = (charId, spouse) => {
    set({ spouses: { ...(spouses || {}), [charId]: spouse } });
  };

  const handleAddDescendantChild = (parentId, child) => {
    const existingChildren = (tree.nestedChildren || {})[parentId] || [];
    if (existingChildren.find(c => c.id === child.id)) return;
    if (existingChildren.length >= MAX_CHILDREN) return;
    set({ nestedChildren: { ...(tree.nestedChildren || {}), [parentId]: [...existingChildren, child] } });
  };

  const handleRemoveDescendantChild = (parentId, childId) => {
    const existing = (tree.nestedChildren || {})[parentId] || [];
    set({ nestedChildren: { ...(tree.nestedChildren || {}), [parentId]: existing.filter(c => c.id !== childId) } });
  };

  const eligibleChildren = useMemo(() => {
    const fatherAge = father?.age || 0;
    const motherAge = mother?.age || 0;
    const parentAge = (father && mother) ? Math.min(fatherAge, motherAge) : (fatherAge || motherAge);
    const minAge = parentAge - MIN_PARENT_CHILD_AGE_DIFF;
    return allChars.filter(c =>
      c.faction === faction &&
      (c.age || 0) <= minAge &&
      !(children || []).find(x => x.id === c.id) &&
      c.id !== father?.id && c.id !== mother?.id
    );
  }, [allChars, father, mother, children, faction]);

  const canAddChild = (children || []).length < MAX_CHILDREN;
  const nestedChildrenMap = { ...(tree.nestedChildren || {}) };

  const treeLabel = [father?.name, mother?.name].filter(Boolean).join(' × ') || 'Unnamed Tree';

  return (
    <div className="rounded border border-slate-700/40 bg-slate-900/30 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] font-semibold text-amber-300 flex-1 truncate">{treeLabel}</span>
        {tree.fromFile && <span className="text-[8px] text-slate-500 bg-slate-800 px-1 rounded">from file</span>}
        <button onClick={() => onDelete(treeId)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CharacterDragCard slot="father" assigned={father} allChars={allChars} onDrop={handleDrop} onClear={handleClear} />
        <CharacterDragCard slot="mother" assigned={mother} allChars={allChars} onDrop={handleDrop} onClear={handleClear} />
      </div>

      <div>
        <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Children ({(children || []).length}/{MAX_CHILDREN})</p>
        {(children || []).map(child => (
          <ChildNode
            key={child.id}
            char={child}
            depth={0}
            allChars={allChars}
            onRemove={handleRemoveRootChild}
            onAssignSpouse={handleAssignSpouse}
            onAddChild={handleAddDescendantChild}
            onRemoveChild={handleRemoveDescendantChild}
            spouses={spouses || {}}
            children={nestedChildrenMap}
            faction={faction}
          />
        ))}

        {canAddChild ? (
          showAddChild ? (
            <div className="flex items-center gap-1 mt-1">
              <select
                defaultValue=""
                onChange={e => {
                  handleAddRootChild(e.target.value);
                  setShowAddChild(false);
                  e.target.value = '';
                }}
                className="h-5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-400 flex-1"
              >
                <option value="">— select child —</option>
                {eligibleChildren.map(c => <option key={c.id} value={c.id}>{c.name} (age {c.age}, {c.sex})</option>)}
              </select>
              <button onClick={() => setShowAddChild(false)} className="text-slate-600 hover:text-red-400"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddChild(true)}
              disabled={!father && !mother}
              className="mt-1 text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 disabled:opacity-30"
            >
              <Plus className="w-2.5 h-2.5" /> Add child
            </button>
          )
        ) : (
          <div className="flex items-center gap-1 text-[9px] text-amber-500 mt-1">
            <AlertTriangle className="w-3 h-3" />
            Max {MAX_CHILDREN} children — 5th requires EOP or MEX mod
          </div>
        )}
      </div>
    </div>
  );
}

export default function FamilyTreeTab({ stratData }) {
  const [factionFilter, setFactionFilter] = useState('');
  const [trees, setTrees] = useState({});
  const [initialized, setInitialized] = useState(false);

  const allChars = useMemo(() => buildAllChars(stratData), [stratData]);

  const allFactions = useMemo(() => {
    const from = (stratData?.factions || []).map(f => f.name).filter(Boolean);
    const fromLists = [...(stratData?.playable || []), ...(stratData?.unlockable || []), ...(stratData?.nonplayable || [])];
    return [...new Set([...from, ...fromLists])].sort();
  }, [stratData]);

  // Initialize trees from file on first load
  useEffect(() => {
    if (stratData?.raw && !initialized) {
      const fromFile = buildInitialTrees(stratData, allChars);
      setTrees(fromFile);
      setInitialized(true);
    }
  }, [stratData?.raw, initialized]);

  const activeFaction = factionFilter || allFactions[0] || '';

  const factionChars = useMemo(() =>
    allChars.filter(c => c.faction === activeFaction),
    [allChars, activeFaction]
  );

  const maleChars = useMemo(() => factionChars.filter(c => c.sex === 'male'), [factionChars]);
  const femaleChars = useMemo(() => factionChars.filter(c => c.sex === 'female'), [factionChars]);

  const factionTrees = trees[activeFaction] || [];

  const addTree = () => {
    const newTree = { id: Date.now(), father: null, mother: null, children: [], spouses: {}, nestedChildren: {} };
    setTrees(prev => ({ ...prev, [activeFaction]: [...(prev[activeFaction] || []), newTree] }));
  };

  const updateTree = (tid, updated) => {
    setTrees(prev => ({
      ...prev,
      [activeFaction]: (prev[activeFaction] || []).map(t => t.id === tid ? updated : t),
    }));
  };

  const deleteTree = (tid) => {
    setTrees(prev => ({
      ...prev,
      [activeFaction]: (prev[activeFaction] || []).filter(t => t.id !== tid),
    }));
  };

  if (!stratData?.raw) {
    return <div className="p-3 text-[10px] text-slate-600 text-center">Load descr_strat.txt to use family trees</div>;
  }

  const DragList = ({ chars, label }) => (
    <div className="flex-1 min-w-0">
      <p className="text-[8px] text-slate-600 uppercase font-semibold mb-1">{label}</p>
      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-0.5">
        {chars.map(c => (
          <div
            key={c.id}
            draggable
            onDragStart={e => e.dataTransfer.setData('charId', String(c.id))}
            className="px-2 py-1 bg-slate-800 rounded border border-slate-600/40 text-[10px] font-mono text-slate-300 cursor-grab hover:border-amber-500/50 hover:text-amber-300 transition-colors select-none"
            title={`${c.charType} · age ${c.age}`}
          >
            <div className="truncate">{c.name}</div>
            <div className="text-[8px] text-slate-600">age {c.age} · {c.charType}</div>
          </div>
        ))}
        {chars.length === 0 && <p className="text-[9px] text-slate-600 italic">None</p>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-slate-800 shrink-0 space-y-1.5">
        <select
          value={activeFaction}
          onChange={e => setFactionFilter(e.target.value)}
          className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200"
        >
          {allFactions.map(f => <option key={f}>{f}</option>)}
        </select>
        <p className="text-[9px] text-slate-500">{factionChars.length} characters ({maleChars.length}♂ {femaleChars.length}♀)</p>
      </div>

      {/* Drag sidebar: two columns male/female */}
      <div className="shrink-0 border-b border-slate-800 p-2">
        <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Drag into Father/Mother slots</p>
        <div className="flex gap-2">
          <DragList chars={maleChars} label="♂ Males → Father" />
          <DragList chars={femaleChars} label="♀ Females → Mother" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <button
          onClick={addTree}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border border-slate-600/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors"
        >
          <Plus className="w-3 h-3" /> New Family Tree
        </button>

        {factionTrees.length === 0 && (
          <p className="text-[10px] text-slate-600 italic text-center py-4">No family trees for {activeFaction}</p>
        )}

        {factionTrees.map(tree => (
          <FamilyTree
            key={tree.id}
            tree={tree}
            allChars={allChars}
            onUpdate={updateTree}
            onDelete={deleteTree}
            faction={activeFaction}
          />
        ))}
      </div>
    </div>
  );
}