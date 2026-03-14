/**
 * Auto-build an effects description string from an array of effects.
 * effects: [{ attribute, value }]
 */
export function buildEffectsDescription(effects) {
  if (!effects || effects.length === 0) return '';
  return effects.map(e => {
    const val = parseInt(e.value) || 0;
    const sign = val >= 0 ? '+' : '';
    return `${e.attribute}: ${sign}${val}`;
  }).join(', ');
}

/**
 * Validate a traits data object. Returns array of error strings.
 */
export function validateTraitsData(traitsData, getText) {
  const errors = [];
  if (!traitsData) return errors;

  const traitNames = new Set((traitsData.traits || []).map(t => t.name));

  for (const trait of traitsData.traits || []) {
    if (!trait.name) errors.push('A trait has no name.');
    if (trait.levels.length === 0) errors.push(`Trait "${trait.name}" has no levels.`);

    // Check anti-traits exist
    for (const anti of trait.antiTraits || []) {
      if (anti && !traitNames.has(anti)) {
        errors.push(`Trait "${trait.name}": anti-trait "${anti}" not found.`);
      }
    }

    // Check level thresholds are ascending
    for (let i = 1; i < trait.levels.length; i++) {
      if ((trait.levels[i].threshold || 0) <= (trait.levels[i - 1].threshold || 0)) {
        errors.push(`Trait "${trait.name}": level "${trait.levels[i].name}" threshold (${trait.levels[i].threshold}) is not greater than previous level (${trait.levels[i - 1].threshold}).`);
      }
    }

    // Check description keys exist in text
    for (const level of trait.levels || []) {
      if (level.description && getText && !getText(level.description)) {
        errors.push(`Trait "${trait.name}" / level "${level.name}": description key "${level.description}" has no text.`);
      }
    }
  }

  // Check triggers
  for (const trigger of traitsData.triggers || []) {
    if (!trigger.name) errors.push('A trigger has no name.');
    if (!trigger.whenToTest) errors.push(`Trigger "${trigger.name}": WhenToTest is not set.`);
    for (const affect of trigger.affects || []) {
      if (affect.trait && !traitNames.has(affect.trait)) {
        errors.push(`Trigger "${trigger.name}": affects trait "${affect.trait}" which does not exist.`);
      }
      if ((affect.chance || 0) < 0 || (affect.chance || 0) > 100) {
        errors.push(`Trigger "${trigger.name}": affects "${affect.trait}" chance ${affect.chance} is out of 0–100 range.`);
      }
    }
  }

  return errors;
}

/**
 * Validate an ancillaries data object. Returns array of error strings.
 */
export function validateAncillariesData(ancData, getText) {
  const errors = [];
  if (!ancData) return errors;

  const ancNames = new Set((ancData.ancillaries || []).map(a => a.name));

  for (const anc of ancData.ancillaries || []) {
    if (!anc.name) errors.push('An ancillary has no name.');

    for (const excl of anc.excludedAncillaries || []) {
      if (excl && !ancNames.has(excl)) {
        errors.push(`Ancillary "${anc.name}": excluded ancillary "${excl}" not found.`);
      }
    }

    if (anc.description && getText && !getText(anc.description)) {
      errors.push(`Ancillary "${anc.name}": description key "${anc.description}" has no text.`);
    }
  }

  for (const trigger of ancData.triggers || []) {
    if (!trigger.name) errors.push('An ancillary trigger has no name.');
    if (!trigger.whenToTest) errors.push(`Trigger "${trigger.name}": WhenToTest is not set.`);
    const acq = trigger.acquireAncillary?.name;
    if (acq && !ancNames.has(acq)) {
      errors.push(`Trigger "${trigger.name}": acquires ancillary "${acq}" which does not exist.`);
    }
    const chance = trigger.acquireAncillary?.chance;
    if (chance !== undefined && (chance < 0 || chance > 100)) {
      errors.push(`Trigger "${trigger.name}": chance ${chance} is out of 0–100 range.`);
    }
  }

  return errors;
}