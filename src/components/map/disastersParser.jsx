/**
 * Parser and serializer for descr_disasters.txt
 *
 * Structure (one block per disaster):
 *   event       earthquake|volcano|flood|storm|dustbowl|locusts|plague|horde
 *   frequency   20        (in years)
 *   winter      false
 *   summer      false
 *   warning     false
 *   climate     rocky_desert   (optional, repeatable)
 *   region      REGION_NAME    (optional, repeatable)
 *   position    x, y           (optional, repeatable)
 *   min_scale   2
 *   max_scale   5
 */

export const DISASTER_TYPES = ['earthquake','volcano','flood','storm','dustbowl','locusts','plague','horde'];

export function parseDisasters(text) {
  const disasters = [];
  if (!text) return disasters;

  const lines = text.split('\n');
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;

    const [key, ...rest] = line.split(/\s+/);
    const val = rest.join(' ').trim();

    if (key === 'event') {
      if (current) disasters.push(current);
      current = {
        eventType: val,
        frequency: 20,
        winter: false,
        summer: false,
        warning: false,
        climates: [],
        regions: [],
        positions: [],
        minScale: 2,
        maxScale: 5,
      };
    } else if (current) {
      if (key === 'frequency')  current.frequency  = parseInt(val) || 20;
      else if (key === 'winter')   current.winter   = val === 'true';
      else if (key === 'summer')   current.summer   = val === 'true';
      else if (key === 'warning')  current.warning  = val === 'true';
      else if (key === 'climate')  current.climates.push(val);
      else if (key === 'region')   current.regions.push(val);
      else if (key === 'position') current.positions.push(val);
      else if (key === 'min_scale') current.minScale = parseInt(val) || 2;
      else if (key === 'max_scale') current.maxScale = parseInt(val) || 5;
    }
  }
  if (current) disasters.push(current);
  return disasters;
}

export function serializeDisasters(disasters) {
  if (!disasters?.length) return '';
  const lines = [
    '; descr_disasters.txt',
    '; event\t\tevent_type',
    '; frequency\tin years',
    '; winter\tonly occurs in winter',
    '; summer\tonly occurs in summer',
    '; warning\tprovides a one year warning',
    '; position\tposition event can occur in strat coords',
    '; region\tregion event can occur by region name',
    '; climate\tclimate event can occur by climate name',
    '; min_scale\tminimum size for event',
    '; max_scale\tmaximum size for event',
    '',
  ];
  for (const d of disasters) {
    lines.push(`event\t\t${d.eventType}`);
    lines.push(`frequency\t${d.frequency}`);
    lines.push(`winter\t\t${d.winter}`);
    lines.push(`summer\t\t${d.summer}`);
    lines.push(`warning\t\t${d.warning}`);
    for (const c of (d.climates || [])) lines.push(`climate\t\t${c}`);
    for (const r of (d.regions || []))  lines.push(`region\t\t${r}`);
    for (const p of (d.positions || [])) lines.push(`position\t${p}`);
    lines.push(`min_scale\t${d.minScale}`);
    lines.push(`max_scale\t${d.maxScale}`);
    lines.push('');
  }
  return lines.join('\n');
}