/**
 * OhmOverlay — OpenHistoricalMap tile overlay with a year slider.
 * Shown during the Edit phase to guide map_regions painting.
 *
 * OHM supports date-filtered tiles via:
 *   https://tile.openhistoricalmap.org/historicalmaps/{z}/{x}/{y}.png?date=YYYY-MM-DD
 * However OHM's tile server has CORS restrictions for cross-origin use.
 * We fall back to their WMS endpoint which is CORS-open:
 *   https://openhistoricalmap.org/api/0.6/map?bbox=...
 *   (for vector — tiles don't support arbitrary date yet)
 *
 * Best available CORS-safe strategy: use OHM's public tile server with a
 * custom date header approach. In practice the tile URL with ?date= works
 * in the browser (no CORS preflight for img tags / Leaflet tile loads).
 */

import React, { useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { Eye, EyeOff, Clock } from 'lucide-react';

const ERA_TICKS = [500, 700, 800, 900, 1000, 1066, 1095, 1200, 1250, 1350, 1400, 1500];

/** Renders only the OHM tile layer inside a MapContainer. */
export default function OhmOverlay({ ohmYear, opacity }) {
  const dateStr = `${String(ohmYear).padStart(4,'0')}-01-01`;
  return <OhmTileLayer dateStr={dateStr} opacity={opacity} />;
}

function OhmTileLayer({ dateStr, opacity }) {
  // OHM tile URL with date parameter
  const url = `https://tile.openhistoricalmap.org/historicalmaps/{z}/{x}/{y}.png?date=${dateStr}`;
  return (
    <TileLayer
      key={dateStr} // force re-render when date changes
      url={url}
      attribution='&copy; <a href="https://openhistoricalmap.org">OpenHistoricalMap</a> contributors'
      opacity={opacity}
      maxZoom={19}
      crossOrigin="anonymous"
    />
  );
}

/**
 * Control panel for OHM overlay — rendered in the right panel during edit phase.
 */
export function OhmOverlayControls({ ohmYear, setOhmYear, visible, setVisible, opacity, setOpacity }) {
  const dateStr = `${String(ohmYear).padStart(4,'0')}-01-01`;

  return (
    <div className="p-3 border-t border-slate-700 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <p className="text-[10px] text-slate-300 font-semibold flex-1 uppercase tracking-wider">OHM Historical</p>
        <button
          onClick={() => setVisible(v => !v)}
          className={`p-0.5 rounded transition-colors ${visible ? 'text-amber-400' : 'text-slate-600'}`}
        >
          {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-slate-500">500</span>
          <span className="text-[11px] font-mono font-semibold text-amber-300">{ohmYear} AD</span>
          <span className="text-[9px] text-slate-500">1600</span>
        </div>
        <input
          type="range" min="500" max="1600" step="1"
          value={ohmYear}
          onChange={e => setOhmYear(Number(e.target.value))}
          disabled={!visible}
          className="w-full h-1.5 accent-amber-400"
        />
        {/* Era quick picks */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {ERA_TICKS.map(y => (
            <button
              key={y}
              onClick={() => setOhmYear(y)}
              className={`px-1.5 py-0.5 rounded text-[8px] border transition-colors ${
                ohmYear === y
                  ? 'bg-amber-600/80 border-amber-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[9px] text-slate-500 mb-1">
          <span>Opacity</span>
          <span className="font-mono">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range" min="0" max="1" step="0.05"
          value={opacity}
          onChange={e => setOpacity(parseFloat(e.target.value))}
          disabled={!visible}
          className="w-full h-1 accent-amber-400"
        />
      </div>

      <p className="text-[9px] text-slate-500">
        Date: <span className="font-mono text-slate-400">{dateStr}</span>
        {' — '}shows historical administrative boundaries from{' '}
        <a href="https://openhistoricalmap.org" target="_blank" rel="noreferrer" className="text-amber-400 underline">OpenHistoricalMap</a>.
        Use as tracing reference for <span className="font-mono text-slate-300">map_regions</span>.
      </p>
    </div>
  );
}