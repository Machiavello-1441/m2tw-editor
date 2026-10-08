const clean = text => (text || '').split('\n').map(line => line.replace(/;.*$/, '').trim()).join('\n');
const names = (text, pattern) => new Set([...clean(text).matchAll(pattern)].map(match => match[1]));
const source = (text, pattern, file) => ({ names: names(text, pattern), loaded: text !== null, file });

export default function buildingRequirementSources() {
  const factions = localStorage.getItem('m2tw_factions_file');
  const cultures = localStorage.getItem('m2tw_cultures_file') ?? sessionStorage.getItem('m2tw_cultures_raw');
  const resources = localStorage.getItem('m2tw_resources_file');
  const religions = localStorage.getItem('m2tw_religions_file') ?? sessionStorage.getItem('m2tw_religions_raw');
  const eventFiles = [localStorage.getItem('m2tw_events_file'), sessionStorage.getItem('m2tw_events_raw'), sessionStorage.getItem('m2tw_campaign_events_raw') ?? localStorage.getItem('m2tw_campaign_events')];
  const eventsText = eventFiles.filter(text => text !== null).join('\n');
  const events = names(eventsText, /^event\s+\S+\s+(\S+)/gm);
  for (const name of names(eventsText, /^event_counter\s+(\S+)/gm)) events.add(name);
  for (const name of names(eventsText, /^event\s+yes_or_no\s+(\S+)/gm)) {
    events.add(`${name}_accepted`);
    events.add(`${name}_declined`);
  }
  return {
    factions: source(factions, /^faction\s+(\S+)/gm, 'descr_sm_factions.txt'),
    cultures: source(cultures ?? factions, /^culture\s+(\S+)/gm, 'descr_cultures.txt or descr_sm_factions.txt'),
    resources: source(resources, /^resource\s+(\S+)/gm, 'descr_sm_resources.txt'),
    religions: source(religions, /^religion\s+(\S+)/gm, 'descr_religions.txt'),
    events: { names: events, loaded: eventFiles.some(text => text !== null), file: 'descr_events.txt / campaign descr_event.txt' },
  };
}