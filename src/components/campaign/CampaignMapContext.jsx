import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { parseTGA } from './TgaLoader';
import { LAYER_ORDER, makeDefaultLayerSettings } from './MapLayerDefs';

const CampaignMapContext = createContext(null);

export function CampaignMapProvider({ children }) {
  // layers: { key -> { width, height, data: Uint8ClampedArray (original), edited: Uint8ClampedArray|null, canvas: OffscreenCanvas|null } }
  const [layers, setLayers] = useState({});
  const [layerSettings, setLayerSettings] = useState(makeDefaultLayerSettings());
  const [activeLayer, setActiveLayer] = useState('ground_types');

  // Editor state
  const [tool, setTool] = useState('pencil'); // 'pencil' | 'bucket' | 'eyedropper'
  const [selectedColor, setSelectedColor] = useState(null); // { rgb: [r,g,b], label: string }
  const [brushSize, setBrushSize] = useState(1);
  const [isDirty, setIsDirty] = useState({}); // { layerKey: bool }

  // Grid overlay settings
  const [gridSettings, setGridSettings] = useState({
    showGridRegionsFeatures: false,
    showGridOther: false,
  });

  // Validation results
  const [validationResults, setValidationResults] = useState(null);

  // Load a TGA file into a layer
  const loadLayer = useCallback((key, arrayBuffer) => {
    const parsed = parseTGA(arrayBuffer);
    const edited = new Uint8ClampedArray(parsed.data);
    setLayers(prev => ({
      ...prev,
      [key]: {
        width: parsed.width,
        height: parsed.height,
        data: parsed.data,
        edited,
      }
    }));
  }, []);

  // Paint a pixel on the active layer's edited data
  const paintPixel = useCallback((layerKey, x, y, rgb) => {
    setLayers(prev => {
      const layer = prev[layerKey];
      if (!layer) return prev;
      const newEdited = new Uint8ClampedArray(layer.edited);
      const idx = (y * layer.width + x) * 4;
      newEdited[idx] = rgb[0];
      newEdited[idx + 1] = rgb[1];
      newEdited[idx + 2] = rgb[2];
      newEdited[idx + 3] = 255;
      return { ...prev, [layerKey]: { ...layer, edited: newEdited } };
    });
    setIsDirty(prev => ({ ...prev, [layerKey]: true }));
  }, []);

  // Bucket fill
  const bucketFill = useCallback((layerKey, x, y, rgb) => {
    setLayers(prev => {
      const layer = prev[layerKey];
      if (!layer) return prev;
      const newEdited = new Uint8ClampedArray(layer.edited);
      const { width, height } = layer;
      const targetIdx = (y * width + x) * 4;
      const tr = newEdited[targetIdx], tg = newEdited[targetIdx + 1], tb = newEdited[targetIdx + 2];
      if (tr === rgb[0] && tg === rgb[1] && tb === rgb[2]) return prev;

      const stack = [[x, y]];
      const visited = new Uint8Array(width * height);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        const idx2 = cy * width + cx;
        if (visited[idx2]) continue;
        const pi = idx2 * 4;
        if (newEdited[pi] !== tr || newEdited[pi+1] !== tg || newEdited[pi+2] !== tb) continue;
        visited[idx2] = 1;
        newEdited[pi] = rgb[0]; newEdited[pi+1] = rgb[1]; newEdited[pi+2] = rgb[2]; newEdited[pi+3] = 255;
        stack.push([cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]);
      }
      return { ...prev, [layerKey]: { ...layer, edited: newEdited } };
    });
    setIsDirty(prev => ({ ...prev, [layerKey]: true }));
  }, []);

  // Revert a layer to original
  const revertLayer = useCallback((layerKey) => {
    setLayers(prev => {
      const layer = prev[layerKey];
      if (!layer) return prev;
      return { ...prev, [layerKey]: { ...layer, edited: new Uint8ClampedArray(layer.data) } };
    });
    setIsDirty(prev => ({ ...prev, [layerKey]: false }));
  }, []);

  const updateLayerSetting = useCallback((key, field, value) => {
    setLayerSettings(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }, []);

  const updateGridSetting = useCallback((field, value) => {
    setGridSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <CampaignMapContext.Provider value={{
      layers, loadLayer,
      layerSettings, updateLayerSetting,
      activeLayer, setActiveLayer,
      tool, setTool,
      selectedColor, setSelectedColor,
      brushSize, setBrushSize,
      isDirty, setIsDirty,
      paintPixel, bucketFill, revertLayer,
      gridSettings, updateGridSetting,
      validationResults, setValidationResults,
    }}>
      {children}
    </CampaignMapContext.Provider>
  );
}

export function useCampaignMap() {
  return useContext(CampaignMapContext);
}