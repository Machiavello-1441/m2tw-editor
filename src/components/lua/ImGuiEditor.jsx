import React, { useState } from 'react';
import { IMGUI_SNIPPETS } from './m2tweop_api';
import LuaCodeEditor from './LuaCodeEditor';
import { Layers, Plus, Copy, CheckCircle2 } from 'lucide-react';

export default function ImGuiEditor({ value, onChange }) {
  const [copied, setCopied] = useState(false);

  const copySnippet = (code) => {
    onChange(value + '\n\n' + code);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Layers className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-semibold text-foreground">ImGUI Script Editor</span>
        <span className="text-[10px] text-muted-foreground ml-1">— rendered via onImGuiRender()</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded border border-border hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            {copied ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Snippets */}
      <div className="shrink-0 space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Quick snippets — append to editor</p>
        <div className="grid grid-cols-2 gap-1.5">
          {IMGUI_SNIPPETS.map(s => (
            <button
              key={s.label}
              onClick={() => copySnippet(s.code)}
              className="flex items-start gap-2 p-2 rounded-lg border border-border hover:border-purple-500/40 hover:bg-purple-500/5 transition-all text-left"
            >
              <Plus className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-purple-500/20">
        <LuaCodeEditor value={value} onChange={onChange} height="100%" />
      </div>

      <div className="shrink-0 p-2 rounded-lg bg-purple-500/5 border border-purple-500/20">
        <p className="text-[10px] text-purple-300/70 leading-relaxed">
          The ImGUI script runs every frame inside <code className="font-mono bg-accent px-1 rounded">onImGuiRender()</code>.
          When exporting, this script is merged into <code className="font-mono bg-accent px-1 rounded">luaPluginScript.lua</code>.
        </p>
      </div>
    </div>
  );
}