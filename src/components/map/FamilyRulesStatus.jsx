import React from 'react';

export default function FamilyRulesStatus({ rules }) {
  if (!rules) return <p className="text-[10px] text-amber-400 p-2 border-b border-border">Load descr_campaign_ai_db_ex.xml from Home to enable your mod’s family-tree parameter checks. Basic relationship checks remain active.</p>;
  return <details className="text-[10px] p-2 border-b border-border shrink-0 max-h-44 overflow-y-auto">
    <summary className="cursor-pointer text-muted-foreground">Family-tree rules: {rules.source} ({Object.keys(rules.values).length} parameters)</summary>
    <dl className="grid grid-cols-2 gap-1 mt-2">{Object.entries(rules.values).map(([key, value]) => <React.Fragment key={key}><dt className="break-all text-muted-foreground">{key}</dt><dd>{value}</dd></React.Fragment>)}</dl>
    <p className="text-muted-foreground mt-2">Marriage maxima are checked when assigning a new couple; exceeding them in an existing couple is only a warning because marriage dates are not recorded. Age-at-death is used for character limits; years dead are included in birth-year comparisons.</p>
    <p className="text-muted-foreground mt-1">Childhood, old-age and adoption settings are runtime rules, not limits on the age of existing descendants. Adoption history is not recorded here.</p>
  </details>;
}