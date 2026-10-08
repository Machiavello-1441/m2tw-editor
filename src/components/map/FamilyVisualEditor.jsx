import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import FamilyGraphView from '@/components/map/FamilyGraphView';
import FamilyCharacterList from '@/components/map/FamilyCharacterList';
import { layoutForest } from '@/components/map/familyGraphLayout';

export default function FamilyVisualEditor({ onClose, ...graphProps }) {
  const [mapArea, setMapArea] = useState(null);
  const [showPortraits, setShowPortraits] = useState(true);
  useEffect(() => {
    setMapArea(document.getElementById('campaign-map-family-overlay'));
  }, []);
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  const placedIds = useMemo(() => new Set(layoutForest(graphProps.factionTrees).flatMap(forest => forest.nodes.map(node => node.char?.id)).filter(id => id != null)), [graphProps.factionTrees]);
  return <>
    <FamilyCharacterList chars={graphProps.chars} placedIds={placedIds} showPortraits={showPortraits} />
    {mapArea && createPortal(
      <div role="dialog" aria-label="Visual family tree editor" className="absolute inset-0 z-[1100] bg-background text-foreground border border-border overflow-hidden">
        <FamilyGraphView {...graphProps} hideCharacterList showPortraits={showPortraits} onShowPortraitsChange={setShowPortraits} onClose={onClose} />
      </div>, mapArea
    )}
  </>;
}