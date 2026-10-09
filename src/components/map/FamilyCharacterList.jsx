import React from 'react';
import { usePortraits, portraitFor } from '@/components/map/FamilyGraphCard';
import WorkspaceImage from '@/components/workspace/WorkspaceImage';
import portraitPaths from '@/components/workspace/portraitPaths';

export default function FamilyCharacterList({ chars, placedIds, showPortraits, characterErrors = {} }) {
  const portraits = usePortraits();
  return <div className="flex flex-col h-full min-h-0">
    <p className="p-2 text-[10px] text-muted-foreground border-b border-border shrink-0">Drag characters onto the visual family tree.</p>
    <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
      {chars.map(character => {
        const src = showPortraits ? portraitFor(character, portraits) : null;
        return <div key={character.id} draggable onDragStart={event => event.dataTransfer.setData('charId', String(character.id))}
          className={`flex items-center gap-2 p-2 rounded border bg-card text-card-foreground cursor-grab select-none ${characterErrors[String(character.id)]?.length ? 'border-destructive' : 'border-border'} ${placedIds.has(character.id) ? 'opacity-50' : ''}`}
          title={characterErrors[String(character.id)]?.join('\n') || 'Drag onto the tree'}>
          {showPortraits && character.portrait && <WorkspaceImage paths={portraitPaths(character)} fallback={src} className="w-8 h-8 rounded-sm shrink-0" />}
          <div className="min-w-0">
            <p className="text-[11px] font-mono truncate">{[character.name, character.surname].filter(Boolean).join(' ')}</p>
            <p className="text-[10px] text-muted-foreground">{character.sex === 'female' ? '♀' : '♂'} · age {character.age}{character.status === 'dead' ? ` · dead ${character.deadYears || 0}yr` : ''}</p>
          </div>
        </div>;
      })}
      {!chars.length && <p className="text-xs text-muted-foreground">No characters in this faction.</p>}
    </div>
  </div>;
}