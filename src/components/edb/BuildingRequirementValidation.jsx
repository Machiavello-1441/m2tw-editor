import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEDB } from '@/components/edb/EDBContext';
import buildingRequirementSources from '@/components/edb/buildingRequirementSources';
import buildingRequirementValidation from '@/components/edb/buildingRequirementValidation';
import BuildingRequirementResults from '@/components/edb/BuildingRequirementResults';

export default function BuildingRequirementValidation({ edbData }) {
  const [sources, setSources] = useState(null);
  const { setSelectedBuilding, setSelectedLevel } = useEDB();
  const navigate = useNavigate();
  const result = useMemo(() => sources && edbData ? buildingRequirementValidation(edbData, sources) : null, [edbData, sources]);
  const edit = context => {
    setSelectedBuilding(context.building);
    setSelectedLevel(context.level || null);
    navigate('/EDBEditor');
  };
  return <section className="rounded border border-border bg-card p-3 space-y-3 text-card-foreground" aria-label="Building requirement validation">
    <h2 className="text-sm font-semibold">Building requirement validation</h2>
    <p className="text-[11px] text-muted-foreground">Checks level, recruitment, capability and upgrade requirements for broken faction, culture, event counter, hidden resource, trade resource and religion references, plus building tree / level mismatches.</p>
    <p className="text-[10px] text-muted-foreground">Checks reference definitions, not whether gameplay conditions are currently satisfied. Missing source files and unsupported conditions are flagged as unverified. No files are changed.</p>
    <Button size="sm" disabled={!edbData?.buildings?.length} onClick={() => setSources(buildingRequirementSources())}>Scan building requirements</Button>
    {!edbData?.buildings?.length ? <p className="text-xs text-muted-foreground">Load export_descr_buildings.txt from Home first.</p> : result ? <BuildingRequirementResults result={result} onEdit={edit} /> : <p className="text-xs text-muted-foreground">Run the scan to find broken references before exporting.</p>}
  </section>;
}