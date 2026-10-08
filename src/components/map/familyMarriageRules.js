import familyCharacterAge from '@/components/map/familyCharacterAge';

// These are eligibility limits for a NEW marriage, not the age of an existing couple.
export function marriageEligibility(character, values) {
  if (!character || !values) return [];
  const female = character.sex === 'female';
  const age = Number(character.age);
  const minimum = female ? 'daughters_age_of_consent' : 'age_of_manhood';
  const maximum = female ? 'max_age_for_marriage_for_female' : 'max_age_for_marriage_for_male';
  const errors = [];
  for (const key of [minimum, maximum, ...(female ? ['daughters_retirement_age'] : [])]) {
    if (values[key] == null) continue;
    if (key === minimum ? age < values[key] : age > values[key]) errors.push(`${character.name}: age ${age} violates ${key} = ${values[key]} (new-marriage eligibility)`);
  }
  return errors;
}

export function checkCouple(father, mother, kids, values, report) {
  if (values.max_number_of_children != null && kids.length > values.max_number_of_children) report([father, mother], `${kids.length} children exceed max_number_of_children = ${values.max_number_of_children}`);
  if (father && mother) {
    const difference = familyCharacterAge(father) - familyCharacterAge(mother);
    for (const key of ['age_difference_min', 'age_difference_max']) {
      if (values[key] != null && (key.endsWith('min') ? difference < values[key] : difference > values[key])) report([father, mother], `${father.name} / ${mother.name}: male minus female age difference ${difference} violates ${key} = ${values[key]}`);
    }
    for (const parent of [father, mother]) {
      const minimum = parent.sex === 'female' ? 'daughters_age_of_consent' : 'age_of_manhood';
      if (values[minimum] != null && Number(parent.age) < values[minimum]) report([parent], `${parent.name}: married below ${minimum} = ${values[minimum]}`);
    }
  }
  for (const child of kids) for (const parent of [father, mother].filter(Boolean)) {
    const ageAtBirth = familyCharacterAge(parent) - familyCharacterAge(child);
    const required = values.parent_to_child_min_age_diff;
    if (required != null && ageAtBirth < required) report([parent, child], `${parent.name} was ${ageAtBirth} at ${child.name}'s birth; requires parent_to_child_min_age_diff = ${required}`);
    if (parent.status === 'dead' && Number(parent.deadYears || 0) > familyCharacterAge(child) + (parent.sex === 'male' ? 1 : 0)) report([parent, child], `${child.name} was born after ${parent.name}'s death`);
    const conceptionAge = Math.max(0, ageAtBirth - 1);
    if (parent.sex === 'female' && values.max_age_for_conception != null && conceptionAge > values.max_age_for_conception) report([parent, child], `${parent.name} was at least ${conceptionAge} at ${child.name}'s conception, exceeding max_age_for_conception = ${values.max_age_for_conception}`);
  }
}