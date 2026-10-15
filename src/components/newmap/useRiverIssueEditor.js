import { useEffect, useRef, useState } from 'react';
import { editRiverIssue } from '@/components/map/rivers/riverIssueEdits';
import { deleteFlaggedOutlets } from '@/components/map/rivers/deleteFlaggedOutlets';

export default function useRiverIssueEditor({ issue, layer, heights, onLayerUpdate, active }) {
  const [pending, setPending] = useState(null), [error, setError] = useState('');
  const [undo, setUndo] = useState(null), [revision, setRevision] = useState(0);
  const expected = useRef(layer?.imageData);
  useEffect(() => { setPending(null); setError(''); }, [issue, active]);
  useEffect(() => {
    setPending(null);
    if (expected.current !== layer?.imageData) setUndo(null);
    expected.current = layer?.imageData;
  }, [layer?.imageData]);
  const commit = (snapshot, remember = true) => {
    if (remember) setUndo({ imageData: layer.imageData, hydroRiverPatch: layer.hydroRiverPatch });
    expected.current = snapshot.imageData;
    onLayerUpdate('features', { ...snapshot, visible: true, opacity: 1, dirty: true });
    setPending(null); setError(''); setRevision(value => value + 1);
  };
  const apply = (selected, target) => {
    try {
      const changed = editRiverIssue(layer?.imageData,selected,target,heights?.imageData);
      commit({ imageData: new ImageData(changed.data,changed.width,changed.height), hydroRiverPatch: layer.hydroRiverPatch });
    } catch (failure) { setError(failure.message); }
  };
  return { pending, error, undo, revision,
    remove: () => apply(issue,null),
    removeAllOutlets: issues => {
      const changed = deleteFlaggedOutlets(layer?.imageData,issues);
      if (changed) commit({ imageData: new ImageData(changed.data,changed.width,changed.height), hydroRiverPatch: layer.hydroRiverPatch });
    },
    begin: () => { setPending(issue); setError(''); },
    cancel: () => { setPending(null); setError(''); },
    pick: target => { if (pending) apply(pending,target); },
    restore: () => { if (undo) { commit(undo,false); setUndo(null); } },
  };
}