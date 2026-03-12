import React, { useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import { useRefData } from '../components/edb/RefDataContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageIcon, Upload, Trash2, Info, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Convert any browser-supported image to TGA and trigger download
async function downloadAsTGA(imageUrl, filename) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const pixels = imageData.data;
      const w = img.width, h = img.height;

      // TGA header (18 bytes)
      const header = new Uint8Array(18);
      header[2] = 2;           // uncompressed true-color
      header[12] = w & 0xff;
      header[13] = (w >> 8) & 0xff;
      header[14] = h & 0xff;
      header[15] = (h >> 8) & 0xff;
      header[16] = 32;         // 32 bits per pixel (BGRA)
      header[17] = 0x28;       // top-left origin + 8 bits alpha

      // Pixel data in BGRA order, flipped vertically (TGA is bottom-to-top by default but we set top-left flag)
      const pixelData = new Uint8Array(w * h * 4);
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const srcIdx = (row * w + col) * 4;
          const dstIdx = (row * w + col) * 4;
          pixelData[dstIdx + 0] = pixels[srcIdx + 2]; // B
          pixelData[dstIdx + 1] = pixels[srcIdx + 1]; // G
          pixelData[dstIdx + 2] = pixels[srcIdx + 0]; // R
          pixelData[dstIdx + 3] = pixels[srcIdx + 3]; // A
        }
      }

      const tgaData = new Uint8Array(18 + pixelData.length);
      tgaData.set(header, 0);
      tgaData.set(pixelData, 18);

      const blob = new Blob([tgaData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

const IMAGE_TYPES = [
  { id: 'icon', label: 'Small Icon', tgaSuffix: '' },
  { id: 'constructed', label: 'Large Info Pic', tgaSuffix: '_constructed' },
  { id: 'construction', label: 'Construction Scroll', tgaSuffix: '' },
];

export default function ImageManager() {
  const { edbData, imageData, setImageData } = useEDB();
  const { cultures } = useRefData();
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedCulture, setSelectedCulture] = useState('northern_european');
  const [uploading, setUploading] = useState({});
  const [converting, setConverting] = useState({});

  const allLevels = edbData ? edbData.buildings.flatMap(b => b.levels.map(l => l.name)) : [];
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
    setImageData(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  const handleDownloadTGA = async (key, imgType) => {
    const existing = imageData[key];
    if (!existing) return;
    setConverting(prev => ({ ...prev, [key]: true }));
    const baseName = selectedLevel;
    const tgaName = `${selectedCulture}_${baseName}${imgType.tgaSuffix}.tga`;
    await downloadAsTGA(existing.url, tgaName);
    setConverting(prev => ({ ...prev, [key]: false }));
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
        <ImageIcon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Image Manager</span>
        <span className="text-[10px] text-muted-foreground">— Upload JPG/PNG, download as TGA</span>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-56 border-r border-border bg-card/30 shrink-0 flex flex-col">
          <div className="p-3 space-y-2">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Culture</h3>
            <Select value={selectedCulture} onValueChange={setSelectedCulture}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cultures.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 space-y-0.5 pb-2">
              {allLevels.map(level => {
                const hasImages = IMAGE_TYPES.some(t => imageData[imageKey(level, selectedCulture, t.id)]);
                return (
                  <button key={level} onClick={() => setSelectedLevel(level)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors
                      ${selectedLevel === level ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                  >
                    {level}{hasImages && <span className="text-primary ml-1">●</span>}
                  </button>
                );
              })}
              {allLevels.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Load an EDB first</p>}
            </div>
          </ScrollArea>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 max-w-2xl">
            {!selectedLevel ? (
              <div className="text-center text-sm text-muted-foreground py-20">Select a building level to manage its images</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">{selectedLevel}</h2>
                  <Badge variant="outline" className="text-[10px]">{selectedCulture}</Badge>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Upload JPG or PNG images. Use the <strong>Download .TGA</strong> button to convert and save each image in TGA format ready for M2TW.
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
                          <span className="text-[10px] font-mono text-muted-foreground">{selectedCulture}_{selectedLevel}{imgType.tgaSuffix}.tga</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        {existing ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 p-2 bg-accent/50 rounded-lg">
                              <img src={existing.url} alt={imgType.label} className="w-16 h-16 object-contain rounded border border-border bg-black/20" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{existing.fileName}</p>
                                <p className="text-[10px] text-muted-foreground">Uploaded</p>
                              </div>
                              <div className="flex flex-col gap-1">
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                  onClick={() => handleDownloadTGA(key, imgType)}
                                  disabled={converting[key]}
                                >
                                  <Download className="w-3 h-3" />
                                  {converting[key] ? 'Converting...' : '.TGA'}
                                </Button>
                                <button onClick={() => removeImage(key)} className="p-1 hover:bg-destructive/20 rounded text-center">
                                  <Trash2 className="w-3 h-3 text-destructive mx-auto" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <input type="file" accept=".tga,.png,.jpg,.jpeg" className="hidden"
                              onChange={e => handleUpload(imgType.id, e.target.files?.[0])}
                            />
                            <div className="flex items-center justify-center gap-2 p-4 border border-dashed border-border rounded-lg hover:border-primary/40 transition-colors">
                              <Upload className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {uploading[key] ? 'Uploading...' : 'Click to upload JPG / PNG / TGA'}
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