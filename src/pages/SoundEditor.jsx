import React, { useState, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Music, FolderOpen, FileText, Download, Search,
  ChevronRight, Plus, Trash2, Save, Info, Volume2
} from 'lucide-react';

const KNOWN_SOUND_FILES = [
  { key: 'descr_sounds', label: 'Main Sounds', desc: 'General sound event definitions' },
  { key: 'descr_sounds_accents', label: 'Accents', desc: 'Accent/voice variety mappings' },
  { key: 'descr_sounds_advice', label: 'Advice', desc: 'Advisor voiceover events' },
  { key: 'descr_sounds_battle_events', label: 'Battle Events', desc: 'Battle event sounds' },
  { key: 'descr_sounds_engine', label: 'Engine', desc: 'Engine-level sound definitions' },
  { key: 'descr_sounds_enviro', label: 'Environment', desc: 'Environmental ambient sounds' },
  { key: 'descr_sounds_events', label: 'Events', desc: 'Campaign event sounds' },
  { key: 'descr_sounds_generic', label: 'Generic', desc: 'Generic/UI sounds' },
  { key: 'descr_sounds_interface', label: 'Interface', desc: 'UI/interface click sounds' },
  { key: 'descr_sounds_music', label: 'Music', desc: 'Music track definitions' },
  { key: 'descr_sounds_narration', label: 'Narration', desc: 'Campaign narration audio' },
  { key: 'descr_sounds_prebattle', label: 'Pre-Battle', desc: 'Pre-battle speech audio' },
  { key: 'descr_sounds_stratmap', label: 'Stratmap', desc: 'Strategy map ambient sounds' },
  { key: 'descr_sounds_stratmap_voice', label: 'Stratmap Voice', desc: 'Strategy map general voice' },
  { key: 'descr_sounds_structures', label: 'Structures', desc: 'Building/structure sounds' },
  { key: 'descr_sounds_units', label: 'Units', desc: 'Unit voice and sound effects' },
];

