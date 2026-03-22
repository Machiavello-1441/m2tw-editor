import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, RotateCw, Pause, Eye, EyeOff, Bone, ImageIcon, X, ChevronRight, ChevronDown } from 'lucide-react';

export default function ModelViewerSidebar({
  isRotating, onToggleRotation,
  showSkeleton, onToggleSkeleton, hasSkeleton,
  meshInfos, superGroups, onToggleVisibility, onToggleSuperGroup, onTextureFile, onRemoveTexture,
  onScreenshot,
}) {
  const [collapsed, setCollapsed] = useState({}); // { sgIndex: true/false }
  const hasSuperGroups = superGroups?.length > 0;

  const toggleCollapse = (sgIdx) => {
    setCollapsed(prev => ({ ...prev, [sgIdx]: !prev[sgIdx] }));
  };

  return (
    <div className="w-56 border-l border-slate-700 bg-slate-900 flex flex-col shrink-0 text-[11px]">
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

      {/* Mesh groups */}
      <div className="flex-1 min-h-0 flex flex-col">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-3 pt-3 pb-1">
          Mesh Groups ({meshInfos.length})
        </p>
        <ScrollArea className="flex-1 px-3 pb-3">
          <div className="space-y-1 pt-1">
            {hasSuperGroups ? (
              superGroups.map((sg, sgIdx) => {
                const isCollapsed = collapsed[sgIdx];
                const allVisible = sg.entries.every(e => meshInfos[e.meshIndex]?.visible);
                const noneVisible = sg.entries.every(e => !meshInfos[e.meshIndex]?.visible);
                return (
                  <div key={sg.superGroup + sgIdx}>
                    {/* Super-group header */}
                    <div className="flex items-center gap-1 py-1">
                      <button onClick={() => toggleCollapse(sgIdx)} className="text-slate-400 hover:text-slate-200 p-0.5">
                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <span className="text-slate-200 font-semibold flex-1 truncate text-[11px]" title={sg.superGroup}>
                        {sg.superGroup}
                      </span>
                      <span className="text-[9px] text-slate-500 mr-1">{sg.entries.length}</span>
                      <button
                        onClick={() => onToggleSuperGroup(sgIdx)}
                        className={`p-0.5 rounded transition-colors ${
                          allVisible ? 'text-blue-400 hover:bg-blue-500/20' :
                          noneVisible ? 'text-slate-500 hover:bg-slate-700' :
                          'text-blue-400/50 hover:bg-blue-500/10'
                        }`}
                        title={allVisible ? 'Hide all' : 'Show all'}
                      >
                        {noneVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                    {/* Child meshes */}
                    {!isCollapsed && (
                      <div className="ml-2 space-y-1 mb-1">
                        {sg.entries.map(entry => {
                          const info = meshInfos[entry.meshIndex];
                          if (!info) return null;
                          return (
                            <MeshGroupRow
                              key={info.name}
                              info={info}
                              index={entry.meshIndex}
                              flag={entry.flag}
                              onToggleVisibility={onToggleVisibility}
                              onTextureFile={onTextureFile}
                              onRemoveTexture={onRemoveTexture}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              meshInfos.map((info, idx) => (
                <MeshGroupRow
                  key={info.name}
                  info={info}
                  index={idx}
                  flag={-1}
                  onToggleVisibility={onToggleVisibility}
                  onTextureFile={onTextureFile}
                  onRemoveTexture={onRemoveTexture}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function MeshGroupRow({ info, index, flag = -1, onToggleVisibility, onTextureFile, onRemoveTexture }) {
  const inputRef = useRef(null);
  const flagLabel = flag === 1 ? 'always' : flag === 0 ? 'random' : null;

  return (
    <div className="bg-slate-800 rounded-lg p-2 space-y-1.5">
      {/* Name + flag + visibility toggle */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-slate-200 font-medium truncate flex-1" title={info.name}>{info.name}</span>
        {flagLabel && (
          <span className={`text-[9px] px-1 py-0.5 rounded ${flag === 1 ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
            {flagLabel}
          </span>
        )}
        <button onClick={() => onToggleVisibility(index)}
          className={`p-1 rounded transition-colors ${info.visible ? 'text-blue-400 hover:bg-blue-500/20' : 'text-slate-500 hover:bg-slate-700'}`}
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
              <span className="text-[10px]">Assign texture…</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}