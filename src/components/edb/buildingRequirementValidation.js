import buildingRequirementEntries from '@/components/edb/buildingRequirementEntries';
import buildingRequirementSources from '@/components/edb/buildingRequirementSources';

export default function buildingRequirementValidation(edbData, sources = buildingRequirementSources()) {
  const issues = [];
  const entries = buildingRequirementEntries(edbData);
  const buildings = new Map((edbData?.buildings || []).map(building => [building.name, new Set((building.levels || []).map(level => level.name))]));
  const hidden = new Set(edbData?.hiddenResources || []);
  const missing = new Set();
  const unavailable = key => {
    if (!missing.has(key)) {
      missing.add(key);
      issues.push({ id: `building_requirement_missing_${key}`, severity: 'warning', category: 'Building requirements', title: `Cannot verify ${key}: reference file not loaded`, detail: `Load ${sources[key].file} from Home, then run the scan again. These references have not been marked valid or broken.` });
    }
  };
  for (const [index, entry] of entries.entries()) {
    const req = entry.requirement;
    const add = (title, detail, severity = 'error') => issues.push({ id: `building_requirement_${index}_${issues.length}`, severity, category: 'Building requirements', title, detail, context: { building: entry.building, level: entry.level, location: entry.location } });
    const check = (key, name) => {
      if (!name?.trim()) add(`Missing ${key} reference`, 'Enter a valid reference name in this requirement.');
      else if (!sources[key].loaded) unavailable(key);
      else if (!sources[key].names.has(name)) add(`Unknown ${key} reference: "${name}"`, `"${name}" is not defined in the loaded ${sources[key].file}. Correct the name or add its definition to the appropriate file.`);
    };
    switch (req.type) {
      case 'factions':
        if (!req.values?.length) add('Empty faction / culture requirement', 'Choose at least one valid faction or culture, or use all.');
        for (const name of req.values || []) {
          if (name === 'all' || sources.factions.names.has(name) || sources.cultures.names.has(name)) continue;
          if (!sources.factions.loaded || !sources.cultures.loaded) {
            if (!sources.factions.loaded) unavailable('factions');
            if (!sources.cultures.loaded) unavailable('cultures');
          } else add(`Unknown faction or culture: "${name}"`, 'This name is absent from the loaded faction and culture definitions. Correct the spelling or define it in your mod.');
        }
        break;
      case 'event_counter':
        check('events', req.event);
        if (req.value === '' || req.value == null || !Number.isInteger(Number(req.value))) add('Invalid event counter value', 'The required event counter value must be a whole number. Script declare_counter variables are not event counter definitions.');
        break;
      case 'hidden_resource':
        if (!hidden.has(req.resource)) add(`Unknown hidden resource: "${req.resource || '(empty)'}"`, 'Add the name to the EDB hidden_resources list, or correct this requirement.');
        break;
      case 'building_present_min_level':
        if (!buildings.has(req.building)) add(`Unknown building tree: "${req.building || '(empty)'}"`, 'Select a building tree that exists in the current EDB.');
        else if (!buildings.get(req.building).has(req.level)) add(`Unknown level "${req.level || '(empty)'}" in "${req.building}"`, 'The required level must belong to the named building tree, not just exist elsewhere in the EDB.');
        break;
      case 'resource':
        check('resources', req.resource);
        break;
      case 'region_religion':
        check('religions', req.religion);
        if (req.percentage === '' || req.percentage == null || !Number.isFinite(Number(req.percentage)) || Number(req.percentage) < 0 || Number(req.percentage) > 100) add('Invalid religion percentage', 'Set a percentage between 0 and 100.');
        break;
      default:
        add(req.type ? `Unverified requirement: ${req.text || req.type}` : 'Malformed requirement', req.type ? 'This condition is outside the supported reference checks. Review it manually in the EDB editor; it has not been marked valid.' : 'The requirement could not be parsed. Check its name and arguments in the EDB editor.', req.type ? 'warning' : 'error');
    }
  }
  return { issues, checked: entries.length };
}