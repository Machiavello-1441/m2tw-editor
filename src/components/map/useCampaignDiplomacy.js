import { useMemo, useState } from 'react';
import useSharedModFile from '@/hooks/useSharedModFile';
import factionDiplomacyMetadata from '@/components/map/factionDiplomacyMetadata';
import clientStateRules from '@/components/map/clientStateRules';
import synchronizeDiplomacyRelationships, { editDiplomacyRelationship } from '@/components/map/diplomacyRelationships';

export default function useCampaignDiplomacy({ stratData, onStratDataChange }) {
  const standings = stratData?.factionStandings || [];
  const relationships = useMemo(() => synchronizeDiplomacyRelationships(stratData?.factionRelationships || []), [stratData?.factionRelationships]);
  const relationshipIssues = useMemo(() => clientStateRules(relationships), [relationships]);
  const raw = useSharedModFile('m2tw_factions_file');
  const metadata = useMemo(() => factionDiplomacyMetadata(raw || ''), [raw]);
  const [rejected, setRejected] = useState(null);
  const applyStandings = updated => onStratDataChange({ ...stratData, factionStandings: updated });
  const commitRelationships = updated => {
    const previousIssues = new Set(relationshipIssues.map(issue => issue.id));
    const introduced = clientStateRules(updated).find(issue => !previousIssues.has(issue.id));
    if (introduced) {
      setRejected({ relationships, message: introduced.message });
      return introduced.message;
    }
    setRejected(null);
    onStratDataChange({ ...stratData, factionRelationships: updated });
    return null;
  };
  const addEntry = (type, entry) => {
    if (type === 'standings') { applyStandings([...standings, entry]); return null; }
    return commitRelationships(editDiplomacyRelationship(relationships, relationships.length, entry));
  };
  const updateStanding = (i, field, val) => applyStandings(standings.map((row, index) => index === i
    ? { ...row, [field]: val, ...(field === 'value' ? { valueStr: String(val) } : {}) } : row));
  const removeStanding = i => applyStandings(standings.filter((_, index) => index !== i));
  const updateRelationship = (i, field, val) => commitRelationships(editDiplomacyRelationship(relationships, i, { ...relationships[i], [field]: val }));
  const removeRelationship = i => {
    setRejected(null);
    onStratDataChange({ ...stratData, factionRelationships: editDiplomacyRelationship(relationships, i, null) });
  };
  return { standings, relationships, metadata, relationshipIssues, applyStandings, addEntry, updateStanding, removeStanding, updateRelationship, removeRelationship,
    rejectedMessage: rejected?.relationships === relationships ? rejected.message : null };
}