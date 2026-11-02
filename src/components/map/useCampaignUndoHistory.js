import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CampaignUndoHistory from '@/components/map/campaignUndoHistory';
import { isUndoStorageEvent } from '@/components/map/campaignUndoStorage';
import { FILES_CHANGED_EVENT } from '@/lib/modFileRegistry';

export default function useCampaignUndoHistory(state, apply, disabled) {
  const [entries, setEntries] = useState([]);
  const controller = useRef(null), current = useRef(null), timers = useRef(new Set());
  if (!controller.current) controller.current = new CampaignUndoHistory(setEntries);
  current.current = { state, apply, disabled };
  const record = () => {
    if (current.current.disabled) return;
    const field = document.activeElement;
    const typing = field?.matches('textarea, input:not([type="checkbox"]):not([type="file"]):not([type="range"]):not([type="radio"])');
    controller.current.record(current.current.state, typing ? field : null);
  };
  const later = fn => {
    const timer = setTimeout(() => { timers.current.delete(timer); fn(); }, 0);
    timers.current.add(timer);
  };
  useLayoutEffect(record, [state.layers, state.stratData, state.regionsData, state.settlementNames, state.overlayItems, state.editedSettlements, state.dirtyLayers, state.overlayDirty, state.edbData, state.descrNames, state.namesDisplayMap, state.factionColors, state.campaignDetails, disabled]);
  useEffect(() => {
    const changed = event => { if (isUndoStorageEvent(event)) later(record); };
    window.addEventListener(FILES_CHANGED_EVENT, changed);
    return () => {
      window.removeEventListener(FILES_CHANGED_EVENT, changed);
      timers.current.forEach(clearTimeout);
    };
  }, []);
  return {
    entries,
    reset: () => controller.current.reset(),
    begin: () => { if (!current.current.disabled) controller.current.begin(current.current.state); },
    end: () => later(() => { if (!current.current.disabled) controller.current.end(current.current.state); else controller.current.depth = 0; }),
    undo: index => controller.current.undo(index, current.current.state, current.current.apply),
  };
}