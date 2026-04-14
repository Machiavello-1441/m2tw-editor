import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Archive, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import FamilyTreeTab from './FamilyTreeTab';

// Types that force female sex
const FEMALE_ONLY_TYPES = new Set(['princess', 'witch']);
// Types that force male sex
const MALE_ONLY_TYPES = new Set(['general', 'admiral', 'spy', 'merchant', 'diplomat', 'priest', 'assassin', 'heretic', 'inquisitor', 'named character']);
// "family" type is both sexes, goes to character_record
const ALL_CHARACTER_TYPES = ['general', 'admiral', 'spy', 'merchant', 'diplomat', 'priest', 'assassin', 'princess', 'heretic', 'witch', 'inquisitor', 'named character', 'family'];
const NAMED_TYPES = new Set(['named character', 'general', 'admiral']);
const RECORD_ROLES = ['never_a_leader', 'past_leader', 'leader', 'heir'];

function getSexForType(charType) {
  if (FEMALE_ONLY_TYPES.has(charType)) return 'female';
  if (MALE_ONLY_TYPES.has(charType)) return 'male';
  return null; // family = free choice
}

// Get available names from descr_names for a faction + sex
function getNames(descrNames, faction, sex) {
  if (!descrNames || !faction) return [];
  const sexKey = sex === 'female' ? 'female' : 'male';
  return descrNames[sexKey]?.[faction] || [];
}

// Get display name from namesDisplayMap (parsed from names.strings.bin)
function getDisplayName(namesDisplayMap, internalName) {
  if (!namesDisplayMap || !internalName) return '';
  return namesDisplayMap[internalName] || namesDisplayMap[internalName.toLowerCase()] || '';
}

// Validate character for the "Confirm" button
function validateChar(char, eduUnits) {
  if (!char.faction) return { ok: false, reason: 'No faction selected' };
  if (!char.name) return { ok: false, reason: 'No name selected' };
  if (char.charType === 'family') return { ok: true, reason: '' };

  const factionUnits = (eduUnits || []).filter(u =>
    u.ownership && (u.ownership.includes(char.faction) || u.ownership.includes('all'))
  );

  if (char.charType === 'named character') {
    const hasGeneral = factionUnits.some(u => u.attributes?.includes('general_unit') || u.attributes?.includes('general_unit_upgrade'));
    if (!hasGeneral) return { ok: false, reason: `No general unit available for ${char.faction} in EDU` };
  }
  if (char.charType === 'general') {
    const hasArmy = (char.army || []).length > 0;
    if (!hasArmy) return { ok: false, reason: 'General needs at least one army unit' };
    const factionUnitNames = new Set(factionUnits.map(u => u.type));
    const allValid = (char.army || []).every(u => !u.unit || factionUnitNames.has(u.unit));
    if (!allValid) return { ok: false, reason: 'Some army units are not available to this faction' };
  }
  if (char.charType === 'admiral') {
    const hasShip = (char.army || []).length > 0;
    if (!hasShip) return { ok: false, reason: 'Admiral needs at least one ship unit' };
    const shipUnits = new Set(factionUnits.filter(u => u.category === 'ship').map(u => u.type));
    const hasValidShip = (char.army || []).some(u => u.unit && shipUnits.has(u.unit));
    if (!hasValidShip) return { ok: false, reason: 'No valid ship unit found for this faction' };
  }
  return { ok: true, reason: '' };
}

