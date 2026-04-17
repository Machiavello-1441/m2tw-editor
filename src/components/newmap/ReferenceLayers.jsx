/**
 * ReferenceLayers — superimposed reference tile layers for the browse/select phase.
 * All layers use Web Mercator (EPSG:3857) so they align perfectly with Leaflet.
 *
 * Available layers:
 *  - heightmap  : Tangram heightmap tiles (grayscale elevation)
 *  - topo       : OpenTopoMap (contours, rivers, labels)
 *  - climate    : ESRI World Climate zones (best free CORS-safe option)
 *  - rivers     : OpenStreetMap Humanitarian (waterways highlighted)
 */

import React, { useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { Eye, EyeOff, Layers } from 'lucide-react';

export const REFERENCE_LAYER_DEFS = [
  {
    id: 'topo',
    label: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors',
    defaultOpacity: 1.0,
    defaultVisible: true,
    color: '#4ade80',
  },
  {
    id: 'heightmap',
    label: 'Heightmap (Tangram)',
    // Terrarium RGB-encoded elevation tiles — standard Mapzen/AWS terrain tiles
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    attribution: '&copy; Mapzen/Amazon elevation tiles',
    defaultOpacity: 0.65,
    defaultVisible: false,
    color: '#a3e635',
    // Note: these are RGB-encoded elevation (not visual), so we show them as a grayscale overlay
  },
  {
    id: 'rivers',
    label: 'Rivers (OSM Humanitarian)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OSM Humanitarian contributors',
    defaultOpacity: 0.5,
    defaultVisible: false,
    color: '#60a5fa',
  },
];

/**
 * Hook that manages reference layer visibility/opacity state.
 * Returns [state, setters] to be used in the parent.
 */
export function useReferenceLayers() {
  const [refLayers, setRefLayers] = useState(() =>
    Object.fromEntries(
      REFERENCE_LAYER_DEFS.map(d => [d.id, { visible: d.defaultVisible, opacity: d.defaultOpacity }])
    )
  );

  const toggleRef = (id) => setRefLayers(p => ({
    ...p, [id]: { ...p[id], visible: !p[id]?.visible }
  }));

  const setRefOpacity = (id, opacity) => setRefLayers(p => ({
    ...p, [id]: { ...p[id], opacity }
  }));

  return { refLayers, toggleRef, setRefOpacity };
}

/**
 * The actual Leaflet TileLayer components — rendered inside MapContainer.
 */
export function ReferenceLayerTiles({ refLayers }) {
  return (
    <>
      {REFERENCE_LAYER_DEFS.map(def => {
        const state = refLayers[def.id];
        if (!state?.visible) return null;
        return (
          <TileLayer
            key={def.id}
            url={def.url}
            attribution={def.attribution}
            opacity={state.opacity ?? def.defaultOpacity}
            maxZoom={def.id === 'heightmap' ? 15 : 19}
            crossOrigin="anonymous"
          />
        );
      })}
    </>
  );
}

/**
 * Control panel for toggling reference layers — shown in the right panel during browse/generate phases.
 */
export function ReferenceLayerControls({ refLayers, onToggle, onOpacity }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Layers className="w-3 h-3 text-slate-400" />
        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Reference Layers</p>
      </div>
      {REFERENCE_LAYER_DEFS.map(def => {
        const state = refLayers[def.id];
        const visible = state?.visible ?? def.defaultVisible;
        const opacity = state?.opacity ?? def.defaultOpacity;
        return (
          <div key={def.id} className="bg-slate-800 border border-slate-700 rounded p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggle(def.id)}
                className={`p-0.5 rounded transition-colors ${visible ? 'text-green-400' : 'text-slate-600'}`}
              >
                {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[10px] text-slate-300 flex-1">{def.label}</span>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: def.color }}
              />
            </div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={opacity}
              onChange={e => onOpacity(def.id, parseFloat(e.target.value))}
              disabled={!visible}
              className="w-full h-1 accent-green-400"
            />
          </div>
        );
      })}
    </div>
  );
}