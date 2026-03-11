import React, { useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import { CULTURES } from '../components/edb/EDBParser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ImageIcon, Upload, FileImage, Trash2, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ImageManager() {
  const { edbData, imageData, setImageData } = useEDB();
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedCulture, setSelectedCulture] = useState('northern_european');
  const [uploading, setUploading] = useState({});

  const allLevels = edbData
    ? edbData.buildings.flatMap(b => b.levels.map(l => l.name))
    : [];

  const imageKey = (level, culture, type) => `${level}_${culture}_${type}`;

  const handleUpload = async (type, file) => {
    if (!file || !selectedLevel) return;
    const key = imageKey(selectedLevel, selectedCulture, type);
    setUploading(prev => ({ ...prev, [key]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageData(prev => ({ ...prev, [key]: { url: file_url, fileName: file.name, type, culture: selectedCulture, level: selectedLevel } }));
    setUploading(prev => ({ ...prev, [key]: false }));
  };

  const removeImage = (key) => {
    setImageData(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const IMAGE_TYPES = [
    { id: 'icon', label: 'Small Icon', desc: '#<culture>_<building>.tga', folder: 'data/ui/<culture>/buildings/' },
    { id: 'constructed', label: 'Large Info Pic', desc: '#<culture>_<building>_constructed.tga', folder: 'data/ui/<culture>/buildings/' },
    { id: 'construction', label: 'Construction Scroll', desc: '#<culture>_<building>.tga', folder: 'data/ui/<culture>/buildings/construction/' },
  ];

  return (
    <div className="h-screen flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
        <Image className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Image Manager</span>
        <span className="text-[10px] text-muted-foreground">— Building images & icons</span>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Level selector */}
        <div className="w-56 border-r border-border bg-card/30 shrink-0">
          <div className="p-3 space-y-2">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Building Levels</h3>
            <Select value={selectedCulture} onValueChange={setSelectedCulture}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CULTURES.map(c => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="px-2 space-y-0.5">
              {allLevels.map(level => {
                const hasImages = IMAGE_TYPES.some(t => imageData[imageKey(level, selectedCulture, t.id)]);
                return (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors
                      ${selectedLevel === level ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                  >
                    {level}
                    {hasImages && <span className="text-primary ml-1">●</span>}
                  </button>
                );
              })}
              {allLevels.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Load an EDB file first</p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Image editor */}
        <ScrollArea className="flex-1">
          <div className="p-4 max-w-2xl">
            {!selectedLevel ? (
              <div className="text-center text-sm text-muted-foreground py-20">
                Select a building level and culture to manage its images
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">{selectedLevel}</h2>
                  <Badge variant="outline" className="text-[10px]">{selectedCulture}</Badge>
                </div>

                {/* Info */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Each building level needs 3 images per culture: a small icon, a large info pic (with "_constructed" suffix), 
                    and a construction scroll image. Images should be .tga format.
                  </p>
                </div>

                {IMAGE_TYPES.map(imgType => {
                  const key = imageKey(selectedLevel, selectedCulture, imgType.id);
                  const existing = imageData[key];
                  return (
                    <Card key={imgType.id}>
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-xs flex items-center justify-between">
                          <span>{imgType.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{imgType.desc}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p className="text-[10px] text-muted-foreground mb-2">
                          Path: {imgType.folder.replace('<culture>', selectedCulture)}
                        </p>
                        {existing ? (
                          <div className="flex items-center gap-3 p-2 bg-accent/50 rounded-lg">
                            <FileImage className="w-8 h-8 text-primary/60" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-foreground">{existing.fileName}</p>
                              <p className="text-[10px] text-muted-foreground">Uploaded</p>
                            </div>
                            <button onClick={() => removeImage(key)} className="p-1 hover:bg-destructive/20 rounded">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".tga,.png,.jpg,.jpeg"
                              className="hidden"
                              onChange={e => handleUpload(imgType.id, e.target.files?.[0])}
                            />
                            <div className="flex items-center justify-center gap-2 p-4 border border-dashed border-border rounded-lg hover:border-primary/40 transition-colors">
                              <Upload className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {uploading[key] ? 'Uploading...' : 'Click to upload image'}
                              </span>
                            </div>
                          </label>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}