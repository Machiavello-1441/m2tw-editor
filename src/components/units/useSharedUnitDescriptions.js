import { useCallback, useEffect, useMemo } from 'react';
import { getFile, removeFile } from '@/lib/bigFileStore';
import useSharedDictionary from '@/hooks/useSharedDictionary';

import { groupUnitDescriptions, flattenUnitDescriptions, parseUnitDescriptionStrings, serializeUnitDescriptionStrings } from '@/components/units/unitDescriptionsCodec';

export default function useSharedUnitDescriptions() {
  const [strings, setStrings] = useSharedDictionary('export_units.txt.strings.bin', 'm2tw_export_units_file', parseUnitDescriptionStrings, serializeUnitDescriptionStrings);
  const value = useMemo(() => groupUnitDescriptions(strings), [strings]);
  const update = useCallback(change => setStrings(current => {
    const previous = groupUnitDescriptions(current);
    return flattenUnitDescriptions(typeof change === 'function' ? change(previous) : change);
  }), [setStrings]);
  useEffect(() => {
    const raw = getFile('m2tw_export_units_file_edits');
    if (!raw) return;
    const edits = JSON.parse(raw);
    update(previous => {
      const next = { ...previous };
      for (const [key, fields] of Object.entries(edits)) next[key] = { ...next[key], ...fields };
      return next;
    });
    removeFile('m2tw_export_units_file_edits');
  }, [update]);
  return [value, update];
}