function CharacterRow({ char, allFactions, descrNames, namesDisplayMap, traitsList, ancillariesList, eduUnits, onUpdate, onDelete, onSelect, onPin }) {
  const [expanded, setExpanded] = useState(false);
  const c = char;
  const set = (key, val) => onUpdate(c.id, { ...c, [key]: val });

  const forcedSex = getSexForType(c.charType);
  const effectiveSex = forcedSex || c.sex || 'male';
  const isFamily = c.charType === 'family';
  const isNamedType = NAMED_TYPES.has(c.charType);
  const hasArmy = c.charType === 'general' || c.charType === 'named character' || c.charType === 'admiral';

  const firstNames = useMemo(() => getNames(descrNames, c.faction, effectiveSex), [descrNames, c.faction, effectiveSex]);
  const surnameNames = useMemo(() => getNames(descrNames, c.faction, effectiveSex), [descrNames, c.faction, effectiveSex]);

  const firstNameDisplay = getDisplayName(namesDisplayMap, c.name);
  const surnameDisplay = getDisplayName(namesDisplayMap, c.surname);

  const factionEduUnits = useMemo(() =>
    (eduUnits || []).filter(u => u.ownership && (u.ownership.includes(c.faction) || u.ownership.includes('all'))),
    [eduUnits, c.faction]
  );
  const factionArmyUnits = useMemo(() => factionEduUnits.filter(u => u.category !== 'ship'), [factionEduUnits]);
  const factionShipUnits = useMemo(() => factionEduUnits.filter(u => u.category === 'ship'), [factionEduUnits]);
  const availableUnits = c.charType === 'admiral' ? factionShipUnits : factionArmyUnits;

  const validation = useMemo(() => validateChar(c, eduUnits), [c, eduUnits]);

  const fullName = [c.name, c.surname].filter(Boolean).join(' ');

  const typeIcon = isFamily ? '👨‍👩‍👧' : c.charType === 'admiral' ? '⚓' : c.charType === 'spy' ? '🕵️' : c.charType === 'priest' ? '✝' : c.charType === 'princess' ? '👑' : '⚔️';

  return (
    <div className="rounded border border-slate-700/40 bg-slate-900/20">
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
        <span className="text-sm shrink-0">{typeIcon}</span>
        <span className="text-[11px] font-mono flex-1 truncate text-slate-200">
          {fullName || '(unnamed)'} — <span className="text-slate-400">{c.charType}</span>
          {c.role && <span className="ml-1 text-amber-400 text-[9px]">[{c.role}]</span>}
          {isFamily && <span className="ml-1 text-pink-400 text-[9px]">[record]</span>}
        </span>
        <span className="text-[9px] text-slate-600 font-mono">{c.x != null ? `${c.x},${c.y}` : 'unplaced'}</span>
        <button onClick={e => { e.stopPropagation(); onPin(char); }}
          title="Pin on map"
          className={`p-0.5 transition-colors shrink-0 ${c.x != null ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-amber-400'}`}>
          <MapPin className="w-3 h-3" />
        </button>
        <button onClick={e => { e.stopPropagation(); onSelect(char); }}
          className="text-[9px] px-1 py-0.5 rounded bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 shrink-0">Go</button>
        <button onClick={e => { e.stopPropagation(); onDelete(c.id); }}
          className="p-0.5 text-slate-600 hover:text-red-400 transition-colors shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/40 px-2 py-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            {/* Type */}
            <div>
              <span className="text-[9px] text-slate-500">Type</span>
              <select value={c.charType || 'general'} onChange={e => {
                const newType = e.target.value;
                const newForcedSex = getSexForType(newType);
                onUpdate(c.id, { ...c, charType: newType, sex: newForcedSex || c.sex || 'male' });
              }}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                {ALL_CHARACTER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Faction */}
            <div>
              <span className="text-[9px] text-slate-500">Faction</span>
              <select value={c.faction || ''} onChange={e => set('faction', e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">— select —</option>
                {allFactions.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>

            {/* First Name */}
            <div>
              <span className="text-[9px] text-slate-500">First Name</span>
              {firstNames.length > 0 ? (
                <select value={c.name || ''} onChange={e => set('name', e.target.value)}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono">
                  <option value="">— select —</option>
                  {firstNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <input value={c.name || ''} onChange={e => set('name', e.target.value)}
                  placeholder={descrNames ? 'no names for faction' : 'load descr_names.txt'}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              )}
              {firstNameDisplay && (
                <p className="text-[9px] text-amber-300/70 mt-0.5 font-mono">"{firstNameDisplay}"</p>
              )}
            </div>

            {/* Surname */}
            <div>
              <span className="text-[9px] text-slate-500">Surname / Epithet</span>
              {surnameNames.length > 0 ? (
                <select value={c.surname || ''} onChange={e => set('surname', e.target.value)}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono">
                  <option value="">— none —</option>
                  {surnameNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <input value={c.surname || ''} onChange={e => set('surname', e.target.value)}
                  placeholder="optional"
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              )}
              {surnameDisplay && (
                <p className="text-[9px] text-amber-300/70 mt-0.5 font-mono">"{surnameDisplay}"</p>
              )}
            </div>

            {/* Sex */}
            <div>
              <span className="text-[9px] text-slate-500">Sex</span>
              {forcedSex ? (
                <div className="h-6 px-1.5 flex items-center text-[11px] bg-slate-800/50 border border-slate-600/20 rounded text-slate-400 font-mono">
                  {forcedSex} <span className="ml-1 text-[9px] text-slate-600">(fixed)</span>
                </div>
              ) : (
                <select value={effectiveSex} onChange={e => set('sex', e.target.value)}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                  <option value="male">male</option>
                  <option value="female">female</option>
                </select>
              )}
            </div>

            {/* Age */}
            <div>
              <span className="text-[9px] text-slate-500">Age</span>
              <input type="number" value={c.age || 30} onChange={e => set('age', parseInt(e.target.value) || 30)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>

            {/* Role (named types only) */}
            {isNamedType && (
              <div>
                <span className="text-[9px] text-slate-500">Role</span>
                <select value={c.role || ''} onChange={e => set('role', e.target.value)}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                  <option value="">— none —</option>
                  <option value="leader">leader</option>
                  <option value="heir">heir</option>
                </select>
              </div>
            )}

            {/* Position */}
            <div className="col-span-2">
              <span className="text-[9px] text-slate-500">Position</span>
              <div className="flex items-center gap-1">
                <input type="number" placeholder="X" value={c.x ?? ''} onChange={e => set('x', parseInt(e.target.value))}
                  className="flex-1 h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                <input type="number" placeholder="Y" value={c.y ?? ''} onChange={e => set('y', parseInt(e.target.value))}
                  className="flex-1 h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                <button onClick={() => onPin(char)}
                  className="h-6 px-2 flex items-center gap-1 rounded text-[10px] border border-amber-500/40 bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors shrink-0">
                  <MapPin className="w-2.5 h-2.5" /> Pin
                </button>
              </div>
            </div>
          </div>

          {/* Traits — family type skips this */}
          {!isFamily && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">Traits</p>
              {(c.traits || []).map((t, i) => (
                <div key={i} className="flex items-center gap-1 mb-0.5">
                  {traitsList.length > 0 ? (
                    <select value={t.name} onChange={e => {
                      const traits = c.traits.map((x, j) => j === i ? { ...x, name: e.target.value } : x);
                      set('traits', traits);
                    }} className="flex-1 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono">
                      <option value="">— select trait —</option>
                      {traitsList.map(tr => <option key={tr} value={tr}>{tr}</option>)}
                    </select>
                  ) : (
                    <input value={t.name} onChange={e => {
                      const traits = c.traits.map((x, j) => j === i ? { ...x, name: e.target.value } : x);
                      set('traits', traits);
                    }} className="flex-1 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" placeholder="TraitName" />
                  )}
                  <input type="number" value={t.level} onChange={e => {
                    const traits = c.traits.map((x, j) => j === i ? { ...x, level: parseInt(e.target.value) } : x);
                    set('traits', traits);
                  }} className="w-10 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-center" />
                  <button onClick={() => set('traits', c.traits.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 text-[9px]">✕</button>
                </div>
              ))}
              <button onClick={() => set('traits', [...(c.traits || []), { name: '', level: 1 }])}
                className="text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5">
                <Plus className="w-2.5 h-2.5" /> Add trait {traitsList.length === 0 && <span className="text-slate-600">(load traits file)</span>}
              </button>
            </div>
          )}

          {/* Ancillaries — family type skips this */}
          {!isFamily && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">Ancillaries</p>
              <div className="flex flex-wrap gap-0.5 mb-0.5">
                {(c.ancillaries || []).map((a, i) => (
                  <span key={i} className="flex items-center gap-0.5 px-1 py-0.5 bg-slate-700/50 rounded text-[9px] text-purple-300 font-mono">
                    {a}<button onClick={() => set('ancillaries', c.ancillaries.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 ml-0.5">×</button>
                  </span>
                ))}
              </div>
              {ancillariesList.length > 0 ? (
                <select defaultValue="" onChange={e => {
                  if (e.target.value && !(c.ancillaries || []).includes(e.target.value)) {
                    set('ancillaries', [...(c.ancillaries || []), e.target.value]);
                  }
                  e.target.value = '';
                }} className="w-full h-5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                  <option value="">— add ancillary —</option>
                  {ancillariesList.filter(a => !(c.ancillaries || []).includes(a)).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              ) : (
                <div className="flex gap-1">
                  <input id={`anc-${c.id}`} placeholder="ancillary_name (load file for dropdown)" className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                  <button onClick={() => {
                    const inp = document.getElementById(`anc-${c.id}`);
                    if (inp?.value) { set('ancillaries', [...(c.ancillaries || []), inp.value]); inp.value = ''; }
                  }} className="text-[9px] px-1 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100">+</button>
                </div>
              )}
            </div>
          )}

          {/* Army — only general/named character/admiral, skip for family */}
          {hasArmy && !isFamily && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">
                {c.charType === 'admiral' ? 'Ships' : 'Army Units'}
                {c.faction && availableUnits.length > 0 && <span className="ml-1 text-slate-600">({availableUnits.length} available)</span>}
                {c.faction && availableUnits.length === 0 && eduUnits.length > 0 && <span className="ml-1 text-amber-500"> — load EDU</span>}
              </p>
              <div className="space-y-0.5">
                {(c.army || []).map((u, i) => (
                  <div key={i} className="flex items-center gap-1">
                    {availableUnits.length > 0 ? (
                      <select value={u.unit} onChange={e => {
                        const army = c.army.map((x, j) => j === i ? { ...x, unit: e.target.value } : x);
                        set('army', army);
                      }} className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono">
                        <option value="">— select unit —</option>
                        {availableUnits.map(u2 => <option key={u2.type} value={u2.type}>{u2.type}</option>)}
                      </select>
                    ) : (
                      <input value={u.unit} onChange={e => {
                        const army = c.army.map((x, j) => j === i ? { ...x, unit: e.target.value } : x);
                        set('army', army);
                      }} className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" placeholder="unit name" />
                    )}
                    <input type="number" title="exp" value={u.exp ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, exp: parseInt(e.target.value) || 0 } : x);
                      set('army', army);
                    }} className="w-8 h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-amber-300 font-mono text-center" />
                    <input type="number" title="armour" value={u.armour ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, armour: parseInt(e.target.value) || 0 } : x);
                      set('army', army);
                    }} className="w-8 h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-blue-300 font-mono text-center" />
                    <input type="number" title="wpn" value={u.weaponLvl ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, weaponLvl: parseInt(e.target.value) || 0 } : x);
                      set('army', army);
                    }} className="w-8 h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-red-300 font-mono text-center" />
                    <button onClick={() => set('army', c.army.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 text-[9px] shrink-0">✕</button>
                  </div>
                ))}
              </div>
              <p className="text-[8px] text-slate-600 mb-0.5">exp | armour | wpn_lvl</p>
              <button onClick={() => set('army', [...(c.army || []), { unit: '', exp: 0, armour: 0, weaponLvl: 0 }])}
                className="text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5">
                <Plus className="w-2.5 h-2.5" /> Add unit
              </button>
            </div>
          )}

          {/* Validate button */}
          <div className="pt-1 border-t border-slate-700/40">
            <button
              disabled={!validation.ok}
              onClick={() => { /* character is already live in state, just visual confirm */ }}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-semibold border transition-colors ${
                validation.ok
                  ? 'bg-green-700/40 hover:bg-green-700/60 border-green-500/40 text-green-300'
                  : 'bg-slate-800/40 border-slate-700/30 text-slate-600 cursor-not-allowed opacity-60'
              }`}
              title={validation.reason}
            >
              {validation.ok
                ? <><CheckCircle className="w-3 h-3" /> Character Valid</>
                : <><AlertTriangle className="w-3 h-3" /> {validation.reason}</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterRecordRow({ rec, factionName, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const isDead = rec.status === 'dead';
  const set = (key, val) => onUpdate({ ...rec, [key]: val });

  return (
    <div className="rounded border border-slate-700/30 bg-slate-900/10">
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="w-3 h-3 text-slate-600" /> : <ChevronRight className="w-3 h-3 text-slate-600" />}
        <Archive className="w-3 h-3 text-slate-600 shrink-0" />
        <span className="text-[11px] font-mono flex-1 truncate text-slate-400">
          {[rec.name, rec.surname].filter(Boolean).join(' ') || '(unnamed)'}
          <span className="text-slate-600 ml-1">{rec.sex} · age {rec.age}</span>
          {isDead && <span className="text-red-500/70 ml-1 text-[9px]">☠ {rec.deadYears}yr</span>}
          {rec.status && !isDead && <span className="text-slate-500 ml-1 text-[9px]">[{rec.status}]</span>}
        </span>
        <span className="text-[8px] text-slate-600 bg-slate-800/50 px-1 rounded">{factionName}</span>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/30 px-2 py-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[9px] text-slate-500">First Name</span>
              <input value={rec.name || ''} onChange={e => set('name', e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Surname</span>
              <input value={rec.surname || ''} onChange={e => set('surname', e.target.value)}
                placeholder="optional"
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Sex</span>
              <select value={rec.sex || 'male'} onChange={e => set('sex', e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300">
                <option value="male">male</option>
                <option value="female">female</option>
              </select>
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Age</span>
              <input type="number" value={rec.age || 0} onChange={e => set('age', parseInt(e.target.value) || 0)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Status</span>
              <select value={isDead ? 'dead' : 'alive'} onChange={e => set('status', e.target.value === 'dead' ? 'dead' : rec.status === 'dead' ? 'never_a_leader' : rec.status)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300">
                <option value="alive">Alive</option>
                <option value="dead">Dead</option>
              </select>
            </div>
            {isDead && (
              <div>
                <span className="text-[9px] text-slate-500">Years Dead</span>
                <input type="number" min={0} value={rec.deadYears || 0} onChange={e => set('deadYears', parseInt(e.target.value) || 0)}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-red-300 font-mono" />
              </div>
            )}
            {!isDead && (
              <div>
                <span className="text-[9px] text-slate-500">Role</span>
                <select value={rec.status || 'never_a_leader'} onChange={e => set('status', e.target.value)}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300">
                  {RECORD_ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CharactersTab({ stratData, onStratDataChange, onSelectItem, descrNames, namesDisplayMap, traitsList = [], ancillariesList = [], eduUnits = [], onPinCharacter }) {
  const [subTab, setSubTab] = useState('list');
  const [search, setSearch] = useState('');
  const [filterFaction, setFilterFaction] = useState('');

  const allFactions = useMemo(() => {
    const from = (stratData?.factions || []).map(f => f.name).filter(Boolean);
    const fromLists = [...(stratData?.playable || []), ...(stratData?.unlockable || []), ...(stratData?.nonplayable || [])];
    return [...new Set([...from, ...fromLists])].sort();
  }, [stratData]);

  const allChars = useMemo(() =>
    (stratData?.items || []).filter(i => i.category === 'character'),
    [stratData?.items]
  );

  const allRecords = useMemo(() => {
    const recs = [];
    for (const f of (stratData?.factions || [])) {
      for (const r of (f.characterRecords || [])) {
        recs.push({ ...r, _faction: f.name });
      }
    }
    return recs;
  }, [stratData]);

  const filtered = useMemo(() =>
    allChars.filter(c => {
      const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.charType?.includes(search);
      const matchFaction = !filterFaction || c.faction === filterFaction;
      return matchSearch && matchFaction;
    }),
    [allChars, search, filterFaction]
  );

  const filteredRecords = useMemo(() =>
    allRecords.filter(r => {
      const matchSearch = !search || r.name?.toLowerCase().includes(search.toLowerCase());
      const matchFaction = !filterFaction || r._faction === filterFaction;
      return matchSearch && matchFaction;
    }),
    [allRecords, search, filterFaction]
  );

  const handleUpdate = (id, updatedChar) => {
    if (!stratData) return;
    const items = (stratData.items || []).map(i => i.id === id ? updatedChar : i);
    onStratDataChange({ ...stratData, items });
  };

  const handleDelete = (id) => {
    if (!stratData) return;
    const items = (stratData.items || []).filter(i => i.id !== id);
    onStratDataChange({ ...stratData, items });
  };

  const handleRecordUpdate = (factionName, oldRec, updated) => {
    if (!stratData) return;
    const factions = (stratData.factions || []).map(f => {
      if (f.name !== factionName) return f;
      const characterRecords = (f.characterRecords || []).map(r =>
        r.name === oldRec.name ? updated : r
      );
      return { ...f, characterRecords };
    });
    onStratDataChange({ ...stratData, factions });
  };

  const handleAdd = () => {
    if (!stratData) return;
    const defaultFaction = allFactions[0] || '';
    const defaultSex = 'male';
    const newChar = {
      id: -(Date.now()), category: 'character', name: '', surname: '',
      charType: 'general', sex: defaultSex, role: '', age: 30,
      faction: defaultFaction, x: null, y: null,
      traits: [], ancillaries: [], army: [],
    };
    const items = [...(stratData.items || []), newChar];
    onStratDataChange({ ...stratData, items });
  };

  const handlePin = (char) => {
    if (onPinCharacter) onPinCharacter(char);
  };

  if (!stratData?.raw) {
    return <div className="p-3 text-[10px] text-slate-600 text-center">Load descr_strat.txt to edit characters</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-800 shrink-0">
        {[['list', 'Characters'], ['trees', 'Family Trees']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex-1 py-1 text-[9px] font-semibold border-b-2 transition-colors ${subTab === id ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === 'trees' && (
        <div className="flex-1 overflow-hidden">
          <FamilyTreeTab stratData={stratData} />
        </div>
      )}

      {subTab === 'list' && (
        <>
          <div className="p-2 space-y-1.5 shrink-0 border-b border-slate-800">
            <div className="flex gap-1">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or type…"
                className="flex-1 h-6 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 placeholder-slate-600" />
              <select value={filterFaction} onChange={e => setFilterFaction(e.target.value)}
                className="h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">All factions</option>
                {allFactions.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            {/* File status hints */}
            <div className="flex flex-wrap gap-1">
              {!descrNames && <span className="text-[8px] text-amber-500/70 bg-amber-900/20 px-1 rounded">Load descr_names.txt for name dropdowns</span>}
              {traitsList.length === 0 && <span className="text-[8px] text-slate-600 bg-slate-800/40 px-1 rounded">Load traits file</span>}
              {ancillariesList.length === 0 && <span className="text-[8px] text-slate-600 bg-slate-800/40 px-1 rounded">Load ancillaries file</span>}
              {eduUnits.length === 0 && <span className="text-[8px] text-slate-600 bg-slate-800/40 px-1 rounded">Load EDU for unit validation</span>}
            </div>
            <button onClick={handleAdd}
              className="w-full flex items-center justify-center gap-1 py-1 text-[10px] rounded border border-slate-600/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors">
              <Plus className="w-3 h-3" /> Add Character
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filtered.map(char => (
              <CharacterRow
                key={char.id}
                char={char}
                allFactions={allFactions}
                descrNames={descrNames}
                namesDisplayMap={namesDisplayMap}
                traitsList={traitsList}
                ancillariesList={ancillariesList}
                eduUnits={eduUnits}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onSelect={onSelectItem}
                onPin={handlePin}
              />
            ))}

            {filtered.length === 0 && allChars.length === 0 && (
              <div className="text-[10px] text-slate-600 italic text-center py-2">No characters in descr_strat.txt</div>
            )}

            {filteredRecords.length > 0 && (
              <>
                <div className="flex items-center gap-2 py-1 mt-2">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[8px] text-slate-600 uppercase font-semibold flex items-center gap-1">
                    <Archive className="w-2.5 h-2.5" /> Character Records ({filteredRecords.length})
                  </span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
                {filteredRecords.map((rec, idx) => (
                  <CharacterRecordRow
                    key={`${rec._faction}_${rec.name}_${idx}`}
                    rec={rec}
                    factionName={rec._faction}
                    onUpdate={(updated) => handleRecordUpdate(rec._faction, rec, updated)}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}