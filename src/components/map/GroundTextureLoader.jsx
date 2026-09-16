import React, { useState } from 'react';
import { decodeTgaToDataUrl } from '@/components/shared/tgaDecoder';
import { FolderOpen, Loader2 } from 'lucide-react';

/**
 * Loads the aerial-map ground tile textures from
 * data\terrain\aerial_map\ground_types\ into window._m2tw_ground_textures,
 * keyed by lowercase basename without extension — the same key the
 * descr_aerial_map_ground_types.txt entries resolve to.
 */
export default function GroundTextureLoader({ onLoaded }) {
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => /\.tga$/i.test(f.name));
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    const textures = { ...(window._m2tw_ground_textures || {}) };
    for (const f of files) {
      const url = decodeTgaToDataUrl(await f.arrayBuffer());
      if (url) textures[f.name.replace(/\.tga$/i, '').toLowerCase()] = url;
    }
    window._m2tw_ground_textures = textures;
    window.dispatchEvent(new CustomEvent('load-ground-textures', { detail: textures }));
    setBusy(false);
    onLoaded?.(Object.keys(textures).length);
  };

  return (
    <label className="cursor-pointer block">
      <input type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={pick} />
      <span className="flex items-center gap-1.5 px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-700 text-[10px]">
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
        Load ground_types textures
      </span>
    </label>
  );
}