function parseSoundFile(text) {
  // Parse M2TW sound file format: blocks with identifiers and properties
  const blocks = [];
  const lines = text.split('\n');
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) {
      if (current) current.lines.push(line);
      else blocks.push({ type: 'comment', content: line });
      continue;
    }
    // Block opener (non-indented identifier)
    if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed !== '{' && trimmed !== '}') {
      if (current) blocks.push(current);
      current = { type: 'block', name: trimmed, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else {
      blocks.push({ type: 'raw', content: line });
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

export default function SoundEditor() {
  const [files, setFiles] = useState({}); // { key: rawText }
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDirty, setIsDirty] = useState({});
  const folderInputRef = useRef();

  const handleFolderLoad = useCallback(async (e) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    const newFiles = {};
    for (const f of fileList) {
      const lower = f.name.toLowerCase().replace('.txt', '');
      if (lower.startsWith('descr_sounds')) {
        const text = await f.text();
        newFiles[lower] = text;
      }
    }
    setFiles(prev => ({ ...prev, ...newFiles }));
    // Auto-select first loaded
    const firstKey = Object.keys(newFiles)[0];
    if (firstKey && !selectedFile) setSelectedFile(firstKey);
  }, [selectedFile]);

  const handleTextChange = (text) => {
    if (!selectedFile) return;
    setFiles(prev => ({ ...prev, [selectedFile]: text }));
    setIsDirty(prev => ({ ...prev, [selectedFile]: true }));
  };

  const handleDownload = (key) => {
    const text = files[key] || '';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setIsDirty(prev => ({ ...prev, [key]: false }));
  };

  const handleDownloadAll = () => {
    // Download as zip
    import('jszip').then(({ default: JSZip }) => {
      const zip = new JSZip();
      const folder = zip.folder('descr_sounds');
      Object.entries(files).forEach(([k, v]) => {
        folder.file(`${k}.txt`, v);
      });
      zip.generateAsync({ type: 'blob' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'descr_sounds.zip';
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  };

  const currentText = selectedFile ? (files[selectedFile] || '') : '';
  const filteredBlocks = selectedFile ? parseSoundFile(currentText).filter(b => {
    if (!searchTerm) return true;
    return (b.name || b.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.lines || []).some(l => l.toLowerCase().includes(searchTerm.toLowerCase()));
  }) : [];

  const loadedCount = Object.keys(files).length;
  const selectedInfo = KNOWN_SOUND_FILES.find(f => f.key === selectedFile);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
        <Music className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground">Sound Files Editor</span>
        <span className="text-[10px] text-muted-foreground">— descr_sounds_*.txt</span>
        <div className="ml-auto flex items-center gap-2">
          {loadedCount > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={handleDownloadAll}>
              <Download className="w-3.5 h-3.5" /> Export All ({loadedCount})
            </Button>
          )}
          <label className="cursor-pointer">
            <input ref={folderInputRef} type="file" className="hidden"
              webkitdirectory="" directory="" multiple onChange={handleFolderLoad} />
            <Button size="sm" asChild className="h-7 text-[11px] gap-1.5 pointer-events-none">
              <span><FolderOpen className="w-3.5 h-3.5" /> Load Sound Folder</span>
            </Button>
          </label>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* File list sidebar */}
        <div className="w-52 border-r border-border flex flex-col bg-card/30 shrink-0">
          <div className="p-2 border-b border-border">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1">
              Sound Files {loadedCount > 0 ? `(${loadedCount} loaded)` : ''}
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1 space-y-0.5">
              {KNOWN_SOUND_FILES.map(f => {
                const loaded = !!files[f.key];
                const dirty = isDirty[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() => loaded && setSelectedFile(f.key)}
                    className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors flex items-center gap-2 group ${selectedFile === f.key ? 'bg-primary/15 text-primary' : loaded ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 cursor-default'}`}
                  >
                    <Volume2 className={`w-3.5 h-3.5 shrink-0 ${loaded ? (selectedFile === f.key ? 'text-primary' : 'text-muted-foreground') : 'text-muted-foreground/30'}`} />
                    <span className="flex-1 truncate font-medium text-[11px]">{f.label}</span>
                    {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
                    {!loaded && <span className="text-[9px] text-muted-foreground/40">—</span>}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {loadedCount === 0 && (
            <div className="p-3 border-t border-border">
              <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                <span>Browse to <code className="font-mono">data/sounds/</code> to load sound definition files</span>
              </div>
            </div>
          )}
        </div>

        {/* Editor pane */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedFile || !files[selectedFile] ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <Music className="w-12 h-12 text-muted-foreground/20" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Load Sound Files</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Browse to your mod's <code className="font-mono text-[10px] bg-accent px-1 rounded">data/sounds/</code> folder to load and edit the M2TW sound definition files.
                </p>
              </div>
              <label className="cursor-pointer">
                <input type="file" className="hidden"
                  webkitdirectory="" directory="" multiple onChange={handleFolderLoad} />
                <Button asChild className="gap-2 pointer-events-none">
                  <span><FolderOpen className="w-4 h-4" /> Browse Sound Folder</span>
                </Button>
              </label>
              <div className="mt-2 text-[10px] text-muted-foreground">
                Reference files: <a href="https://github.com/RiritoNinigaya/M2TW-TextSoundFiles" target="_blank" rel="noreferrer" className="text-primary underline">RiritoNinigaya/M2TW-TextSoundFiles</a>
              </div>
            </div>
          ) : (
            <>
              {/* File toolbar */}
              <div className="border-b border-border px-3 py-1.5 flex items-center gap-2 shrink-0 bg-card/20">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-mono text-foreground">{selectedFile}.txt</span>
                {selectedInfo && <span className="text-[10px] text-muted-foreground">— {selectedInfo.desc}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  {isDirty[selectedFile] && (
                    <span className="text-[10px] text-amber-400">● Unsaved</span>
                  )}
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => handleDownload(selectedFile)}>
                    <Download className="w-3 h-3" /> Save File
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div className="border-b border-border px-3 py-1.5 flex items-center gap-2 shrink-0">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  className="flex-1 bg-transparent text-[11px] text-foreground placeholder-muted-foreground focus:outline-none"
                  placeholder="Search entries…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-[10px] text-muted-foreground hover:text-foreground">clear</button>
                )}
              </div>

              {/* Content: raw text editor with block highlights */}
              <div className="flex flex-1 min-h-0">
                {/* Raw editor */}
                <textarea
                  className="flex-1 bg-background font-mono text-[11px] text-foreground p-3 resize-none focus:outline-none border-r border-border"
                  value={currentText}
                  onChange={e => handleTextChange(e.target.value)}
                  spellCheck={false}
                  style={{ minHeight: 0 }}
                />

                {/* Block overview panel */}
                {!searchTerm && (
                  <div className="w-48 border-l border-border flex flex-col bg-card/10 shrink-0">
                    <div className="p-2 border-b border-border">
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Blocks ({parseSoundFile(currentText).filter(b => b.type === 'block').length})</p>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-1 space-y-0.5">
                        {parseSoundFile(currentText).filter(b => b.type === 'block').map((b, i) => (
                          <div key={i} className="px-2 py-1 rounded text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground cursor-default truncate font-mono">
                            {b.name}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="h-6 border-t border-border flex items-center px-3 gap-3 shrink-0 bg-card/30">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {currentText.split('\n').length} lines · {parseSoundFile(currentText).filter(b => b.type === 'block').length} blocks
                </span>
                {searchTerm && (
                  <span className="text-[10px] text-primary">{filteredBlocks.filter(b => b.type === 'block').length} matching</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}