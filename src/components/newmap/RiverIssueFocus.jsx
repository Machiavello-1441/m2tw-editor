import React, { useEffect, useMemo } from 'react';
import { Rectangle, Tooltip, useMap } from 'react-leaflet';

export default function RiverIssueFocus({ issue, bbox, width, height }) {
  const map = useMap();
  const target = useMemo(() => {
    if (!issue || !bbox || !width || !height) return null;
    const top = map.project([bbox.north,bbox.west],0), bottom = map.project([bbox.south,bbox.east],0);
    const point = (x,y) => map.unproject([top.x + x / width * (bottom.x - top.x), top.y + y / height * (bottom.y - top.y)],0);
    const { x,y } = issue;
    return { pixel: [point(x,y), point(x + 1,y + 1)], view: [point(x - 6,y - 6), point(x + 7,y + 7)] };
  }, [map, issue, bbox?.north, bbox?.south, bbox?.west, bbox?.east, width, height]);
  useEffect(() => { if (target) map.fitBounds(target.view, { padding: [40,40], maxZoom: 17, animate: false }); }, [map,target]);
  if (!target) return null;
  return <Rectangle bounds={target.pixel} interactive={false} pathOptions={{ color: 'hsl(var(--destructive))', weight: 3, fillOpacity: 0.25 }}>
    <Tooltip permanent direction="top" opacity={1}>River issue ({issue.x}, {issue.y})</Tooltip>
  </Rectangle>;
}