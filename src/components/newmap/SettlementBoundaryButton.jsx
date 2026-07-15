import React, { useState, useCallback } from 'react';
import { Globe, Loader2 } from 'lucide-react';

// Same Mercator projection used by RegionsWorkshop (kept independent so this
// component can be moved/edited without coupling to the parent).
function latToMercN(lat) {
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
}
function latLngToPixel(lat, lng, bbox, width, height) {
  const mercNorth = latToMercN(bbox.north);
  const mercSouth = latToMercN(bbox.south);
  const px = Math.round(((lng - bbox.west) / (bbox.east - bbox.west)) * (width - 1));
  const py = Math.round(((mercNorth - latToMercN(lat)) / (mercNorth - mercSouth)) * (height - 1));
  return { px, py };
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function overpass(query) {
  let lastErr;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Overpass request failed.');
}

/**
 * SettlementBoundaryButton — fetches the lowest-order (smallest geographic,
 * i.e. highest admin_level) administrative boundary from OpenStreetMap that
 * contains the settlement point, and rasterizes that polygon onto the
 * regions layer using the settlement's RGB colour. OSM-Boundaries.com serves
 * the exact same OSM administrative-boundary polygons, but its download API
 * requires paid membership/credits, so we fetch the pre-indexed polygon from
 * Nominatim's lookup API (fast) using the OSM relation id captured at
 * settlement-add time; place-node settlements without a stored id fall back
 * to resolving the enclosing boundary via Overpass.
 *
 * Painting rules:
 *  • Pixels outside the boundary polygon are left untouched.
 *  • Existing sea-blue pixels (0,0,255) inside the polygon are preserved.
 *  • The black settlement-center pixel at (px,py) is preserved, and its
 *    3×3 surroundings are re-applied with the settlement RGB.
 */
export default function SettlementBoundaryButton({
  settlement, bbox, layers, onLayerUpdate, mapWidth, mapHeight,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      if (!bbox) throw new Error('No bounding box set.');
      const { lat, lng, osmId, osmType } = settlement;

      let targetRelId;
      if (osmType === 'relation' && osmId) {
        // Fast path: Nominatim already returned the admin-boundary relation
        // (e.g. a comune like Canicattì), so skip the slow global is_in
        // point-in-polygon lookup that times out on overloaded public
        // Overpass servers, and fetch only this one relation's geometry.
        targetRelId = osmId;
      } else {
        // Fallback for place-node/way results or older settlements without
        // a stored osm_id: resolve the enclosing admin boundary the slow way.
        const isinQuery = `[out:json][timeout:25];
is_in(${lat},${lng});
out tags;`;
        const isinJson = await overpass(isinQuery);
        const candidates = (isinJson.elements || [])
          .filter(e => e.type === 'area' && e.tags && e.tags.boundary === 'administrative' && e.tags.admin_level)
          .map(e => ({
            area_id: e.id,
            rel_id: e.id > 3600000000 ? e.id - 3600000000 : null,
            admin_level: parseInt(e.tags.admin_level, 10),
            name: e.tags.name || e.tags['name:en'],
          }))
          .filter(c => c.rel_id && !Number.isNaN(c.admin_level))
          .sort((a, b) => b.admin_level - a.admin_level);

        if (candidates.length === 0) {
          throw new Error('No administrative boundary found at this point.');
        }
        targetRelId = candidates[0].rel_id;
      }

      // 2) Fetch the boundary geometry via Nominatim's lookup endpoint with
      //    polygon_geojson — a single fast request. Nominatim serves
      //    pre-indexed boundary polygons directly, so this is far faster and
      //    more reliable than Overpass's out geom on busy public servers
      //    (which was causing the "Failed to fetch" / 504 timeouts).
      const lookupUrl = `https://nominatim.openstreetmap.org/lookup?osm_ids=R${targetRelId}&format=jsonv2&polygon_geojson=1&addressdetails=0`;
      const lookupRes = await fetch(lookupUrl, { headers: { 'Accept-Language': 'en' } });
      if (!lookupRes.ok) throw new Error(`Nominatim HTTP ${lookupRes.status}`);
      const lookupJson = await lookupRes.json();
      const item = lookupJson && lookupJson[0];
      if (!item || !item.geojson) {
        throw new Error('Boundary geometry unavailable from Nominatim.');
      }
      const geo = item.geojson;
      const coordRings = [];
      if (geo.type === 'Polygon') {
        coordRings.push(...geo.coordinates);
      } else if (geo.type === 'MultiPolygon') {
        for (const poly of geo.coordinates) coordRings.push(...poly);
      } else {
        throw new Error('Unsupported boundary geometry type: ' + geo.type);
      }
      const rings = coordRings
        .map(ring => ring.map(([lng, lat]) => latLngToPixel(lat, lng, bbox, mapWidth, mapHeight)))
        .filter(pts => pts.length >= 3);
      if (rings.length === 0) throw new Error('No outer rings found in boundary.');

      // 3) Rasterize the polygon(s) onto a hidden canvas (evenodd handles
      //    multipolygons + holes uniformly).
      const layer = layers.regions;
      if (!layer?.imageData) throw new Error('Regions layer not initialized.');
      const canvas = document.createElement('canvas');
      canvas.width = mapWidth; canvas.height = mapHeight;
      const ctx = canvas.getContext('2d');
      const path = new Path2D();
      for (const ring of rings) {
        ring.forEach((p, i) => (i === 0 ? path.moveTo(p.px, p.py) : path.lineTo(p.px, p.py)));
        path.closePath();
      }
      ctx.fillStyle = `rgba(${settlement.rgb[0]},${settlement.rgb[1]},${settlement.rgb[2]},1)`;
      ctx.fill(path, 'evenodd');
      const insideData = ctx.getImageData(0, 0, mapWidth, mapHeight);

      // 4) Composite onto a copy of the regions layer: paint RGB inside the
      //    polygon, but preserve sea-blue pixels and any existing black
      //    settlement-center pixels.
      const w = layer.imageData.width, h = layer.imageData.height;
      const copy = new ImageData(new Uint8ClampedArray(layer.imageData.data), w, h);
      const dst = copy.data;
      const ins = insideData.data;
      const isSeaPix = i => dst[i] === 0 && dst[i+1] === 0 && dst[i+2] === 255;
      const isBlackPix = i => dst[i] === 0 && dst[i+1] === 0 && dst[i+2] === 0;
      for (let i = 0; i < dst.length; i += 4) {
        if (ins[i+3] === 0) continue;          // outside polygon
        if (isBlackPix(i)) continue;            // keep settlement dots (incl. this one)
        if (isSeaPix(i)) continue;              // keep sea blue
        dst[i]   = settlement.rgb[0];
        dst[i+1] = settlement.rgb[1];
        dst[i+2] = settlement.rgb[2];
        dst[i+3] = 255;
      }

      // 5) Guarantee the settlement's own black center + 3×3 RGB surround.
      const cx = settlement.px, cy = settlement.py;
      const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = clamp(cx + dx, w), y = clamp(cy + dy, h);
          const idx = (y * w + x) * 4;
          if (dx === 0 && dy === 0) {
            dst[idx] = 0; dst[idx+1] = 0; dst[idx+2] = 0; dst[idx+3] = 255;
          } else {
            // Don't overwrite sea or other black dots with the surround color.
            if (isSeaPix(idx) || isBlackPix(idx)) continue;
            dst[idx]   = settlement.rgb[0];
            dst[idx+1] = settlement.rgb[1];
            dst[idx+2] = settlement.rgb[2];
            dst[idx+3] = 255;
          }
        }
      }

      onLayerUpdate('regions', {
        imageData: copy,
        visible: true,
        opacity: layer.opacity ?? 1,
        dirty: true,
      });
    } catch (e) {
      setError(e?.message || 'Failed to fetch boundary.');
    } finally {
      setLoading(false);
    }
  }, [loading, settlement, bbox, layers, mapWidth, mapHeight, onLayerUpdate]);

  return (
    <div className="flex flex-col gap-0.5 mt-1">
      <button
        onClick={handleClick}
        disabled={loading || !bbox}
        title="Fetch the lowest-order administrative boundary from OpenStreetMap (the same data osm-boundaries.com serves) and paint it onto the regions layer."
        className="flex items-center justify-center gap-1.5 w-full px-2 py-1 rounded text-[9px] bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 disabled:opacity-50 transition-colors font-semibold"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
        {loading ? 'Fetching boundary…' : 'Fetch boundary & paint (OSM)'}
      </button>
      {error && <p className="text-[9px] text-red-400 leading-tight">{error}</p>}
    </div>
  );
}