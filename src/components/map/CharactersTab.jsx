import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Archive, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import FamilyTreeTab from './FamilyTreeTab';

// Types that are always female
const FEMALE_ONLY_TYPES = new Set(['princess', 'witch']);
// Types that are always male
const MALE_ONLY_TYPES = new Set(['general','admiral','spy','merchant','diplomat','priest','assassin','heretic','inquisitor','named character']);
// "family" type = character_record only, no army/traits/ancillaries
const ALL_CHARACTER_TYPES = ['general','admiral','spy','merchant','diplomat','priest','assassin','princess','heretic','witch','inquisitor','named character','family'];
const NAMED_TYPES = new Set(['named character','general','admiral']);
const RECORD_ROLES = ['never_a_leader','past_leader','leader','heir'];

// Derive sex from type
function sexForType(type) {
  if (FEMALE_ONLY_TYPES.has(type)) return 'female';
  if (MALE_ONLY_TYPES.has(type)) return 'male';
  return null; // family = both ok
}

// Get filtered names list for a faction/sex from descrNames
function getNames(descrNames, faction, sex) {
  if (!descrNames || !faction) return [];
  // Try exact faction match first, then collect all
  const sexObj = descrNames[sex] || {};
  const factionNames = sexObj[faction] || [];
  if (factionNames.length > 0) return factionNames;
  // fallback: return all names for that sex across all factions
  const all = new Set();
  for (const names of Object.values(sexObj)) names.forEach(n => all.add(n));
  return [...all].sort();
}

// Validate a character for placing/saving
function validateCharacter(char, eduUnits) {
  if (!char.faction) return { ok: false, reason: 'No faction selected' };
  if (!char.name) return { ok: false, reason: 'No name' };
  if (char.charType === 'family') return { ok: true };

  const factionUnits = (eduUnits || []).filter(u => {
    const owners = u.ownership || [];
    return owners.includes(char.faction) || owners.includes('all');
  });

  if (char.charType === 'named character') {
    const hasGeneral = factionUnits.some(u => (u.attributes || []).includes('general_unit'));
    if (!hasGeneral) return { ok: false, reason: `Faction "${char.faction}" has no general unit in EDU` };
  }
  if (char.charType === 'general') {
    const army = char.army || [];
    if (army.length === 0) return { ok: false, reason: 'General needs at least 1 army unit' };
    const unitNames = factionUnits.map(u => u.type);
    const hasValidUnit = army.some(a => unitNames.includes(a.unit));
    if (!hasValidUnit) return { ok: false, reason: `No valid army unit found for faction "${char.faction}" in EDU` };
  }
  if (char.charType === 'admiral') {
    const army = char.army || [];
    if (army.length === 0) return { ok: false, reason: 'Admiral needs at least 1 ship unit' };
    const shipUnits = factionUnits.filter(u => u.category === 'ship').map(u => u.type);
    const hasShip = army.some(a => shipUnits.includes(a.unit));
    if (!hasShip) return { ok: false, reason: `No valid ship unit found for faction "${char.faction}" in EDU` };
  }
  return { ok: true };
}

