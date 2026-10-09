import { useEffect, useRef, useState } from 'react';
import { campaignLibrary } from '@/components/map/campaignLibrary';
import { captureCampaignStorage, restoreCampaignStorage } from '@/components/map/campaignSession';
import { getWorkspace } from '@/components/workspace/localWorkspace';
import { readCampaignRecovery, rebuildRecoveryLayers } from '@/components/map/campaignRecovery';
import useCampaignRecovery from '@/components/map/useCampaignRecovery';

export default function useCampaignSelection(snapshot, apply, load) {
  const library = campaignLibrary();
  const [active, setActive] = useState(library.active);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const modName = getWorkspace()?.name || '';
  const recovery = useCampaignRecovery(snapshot, initialized && !loading && !error, modName, active);
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
      const saved = library.snapshots.get(id);
      restoreCampaignStorage(saved?.storage);
      if (saved) current.current.apply(saved);
      else { current.current.apply(null); await current.current.load({ files: campaign.files, campaignName: campaign.name }); }
      library.active = id; committed.current = id; setActive(id);
      window._m2tw_map_files = campaign.files;
      window._m2tw_loaded_map_files = campaign.files;
    } catch (e) {
      restoreCampaignStorage(previous?.storage);
      current.current.apply(previous || null);
      setError(e.message || 'Could not load campaign.');
    } finally { busy.current = false; setLoading(false); }
  };
  useEffect(() => {
    let mounted = true;
    (async () => {
      const record = await readCampaignRecovery(modName);
      if (!mounted) return;
      const target = record && library.campaigns.find(c => c.id === record.active || c.name === record.snapshot.stratData?.campaignName);
      if (record && (!library.campaigns.length || target)) {
        const restored = await rebuildRecoveryLayers(record.snapshot);
        if (!mounted) return;
        restoreCampaignStorage(record.storage);
        current.current.apply(restored);
        const id = target?.id || '';
        library.active = id; committed.current = id; setActive(id);
        if (target) {
          library.snapshots.set(id, { ...restored, storage: record.storage });
          window._m2tw_map_files = target.files; window._m2tw_loaded_map_files = target.files;
        }
        setRecovered(true);
      } else if (library.active) await select(library.active, true);
      else if (window._m2tw_map_files?.length && window._m2tw_loaded_map_files !== window._m2tw_map_files) {
        await current.current.load({ files: window._m2tw_map_files });
        window._m2tw_loaded_map_files = window._m2tw_map_files;
      }
    })().catch(e => { if (mounted) setError(`Could not restore the local draft: ${e.message}`); })
      .finally(() => { if (mounted) { setInitialized(true); setLoading(false); } });
    const refresh = () => select(library.active, true);
    window.addEventListener('m2tw-campaign-library-updated', refresh);
    return () => { mounted = false; save(); window.removeEventListener('m2tw-campaign-library-updated', refresh); };
  }, []);
  return { active, loading, error, select, recovery: error ? { phase: 'error', error } : recovery, recovered };
}