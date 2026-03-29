import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

const DEG = Math.PI / 180;
const toDeg = (rad) => Math.round(rad / DEG * 10) / 10;
const toRad = (deg) => deg * DEG;

export default function PoseEditor({ joints, poseRotations, onPoseChange, onReset }) {
  const [expanded, setExpanded] = useState({});
  const [saveName, setSaveName] = useState('');
  const [saveTags, setSaveTags] = useState('');
  const queryClient = useQueryClient();

  const { data: savedPoses = [] } = useQuery({
    queryKey: ['skeleton-poses'],
    queryFn: () => base44.entities.SkeletonPose.list('-created_date', 50)
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.SkeletonPose.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skeleton-poses'] });
      setSaveName('');
      setSaveTags('');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SkeletonPose.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skeleton-poses'] })
  });

  const handleSave = () => {
    if (!saveName.trim()) return;
    const jointNames = joints.map((j) => j.name);
    const tags = saveTags.split(',').map((t) => t.trim()).filter(Boolean);
    saveMutation.mutate({
      name: saveName.trim(),
      joint_names: jointNames,
      rotations: poseRotations,
      tags
    });
  };

  const handleLoad = (pose) => {
    onPoseChange(pose.rotations || {});
  };

  const handleBoneRotation = (boneIdx, axis, degValue) => {
    const current = poseRotations[boneIdx] || { rx: 0, ry: 0, rz: 0 };
    const updated = { ...current, [axis]: toRad(degValue) };
    if (Math.abs(updated.rx) < 0.001 && Math.abs(updated.ry) < 0.001 && Math.abs(updated.rz) < 0.001) {
      const next = { ...poseRotations };
      delete next[boneIdx];
      onPoseChange(next);
    } else {
      onPoseChange({ ...poseRotations, [boneIdx]: updated });
    }
  };

  const toggleBone = (idx) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (!joints?.length) {
    return (
      <div className="p-3 text-slate-500 text-xs text-center">
        No skeleton loaded. Import an .ms3d file with bones to use the pose editor.
      </div>);

  }

  // Build flat ordered list with depth info (for display indentation of names only)
  const { flatList } = React.useMemo(() => {
    const indexedJoints = joints.map((j, i) => ({ ...j, index: i }));
    const cMap = {};
    const roots = [];
    for (const j of indexedJoints) {
      if (j.parentIdx < 0) {
        roots.push(j);
      } else {
        if (!cMap[j.parentIdx]) cMap[j.parentIdx] = [];
        cMap[j.parentIdx].push(j);
      }
    }
    const list = [];
    const walk = (joint, depth) => {
      const children = cMap[joint.index] || [];
      list.push({ ...joint, depth, hasChildren: children.length > 0 });
      for (const child of children) walk(child, depth + 1);
    };
    for (const r of roots) walk(r, 0);
    return { flatList: list };
  }, [joints]);

  // Filter visible items: show all top-level items, and children only if their parent chain is expanded
  const visibleItems = React.useMemo(() => {
    const result = [];
    const depthStack = []; // track expanded state at each depth
    for (const item of flatList) {
      // An item is visible if all its ancestors are expanded
      // Check: for depth 0, always visible. For depth > 0, the item at depth-1 in the stack must be expanded
      if (item.depth === 0) {
        result.push(item);
        depthStack[0] = expanded[item.index];
      } else {
        // visible if all depths above are expanded
        let visible = true;
        for (let d = 0; d < item.depth; d++) {
          if (!depthStack[d]) {visible = false;break;}
        }
        if (visible) {
          result.push(item);
          depthStack[item.depth] = expanded[item.index];
        }
      }
    }
    return result;
  }, [flatList, expanded]);

  return (
    <div className="flex flex-col h-full text-[11px]">
      {/* Save section */}
      <div className="p-2.5 border-b border-slate-700 space-y-1.5">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Save Pose</p>
        <Input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Pose name…"
          className="h-6 text-[11px] bg-slate-800 border-slate-600" />
        
        <Input
          value={saveTags}
          onChange={(e) => setSaveTags(e.target.value)}
          placeholder="Tags (comma separated)…"
          className="h-6 text-[11px] bg-slate-800 border-slate-600" />
        
        <div className="flex gap-1.5">
          <Button size="sm" className="flex-1 h-6 text-[11px] gap-1 bg-green-700 hover:bg-green-600" onClick={handleSave}
          disabled={!saveName.trim() || saveMutation.isPending}>
            <Save className="w-3 h-3" /> Save
          </Button>
          <Button size="sm" variant="outline" className="bg-slate-700 text-[11px] px-3 font-medium rounded-md inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-6 gap-1 border-slate-600" onClick={onReset}>
            <RotateCcw className="w-3 h-3" /> Reset All
          </Button>
        </div>
      </div>

      {/* Saved presets */}
      {savedPoses.length > 0 &&
      <div className="p-2.5 border-b border-slate-700 space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Saved Presets</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {savedPoses.map((pose) =>
          <div key={pose.id} className="flex items-center gap-1 bg-slate-800 rounded px-2 py-1">
                <button onClick={() => handleLoad(pose)} className="flex-1 text-left text-slate-200 hover:text-white truncate text-[11px]">
                  {pose.name}
                </button>
                {pose.tags?.length > 0 &&
            <span className="text-[9px] text-slate-500">{pose.tags.join(', ')}</span>
            }
                <button onClick={() => deleteMutation.mutate(pose.id)} className="text-slate-500 hover:text-red-400 p-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
          )}
          </div>
        </div>
      }

      {/* Bone hierarchy — flat, no indent on sliders */}
      <div className="flex-1 min-h-0 flex flex-col">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-2.5 pt-2 pb-1">
          Bones ({joints.length})
        </p>
        <ScrollArea className="flex-1 px-2.5 pb-2">
          {visibleItems.map((item) => {
            const idx = item.index;
            const isExp = expanded[idx];
            const rot = poseRotations[idx] || { rx: 0, ry: 0, rz: 0 };
            const hasOverride = poseRotations[idx] !== undefined;

            return (
              <div key={idx}>
                {/* Bone name row — indent name only for hierarchy clarity */}
                <div
                  className={`flex items-center gap-1 py-0.5 cursor-pointer hover:bg-slate-800 rounded px-1 ${hasOverride ? 'text-yellow-300' : 'text-slate-300'}`}
                  onClick={() => toggleBone(idx)}>
                  
                  {item.hasChildren ?
                  isExp ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" /> :
                  <span className="w-3 shrink-0" />}
                  {item.depth > 0 &&
                  <span className="text-[8px] text-slate-600 shrink-0">{'·'.repeat(Math.min(item.depth, 4))}</span>
                  }
                  <span className="text-[11px] truncate flex-1">{item.name}</span>
                  {hasOverride && <span className="text-[9px] text-yellow-500">●</span>}
                </div>

                {/* Sliders — NO indent, full width */}
                {isExp &&
                <div className="mb-1 space-y-1 bg-slate-800/50 rounded p-2">
                    {['rx', 'ry', 'rz'].map((axis) =>
                  <BoneAxisSlider
                    key={axis}
                    axis={axis}
                    value={toDeg(rot[axis] || 0)}
                    onChange={(v) => handleBoneRotation(idx, axis, v)} />

                  )}
                    <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = { ...poseRotations };
                      delete next[idx];
                      onPoseChange(next);
                    }}
                    className="text-[10px] text-slate-500 hover:text-red-400 mt-0.5">
                    
                      Reset bone
                    </button>
                  </div>
                }
              </div>);

          })}
        </ScrollArea>
      </div>
    </div>);

}

function BoneAxisSlider({ axis, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const startEdit = () => {
    setEditText(String(value));
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const num = parseFloat(editText);
    if (!isNaN(num)) {
      onChange(Math.max(-180, Math.min(180, num)));
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-400 w-4 uppercase shrink-0">{axis.slice(1)}</span>
      <Slider
        min={-180}
        max={180}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="flex-1" />
      
      {editing ?
      <input
        type="number"
        autoFocus
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {if (e.key === 'Enter') commitEdit();if (e.key === 'Escape') setEditing(false);}}
        className="w-12 h-5 text-[10px] text-right font-mono bg-slate-700 border border-slate-500 rounded px-1 text-slate-200 outline-none" /> :


      <span
        className="w-12 text-[10px] text-slate-400 text-right font-mono cursor-pointer hover:text-slate-200 shrink-0"
        onClick={(e) => {e.stopPropagation();startEdit();}}
        title="Click to type a value">
        
          {value}°
        </span>
      }
    </div>);

}