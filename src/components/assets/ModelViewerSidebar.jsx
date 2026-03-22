import React, { useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, RotateCw, Pause, Eye, EyeOff, Bone, ImageIcon, X, ChevronRight, ChevronDown } from 'lucide-react';

/**
 * Build super-groups from meshInfos.
 * Each meshInfo has { name, visible, textureFile, superGroup, alwaysVisible }.
 * Returns [ { superGroup, items: [{ info, globalIndex }] } ]
 */
function buildSuperGroups(meshInfos) {
  const map = new Map();
  meshInfos.forEach((info, idx) => {
    const sg = info.superGroup || info.name;
    if (!map.has(sg)) map.set(sg, []);
    map.get(sg).push({ info, globalIndex: idx });
  });
  return Array.from(map.entries()).map(([superGroup, items]) => ({ superGroup, items }));
}

export default function ModelViewerSidebar({
  isRotating, onToggleRotation,
  showSkeleton, onToggleSkeleton, hasSkeleton,
  meshInfos, onToggleVisibility, onTextureFile, onRemoveTexture,
  onScreenshot,
}) {
  const superGroups = useMemo(() => buildSuperGroups(meshInfos), [meshInfos]);

  return (
    <div className="w-60 border-l border-slate-700 bg-slate-900 flex flex-col shrink-0 text-[11px]">
      {/* Controls */}
      <div className="p-3 border-b border-slate-700 space-y-1.5">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Controls</p>

        <button
          onClick={onToggleRotation}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
            isRotating ? 'bg-blue-600/30 text-blue-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {isRotating ? <Pause className="w-3 h-3" /> : <RotateCw className="w-3 h-3" />}
          {isRotating ? 'Stop Rotation' : 'Start Rotation'}
        </button>

        <button
          onClick={onToggleSkeleton}
          disabled={!hasSkeleton}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
            !hasSkeleton ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500' :
            showSkeleton ? 'bg-green-600/30 text-green-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Bone className="w-3 h-3" />
          {hasSkeleton ? (showSkeleton ? 'Hide Skeleton' : 'Show Skeleton') : 'No Skeleton'}
        </button>

        <Button size="sm" variant="outline"
          className="w-full gap-2 border-slate-600 text-slate-200 hover:bg-slate-700 h-7 text-[11px]"
          onClick={onScreenshot}
        >
          <Camera className="w-3 h-3" /> Screenshot (.png)
        </Button>
      </div>

      {/* Mesh groups — organized by super-groups */}
      <div className="flex-1 min-h-0 flex flex-col">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-3 pt-3 pb-1">
          Mesh Groups ({meshInfos.length})
        </p>
        <ScrollArea className="flex-1 px-2 pb-3">
          <div className="space-y-1 pt-1">
            {superGroups.map(sg => (
              <SuperGroupSection
                key={sg.superGroup}
                superGroup={sg.superGroup}
                items={sg.items}
                onToggleVisibility={onToggleVisibility}
                onTextureFile={onTextureFile}
                onRemoveTexture={onRemoveTexture}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SuperGroupSection({ superGroup, items, onToggleVisibility, onTextureFile, onRemoveTexture }) {
  const [expanded, setExpanded] = useState(false);
  const allVisible = items.every(i => i.info.visible);
  const noneVisible = items.every(i => !i.info.visible);

  const toggleAll = () => {
    // If all visible, hide all. Otherwise show all.
    const targetVisible = !allVisible;
    items.forEach(({ info, globalIndex }) => {
      if (info.visible !== targetVisible) onToggleVisibility(globalIndex);
    });
  };

  // If only 1 item in the group, render it flat (no collapsible header)
  if (items.length === 1) {
    return (
      <MeshGroupRow
        info={items[0].info}
        index={items[0].globalIndex}
        onToggleVisibility={onToggleVisibility}
        onTextureFile={onTextureFile}
        onRemoveTexture={onRemoveTexture}
      />
    );
  }

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Super-group header */}
      <div className="flex items-center bg-slate-800 px-2 py-1.5 gap-1">
        <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-200 p-0.5">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <button onClick={() => setExpanded(e => !e)} className="flex-1 text-left text-slate-200 font-semibold truncate">
          {superGroup}
        </button>
        <span className="text-[9px] text-slate-500 mr-1">{items.length}</span>
        <button onClick={toggleAll}
          className={`p-0.5 rounded transition-colors ${allVisible ? 'text-blue-400 hover:bg-blue-500/20' : noneVisible ? 'text-slate-600 hover:bg-slate-700' : 'text-blue-400/50 hover:bg-blue-500/20'}`}
          title={allVisible ? 'Hide all' : 'Show all'}
        >
          {allVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
      </div>

      {/* Children */}
      {expanded && (
        <div className="bg-slate-850 pl-2 space-y-0.5 py-0.5">
          {items.map(({ info, globalIndex }) => (
            <MeshGroupRow
              key={info.name}
              info={info}
              index={globalIndex}
              onToggleVisibility={onToggleVisibility}
              onTextureFile={onTextureFile}
              onRemoveTexture={onRemoveTexture}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MeshGroupRow({ info, index, onToggleVisibility, onTextureFile, onRemoveTexture, compact }) {
  const inputRef = useRef(null);
  const label = compact ? info.name.replace(/^.*?_(\d+)$/, (_, n) => `#${n}`) : info.name;

  return (
    <div className={`bg-slate-800 rounded p-1.5 space-y-1 ${compact ? 'ml-1' : ''}`}>
      {/* Name + visibility toggle */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-slate-200 truncate flex-1 mr-1" title={info.name}>
          {label}
          {info.alwaysVisible === true && <span className="text-[9px] text-green-500 ml-1" title="Always visible in game">★</span>}
          {info.alwaysVisible === false && <span className="text-[9px] text-amber-500 ml-1" title="Random in game">⚄</span>}
        </span>
        <button onClick={() => onToggleVisibility(index)}
          className={`p-0.5 rounded transition-colors ${info.visible ? 'text-blue-400 hover:bg-blue-500/20' : 'text-slate-500 hover:bg-slate-700'}`}
        >
          {info.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
      </div>

      {/* Texture assignment */}
      <div className="flex items-center gap-1">
        {info.textureFile ? (
          <>
            <div className="flex-1 flex items-center gap-1 bg-slate-700 rounded px-1.5 py-0.5 min-w-0">
              <ImageIcon className="w-2.5 h-2.5 text-green-400 shrink-0" />
              <span className="truncate text-green-300 text-[10px]">{info.textureFile}</span>
            </div>
            <button onClick={() => onRemoveTexture(index)}
              className="text-slate-500 hover:text-red-400 p-0.5">
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <input ref={inputRef} type="file" className="hidden" accept=".texture,.tga,.dds"
              onChange={(e) => { if (e.target.files[0]) onTextureFile(index, e.target.files[0]); e.target.value = ''; }} />
            <button onClick={() => inputRef.current?.click()}
              className="flex-1 flex items-center gap-1 bg-slate-700 hover:bg-slate-600 rounded px-1.5 py-0.5 text-slate-400 transition-colors">
              <ImageIcon className="w-2.5 h-2.5" />
              <span className="text-[10px]">Texture…</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}