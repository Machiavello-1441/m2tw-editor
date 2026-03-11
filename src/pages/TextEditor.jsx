import React, { useState, useCallback } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, ChevronRight, ChevronDown, Trash2, Castle, Layers, Eye } from 'lucide-react';
import { FACTIONS } from '../components/edb/EDBParser';

function BuildingTreeNav({ edbData, textData, selectedLevel, setSelectedLevel }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (name) => setExpanded(p => ({ ...p, [name]: !p[name] }));

  if (!edbData) return (
    <p className="text-xs text-muted-foreground text-center py-8 px-2">Load an EDB file first</p>
  );

  return (
    <div className="px-2 space-y-0.5">
      {edbData.buildings.map(building => {
        const isOpen = expanded[building.name] !== false; // open by default
        return (
          <div key={building.name} className="mb-0.5">
            <button
              onClick={() => toggle(building.name)}
              className="flex items-center gap-1 w-full px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {isOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
              <Castle className="w-3 h-3 text-primary/60 shrink-0" />
              <span className="truncate font-medium">{building.name}</span>
            </button>
            {isOpen && (
              <div className="ml-4 pl-2 border-l border-border/50 space-y-0.5">
                {building.levels.map(level => {
                  const hasText = !!textData[level.name];
                  return (
                    <button
                      key={level.name}
                      onClick={() => setSelectedLevel(level.name)}
                      className={`flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs transition-colors
                        ${selectedLevel === level.name ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                    >
                      <Layers className="w-3 h-3 shrink-0" />
                      <span className="flex-1 truncate">{level.name}</span>
                      {hasText && <span className="text-primary text-[8px]">●</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TextEditor() {
  const { edbData, textData, setTextData } = useEDB();
  const [selectedLevel, setSelectedLevel] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const handleLoadFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const entries = {};
      const lines = ev.target.result.split('\n');
      let currentKey = '';
      let currentText = '';
      for (const line of lines) {
        const match = line.match(/^\{([^}]+)\}/);
        if (match) {
          if (currentKey) entries[currentKey] = currentText.trim();
          currentKey = match[1];
          currentText = line.replace(/^\{[^}]+\}/, '').trim();
        } else if (currentKey) {
          currentText += '\n' + line;
        }
      }
      if (currentKey) entries[currentKey] = currentText.trim();
      setTextData(prev => ({ ...prev, ...entries }));
      setRawContent(ev.target.result);
      setLoaded(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setTextData]);

  const currentEntry = textData[selectedLevel] || '';
  const descKey = selectedLevel + '_desc';
  const shortDescKey = selectedLevel + '_desc_short';
  const currentDesc = textData[descKey] || '';
  const currentShortDesc = textData[shortDescKey] || '';

  const updateEntry = (key, value) => setTextData(prev => ({ ...prev, [key]: value }));

  const factionEntries = selectedLevel
    ? FACTIONS.filter(f => textData[selectedLevel + '_' + f])
    : [];

  const addFactionEntry = (faction) => {
    const key = selectedLevel + '_' + faction;
    if (!textData[key]) updateEntry(key, textData[selectedLevel] || '');
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Text Editor</span>
        <span className="text-[10px] text-muted-foreground">— export_buildings.txt</span>
        <div className="ml-auto flex items-center gap-2">
          {loaded && (
            <>
              <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/40">
                File loaded
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowRaw(!showRaw)}>
                <Eye className="w-3 h-3 mr-1" /> {showRaw ? 'Hide Raw' : 'View Raw'}
              </Button>
            </>
          )}
          <label className="cursor-pointer">
            <input type="file" accept=".txt" onChange={handleLoadFile} className="hidden" />
            <Button variant="outline" size="sm" className="h-7 text-xs pointer-events-none">
              <Upload className="w-3 h-3 mr-1" /> Load export_buildings.txt
            </Button>
          </label>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Building tree nav */}
        <div className="w-56 border-r border-border bg-card/30 shrink-0 flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Buildings</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="py-2">
              <BuildingTreeNav
                edbData={edbData}
                textData={textData}
                selectedLevel={selectedLevel}
                setSelectedLevel={setSelectedLevel}
              />
            </div>
          </ScrollArea>
        </div>

        {/* Editor */}
        <ScrollArea className="flex-1">
          <div className="p-4 max-w-2xl">
            {!selectedLevel ? (
              <div className="text-center text-sm text-muted-foreground py-20">
                {edbData
                  ? 'Select a building level to edit its text entries'
                  : 'Load an EDB file first, then optionally load export_buildings.txt to import existing text'
                }
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-foreground">{selectedLevel}</h2>

                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs">Title</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <Input className="h-8 text-xs" placeholder={`{${selectedLevel}}`}
                      value={textData[selectedLevel] || ''}
                      onChange={e => updateEntry(selectedLevel, e.target.value)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs">Long Description</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <Textarea className="text-xs min-h-24" placeholder={`{${descKey}}`}
                      value={currentDesc}
                      onChange={e => updateEntry(descKey, e.target.value)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs">Short Description</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <Textarea className="text-xs min-h-16" placeholder={`{${shortDescKey}}`}
                      value={currentShortDesc}
                      onChange={e => updateEntry(shortDescKey, e.target.value)}
                    />
                  </CardContent>
                </Card>

                {/* Faction-specific entries */}
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs flex items-center justify-between">
                      Faction-Specific Titles
                      <Select onValueChange={addFactionEntry}>
                        <SelectTrigger className="h-6 text-[10px] w-32">
                          <SelectValue placeholder="Add faction..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FACTIONS.map(f => (
                            <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    {factionEntries.map(faction => {
                      const key = selectedLevel + '_' + faction;
                      return (
                        <div key={faction} className="flex gap-2 items-center">
                          <Badge variant="outline" className="text-[10px] w-24 justify-center shrink-0">{faction}</Badge>
                          <Input className="h-7 text-xs flex-1" value={textData[key] || ''}
                            onChange={e => updateEntry(key, e.target.value)}
                          />
                          <button onClick={() => {
                            const newData = { ...textData };
                            delete newData[key];
                            setTextData(newData);
                          }} className="p-1 hover:bg-destructive/20 rounded">
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        </div>
                      );
                    })}
                    {factionEntries.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">No faction-specific entries. Use the dropdown to add one.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}