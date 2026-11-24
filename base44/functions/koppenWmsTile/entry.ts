import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';

// Köppen climate map (koppen.earth) served through its terrakio WMS backend.
// The API key never leaves the server.
const WMS_BASE = 'https://terrakio-server-wms-lark-573248941006.australia-southeast1.run.app/wms';
const MAX_SIDE = 4096;
const MAX_BYTES = 16 * 1024 * 1024;

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get('WMS_KEY');
    if (!apiKey) return Response.json({ error: 'The climate map key is not configured.' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const width = Math.round(Number(body.width));
    const height = Math.round(Number(body.height));
    const bbox = Array.isArray(body.bbox) ? body.bbox.map(Number) : [];

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8 || width > MAX_SIDE || height > MAX_SIDE) {
      return Response.json({ error: 'Unsupported climate map size.' }, { status: 400 });
    }
    if (bbox.length !== 4 || !bbox.every(Number.isFinite) || bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) {
      return Response.json({ error: 'Invalid bounding box.' }, { status: 400 });
    }

    const params = new URLSearchParams({
      service: 'WMS', request: 'GetMap', layers: 'koppen', styles: '',
      format: 'image/png', transparent: 'false', version: '1.1.1',
      expression: 'CMIP6Koppen.reanalysis@(year=2020)',
      cmap: 'koppen', vmin: '1', vmax: '30',
      'api-key': apiKey,
      width: String(width), height: String(height), srs: 'EPSG:3857',
      bbox: bbox.join(','),
    });

    const res = await fetch(`${WMS_BASE}?${params.toString()}`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return Response.json({ error: 'The climate map service is unavailable.' }, { status: 502 });

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      return Response.json({ error: 'The climate map image could not be read.' }, { status: 502 });
    }

    return Response.json({ imageBase64: toBase64(bytes), width, height });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}