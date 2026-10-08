import { useCallback } from 'react';

export default function useSettlementChanges({ setEditedSettlements, setOverlayItems, setStratDataRaw, setSelectedItem, setOverlayDirty }) {
  return useCallback(changes => {
    const byId = new Map(changes.map(({ id, edits }) => [id, edits]));
    const merge = item => byId.has(item.id) ? { ...item, ...byId.get(item.id) } : item;
    setEditedSettlements(prev => ({ ...prev, ...Object.fromEntries(changes.map(({ id, edits }) => [id, { ...(prev[id] || {}), ...edits }])) }));
    setOverlayItems(prev => prev.map(merge));
    setStratDataRaw(prev => prev ? { ...prev, items: (prev.items || []).map(merge) } : prev);
    setSelectedItem(prev => prev ? merge(prev) : prev);
    setOverlayDirty(true);
  }, [setEditedSettlements, setOverlayItems, setStratDataRaw, setSelectedItem, setOverlayDirty]);
}