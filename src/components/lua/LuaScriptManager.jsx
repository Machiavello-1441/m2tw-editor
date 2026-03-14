import React, { useState } from 'react';
import { Plus, Trash2, FileCode, CheckCircle2 } from 'lucide-react';

export default function LuaScriptManager({ scripts, activeId, onSelect, onAdd, onDelete, onRename }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const startRename = (s) => {
    setEditingId(s.id);
    setEditName(s.name);
  };

  const commitRename = () => {
    if (editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border flex items-center gap-2 shrink-0">
        <FileCode className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground flex-1">Scripts</span>
        <button
          onClick={onAdd}
          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="New script"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {scripts.map(s => (
          <div
            key={s.id}
            className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${activeId === s.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
            onClick={() => onSelect(s.id)}
          >
            <FileCode className={`w-3.5 h-3.5 shrink-0 ${s.type === 'imgui' ? 'text-purple-400' : s.id === 'plugin' ? 'text-primary' : 'text-muted-foreground'}`} />
            {editingId === s.id ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                onClick={e => e.stopPropagation()}
                className="flex-1 text-xs bg-background border border-primary rounded px-1 focus:outline-none"
              />
            ) : (
              <span
                className="flex-1 text-xs font-mono truncate"
                onDoubleClick={(e) => { e.stopPropagation(); startRename(s); }}
                title="Double-click to rename"
              >
                {s.name}
              </span>
            )}
            {s.id === 'plugin' && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0 opacity-70" title="Main plugin script" />}
            {s.type === 'imgui' && <span className="text-[9px] text-purple-400 font-mono shrink-0">GUI</span>}
            {s.id !== 'plugin' && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="text-primary font-mono">luaPluginScript.lua</span> is the EOP main entry point.<br />
          Double-click a script name to rename it.
        </p>
      </div>
    </div>
  );
}