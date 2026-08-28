import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { lookupSourceStrings } from './factionBulkDuplicate';

const EMPTY = { displayName: '', adjective: '', leaderTitle: '', formerLeaderTitle: '', heirTitle: '', strengths: '', weaknesses: '', customUnit: '' };

function FieldPair({ label, sourceValue, value, onChange, placeholder, textarea }) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div>
        <label className="text-[9px] text-slate-500 block mb-1">Source {label}</label>
        {textarea ? (
          <textarea value={sourceValue || ''} disabled readOnly
            className="w-full h-16 bg-slate-800/60 border border-slate-700 rounded p-2 text-[10px] text-slate-400 resize-none cursor-not-allowed" />
        ) : (
          <Input value={sourceValue || ''} disabled readOnly
            className="h-7 text-[10px] px-2 bg-slate-800/60 border-slate-700 text-slate-400 cursor-not-allowed" />
        )}
      </div>
      <div>
        <label className="text-[9px] text-slate-400 block mb-1">New {label}</label>
        {textarea ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            className="w-full h-16 bg-slate-700 border border-slate-600 rounded p-2 text-[10px] text-slate-100 resize-none" />
        ) : (
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            className="h-7 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100" />
        )}
      </div>
    </div>
  );
}

export default function DuplicateFactionModal({ open, onOpenChange, sourceFaction, defaultName, onConfirm }) {
  const [name, setName] = useState('');
  const [srcInfo, setSrcInfo] = useState(null);
  const [vals, setVals] = useState(EMPTY);
  const [manualSrcAdj, setManualSrcAdj] = useState('');

  useEffect(() => {
    if (open && sourceFaction) {
      setName(defaultName || '');
      setSrcInfo(lookupSourceStrings(sourceFaction.name));
      setVals(EMPTY);
      setManualSrcAdj('');
    }
  }, [open, sourceFaction, defaultName]);

  const set = (key) => (v) => setVals((s) => ({ ...s, [key]: v }));

  const confirm = () => {
    if (!name.trim()) return;
    onConfirm({
      newName: name.trim(),
      sourceAdjective: srcInfo?.adjective || manualSrcAdj.trim(),
      ...vals,
    });
  };

  const adjFound = !!srcInfo?.adjective;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-600 max-h-[85vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-200">
            Duplicate Faction{sourceFaction ? `: ${sourceFaction.name}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-3">
          <div>
            <label className="text-[10px] text-slate-300 block mb-2">New Faction Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. mantua"
              className="h-8 text-[11px] px-2 bg-slate-700 border-slate-600 text-slate-100"
              onKeyDown={(e) => e.key === 'Enter' && confirm()}
            />
          </div>

          <div className="border-t border-slate-700 pt-3">
            <p className="text-[10px] text-slate-400 mb-1">String Entries (expanded + menu .strings.bin)</p>
            <p className="text-[9px] text-slate-500">Left column shows the source faction's current values. Fill the right column with the new faction's variants — empty fields keep the source text.</p>

            {/* Adjective — source is auto-detected when possible */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-[9px] text-slate-500 block mb-1">Source Faction Adjective</label>
                {adjFound ? (
                  <Input value={srcInfo.adjective} disabled readOnly
                    className="h-7 text-[10px] px-2 bg-slate-800/60 border-slate-700 text-slate-400 cursor-not-allowed" />
                ) : (
                  <>
                    <Input value={manualSrcAdj} onChange={(e) => setManualSrcAdj(e.target.value)}
                      placeholder="e.g. Milanese"
                      className="h-7 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100" />
                    <p className="text-[9px] text-amber-400/80 mt-1">Not found in strings — enter it manually</p>
                  </>
                )}
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block mb-1">New Faction Adjective</label>
                <Input value={vals.adjective} onChange={(e) => set('adjective')(e.target.value)}
                  placeholder="e.g. Mantuan"
                  className="h-7 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100" />
              </div>
            </div>

            <FieldPair label="Display Name" sourceValue={srcInfo?.displayName} value={vals.displayName}
              onChange={set('displayName')} placeholder="e.g. Marquisate of Mantua" />
            <FieldPair label="Leader Title" sourceValue={srcInfo?.leaderTitle} value={vals.leaderTitle}
              onChange={set('leaderTitle')} placeholder="e.g. Marquis" />
            <FieldPair label="Former Leader Title" sourceValue={srcInfo?.formerLeaderTitle} value={vals.formerLeaderTitle}
              onChange={set('formerLeaderTitle')} placeholder="e.g. Late Marquis" />
            <FieldPair label="Heir Title" sourceValue={srcInfo?.heirTitle} value={vals.heirTitle}
              onChange={set('heirTitle')} placeholder="e.g. Prince" />
            <FieldPair label="Strengths" sourceValue={srcInfo?.strengths} value={vals.strengths}
              onChange={set('strengths')} placeholder="e.g. Expert horse archers…" textarea />
            <FieldPair label="Weaknesses" sourceValue={srcInfo?.weaknesses} value={vals.weaknesses}
              onChange={set('weaknesses')} placeholder="e.g. Weak in siege defense" textarea />
            <FieldPair label="Custom Unit Name" sourceValue={srcInfo?.customUnit} value={vals.customUnit}
              onChange={set('customUnit')} placeholder="e.g. Keshik Guard" />
          </div>

          <div className="border-t border-slate-700 pt-3 text-[9px] text-slate-500 leading-relaxed">
            <p className="text-slate-400 font-semibold mb-1">Also duplicated automatically:</p>
            <p>• Banner textures (descr_banners_new.xml) • Stratmap characters &amp; strat model textures (descr_character.txt, descr_model_strat.txt) • Character names block (descr_names.txt) • Unit ownership (export_descr_unit.txt) • Navy entry (descr_offmap_models.txt) • Menu UI strings</p>
            <p className="mt-1">The new faction is inserted directly below the source in descr_sm_factions.txt.</p>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-[10px] rounded border border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</button>
          <button onClick={confirm} disabled={!name.trim()}
            className="px-3 py-1.5 text-[10px] rounded bg-blue-700 hover:bg-blue-600 text-white font-semibold disabled:opacity-40">Duplicate</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}