import { useSyncExternalStore } from 'react';
import { subscribeSharedModFiles } from '@/lib/sharedModFiles';
import { STRINGS_STORE_KEY } from '@/lib/modFileRegistry';
import { getSharedExportFileCount, sharedExportKeys } from '@/components/export/sharedExportSources';
import { currentCampaignExportKeys } from '@/components/export/currentCampaignFilesExport';

const subscribe = listener => subscribeSharedModFiles([...sharedExportKeys, ...currentCampaignExportKeys, STRINGS_STORE_KEY, 'm2tw_names_bin_entries'], listener);
export default function useSharedExportFiles() {
  return useSyncExternalStore(subscribe, getSharedExportFileCount, getSharedExportFileCount);
}