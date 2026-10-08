import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import FamilyGraphView from '@/components/map/FamilyGraphView';
import FamilyCharacterList from '@/components/map/FamilyCharacterList';
import FamilyCharacterDetails from '@/components/map/FamilyCharacterDetails';
import { layoutForest } from '@/components/map/familyGraphLayout';
import FamilyMemberPanel from '@/components/map/FamilyMemberPanel';
import useFamilyMemberEditor from '@/components/map/useFamilyMemberEditor';

export default function FamilyVisualEditor({ onClose, renderCharacterDetails, ...graphProps }) {
  const [selectedId, setSelectedId] = useState(null);
  const member = useFamilyMemberEditor(graphProps, setSelectedId);
  const selected = graphProps.chars.find(character => String(character.id) === selectedId);
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
    {member.open ? <FamilyMemberPanel key={JSON.stringify(member.request)} request={member.request} chars={graphProps.chars} faction={graphProps.faction} rules={graphProps.rules} error={member.error} onAssign={member.assign} onCancel={member.cancel} /> : selected ? <FamilyCharacterDetails character={selected} renderDetails={renderCharacterDetails} errors={graphProps.problems.characterErrors?.[selectedId]} onBack={() => { member.cancel(); setSelectedId(null); }} /> : <FamilyCharacterList chars={graphProps.chars} placedIds={placedIds} showPortraits={showPortraits} characterErrors={graphProps.problems.characterErrors} />}
    {mapArea && createPortal(
      <div role="dialog" aria-label="Visual family tree editor" className="absolute inset-0 z-[1100] bg-background text-foreground border border-border overflow-hidden">
        <FamilyGraphView {...graphProps} pendingMember={member.request} onRequestMember={member.start} onOpenMember={member.showPanel} selectedCharacterId={selectedId} onSelectCharacter={character => { member.cancel(); setSelectedId(String(character.id)); }} onSelectTree={() => { member.cancel(); setSelectedId(null); }} hideCharacterList showPortraits={showPortraits} onShowPortraitsChange={setShowPortraits} onClose={onClose} />
      </div>, mapArea
    )}
  </>;
}