import { useMemo, useSyncExternalStore } from 'react';
import { createSharedDictionaryBinding } from '@/lib/sharedDictionary';

export default function useSharedDictionary(name, legacyKey, parseText, serializeText, empty = {}) {
  const binding = useMemo(() => createSharedDictionaryBinding(name, legacyKey, parseText, serializeText, empty), [name, legacyKey, parseText, serializeText]);
  return [useSyncExternalStore(binding.subscribe, binding.read, binding.read), binding.update];
}