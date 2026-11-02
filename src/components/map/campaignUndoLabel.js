export default function campaignUndoLabel(before, state, layers, storage) {
  const names = Object.keys(layers);
  if (names.length) return `Edit ${names.join(', ')} map`;
  const old = before.stratData, next = state.stratData;
  if (old && next && old.factions !== next.factions && JSON.stringify(old.factions) !== JSON.stringify(next.factions)) {
    if ((next.factions?.length || 0) > (old.factions?.length || 0)) return 'Add faction';
    return 'Edit factions';
  }
  if ('overlayItems' in before) {
    const count = state.overlayItems.length - before.overlayItems.length;
    return count > 0 ? 'Add map item' : count < 0 ? 'Delete map item' : 'Edit map items / settlements';
  }
  if ('regionsData' in before) return 'Edit regions';
  if ('settlementNames' in before) return 'Edit settlement names';
  if ('edbData' in before) return 'Edit hidden resources';
  if ('stratData' in before) return 'Edit campaign settings';
  if ('campaignDetails' in before) {
    const labels = { winConditions: 'Edit victory conditions', factionMovies: 'Edit faction movies', disasters: 'Edit disasters', campaignEvents: 'Edit campaign events', campaignDescription: 'Edit campaign description' };
    for (const [key, label] of Object.entries(labels)) if (JSON.stringify(before.campaignDetails[key]) !== JSON.stringify(state.campaignDetails[key])) return label;
  }
  const labels = { m2tw_win_conditions_raw: 'Edit victory conditions', m2tw_faction_movies_raw: 'Edit faction movies', m2tw_disasters_raw: 'Edit disasters', m2tw_campaign_events_raw: 'Edit campaign events', m2tw_campaign_description: 'Edit campaign description', m2tw_campaign_desc_strings: 'Edit campaign descriptions' };
  for (const [key, label] of Object.entries(labels)) if (storage.previous.session[key] !== storage.next.session[key]) return label;
  return 'Edit campaign data';
}