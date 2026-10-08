import { useEffect, useState } from 'react';
import { readFamilyRules, FAMILY_RULES_EVENT } from '@/components/map/familyRules';

export default function useFamilyRules() {
  const [rules, setRules] = useState(readFamilyRules);
  useEffect(() => {
    const refresh = () => setRules(readFamilyRules());
    window.addEventListener(FAMILY_RULES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(FAMILY_RULES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return rules;
}