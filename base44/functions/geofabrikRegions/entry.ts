// Public, read-only metadata for fixed official Geofabrik resources. ZIPs never pass through this function.
export default async function(req) {
  const body = await req.json().catch(() => ({}));
  if (body.action && !['catalogue', 'metadata'].includes(body.action)) return Response.json({ error: 'Unknown operation.' }, { status: 400 });
  if (body.action === 'metadata' && (typeof body.regionId !== 'string' || body.regionId.length > 120)) return Response.json({ error: 'Choose a region.' }, { status: 400 });
  try {
    const now = Date.now();
    let cache = globalThis.geofabrikCatalogue;
    if (!cache || now - cache.time > 21600000) {
      const response = await fetch('https://download.geofabrik.de/index-v1.json', { signal: AbortSignal.timeout(20000) });
      if (!response.ok) return Response.json({ error: 'The official region catalogue is temporarily unavailable.' }, { status: 502 });
      const text = await response.text();
      if (text.length > 8000000) throw new Error('The region catalogue exceeds the supported size.');
      const json = JSON.parse(text);
      const regions = (json.features || []).slice(0, 1000).map(feature => {
        const p = feature.properties || {}, points = feature.geometry?.coordinates?.flat(feature.geometry.type === 'MultiPolygon' ? 2 : 1) || [];
        let west = 180, east = -180, south = 90, north = -90;
        for (const [x, y] of points) { west = Math.min(west, x); east = Math.max(east, x); south = Math.min(south, y); north = Math.max(north, y); }
        const url = p.urls?.shp;
        return { id: p.id, parent: p.parent || '', name: p.name, url: typeof url === 'string' && url.startsWith('https://download.geofabrik.de/') && url.endsWith('.shp.zip') ? url : null, bounds: { west, east, south, north } };
      });
      cache = { time: now, regions, metadata: new Map() }; globalThis.geofabrikCatalogue = cache;
    }
    if (body.action !== 'metadata') return Response.json({ regions: cache.regions, checkedAt: new Date(cache.time).toISOString() });
    const region = cache.regions.find(item => item.id === body.regionId);
    if (!region?.url) return Response.json({ error: 'No shapefile ZIP is available for this region. Choose a smaller subregion.' }, { status: 404 });
    const previous = cache.metadata.get(region.id);
    if (previous && now - previous.time < 3600000) return Response.json(previous.data);
    const response = await fetch(region.url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    if (!response.ok) return Response.json({ error: 'This ZIP is not currently available from Geofabrik.' }, { status: 502 });
    const data = { url: response.url, bytes: Number(response.headers.get('content-length')) || null, modified: response.headers.get('last-modified') || null };
    if (!data.url.startsWith('https://download.geofabrik.de/')) throw new Error('Unexpected download destination.');
    cache.metadata.set(region.id, { time: now, data });
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message || 'Could not load Geofabrik metadata.' }, { status: 502 });
  }
}