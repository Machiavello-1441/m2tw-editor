/** Check every source ownership/era entry independently of the insertion patch. */
export default function verifyEduOwnershipInheritance(original, output, sourceFaction, targetFaction, sourceCulture = '') {
  const sources = new Set([sourceFaction, sourceCulture].filter(Boolean).map(name => name.trim().toLowerCase()));
  const target = targetFaction.trim().toLowerCase();
  const before = original.split(/\r\n|\r|\n/), after = output.split(/\r\n|\r|\n/);
  if (before.length !== after.length) throw new Error('Unit ownership verification failed: EDU lines changed. No changes made.');
  let ownershipMatches = 0, ownershipAlready = 0, universalUnits = 0, unitName = '';
  for (let index = 0; index < before.length; index++) {
    const line = before[index].split(';')[0].trim();
    const unit = line.match(/^type[\t ]+(.+)$/i);
    if (unit) unitName = unit[1].trim();
    const entry = line.match(/^(ownership|era[\t ]+\d+)[\t ]+(.+)$/i);
    if (!entry) continue;
    const owners = entry[2].split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
    const isOwnership = entry[1].toLowerCase() === 'ownership';
    if (!owners.some(name => sources.has(name))) {
      if (isOwnership && owners.includes('all')) universalUnits++;
      continue;
    }
    if (isOwnership) {
      ownershipMatches++;
      if (owners.includes(target)) ownershipAlready++;
    }
    const copied = after[index].split(';')[0].trim().match(/^(ownership|era[\t ]+\d+)[\t ]+(.+)$/i);
    const copiedOwners = copied?.[2].split(',').map(name => name.trim().toLowerCase()) || [];
    if (!copiedOwners.includes(target)) {
      throw new Error(`Could not copy ${entry[1]} for unit "${unitName || '(unnamed)'}" to "${targetFaction}". Check this entry in the loaded EDU. No changes made.`);
    }
  }
  return { ownershipMatches, ownershipAlready, universalUnits };
}