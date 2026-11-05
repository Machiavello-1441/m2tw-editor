import { useMemo, useSyncExternalStore } from 'react';
import { getFile, setFile } from '@/lib/bigFileStore';
import { FILES_CHANGED_EVENT } from '@/lib/modFileRegistry';
import { parseEDU } from '@/components/units/EDUParser';

const EDU_KEY = 'm2tw_units_file';
export const readSharedEdu = () => getFile(EDU_KEY) ?? '';

export function subscribeSharedEdu(listener) {
  const refresh = event => {
    if (!event.detail?.keys || event.detail.keys.includes(EDU_KEY)) listener();
  };
  window.addEventListener(FILES_CHANGED_EVENT, refresh);
  window.addEventListener('edu-file-loaded', refresh);
  return () => {
    window.removeEventListener(FILES_CHANGED_EVENT, refresh);
    window.removeEventListener('edu-file-loaded', refresh);
  };
}

// Campaign libraries retain the original File objects. They may seed a missing
// EDU, but must never replace later imports, unit edits or faction duplication.
export async function seedCampaignEdu(file) {
  if (getFile(EDU_KEY) !== null) return;
  const text = await file.text();
  if (getFile(EDU_KEY) === null) setFile(EDU_KEY, text);
}

export default function useSharedEduUnits() {
  const raw = useSyncExternalStore(subscribeSharedEdu, readSharedEdu, readSharedEdu);
  return useMemo(() => raw ? parseEDU(raw) : [], [raw]);
}