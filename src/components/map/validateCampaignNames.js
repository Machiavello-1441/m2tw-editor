const hasText = value => typeof value === 'string' && value.trim().length > 0;

/** Validate the live identifiers and localization used by campaign export, without editing them. */
export default function validateCampaignNames({ regionsData, settlementNames, settlements = [] } = {}) {
  const issues = [], regions = regionsData || [];
  const push = (code, key, message) => issues.push({ id: `campaign-name-${issues.length}`, severity: 'error', layer: 'campaign names', code, key, message });
  const checkName = (key, kind, province) => {
    if (!Object.prototype.hasOwnProperty.call(settlementNames || {}, key) || !hasText(settlementNames[key])) {
      push(`missing_${kind}_name`, key, `Missing ${kind} display name for {${key}} in province "${province}". Add a non-empty entry to the campaign region/settlement names (.txt / .strings.bin).`);
    }
  };
  const defined = new Set(regions.map(region => region.regionName));
  regions.forEach((region, index) => {
    const province = hasText(region.regionName) ? region.regionName : `Region #${index + 1}`;
    if (!hasText(region.regionName)) {
      push('missing_region_identifier', '', `${province} has no internal province/region name in descr_regions.txt.`);
    } else checkName(region.regionName, 'province', province);
    // M2EX wastelands have a province but deliberately have no settlement.
    if (region.wasteland || /^wasteland$/i.test(region.settlementName || '')) return;
    if (!hasText(region.settlementName)) {
      push('missing_settlement_identifier', region.regionName, `Province "${province}" has no internal settlement name in descr_regions.txt.`);
    } else checkName(region.settlementName, 'settlement', province);
  });
  if (settlements.length && !regions.length) {
    push('missing_region_definitions', '', 'Campaign settlements are loaded, but descr_regions.txt has no loaded region definitions. Load it to validate province and settlement names.');
  }
  const missingReferences = new Set();
  settlements.forEach((settlement, index) => {
    const key = settlement.region;
    if (!hasText(key)) {
      push('missing_region_reference', '', `Settlement "${settlement.name || settlement.id || `#${index + 1}`}" has no province/region identifier in descr_strat.txt.`);
    } else if (regions.length && !defined.has(key) && !missingReferences.has(key)) {
      missingReferences.add(key);
      push('undefined_region', key, `Campaign province "${key}" is missing from descr_regions.txt. Its identifier must match exactly, including case.`);
      checkName(key, 'province', key);
    }
  });
  return issues;
}