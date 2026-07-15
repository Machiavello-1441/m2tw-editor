import React, { useState, useCallback } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { paintBoundary } from './boundaryRasterizer';

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
      await paintBoundary({
        lat: settlement.lat,
        lng: settlement.lng,
        osmId: settlement.osmId,
        osmType: settlement.osmType,
        rgb: settlement.rgb,
        drawDot: true,
        dotPx: settlement.px,
        dotPy: settlement.py,
        bbox, layers, onLayerUpdate, mapWidth, mapHeight,
      });
    } catch (e) {
      setError(e?.message || 'Failed to fetch boundary.');
    } finally {
      setLoading(false);
    }
  }, [loading, settlement, bbox, layers, onLayerUpdate, mapWidth, mapHeight]);

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