import { useMemo, useSyncExternalStore } from 'react';
import { getFile, setFile } from '@/lib/bigFileStore';
import { FILES_CHANGED_EVENT, canonicalFileKey } from '@/lib/modFileRegistry';
import { parseDescrSmFactions } from '@/components/map/stratParser';

const FACTIONS_KEY = 'm2tw_factions_file';
export const readSharedFactions = () => getFile(FACTIONS_KEY) ?? '';
export function subscribeSharedFactions(listener) {
  const refresh = event => {
    if (!event.detail?.keys || event.detail.keys.some(key => canonicalFileKey(key) === FACTIONS_KEY)) listener();
  };
  window.addEventListener(FILES_CHANGED_EVENT, refresh);
  return () => window.removeEventListener(FILES_CHANGED_EVENT, refresh);
}

// Original campaign files may fill a missing reference, never undo saved faction edits.
export async function seedCampaignFactions(file) {
  if (getFile(FACTIONS_KEY) !== null) return;
  const text = await file.text();
  if (getFile(FACTIONS_KEY) === null) setFile(FACTIONS_KEY, text);
}

export default function useSharedFactionColors() {
  const raw = useSyncExternalStore(subscribeSharedFactions, readSharedFactions, readSharedFactions);
  return useMemo(() => raw ? parseDescrSmFactions(raw) : null, [raw]);
}