import { useSharedFileState } from '@/hooks/useSharedModFile';
import { seedSharedModFile } from '@/lib/sharedModFiles';
import { parseDescrRebelFactions, parseDescrReligions, parseDescrSmResources, parseDescrSoundsMusicTypes, parseDescrCultures, parseExportDescrTraits, parseExportDescrAncillaries } from '@/components/map/additionalParsers';

export const CAMPAIGN_SHARED_REFERENCES = {
  'descr_rebel_factions.txt': 'm2tw_rebel_factions_file',
  'descr_religions.txt': 'm2tw_religions_file',
  'descr_sm_resources.txt': 'm2tw_resources_file',
  'descr_cultures.txt': 'm2tw_cultures_file',
  'export_descr_character_traits.txt': 'm2tw_traits_file',
  'export_descr_ancillaries.txt': 'm2tw_anc_file',
  'descr_sounds_music_types.txt': 'm2tw_music_types_raw',
};
export { seedSharedModFile };
const useReference = (key, parse) => useSharedFileState(key, parse, undefined, [])[0];

export default function useSharedCampaignReferences() {
  return {
    rebelFactions: useReference('m2tw_rebel_factions_file', parseDescrRebelFactions),
    religions: useReference('m2tw_religions_file', parseDescrReligions),
    naturalResources: useReference('m2tw_resources_file', parseDescrSmResources),
    cultures: useReference('m2tw_cultures_file', parseDescrCultures),
    traitsList: useReference('m2tw_traits_file', parseExportDescrTraits),
    ancillariesList: useReference('m2tw_anc_file', parseExportDescrAncillaries),
    musicTypes: useReference('m2tw_music_types_raw', parseDescrSoundsMusicTypes),
  };
}