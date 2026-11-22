import React, { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import { borderLatLngGroups } from '@/components/map/politicalBorders';

/** Province borders as hairline strokes along the map_regions pixel edges. */
export default function PoliticalBorderLines({ runs, bounds }) {
  const groups = useMemo(() => borderLatLngGroups(runs, bounds), [runs, bounds]);
  return (
    <>
      {groups.map(group => (
        <Polyline
          key={group.key}
          positions={group.positions}
          pathOptions={{ color: group.color, weight: 1, opacity: 0.9, interactive: false }}
        />
      ))}
    </>
  );
}