function CharacterRow({ char, allFactions, descrNames, traitsList, ancillariesList, eduUnits, onUpdate, onDelete, onSelect, onPin }) {
  const [expanded, setExpanded] = useState(false);
  const c = char;
  const set = (key, val) => onUpdate(c.id, { ...c, [key]: val });

  const enforcedSex = sexForType(c.charType);
  const isFamily = c.charType === 'family';
  const isNamedType = NAMED_TYPES.has(c.charType);
  const hasArmy = c.charType === 'general' || c.charType === 'named character' || c.charType === 'admiral';
  const fullName = [c.name, c.surname].filter(Boolean).join(' ');

  // Name lists from descrNames
  const sex = enforcedSex || c.sex || 'male';
  const firstNames = useMemo(() => getNames(descrNames, c.faction, sex), [descrNames, c.faction, sex]);
  const surnameNames = useMemo(() => getNames(descrNames, c.faction, 'male').concat(getNames(descrNames, c.faction, 'female')), [descrNames, c.faction]);

  // Display name lookup (from names.strings.bin merged into descrNames parent or settlement names)
  // We pass descrNames as raw object; display names aren't available separately here, so we skip for now.

  const validation = useMemo(() => validateCharacter(c, eduUnits), [c, eduUnits]);

  // Faction units for dropdowns
  const factionUnits = useMemo(() => {
    if (!eduUnits?.length || !c.faction) return [];
    return eduUnits.filter(u => {
      const owners = u.ownership || [];
      return owners.includes(c.faction) || owners.includes('all');
    });
  }, [eduUnits, c.faction]);

  const landUnits = useMemo(() => factionUnits.filter(u => u.category !== 'ship'), [factionUnits]);
  const shipUnits = useMemo(() => factionUnits.filter(u => u.category === 'ship'), [factionUnits]);
  const unitOptions = c.charType === 'admiral' ? shipUnits : landUnits;

  const handleTypeChange = (newType) => {
    const newSex = sexForType(newType);
    onUpdate(c.id, { ...c, charType: newType, sex: newSex || c.sex });
  };

  const icon = c.charType === 'admiral' ? '⚓' : c.charType === 'spy' ? '🕵️' : c.charType === 'priest' ? '✝' : c.charType === 'princess' ? '👸' : c.charType === 'family' ? '👪' : '⚔️';

  return (
    <div className="rounded border border-slate-700/40 bg-slate-900/20">
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
        <span className="text-sm shrink-0">{icon}</span>
        <span className="text-[11px] font-mono flex-1 truncate text-slate-200">
          {fullName || '(unnamed)'} — <span className="text-slate-400">{c.charType}</span>
          {c.role && <span className="ml-1 text-amber-400 text-[9px]">[{c.role}]</span>}
        </span>
        <span className="text-[9px] text-slate-600 font-mono">{c.x != null ? `${c.x},${c.y}` : 'unplaced'}</span>
        {!isFamily && (
          <button onClick={e => { e.stopPropagation(); onSelect(char); }}
            className="text-[9px] px-1 py-0.5 rounded bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 shrink-0">Go</button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(c.id); }}
          className="p-0.5 text-slate-600 hover:text-red-400 transition-colors shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/40 px-2 py-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            {/* First Name - from descrNames */}
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
                  placeholder="Load descr_names.txt"
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              )}
            </div>
            {/* Surname - from descrNames surnames */}
            <div>
              <span className="text-[9px] text-slate-500">Surname</span>
              {surnameNames.length > 0 ? (
                <select value={c.surname || ''} onChange={e => set('surname', e.target.value)}
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono">
                  <option value="">— none —</option>
                  {surnameNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <input value={c.surname || ''} onChange={e => set('surname', e.target.value)}
                  placeholder="e.g. the Bastard"
                  className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              )}
            </div>

            {/* Type */}
            <div>
              <span className="text-[9px] text-slate-500">Type</span>
              <select value={c.charType || 'general'} onChange={e => handleTypeChange(e.target.value)}
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

            {/* Sex */}
            <div>
              <span className="text-[9px] text-slate-500">Sex</span>
              <select value={sex} onChange={e => set('sex', e.target.value)}
                disabled={!!enforcedSex}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                {enforcedSex ? (
                  <option value={enforcedSex}>{enforcedSex} (forced)</option>
                ) : (
                  <>
                    <option value="male">male</option>
                    <option value="female">female</option>
                  </>
                )}
              </select>
            </div>

            {/* Age */}
            <div>
              <span className="text-[9px] text-slate-500">Age</span>
              <input type="number" value={c.age || 30} onChange={e => set('age', parseInt(e.target.value) || 30)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>

            {/* Role (named/general only) */}
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
            {!isFamily && (
              <>
                <div>
                  <span className="text-[9px] text-slate-500">X (map)</span>
                  <input type="number" value={c.x ?? ''} onChange={e => set('x', parseInt(e.target.value))}
                    className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500">Y (map)</span>
                  <input type="number" value={c.y ?? ''} onChange={e => set('y', parseInt(e.target.value))}
                    className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                </div>
              </>
            )}
          </div>

          {/* Pin on map button */}
          {!isFamily && (
            <button
              onClick={() => onPin(char)}
              className="w-full flex items-center justify-center gap-1 py-1 text-[10px] rounded border border-cyan-600/40 text-cyan-400 hover:bg-cyan-600/20 transition-colors">
              <MapPin className="w-3 h-3" /> Pin on Map (click map to place)
            </button>
          )}

          {/* Traits (from parsed file, not manual) */}
          {!isFamily && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">Traits</p>
              {(c.traits || []).map((t, i) => (
                <div key={i} className="flex items-center gap-1 mb-0.5">
                  {traitsList.length > 0 ? (
                    <select value={t.name} onChange={e => {
                      const traits = c.traits.map((x, j) => j === i ? { ...x, name: e.target.value } : x);
                      set('traits', traits);
                    }} className="flex-1 h-5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono">
                      <option value="">— select trait —</option>
                      {traitsList.map(tn => <option key={tn} value={tn}>{tn}</option>)}
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
                <Plus className="w-2.5 h-2.5" /> Add trait
              </button>
            </div>
          )}

          {/* Ancillaries (from parsed file) */}
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
                  if (e.target.value && !(c.ancillaries||[]).includes(e.target.value)) {
                    set('ancillaries', [...(c.ancillaries||[]), e.target.value]);
                  }
                  e.target.value = '';
                }} className="w-full h-5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                  <option value="">— add ancillary —</option>
                  {ancillariesList.filter(a => !(c.ancillaries||[]).includes(a)).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              ) : (
                <div className="flex gap-1">
                  <input id={`anc-${c.id}`} placeholder="ancillary_name" className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
                  <button onClick={() => {
                    const inp = document.getElementById(`anc-${c.id}`);
                    if (inp?.value) { set('ancillaries', [...(c.ancillaries||[]), inp.value]); inp.value = ''; }
                  }} className="text-[9px] px-1 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100">+</button>
                </div>
              )}
            </div>
          )}

          {/* Army Units */}
          {hasArmy && !isFamily && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">
                Army Units {c.charType === 'admiral' ? '(ships only)' : ''}
              </p>
              <div className="space-y-0.5">
                {(c.army || []).map((u, i) => (
                  <div key={i} className="flex items-center gap-1">
                    {unitOptions.length > 0 ? (
                      <select value={u.unit} onChange={e => {
                        const army = c.army.map((x, j) => j === i ? { ...x, unit: e.target.value } : x);
                        set('army', army);
                      }} className="flex-1 h-5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono">
                        <option value="">— select unit —</option>
                        {unitOptions.map(u2 => <option key={u2.type} value={u2.type}>{u2.type}</option>)}
                      </select>
                    ) : (
                      <input value={u.unit} onChange={e => {
                        const army = c.army.map((x, j) => j === i ? { ...x, unit: e.target.value } : x);
                        set('army', army);
                      }} className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" placeholder="unit name" />
                    )}
                    <input type="number" title="exp" value={u.exp ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, exp: parseInt(e.target.value)||0 } : x);
                      set('army', army);
                    }} className="w-8 h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-amber-300 font-mono text-center" />
                    <input type="number" title="armour" value={u.armour ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, armour: parseInt(e.target.value)||0 } : x);
                      set('army', army);
                    }} className="w-8 h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-blue-300 font-mono text-center" />
                    <input type="number" title="wpn" value={u.weaponLvl ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, weaponLvl: parseInt(e.target.value)||0 } : x);
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
          {!isFamily && (
            <div className="pt-1 border-t border-slate-700/40">
              <button
                disabled={!validation.ok}
                onClick={() => { if (validation.ok && c.x == null) onPin(char); }}
                className={`w-full flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border font-semibold transition-colors ${
                  validation.ok
                    ? 'bg-green-700/80 hover:bg-green-700 border-green-600/40 text-green-200'
                    : 'bg-slate-800/50 border-slate-600/30 text-slate-600 cursor-not-allowed'
                }`}
                title={validation.ok ? 'Character is valid' : validation.reason}
              >
                {validation.ok
                  ? <><CheckCircle className="w-3 h-3" /> Valid</>
                  : <><AlertTriangle className="w-3 h-3" /> {validation.reason}</>
                }
              </button>
            </div>
          )}
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

