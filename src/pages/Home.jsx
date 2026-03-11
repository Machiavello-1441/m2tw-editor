import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useEDB } from '../components/edb/EDBContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Castle, FileText, Image, Download, ArrowRight, Sword } from 'lucide-react';

export default function Home() {
  const { loadEDB, edbData } = useEDB();
  const navigate = useNavigate();

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      loadEDB(ev.target.result, file.name);
      navigate(createPageUrl('EDBEditor'));
    };
    reader.readAsText(file);
  }, [loadEDB, navigate]);

  const steps = [
    { icon: Upload, title: 'Load EDB File', desc: 'Upload your export_descr_buildings.txt file to begin editing' },
    { icon: Castle, title: 'Edit Buildings', desc: 'Add, modify, or remove buildings and their levels using the visual editor' },
    { icon: FileText, title: 'Manage Texts', desc: 'Edit building titles, descriptions, and faction-specific entries' },
    { icon: Image, title: 'Manage Images', desc: 'Upload TGA images for building icons and construction views' },
    { icon: Download, title: 'Export Mod', desc: 'Download the complete mod package ready for M2TW' },
  ];

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <Sword className="w-3 h-3" />
            Medieval II: Total War Modding Tool
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            EDB Building Editor
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A visual editor for <code className="text-sm bg-accent px-1.5 py-0.5 rounded font-mono">export_descr_buildings.txt</code>. 
            Create and manage buildings with a powerful GUI instead of editing raw text files.
          </p>
        </div>

        {/* Upload Card */}
        <Card className="mb-10 border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {edbData ? 'File Loaded — Ready to Edit' : 'Load Your EDB File'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {edbData 
                ? `${edbData.buildings.length} buildings loaded. Click below to start editing.`
                : 'Select your export_descr_buildings.txt file to parse and load it into the editor.'
              }
            </p>
            <div className="flex items-center justify-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant={edbData ? 'outline' : 'default'} className="pointer-events-none">
                  <Upload className="w-4 h-4 mr-2" />
                  {edbData ? 'Load Different File' : 'Choose File'}
                </Button>
              </label>
              {edbData && (
                <Button onClick={() => navigate(createPageUrl('EDBEditor'))}>
                  Open Editor <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Workflow</h3>
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <step.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-primary font-mono">0{i + 1}</span>
                  <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}