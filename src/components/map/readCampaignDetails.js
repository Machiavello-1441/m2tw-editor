import { editorSessionStorage } from '@/lib/editorStorage';
import { getFile } from '@/lib/bigFileStore';
import { parseWinConditions } from '@/components/map/stratParser';
import { parseFactionMovies } from '@/components/map/factionMoviesParser';
import { parseDisasters } from '@/components/map/disastersParser';
import { parseCampaignEvents } from '@/components/map/campaignEventsParser';

export default function readCampaignDetails() {
  const read = (sessionKey, localKey, parse) => {
    const raw = editorSessionStorage.getItem(sessionKey) || getFile(localKey);
    return raw ? parse(raw) : null;
  };
  return {
    winConditions: read('m2tw_win_conditions_raw', 'm2tw_campaign_win_conditions', parseWinConditions),
    factionMovies: read('m2tw_faction_movies_raw', 'm2tw_campaign_faction_movies', parseFactionMovies),
    disasters: read('m2tw_disasters_raw', 'm2tw_campaign_disasters', parseDisasters),
    campaignEvents: read('m2tw_campaign_events_raw', 'm2tw_campaign_events', parseCampaignEvents),
    campaignDescription: editorSessionStorage.getItem('m2tw_campaign_description') || getFile('m2tw_campaign_description') || '',
  };
}