export default function CharactersTab({ stratData, onStratDataChange, onSelectItem, descrNames, traitsList, ancillariesList, eduUnits, onPinCharacter }) {
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
      for (const r of (f.characterRecords || [])) recs.push({ ...r, _faction: f.name });
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
      const characterRecords = (f.characterRecords || []).map(r => r.name === oldRec.name ? updated : r);
      return { ...f, characterRecords };
    });
    onStratDataChange({ ...stratData, factions });
  };

  const handleAdd = () => {
    if (!stratData) return;
    const defaultFaction = allFactions[0] || '';
    const newChar = {
      id: -(Date.now()), category: 'character', name: '', surname: '',
      charType: 'general', sex: 'male', role: '', age: 30,
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
            {/* File load hints */}
            {!descrNames && <p className="text-[9px] text-amber-600/80 italic">Load descr_names.txt for name dropdowns</p>}
            {(!traitsList?.length || !ancillariesList?.length) && <p className="text-[9px] text-amber-600/80 italic">Load traits/ancillaries files for dropdowns</p>}
            {!eduUnits?.length && <p className="text-[9px] text-amber-600/80 italic">Load export_descr_unit.txt for validation</p>}
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
                traitsList={traitsList || []}
                ancillariesList={ancillariesList || []}
                eduUnits={eduUnits || []}
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