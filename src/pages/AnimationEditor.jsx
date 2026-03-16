import React, { useState } from 'react';
import CasAnimParser from '@/components/anim/CasAnimParser';
import AnimInspector from '@/components/anim/AnimInspector';
import AnimBoneEditor from '@/components/anim/AnimBoneEditor';
import { Film, Info, Edit3 } from 'lucide-react';

const TABS = [
  { id: 'inspect', label: 'Inspect & Export', icon: Info },
  { id: 'edit', label: 'Edit Euler Angles', icon: Edit3 },
];

export default function AnimationEditor() {
  const [parsed, setParsed] = useState(null);
  const [tab, setTab] = useState('inspect');

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Film className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Animation Editor</h1>
          <p className="text-[11px] text-muted-foreground">Load .cas animation files — inspect, scale, or edit Euler angles</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Left: file loader */}
        <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
          <CasAnimParser onParsed={p => { setParsed(p); setTab('inspect'); }} />

          {!parsed && (
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 text-[11px] text-amber-300 space-y-2 leading-snug">
              <p className="font-semibold">Supported operations:</p>
              <ul className="list-disc list-inside space-y-1 text-amber-400/80">
                <li>Inspect .cas header, bones, frames</li>
                <li>Export readable .txt dump</li>
                <li>Scale animation data (ExportSkeleton)</li>
                <li>Edit per-bone Euler angles per frame</li>
                <li>Round-trip encode back to binary .cas</li>
              </ul>
              <p className="text-amber-500/70 mt-2">
                Based on KnightErrant's animationutilities v1.1 (2007).<br />
                Original Python required tkinter which no longer works.
              </p>
            </div>
          )}
        </div>

        {/* Right: tools */}
        {parsed && (
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* Tabs */}
            <div className="flex gap-2">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all ${tab === t.id ? 'bg-amber-900/40 border-amber-600 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === 'inspect' && <AnimInspector parsed={parsed} />}
              {tab === 'edit' && <AnimBoneEditor parsed={parsed} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}