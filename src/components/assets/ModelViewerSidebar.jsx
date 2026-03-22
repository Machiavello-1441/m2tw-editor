import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, RotateCw, Eye, EyeOff, Bone, Upload, ListTree } from 'lucide-react';

export default function ModelViewerSidebar({
  meshNames,
  visibleMeshes,
  onToggleMesh,
  isRotating,
  onToggleRotation,
  showSkeleton,
  onToggleSkeleton,
  hasJoints,
  onScreenshot,
  groupTextures,
  onLoadTexture,
}) {
  return (
    <div className="w-56 border-l border-slate-700 bg-slate-900/80 flex flex-col shrink-0 overflow-hidden">
      {/* Controls */}
      <div className="p-3 border-b border-slate-700 space-y-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Controls</p>
        <div className="flex items-center justify-between text-xs text-slate-200">
          <span className="flex items-center gap-1.5"><RotateCw className="w-3 h-3" /> Auto-rotate</span>
          <Switch checked={isRotating} onCheckedChange={onToggleRotation} className="scale-75" />
        </div>
        {hasJoints && (
          <div className="flex items-center justify-between text-xs text-slate-200">
            <span className="flex items-center gap-1.5"><Bone className="w-3 h-3" /> Skeleton</span>
            <Switch checked={showSkeleton} onCheckedChange={onToggleSkeleton} className="scale-75" />
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs border-slate-600 text-slate-200 hover:bg-slate-700 h-7" onClick={onScreenshot}>
          <Camera className="w-3 h-3" /> Screenshot (PNG)
        </Button>
      </div>

      {/* Mesh Groups */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
            <ListTree className="w-3 h-3" /> Groups ({meshNames.length})
          </p>
        </div>
        <ScrollArea className="flex-1 px-3 pb-3">
          <div className="space-y-1.5">
            {meshNames.map((name, idx) => (
              <MeshGroupRow
                key={name}
                name={name}
                visible={visibleMeshes[name] !== false}
                onToggle={() => onToggleMesh(name)}
                textureFile={groupTextures[name]}
                onLoadTexture={(file) => onLoadTexture(name, file)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function MeshGroupRow({ name, visible, onToggle, textureFile, onLoadTexture }) {
  const inputRef = useRef(null);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-200 truncate flex-1" title={name}>{name}</span>
        <button
          onClick={onToggle}
          className="ml-1.5 text-slate-400 hover:text-white transition-colors"
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => inputRef.current?.click()}
          className="flex-1 text-[9px] px-1.5 py-1 rounded border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors truncate text-left"
          title="Load .texture / .tga / .dds"
        >
          <Upload className="w-2.5 h-2.5 inline mr-1" />
          {textureFile ? textureFile : 'Texture…'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".texture,.tga,.dds"
          className="hidden"
          onChange={(e) => {
            if (e.target.files[0]) onLoadTexture(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}