import { useEffect, useRef, useState } from 'react';
import { campaignLibrary } from '@/components/map/campaignLibrary';
import { captureCampaignStorage, restoreCampaignStorage } from '@/components/map/campaignSession';
import { persistSavedCampaign, reviveCampaignSnapshot } from '@/components/map/campaignSavePersistence';
import { readCampaignSnapshot } from '@/components/map/campaignRecoveryStore';
import { restoreUndoStorage } from '@/components/map/campaignUndoStorage';

export default function useCampaignSelection(snapshot, apply, load) {
  const library = campaignLibrary();
  const [active, setActive] = useState(library.active);
  // Do not let an initial raw-file draft overwrite a recovery copy while it loads.
  const [loading, setLoading] = useState(() => Boolean(library.active));
  const [error, setError] = useState('');
  const [recoveredAt, setRecoveredAt] = useState(null);
  const current = useRef({ snapshot, apply, load });
  current.current = { snapshot, apply, load };
  const committed = useRef('');
  const busy = useRef(false);
  const save = () => {
    if (committed.current && !busy.current) library.snapshots.set(committed.current, { ...current.current.snapshot, storage: captureCampaignStorage() });
  };
  const select = async (id, initial = false) => {
    if (busy.current || (!initial && id === committed.current)) return;
    const campaign = library.campaigns.find(c => c.id === id);
    if (!campaign) return;
    if (!initial) save();
    const previous = library.snapshots.get(committed.current);
    busy.current = true; setLoading(true); setError('');
    try {
      const stored = library.snapshots.get(id) || await readCampaignSnapshot(id);
      const saved = stored ? await reviveCampaignSnapshot(stored) : null;
      if (saved?.storage?.extra) restoreUndoStorage(saved.storage, saved, true);
      else restoreCampaignStorage(saved?.storage);
      if (saved) current.current.apply(saved);
      else { current.current.apply(null); await current.current.load({ files: campaign.files, campaignName: campaign.name }); }
      if (committed.current !== id) library.snapshots.delete(committed.current);
      library.active = id; committed.current = id; setActive(id); setRecoveredAt(saved?.recoveryAt || null);
      window._m2tw_map_files = campaign.files;
      window._m2tw_loaded_map_files = campaign.files;
    } catch (e) {
      restoreCampaignStorage(previous?.storage);
      current.current.apply(previous || null);
      setError(e.message || 'Could not load campaign.');
    } finally { busy.current = false; setLoading(false); }
  };
  useEffect(() => {
    if (library.active) select(library.active, true);
    else if (window._m2tw_map_files?.length && window._m2tw_loaded_map_files !== window._m2tw_map_files) {
      current.current.load({ files: window._m2tw_map_files });
      window._m2tw_loaded_map_files = window._m2tw_map_files;
    }
    const refresh = () => select(library.active, true);
    window.addEventListener('m2tw-campaign-library-updated', refresh);
    return () => { save(); window.removeEventListener('m2tw-campaign-library-updated', refresh); };
  }, []);
  const commit = async changes => {
    if (busy.current) throw new Error('Wait for the campaign to finish loading before saving.');
    busy.current = true;
    try {
      const id = committed.current || changes.stratData?.campaignName || 'campaign';
      const saved = { ...current.current.snapshot, ...changes };
      await persistSavedCampaign(library, id, saved);
      // The durable copy is on disk; retain the live buffers, not a second full map.
      const live = { ...saved, layers: current.current.snapshot.layers };
      library.snapshots.set(id, live);
      current.current.snapshot = live;
      library.active = id; committed.current = id; setActive(id);
    } finally { busy.current = false; }
  };
  return { active, loading, error, recoveredAt, select, commit };
}