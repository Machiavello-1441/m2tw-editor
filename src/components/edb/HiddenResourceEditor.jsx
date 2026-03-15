import React, { useState } from 'react';
import { useEDB } from './EDBContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database, Plus, X } from 'lucide-react';

export default function HiddenResourceEditor() {
  const { edbData, setEdbData } = useEDB();
  const [newResource, setNewResource] = useState('');
  const [open, setOpen] = useState(false);

  if (!edbData) return null;
  const resources = edbData.hiddenResources || [];

  const addResource = () => {
    const name = newResource.trim().replace(/\s+/g, '_');
    if (!name || resources.includes(name)) return;
    setEdbData((prev) => ({ ...prev, hiddenResources: [...prev.hiddenResources, name] }));
    setNewResource('');
  };

  const removeResource = (res) => {
    setEdbData((prev) => ({ ...prev, hiddenResources: prev.hiddenResources.filter((r) => r !== res) }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-slate-50 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-7 gap-1">
          <Database className="w-3 h-3" />
          <span className="hidden xl:inline">Hidden Resources</span>
          <span className="text-[10px] text-muted-foreground">({resources.length})</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Database className="w-4 h-4 text-primary" />
            Hidden Resources ({resources.length})
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Input
            className="h-8 text-xs flex-1"
            placeholder="new_resource_name"
            value={newResource}
            onChange={(e) => setNewResource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addResource()} />

          <Button size="sm" className="h-8" onClick={addResource} disabled={!newResource.trim()}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
        <ScrollArea className="h-72">
          <div className="grid grid-cols-2 gap-1">
            {resources.map((res) =>
            <div key={res} className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent/40 group">
                <span className="text-[10px] font-mono flex-1 truncate">{res}</span>
                <button
                onClick={() => removeResource(res)}
                className="p-0.5 rounded hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">

                  <X className="w-2.5 h-2.5 text-destructive" />
                </button>
              </div>
            )}
            {resources.length === 0 &&
            <p className="col-span-2 text-xs text-muted-foreground text-center py-4">No hidden resources defined</p>
            }
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>);

}