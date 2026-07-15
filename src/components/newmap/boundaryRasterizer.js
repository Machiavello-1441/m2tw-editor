// Shared boundary fetch + raster pipeline for the regions layer.
// Used both by SettlementBoundaryButton (paint a settlement's own boundary
// with its colour + black dot) and by the RegionsWorkshop "Merge to last"
// search action (paint a boundary with another settlement's colour, no dot).

function latToMercN(lat) {
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
}

export function latLngToPixel(lat, lng, bbox, width, height) {
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

function resolveRingsFromGeo(geo, bbox, mapWidth, mapHeight) {
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
  return rings;
}

/**
 * Resolve the lowest-order administrative boundary containing a point and
 * paint it onto the regions layer.
 *
 * @param {Object}   opts
 * @param {number}   opts.lat, opts.lng           Point to resolve/paint.
 * @param {number}  [opts.osmId]                   OSM relation id (fast path).
 * @param {string}  [opts.osmType]                 'relation' | 'node' | 'way'.
 * @param {number[]} opts.rgb                       [r,g,b] paint colour.
 * @param {boolean} [opts.drawDot=false]           Whether to draw the black
 *                                                  settlement marker + 3×3 rgb.
 * @param {number}  [opts.dotPx, opts.dotPy]       Marker pixel (when drawDot).
 */
export async function paintBoundary({
  lat, lng, osmId, osmType, rgb,
  drawDot = false, dotPx = null, dotPy = null,
  bbox, layers, onLayerUpdate, mapWidth, mapHeight,
}) {
  if (!bbox) throw new Error('No bounding box set.');

  let targetRelId;
  if (osmType === 'relation' && osmId) {
    // Fast path: Nominatim already returned the admin-boundary relation.
    targetRelId = osmId;
  } else {
    // Fallback for place-node/way results or settlements without a stored
    // osm_id: resolve the enclosing admin boundary via Overpass is_in.
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
    if (candidates.length === 0) throw new Error('No administrative boundary found at this point.');
    targetRelId = candidates[0].rel_id;
  }

  // Fetch the boundary geometry via Nominatim's lookup endpoint with
  // polygon_geojson — a single fast request returning pre-indexed polygons.
  const lookupUrl = `https://nominatim.openstreetmap.org/lookup?osm_ids=R${targetRelId}&format=jsonv2&polygon_geojson=1&addressdetails=0`;
  const lookupRes = await fetch(lookupUrl, { headers: { 'Accept-Language': 'en' } });
  if (!lookupRes.ok) throw new Error(`Nominatim HTTP ${lookupRes.status}`);
  const lookupJson = await lookupRes.json();
  const item = lookupJson && lookupJson[0];
  if (!item || !item.geojson) throw new Error('Boundary geometry unavailable from Nominatim.');
  const rings = resolveRingsFromGeo(item.geojson, bbox, mapWidth, mapHeight);

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
  ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`;
  ctx.fill(path, 'evenodd');
  const insideData = ctx.getImageData(0, 0, mapWidth, mapHeight);

  // Composite: paint RGB inside the polygon, but preserve sea-blue and any
  // existing black settlement-center pixels.
  const w = layer.imageData.width, h = layer.imageData.height;
  const copy = new ImageData(new Uint8ClampedArray(layer.imageData.data), w, h);
  const dst = copy.data;
  const ins = insideData.data;
  const isSeaPix = i => dst[i] === 0 && dst[i + 1] === 0 && dst[i + 2] === 255;
  const isBlackPix = i => dst[i] === 0 && dst[i + 1] === 0 && dst[i + 2] === 0;
  for (let i = 0; i < dst.length; i += 4) {
    if (ins[i + 3] === 0) continue;
    if (isBlackPix(i)) continue;
    if (isSeaPix(i)) continue;
    dst[i] = rgb[0]; dst[i + 1] = rgb[1]; dst[i + 2] = rgb[2]; dst[i + 3] = 255;
  }

  if (drawDot && dotPx != null && dotPy != null) {
    const cx = dotPx, cy = dotPy;
    const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = clamp(cx + dx, w), y = clamp(cy + dy, h);
        const idx = (y * w + x) * 4;
        if (dx === 0 && dy === 0) {
          dst[idx] = 0; dst[idx + 1] = 0; dst[idx + 2] = 0; dst[idx + 3] = 255;
        } else {
          if (isSeaPix(idx) || isBlackPix(idx)) continue;
          dst[idx] = rgb[0]; dst[idx + 1] = rgb[1]; dst[idx + 2] = rgb[2]; dst[idx + 3] = 255;
        }
      }
    }
  }

  onLayerUpdate('regions', {
    imageData: copy,
    visible: true,
    opacity: layer.opacity ?? 1,
    dirty: true,
  });
}