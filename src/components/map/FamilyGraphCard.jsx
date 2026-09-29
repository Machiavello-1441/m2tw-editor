import React, { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';
import { CW, CH } from './familyGraphLayout';

// Custom portraits loaded from data/ui/custom_portraits (see Home page loader)
export function usePortraits() {
  const [p, setP] = useState(() => window._m2tw_portraits || {});
  useEffect(() => {
    const h = () => setP({ ...(window._m2tw_portraits || {}) });
    window.addEventListener('load-portraits', h);
    return () => window.removeEventListener('load-portraits', h);
  }, []);
  return p;
}

export function portraitFor(char, portraits) {
  if (!char?.portrait) return null;
  const f = char.portrait;
  return portraits[`${f}/portrait_young`] || portraits[`${f}/portrait_old`] || portraits[`${f}/portrait_dead`] || null;
}

const style = { width: CW, height: CH };

export default function FamilyGraphCard({ node, portraits, showPortraits, onDropChar, onDetach, onSelect }) {
  const [over, setOver] = useState(false);
  const { char, slot } = node;
  const dropProps = {
    onDragOver: (e) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e) => { e.preventDefault(); setOver(false); onDropChar(node, e.dataTransfer.getData('charId')); },
  };
  const ring = over ? 'border-amber-400 bg-amber-900/30' : '';

  if (!char) {
    return (
      <div {...dropProps} style={{ ...style, left: node.x, top: node.y }}
        className={`absolute rounded border-2 border-dashed border-slate-600/50 flex items-center justify-center text-[9px] text-slate-500 text-center px-1 ${ring}`}>
        Drop {slot === 'father' ? 'a man (father)' : 'a woman (mother)'}
      </div>
    );
  }
  const src = showPortraits ? portraitFor(char, portraits) : null;
  const female = char.sex === 'female';
  return (
    <div draggable {...dropProps}
      onDragStart={(e) => e.dataTransfer.setData('charId', String(char.id))}
      onClick={() => onSelect?.(char)}
      title={`${char.name}${char.surname ? ' ' + char.surname : ''} · ${char.charType || ''} · age ${char.age ?? '?'}${char.portrait ? ' · portrait: ' + char.portrait : ''}`}
      style={{ ...style, left: node.x, top: node.y }}
      className={`group absolute rounded border bg-slate-800 flex items-center gap-1.5 p-1 cursor-grab select-none ${
        over ? ring : female ? 'border-pink-500/50' : 'border-sky-500/50'}`}>
      {showPortraits && char.portrait && (
        src
          ? <img src={src} alt="" className="h-full w-9 rounded-sm object-cover shrink-0" />
          : <div className="h-full w-9 rounded-sm bg-slate-700 text-[8px] text-slate-500 flex items-center justify-center text-center shrink-0" title="Load data/ui/custom_portraits to preview">no img</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-mono text-slate-100 truncate flex items-center gap-0.5">
          {(char.role === 'leader' || char.role === 'heir') && <Star className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
          {char.name}
        </p>
        <p className="text-[8px] text-slate-500 truncate">{char.surname || ''}</p>
        <p className="text-[8px] text-slate-500">{female ? '♀' : '♂'} age {char.age ?? '?'}{char.status === 'dead' ? ' ✝' : ''}</p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDetach(node); }} title="Take off the tree"
        className="absolute -top-1.5 -right-1.5 hidden group-hover:block rounded-full bg-slate-900 border border-slate-600 text-slate-400 hover:text-red-400">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}