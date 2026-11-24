import React, { useRef, useState } from 'react';
import { Sliders, RotateCcw, Check, Wand2 } from 'lucide-react';

/**
 * Image adjustment controls for the heightmap layer.
 *
 * Land pixels are pure greyscale (R = G = B), sea is (0,0,255). Adjustments
 * therefore touch only grey pixels and write the new value back to all three
 * channels, so land stays grey instead of drifting yellow (B left behind) or
 * blue (B left ahead). Sea and any painted water keep their exact colour.
 */

/** True when a pixel is greyscale, i.e. land rather than painted water. */
const isGrey = (data, i) =>
  data[i] === data[i + 1] && data[i + 1] === data[i + 2];

export default function HeightmapAdjustPanel({ layer, onLayerUpdate }) {
  const [brightness, setBrightness] = useState(0); // -100..100
  const [contrast, setContrast] = useState(0);     // -100..100
  const [gamma, setGamma] = useState(1);           // 0.1..3.0
  const [expanded, setExpanded] = useState(false);
  // Heightmap pixels from before each applied change, newest last.
  const history = useRef([]);
  const [depth, setDepth] = useState(0);

  if (!layer?.imageData) return null;

  const resetSliders = () => {
    setBrightness(0);
    setContrast(0);
    setGamma(1);
  };

  /** Remember the current pixels so the next change can be reverted. */
  const pushSnapshot = () => {
    const { data, width, height } = layer.imageData;
    history.current.push(new ImageData(new Uint8ClampedArray(data), width, height));
    if (history.current.length > 10) history.current.shift();
    setDepth(history.current.length);
  };

  /** Apply a tone function to greyscale pixels, keeping them grey. */
  const applyToGreyscale = (srcData, fn) => {
    const { data, width, height } = srcData;
    const out = new Uint8ClampedArray(data);
    for (let i = 0; i < out.length; i += 4) {
      if (!isGrey(data, i)) continue; // sea / painted water untouched
      const v = fn(data[i]);
      out[i] = v; out[i + 1] = v; out[i + 2] = v;
    }
    return new ImageData(out, width, height);
  };

  const handleApply = () => {
    const bVal = brightness * 2.55;
    const cVal = contrast * 2.55;
    const contrastFactor = (259 * (cVal + 255)) / (255 * (259 - cVal));
    const gammaInv = 1 / gamma;
    const fn = (v) => {
      let r = contrastFactor * (v - 128) + 128 + bVal;
      r = Math.max(0, Math.min(255, r));
      r = 255 * Math.pow(r / 255, gammaInv);
      return Math.max(0, Math.min(255, Math.round(r)));
    };
    pushSnapshot();
    const result = applyToGreyscale(layer.imageData, fn);
    onLayerUpdate('heights', { imageData: result, visible: true, dirty: true });
    resetSliders();
  };

  const handleEqualize = () => {
    const { data, width, height } = layer.imageData;
    // Histogram of the greyscale (land) pixels only — sea must not drag it down
    const hist = new Array(256).fill(0);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (!isGrey(data, i)) continue;
      hist[data[i]]++;
      total++;
    }
    // Cumulative distribution
    const cdf = new Array(256).fill(0);
    let sum = 0;
    for (let i = 0; i < 256; i++) { sum += hist[i]; cdf[i] = sum; }
    let cdfMin = 0;
    for (let i = 0; i < 256; i++) { if (cdf[i] > 0) { cdfMin = cdf[i]; break; } }
    const denom = total - cdfMin;
    const lut = new Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = denom > 0 ? Math.round(((cdf[i] - cdfMin) / denom) * 255) : i;
    }
    pushSnapshot();
    const out = new Uint8ClampedArray(data);
    for (let i = 0; i < out.length; i += 4) {
      if (!isGrey(data, i)) continue; // sea / painted water untouched
      const v = lut[data[i]];
      out[i] = v; out[i + 1] = v; out[i + 2] = v;
    }
    onLayerUpdate('heights', { imageData: new ImageData(out, width, height), visible: true, dirty: true });
  };

  /** Restore the heightmap from before the last applied change. */
  const handleRevert = () => {
    const previous = history.current.pop();
    setDepth(history.current.length);
    resetSliders();
    const current = layer.imageData;
    // A re-fetched heightmap has different dimensions: never paste a stale one back.
    if (previous && previous.width === current.width && previous.height === current.height) {
      onLayerUpdate('heights', { imageData: previous, visible: true, dirty: true });
    }
  };

  return (
    <div className="border-t border-slate-700/60 pt-1.5 mt-1 space-y-1.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-200 font-semibold transition-colors"
      >
        <Sliders className="w-3 h-3" />
        Adjust Heightmap
        <span className="text-slate-600 ml-auto text-[9px] font-normal">greyscale only</span>
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {/* Brightness */}
          <div>
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>Brightness</span>
              <span className="font-mono">{brightness > 0 ? '+' : ''}{brightness}</span>
            </div>
            <input type="range" min="-100" max="100" value={brightness}
              onChange={e => setBrightness(parseInt(e.target.value))}
              className="w-full h-1 accent-amber-400" />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>Contrast</span>
              <span className="font-mono">{contrast > 0 ? '+' : ''}{contrast}</span>
            </div>
            <input type="range" min="-100" max="100" value={contrast}
              onChange={e => setContrast(parseInt(e.target.value))}
              className="w-full h-1 accent-amber-400" />
          </div>

          {/* Gamma (tone curve) */}
          <div>
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>Gamma</span>
              <span className="font-mono">{gamma.toFixed(2)}</span>
            </div>
            <input type="range" min="0.1" max="3" step="0.05" value={gamma}
              onChange={e => setGamma(parseFloat(e.target.value))}
              className="w-full h-1 accent-amber-400" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 pt-0.5">
            <button onClick={handleApply}
              className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] bg-amber-600/80 hover:bg-amber-600 text-white font-semibold border border-amber-500/50 transition-colors">
              <Check className="w-3 h-3" /> Apply
            </button>
            <button onClick={handleEqualize}
              title="Histogram equalization (land pixels only)"
              className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 font-semibold border border-purple-500/40 transition-colors">
              <Wand2 className="w-3 h-3" /> Equalize
            </button>
            <button onClick={handleRevert}
              disabled={depth === 0}
              title={depth === 0 ? 'Nothing to revert yet' : `Revert the last applied change (${depth} undoable)`}
              className="flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[10px] bg-slate-700/60 hover:bg-slate-600 text-slate-300 border border-slate-600/40 transition-colors">
              <RotateCcw className="w-3 h-3" /> Revert
            </button>
          </div>
          <p className="text-[8px] text-slate-600 leading-tight">
            Adjustments affect only grey land pixels and keep them grey. Sea and painted water <code className="text-amber-300">(0,0,255)</code> keep their exact colour.
            {depth > 0 ? ` Revert steps back one change at a time (${depth} available).` : ''}
          </p>
        </div>
      )}
    </div>
  );
}