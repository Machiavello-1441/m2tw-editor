import React, { useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Download, FileText, Image, Package, Eye, Copy, Check } from 'lucide-react';

export default function Export() {
  const { edbData, exportEDB, textData, imageData, fileName } = useEDB();
  const [preview, setPreview] = useState('');
  const [copied, setCopied] = useState(false);

  const handlePreview = () => {
    if (!edbData) return;
    const text = exportEDB();
    setPreview(text);
  };

  const handleDownloadEDB = () => {
    if (!edbData) return;
    const text = exportEDB();
    downloadFile(text, 'export_descr_buildings.txt', 'text/plain');
  };

  const handleDownloadTexts = () => {
    let text = '';
    for (const [key, value] of Object.entries(textData)) {
      text += `{${key}}${value}\n`;
    }
    downloadFile(text, 'export_buildings.txt', 'text/plain');
  };

  const handleCopy = () => {
    if (preview) {
      navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = edbData ? {
    buildings: edbData.buildings.length,
    levels: edbData.buildings.reduce((sum, b) => sum + b.levels.length, 0),
    hiddenResources: edbData.hiddenResources.length,
    textEntries: Object.keys(textData).length,
    images: Object.keys(imageData).length,
  } : null;

  return (
    <div className="h-screen flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
        <Download className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Export Mod</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          {!edbData ? (
            <div className="text-center text-sm text-muted-foreground py-20">
              No EDB data loaded. Go to the Editor to load a file first.
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Buildings', value: stats.buildings, color: 'text-primary' },
                  { label: 'Levels', value: stats.levels, color: 'text-chart-2' },
                  { label: 'Hidden Res.', value: stats.hiddenResources, color: 'text-chart-3' },
                  { label: 'Text Entries', value: stats.textEntries, color: 'text-chart-4' },
                  { label: 'Images', value: stats.images, color: 'text-chart-5' },
                ].map(stat => (
                  <Card key={stat.label}>
                    <CardContent className="p-3 text-center">
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Download buttons */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Download Files
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <FileText className="w-5 h-5 text-primary/60 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">export_descr_buildings.txt</p>
                      <p className="text-[10px] text-muted-foreground">
                        The main EDB file with all building definitions
                      </p>
                    </div>
                    <Button size="sm" className="h-7 text-xs" onClick={handleDownloadEDB}>
                      <Download className="w-3 h-3 mr-1" /> Download
                    </Button>
                  </div>

                  {Object.keys(textData).length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                      <FileText className="w-5 h-5 text-chart-4/60 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">export_buildings.txt</p>
                        <p className="text-[10px] text-muted-foreground">
                          Building names and descriptions ({Object.keys(textData).length} entries)
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleDownloadTexts}>
                        <Download className="w-3 h-3 mr-1" /> Download
                      </Button>
                    </div>
                  )}

                  {Object.keys(imageData).length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                      <Image className="w-5 h-5 text-chart-5/60 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Building Images</p>
                        <p className="text-[10px] text-muted-foreground">
                          {Object.keys(imageData).length} images uploaded. Download individually from the Image Manager.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{Object.keys(imageData).length} files</Badge>
                    </div>
                  )}

                  {/* Mod folder structure info */}
                  <div className="mt-4 p-3 rounded-lg border border-border">
                    <p className="text-xs font-semibold text-foreground mb-2">Expected Mod Folder Structure:</p>
                    <pre className="text-[10px] text-muted-foreground font-mono leading-relaxed">
{`your_mod/
├── data/
│   ├── export_descr_buildings.txt
│   ├── text/
│   │   └── export_buildings.txt
│   └── ui/
│       └── <culture>/
│           └── buildings/
│               ├── #<culture>_<building>.tga
│               ├── #<culture>_<building>_constructed.tga
│               └── construction/
│                   └── #<culture>_<building>.tga`}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    EDB Preview
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePreview}>
                        <Eye className="w-3 h-3 mr-1" /> Generate Preview
                      </Button>
                      {preview && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopy}>
                          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          {copied ? 'Copied!' : 'Copy'}
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  {preview ? (
                    <Textarea
                      className="font-mono text-[10px] min-h-[400px] bg-background"
                      value={preview}
                      readOnly
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Click "Generate Preview" to see the output file
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}