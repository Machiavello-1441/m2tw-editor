/**
 * Parser and serializer for descr_events.txt (campaign events)
 *
 * Structure (one block per event):
 *   event   historic|earthquake|volcano|flood|storm|horde|dustbowl|locusts|plague   event_name
 *   date    50                   (year offset from campaign start, or range: "128 144")
 *   position  x, y              (optional, repeatable)
 *   movie   event/file.bik      (optional)
 */

export const EVENT_TYPES = ['historic','earthquake','volcano','flood','storm','horde','dustbowl','locusts','plague'];

export function parseCampaignEvents(text) {
  const events = [];
  if (!text) return events;

  const lines = text.split('\n');
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;

    const parts = line.split(/\s+/);
    const key = parts[0];

    if (key === 'event') {
      if (current) events.push(current);
      current = {
        eventType: parts[1] || 'historic',
        name: parts[2] || '',
        date: '',
        positions: [],
        movie: '',
      };
    } else if (current) {
      if (key === 'date') {
        current.date = parts.slice(1).join(' ');
      } else if (key === 'position') {
        current.positions.push(parts.slice(1).join(' '));
      } else if (key === 'movie') {
        current.movie = parts.slice(1).join(' ');
      }
    }
  }
  if (current) events.push(current);
  return events;
}

export function serializeCampaignEvents(events) {
  if (!events?.length) return '';
  const lines = [
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
    ';',
    '; Historical events',
    ';',
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
    '',
  ];
  for (const ev of events) {
    lines.push(`event\t${ev.eventType}\t${ev.name}`);
    if (ev.date) lines.push(`date\t${ev.date}`);
    for (const p of (ev.positions || [])) lines.push(`position\t${p}`);
    if (ev.movie) lines.push(`movie\t${ev.movie}`);
    lines.push('');
  }
  return lines.join('\n');
}