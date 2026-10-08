import { fullName } from '@/components/map/familyTreeLogic';
import { checkCouple, marriageEligibility } from '@/components/map/familyMarriageRules';

export default function familyRuleValidation(rels, chars, rules) {
  const errors = [], warnings = [], characterErrors = {};
  if (!rules) return { errors, warnings, characterErrors };
  const values = rules.values;
  const report = (people, message) => {
    errors.push(message);
    for (const character of people.filter(Boolean)) {
      const id = String(character.id);
      characterErrors[id] = [...new Set([...(characterErrors[id] || []), message])];
    }
  };
  const byName = new Map();
  for (const character of chars) {
    byName.set(fullName(character).toLowerCase(), character);
    if (!byName.has(character.name?.toLowerCase())) byName.set(character.name?.toLowerCase(), character);
    const age = Number(character.age);
    if (!Number.isFinite(age) || age < 0) report([character], `${fullName(character)}: invalid character age`);
    if (values.max_age != null && age > values.max_age) report([character], `${fullName(character)}: ${character.status === 'dead' ? 'age at death' : 'age'} ${age} exceeds max_age = ${values.max_age}`);
    if (character.status !== 'dead' && values.max_age_before_death != null && age >= values.max_age_before_death) report([character], `${fullName(character)}: still alive at ${age}, but max_age_before_death = ${values.max_age_before_death}`);
  }
  const lookup = name => byName.get((name || '').toLowerCase());
  for (const [fatherName, motherName, ...childNames] of rels) {
    const father = lookup(fatherName), mother = lookup(motherName);
    checkCouple(father, mother, childNames.map(lookup).filter(Boolean), values, report);
    if (father && mother) for (const parent of [father, mother]) {
      // Existing marriages do not have dates in descr_strat, so upper eligibility
      // limits must not be treated as proof of an invalid historical marriage.
      warnings.push(...marriageEligibility(parent, values).filter(message => !message.includes('age_of_manhood') && !message.includes('daughters_age_of_consent')));
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], characterErrors };
}