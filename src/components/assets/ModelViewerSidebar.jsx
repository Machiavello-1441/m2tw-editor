import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, RotateCw, Pause, Eye, EyeOff, Bone, ImageIcon, X, ChevronRight, ChevronDown, Grid3x3, Sun, Wrench } from 'lucide-react';

export default function ModelViewerSidebar({
  isRotating, onToggleRotation,
  showSkeleton, onToggleSkeleton, hasSkeleton,
  showWireframe, onToggleWireframe,
  lightingPreset, onLightingChange, lightingPresets,
  onFixNormals,
  meshInfos, superGroups, onToggleVisibility, onToggleSuperGroup,
  onTextureFile, onRemoveTexture,
  onNormalMapFile, onRemoveNormalMap,
  onSpecularMapFile, onRemoveSpecularMap,
  onScreenshot,
}) {
  const [collapsed, setCollapsed] = useState({});
  const hasSuperGroups = superGroups?.length > 0;

  const toggleCollapse = (sgIdx) => {
    setCollapsed(prev => ({ ...prev, [sgIdx]: !prev[sgIdx] }));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 text-[11px]">
      {/* Controls */}
      <div className="p-2.5 border-b border-slate-700 space-y-1">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Controls</p>

        <button
          onClick={onToggleRotation}
          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
            isRotating ? 'bg-blue-600/30 text-blue-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {isRotating ? <Pause className="w-3 h-3" /> : <RotateCw className="w-3 h-3" />}
          {isRotating ? 'Stop Rotation' : 'Start Rotation'}
        </button>

        <button
          onClick={onToggleWireframe}
          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
            showWireframe ? 'bg-purple-600/30 text-purple-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Grid3x3 className="w-3 h-3" />
          {showWireframe ? 'Hide Wireframe' : 'Show Wireframe'}
        </button>

        <button
          onClick={onToggleSkeleton}
          disabled={!hasSkeleton}
          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
            !hasSkeleton ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500' :
            showSkeleton ? 'bg-green-600/30 text-green-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Bone className="w-3 h-3" />
          {hasSkeleton ? (showSkeleton ? 'Hide Skeleton' : 'Show Skeleton') : 'No Skeleton'}
        </button>
      </div>

      {/* Lighting */}
      <div className="p-2.5 border-b border-slate-700 space-y-1">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
          <Sun className="w-3 h-3" /> Lighting
        </p>
        <div className="grid grid-cols-2 gap-1">
          {lightingPresets && Object.entries(lightingPresets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => onLightingChange(key)}
              className={`px-2 py-1 rounded text-[10px] transition-colors ${
                lightingPreset === key
                  ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-600/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-transparent'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div className="p-2.5 border-b border-slate-700 space-y-1">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Tools</p>
        <button
          onClick={onFixNormals}
          className="w-full flex items-center gap-2 px-2 py-1 rounded text-left bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          title="Recompute vertex normals from face geometry to fix shading artifacts"
        >
          <Wrench className="w-3 h-3" />
          Fix Normals
        </button>
        <Button size="sm" variant="outline"
          className="w-full gap-2 border-slate-600 text-slate-200 hover:bg-slate-700 h-6 text-[11px]"
          onClick={onScreenshot}
        >
          <Camera className="w-3 h-3" /> Screenshot
        </Button>
      </div>

      {/* Mesh groups */}
      <div className="flex-1 min-h-0 flex flex-col">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-2.5 pt-2 pb-1">
          Mesh Groups ({meshInfos.length})
        </p>
        <ScrollArea className="flex-1 px-2.5 pb-2">
          <div className="space-y-1 pt-1">
            {hasSuperGroups ? (
              superGroups.map((sg, sgIdx) => {
                const isCollapsed = collapsed[sgIdx];
                const allVisible = sg.entries.every(e => meshInfos[e.meshIndex]?.visible);
                const noneVisible = sg.entries.every(e => !meshInfos[e.meshIndex]?.visible);
                return (
                  <div key={sg.superGroup + sgIdx}>
                    <div className="flex items-center gap-1 py-0.5">
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
                              onNormalMapFile={onNormalMapFile}
                              onRemoveNormalMap={onRemoveNormalMap}
                              onSpecularMapFile={onSpecularMapFile}
                              onRemoveSpecularMap={onRemoveSpecularMap}
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
                  onNormalMapFile={onNormalMapFile}
                  onRemoveNormalMap={onRemoveNormalMap}
                  onSpecularMapFile={onSpecularMapFile}
                  onRemoveSpecularMap={onRemoveSpecularMap}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function TextureSlot({ label, fileName, onFile, onRemove, accept = ".texture,.tga,.dds" }) {
  const inputRef = useRef(null);
  return (
    <div className="flex items-center gap-1 h-5" style={{ overflow: 'hidden', maxWidth: '100%' }}>
      <span className="text-[9px] text-slate-500" style={{ flexShrink: 0, width: 22 }}>{label}</span>
      {fileName ? (
        <div className="flex items-center gap-0.5" style={{ minWidth: 0, flex: '1 1 0%', overflow: 'hidden' }}>
          <div className="flex items-center gap-0.5 bg-slate-700 rounded px-1 py-0.5" style={{ minWidth: 0, flex: '1 1 0%', overflow: 'hidden' }}>
            <ImageIcon className="w-2.5 h-2.5 text-green-400" style={{ flexShrink: 0 }} />
            <span className="text-green-300 text-[9px] block" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }} title={fileName}>{fileName}</span>
          </div>
          <button onClick={onRemove} className="text-slate-500 hover:text-red-400" style={{ flexShrink: 0, padding: 2 }}>
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        <>
          <input ref={inputRef} type="file" className="hidden" accept={accept}
            onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }} />
          <button onClick={() => inputRef.current?.click()}
            className="flex-1 flex items-center gap-0.5 bg-slate-700 hover:bg-slate-600 rounded px-1 py-0.5 text-slate-400 transition-colors min-w-0">
            <ImageIcon className="w-2.5 h-2.5 shrink-0" />
            <span className="text-[9px] truncate">Assign…</span>
          </button>
        </>
      )}
    </div>
  );
}

function MeshGroupRow({ info, index, flag = -1, onToggleVisibility, onTextureFile, onRemoveTexture, onNormalMapFile, onRemoveNormalMap, onSpecularMapFile, onRemoveSpecularMap }) {
  const flagLabel = flag === 1 ? 'always' : flag === 0 ? 'random' : null;

  return (
    <div className="bg-slate-800 rounded p-1.5 space-y-0.5 overflow-hidden">
      {/* Header row — always same height */}
      <div className="flex items-center gap-1 h-5" style={{ overflow: 'hidden' }}>
        <span className="text-slate-200 font-medium text-[10px] block truncate" style={{ minWidth: 0, flex: '1 1 0%' }} title={info.name}>{info.name}</span>
        {flagLabel && (
          <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${flag === 1 ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
            {flagLabel}
          </span>
        )}
        <button onClick={() => onToggleVisibility(index)}
          className={`p-0.5 rounded transition-colors shrink-0 ${info.visible ? 'text-blue-400 hover:bg-blue-500/20' : 'text-slate-500 hover:bg-slate-700'}`}
        >
          {info.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
      </div>

      {/* Texture slots — always present, fixed height each */}
      <TextureSlot
        label="Tex"
        fileName={info.textureFile}
        onFile={(file) => onTextureFile(index, file)}
        onRemove={() => onRemoveTexture(index)}
      />
      <TextureSlot
        label="Nrm"
        fileName={info.normalMapFile}
        onFile={(file) => onNormalMapFile(index, file)}
        onRemove={() => onRemoveNormalMap(index)}
      />
      <TextureSlot
        label="Spc"
        fileName={info.specularMapFile}
        onFile={(file) => onSpecularMapFile(index, file)}
        onRemove={() => onRemoveSpecularMap(index)}
      />
    </div>
  );
}