import { getFile, setFile } from '@/lib/bigFileStore';

export const SCRIPT_OWNER_KEY = 'm2tw_edited_script_campaign';
export function rememberEditedScript(campaign, text) {
  setFile('m2tw_campaign_script', text);
  setFile(SCRIPT_OWNER_KEY, campaign || '');
}
export function readEditedScript(campaign) {
  return campaign && getFile(SCRIPT_OWNER_KEY) === campaign ? getFile('m2tw_campaign_script') : null;
}