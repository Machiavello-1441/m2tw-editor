import { useSyncExternalStore } from 'react';
import { getFile } from '@/lib/bigFileStore';
import { FILES_CHANGED_EVENT, STRINGS_STORE_KEY, canonicalFileKey } from '@/lib/modFileRegistry';
import { getCharacterNamesRaw, getCharacterDisplayNames } from '@/lib/characterNames';
import { parseDescrNames } from '@/components/map/additionalParsers';

const keys = new Set(['m2tw_names_file', 'm2tw_names_bin_entries', 'm2tw_char_names_display', STRINGS_STORE_KEY]);
let previous, snapshot;

/** Stable snapshots read the current shared files, never an old campaign's copy. */
export function readSharedCharacterNames() {
  const sources = [getCharacterNamesRaw(), ...[...keys].slice(1).map(key => getFile(key))];
  if (!previous || sources.some((source, index) => source !== previous[index])) {
    snapshot = {
      descrNames: previous && sources[0] === previous[0] ? snapshot.descrNames : sources[0] ? parseDescrNames(sources[0]) : null,
      namesDisplayMap: getCharacterDisplayNames(),
    };
    previous = sources;
  }
  return snapshot;
}

export function subscribeSharedCharacterNames(listener) {
  const refresh = event => {
    if (!event.detail?.keys || event.detail.keys.some(key => keys.has(canonicalFileKey(key)))) listener();
  };
  const events = [FILES_CHANGED_EVENT, 'load-character-names', 'strings-bin-updated'];
  events.forEach(name => window.addEventListener(name, refresh));
  return () => events.forEach(name => window.removeEventListener(name, refresh));
}

export default function useSharedCharacterNames() {
  return useSyncExternalStore(subscribeSharedCharacterNames, readSharedCharacterNames, readSharedCharacterNames);
}