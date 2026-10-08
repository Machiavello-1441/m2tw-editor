import { parseRequirements } from '@/components/edb/EDBParser';

export default function buildingRequirementEntries(edbData) {
  const entries = [];
  const add = (building, level, location, item) => {
    const text = item.text?.replace(/;.*$/, '') || '';
    const rawRequires = text.match(/\brequires\s+(.+)$/);
    const requirements = item.requirements || (rawRequires ? parseRequirements(rawRequires[1]) : []);
    requirements.forEach((requirement, index) => entries.push({ building, level, location: `${location}, condition ${index + 1}`, requirement }));
  };
  const capabilities = (building, level, label, items) => (items || []).forEach((item, index) => add(building, level, `${label} ${index + 1} (${item.unitName || item.identifier || item.agentType || item.type})`, item));
  for (const building of edbData?.buildings || []) {
    capabilities(building.name, null, 'Building faction capability', building.factionCapability);
    for (const level of building.levels || []) {
      add(building.name, level.name, 'Level requirements', level);
      capabilities(building.name, level.name, 'Capability', level.capabilities);
      capabilities(building.name, level.name, 'Faction capability', level.factionCapability);
      (level.upgrades || []).forEach(upgrade => {
        if (typeof upgrade === 'object') add(building.name, level.name, `Upgrade to ${upgrade.name}`, upgrade);
      });
    }
  }
  return entries;
}