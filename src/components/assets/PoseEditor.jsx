import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Trash2, ChevronRight, ChevronDown, Download } from 'lucide-react';

const DEG = Math.PI / 180;
const toDeg = (rad) => Math.round((rad / DEG) * 10) / 10;
const toRad = (deg) => deg * DEG;

export default function PoseEditor({ joints, poseRotations, onPoseChange, onReset }) {
  const [expanded, setExpanded] = useState({});
  const [saveName, setSaveName] = useState('');
  const [saveTags, setSaveTags] = useState('');
  const queryClient = useQueryClient();

  const { data: savedPoses = [] } = useQuery({
    queryKey: ['skeleton-poses'],
    queryFn: () => base44.entities.SkeletonPose.list('-created_date', 50),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.SkeletonPose.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skeleton-poses'] });
      setSaveName('');
      setSaveTags('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SkeletonPose.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skeleton-poses'] }),
  });

  const handleSave = () => {
    if (!saveName.trim()) return;
    const jointNames = joints.map(j => j.name);
    const tags = saveTags.split(',').map(t => t.trim()).filter(Boolean);
    saveMutation.mutate({
      name: saveName.trim(),
      joint_names: jointNames,
      rotations: poseRotations,
      tags,
    });
  };

  const handleLoad = (pose) => {
    onPoseChange(pose.rotations || {});
  };

  const handleBoneRotation = (boneIdx, axis, degValue) => {
    const current = poseRotations[boneIdx] || { rx: 0, ry: 0, rz: 0 };
    const updated = { ...current, [axis]: toRad(degValue) };
    // Clean up zero rotations
    if (Math.abs(updated.rx) < 0.001 && Math.abs(updated.ry) < 0.001 && Math.abs(updated.rz) < 0.001) {
      const next = { ...poseRotations };
      delete next[boneIdx];
      onPoseChange(next);
    } else {
      onPoseChange({ ...poseRotations, [boneIdx]: updated });
    }
  };

  const toggleBone = (idx) => {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (!joints?.length) {
    return (
      <div className="p-3 text-slate-500 text-xs text-center">
        No skeleton loaded. Import an .ms3d file with bones to use the pose editor.
      </div>
    );
  }

  // Build hierarchy for display
  const rootJoints = joints.map((j, i) => ({ ...j, index: i })).filter(j => j.parentIdx < 0);
  
  const renderBone = (joint, depth = 0) => {
    const idx = joint.index;
    const isExpanded = expanded[idx];
    const rot = poseRotations[idx] || { rx: 0, ry: 0, rz: 0 };
    const hasOverride = poseRotations[idx] !== undefined;
    const children = joints.map((j, i) => ({ ...j, index: i })).filter(j => j.parentIdx === idx);

    return (
      <div key={idx}>
        <div
          className={`flex items-center gap-1 py-0.5 cursor-pointer hover:bg-slate-800 rounded px-1 ${hasOverride ? 'text-yellow-300' : 'text-slate-300'}`}
          style={{ paddingLeft: depth * 12 + 4 }}
          onClick={() => toggleBone(idx)}
        >
          {children.length > 0 ? (
            isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
          ) : <span className="w-3" />}
          <span className="text-[11px] truncate flex-1">{joint.name}</span>
          {hasOverride && <span className="text-[9px] text-yellow-500">●</span>}
        </div>

        {isExpanded && (
          <div className="ml-4 mb-1 space-y-1 bg-slate-800/50 rounded p-2" style={{ marginLeft: depth * 12 + 16 }}>
            {['rx', 'ry', 'rz'].map(axis => (
              <div key={axis} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-5 uppercase">{axis.slice(1)}</span>
                <Slider
                  min={-180}
                  max={180}
                  step={1}
                  value={[toDeg(rot[axis] || 0)]}
                  onValueChange={([v]) => handleBoneRotation(idx, axis, v)}
                  className="flex-1"
                />
                <span className="text-[10px] text-slate-400 w-10 text-right font-mono">
                  {toDeg(rot[axis] || 0)}°
                </span>
              </div>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = { ...poseRotations };
                delete next[idx];
                onPoseChange(next);
              }}
              className="text-[10px] text-slate-500 hover:text-red-400 mt-0.5"
            >
              Reset bone
            </button>
          </div>
        )}

        {isExpanded && children.map(child => renderBone(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full text-[11px]">
      {/* Save section */}
      <div className="p-2.5 border-b border-slate-700 space-y-1.5">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Save Pose</p>
        <Input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Pose name…"
          className="h-6 text-[11px] bg-slate-800 border-slate-600"
        />
        <Input
          value={saveTags}
          onChange={(e) => setSaveTags(e.target.value)}
          placeholder="Tags (comma separated)…"
          className="h-6 text-[11px] bg-slate-800 border-slate-600"
        />
        <div className="flex gap-1.5">
          <Button size="sm" className="flex-1 h-6 text-[11px] gap-1 bg-green-700 hover:bg-green-600" onClick={handleSave}
            disabled={!saveName.trim() || saveMutation.isPending}>
            <Save className="w-3 h-3" /> Save
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1 border-slate-600" onClick={onReset}>
            <RotateCcw className="w-3 h-3" /> Reset All
          </Button>
        </div>
      </div>

      {/* Saved presets */}
      {savedPoses.length > 0 && (
        <div className="p-2.5 border-b border-slate-700 space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Saved Presets</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {savedPoses.map(pose => (
              <div key={pose.id} className="flex items-center gap-1 bg-slate-800 rounded px-2 py-1">
                <button onClick={() => handleLoad(pose)} className="flex-1 text-left text-slate-200 hover:text-white truncate text-[11px]">
                  {pose.name}
                </button>
                {pose.tags?.length > 0 && (
                  <span className="text-[9px] text-slate-500">{pose.tags.join(', ')}</span>
                )}
                <button onClick={() => deleteMutation.mutate(pose.id)} className="text-slate-500 hover:text-red-400 p-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bone hierarchy */}
      <div className="flex-1 min-h-0 flex flex-col">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-2.5 pt-2 pb-1">
          Bones ({joints.length})
        </p>
        <ScrollArea className="flex-1 px-2.5 pb-2">
          {rootJoints.map(j => renderBone(j))}
        </ScrollArea>
      </div>
    </div>
  );
}