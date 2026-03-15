import React, { useState, useCallback, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Download, Copy, CheckCircle2, Code2, Info, Sparkles } from 'lucide-react';
import LuaCodeEditor from '../components/lua/LuaCodeEditor';
import LuaApiReference from '../components/lua/LuaApiReference';
import LuaScriptManager from '../components/lua/LuaScriptManager';
import ImGuiEditor from '../components/lua/ImGuiEditor';
import LuaAiAssistant from '../components/lua/LuaAiAssistant';
import { DEFAULT_PLUGIN_SCRIPT, DEFAULT_IMGUI_SCRIPT } from '../components/lua/m2tweop_api';

const STORAGE_KEY = 'm2tw_lua_scripts';

function loadScripts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [
    { id: 'plugin', name: 'luaPluginScript.lua', type: 'plugin', code: DEFAULT_PLUGIN_SCRIPT },
    { id: 'imgui_main', name: 'imgui_overlay.lua', type: 'imgui', code: DEFAULT_IMGUI_SCRIPT },
  ];
}

function saveScripts(scripts) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts)); } catch {}
}

export default function LuaScripts() {
  const [scripts, setScripts] = useState(loadScripts);
  const [activeId, setActiveId] = useState('plugin');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'imgui' | 'api'

  useEffect(() => {
    const handler = () => {
      const reloaded = loadScripts();
      setScripts(reloaded);
      setActiveId(reloaded[0]?.id || '');
    };
    window.addEventListener('lua-scripts-loaded', handler);
    return () => window.removeEventListener('lua-scripts-loaded', handler);
  }, []);

  const activeScript = scripts.find(s => s.id === activeId) || scripts[0];
  const activeIsImgui = activeScript?.type === 'imgui';

  const updateCode = useCallback((code) => {
    setScripts(prev => {
      const updated = prev.map(s => s.id === activeId ? { ...s, code } : s);
      saveScripts(updated);
      return updated;
    });
  }, [activeId]);

  const handleAdd = () => {
    const id = `script_${Date.now()}`;
    const newScript = { id, name: `script_${scripts.length + 1}.lua`, type: 'custom', code: '-- New script\n\n' };
    const updated = [...scripts, newScript];
    setScripts(updated);
    saveScripts(updated);
    setActiveId(id);
  };

  const handleDelete = (id) => {
    const updated = scripts.filter(s => s.id !== id);
    setScripts(updated);
    saveScripts(updated);
    if (activeId === id) setActiveId(updated[0]?.id || '');
  };

  const handleRename = (id, name) => {
    const updated = scripts.map(s => s.id === id ? { ...s, name } : s);
    setScripts(updated);
    saveScripts(updated);
  };

  const handleInsertFromRef = (text) => {
    updateCode((activeScript?.code || '') + '\n' + text);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeScript?.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([activeScript.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeScript.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    // Download the plugin script (merge imgui into it if present)
    const pluginScript = scripts.find(s => s.id === 'plugin');
    const imguiScripts = scripts.filter(s => s.type === 'imgui');
    const customScripts = scripts.filter(s => s.type === 'custom');

    let merged = pluginScript ? pluginScript.code : '';
    if (imguiScripts.length > 0) {
      merged += '\n\n-- ═══ ImGUI Scripts ═══\n';
      imguiScripts.forEach(s => { merged += `\n-- ${s.name}\n${s.code}`; });
    }
    if (customScripts.length > 0) {
      merged += '\n\n-- ═══ Custom Scripts ═══\n';
      customScripts.forEach(s => { merged += `\n-- ${s.name}\n${s.code}`; });
    }

    const blob = new Blob([merged], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'luaPluginScript.lua';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-2 shrink-0 bg-card/50">
        <Code2 className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground">Lua Scripts</span>
        <span className="text-[10px] text-muted-foreground font-mono">— M2TWEOP EOP Plugin</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            {copied ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownloadScript}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3 h-3" />
            This file
          </button>
          <Button size="sm" className="h-7 text-[11px] gap-1.5" onClick={handleDownloadAll}>
            <Download className="w-3.5 h-3.5" />
            Download luaPluginScript.lua
          </Button>
        </div>
      </div>

      {/* Body — 3 panels */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Script manager */}
        <div className="w-44 lg:w-52 border-r border-border shrink-0 flex flex-col">
          <LuaScriptManager
            scripts={scripts}
            activeId={activeId}
            onSelect={(id) => { setActiveId(id); setActiveTab('editor'); }}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </div>

        {/* Center: Editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-border shrink-0 px-2 h-9">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 h-full text-[11px] font-medium border-b-2 transition-colors ${activeTab === 'editor' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {activeScript?.name || 'Editor'}
            </button>
            {activeIsImgui && (
              <button
                onClick={() => setActiveTab('imgui')}
                className={`px-3 h-full text-[11px] font-medium border-b-2 transition-colors ${activeTab === 'imgui' ? 'border-purple-400 text-purple-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                ImGUI Builder
              </button>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-0 p-2">
            {activeTab === 'imgui' && activeIsImgui ? (
              <ImGuiEditor value={activeScript.code} onChange={updateCode} />
            ) : (
              <LuaCodeEditor value={activeScript?.code || ''} onChange={updateCode} height="100%" />
            )}
          </div>

          {/* Footer info */}
          <div className="h-7 border-t border-border flex items-center px-3 gap-3 shrink-0 bg-card/30">
            <Info className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Place <code className="font-mono bg-accent px-1 rounded">luaPluginScript.lua</code> at{' '}
              <code className="font-mono bg-accent px-1 rounded">&lt;mod&gt;/eopData/eopScripts/</code>
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">
              {(activeScript?.code || '').split('\n').length} lines
            </span>
          </div>
        </div>

        {/* Right: API Reference / AI Assistant */}
        <div className="w-72 xl:w-80 border-l border-border shrink-0 flex flex-col">
          {/* Tab toggle */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setActiveTab('api')}
              className={`flex-1 py-1.5 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${activeTab !== 'ai' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
            >
              API Reference
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-1.5 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${activeTab === 'ai' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Sparkles className="w-3 h-3" /> AI Assistant
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'ai'
              ? <LuaAiAssistant onInsert={handleInsertFromRef} />
              : <LuaApiReference onInsert={handleInsertFromRef} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}