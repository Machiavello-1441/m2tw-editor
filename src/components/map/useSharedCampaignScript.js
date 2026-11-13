import { useCallback } from 'react';
import { useSharedFileState } from '@/hooks/useSharedModFile';
import { campaignLibrary } from '@/components/map/campaignLibrary';
import { rememberEditedScript } from '@/components/map/sharedCampaignScript';

export default function useSharedCampaignScript() {
  const [text, update] = useSharedFileState('m2tw_campaign_script', undefined, undefined, '');
  const setText = useCallback(change => {
    const next = update(change);
    rememberEditedScript(campaignLibrary().active, next);
    return next;
  }, [update]);
  return [text, setText];
}