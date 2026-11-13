import { useMemo, useSyncExternalStore } from 'react';
import { createSharedFileBinding } from '@/lib/sharedModFiles';

const identity = value => value;

export function useSharedFileState(key, parse = identity, serialize = identity, empty = null) {
  const binding = useMemo(() => createSharedFileBinding(key, parse, serialize, empty), [key, parse, serialize]);
  const value = useSyncExternalStore(binding.subscribe, binding.read, binding.read);
  return [value, binding.update];
}

export default function useSharedModFile(key) {
  return useSharedFileState(key)[0];
}