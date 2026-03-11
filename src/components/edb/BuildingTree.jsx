import React, { useState } from 'react';
import { useEDB } from './EDBContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronRight, ChevronDown, Castle, Layers, Plus, Trash2, Search
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog';

function BuildingNode({ building }) {
  const { selectedBuilding, setSelectedBuilding, selectedLevel, setSelectedLevel,
    deleteBuilding, addLevel, deleteLevel } = useEDB();
  const [expanded, setExpanded] = useState(selectedBuilding === building.name);
  const isSelected = selectedBuilding === building.name && !selectedLevel;

  const handleSelect = () => {
    setSelectedBuilding(building.name);
    setSelectedLevel(null);
    setExpanded(true);
  };

  return (
    <div className="mb-0.5">
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group text-sm transition-colors
          ${isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-accent text-foreground'}`}
      >
        <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-accent rounded">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <Castle className="w-3.5 h-3.5 text-primary/60 shrink-0" />
        <span onClick={handleSelect} className="flex-1 truncate font-medium text-xs">
          {building.name}
        </span>
        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
          {building.levels.length}L
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="p-0.5 hover:bg-destructive/20 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Building</AlertDialogTitle>
              <AlertDialogDescription>
                Delete "{building.name}" and all its levels? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteBuilding(building.name)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {expanded && (
        <div className="ml-4 pl-2 border-l border-border/50">
          {building.levels.map(level => {
            const isLevelSelected = selectedBuilding === building.name && selectedLevel === level.name;
            return (
              <div
                key={level.name}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer group text-xs transition-colors
                  ${isLevelSelected ? 'bg-primary/15 text-primary' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
                onClick={() => { setSelectedBuilding(building.name); setSelectedLevel(level.name); }}
              >
                <Layers className="w-3 h-3 shrink-0" />
                <span className="flex-1 truncate">{level.name}</span>
                <span className="text-[10px] opacity-60">{level.settlementType}</span>
                {building.levels.length > 1 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={e => e.stopPropagation()}
                        className="p-0.5 hover:bg-destructive/20 rounded opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-2.5 h-2.5 text-destructive" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Level</AlertDialogTitle>
                        <AlertDialogDescription>
                          Delete level "{level.name}"?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteLevel(building.name, level.name)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
          <button
            onClick={() => addLevel(building.name)}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-muted-foreground hover:text-primary transition-colors w-full"
          >
            <Plus className="w-2.5 h-2.5" /> Add Level
          </button>
        </div>
      )}
    </div>
  );
}

export default function BuildingTree() {
  const { edbData, addBuilding } = useEDB();
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!edbData) return null;

  const filtered = edbData.buildings.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.levels.some(l => l.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAddBuilding = () => {
    if (newName.trim()) {
      addBuilding(newName.trim().replace(/\s+/g, '_'));
      setNewName('');
      setDialogOpen(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex-1">Buildings</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Building</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="building_name (use underscores)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddBuilding()}
              />
              <DialogFooter>
                <Button onClick={handleAddBuilding} disabled={!newName.trim()}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs pl-7"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filtered.map(building => (
            <BuildingNode key={building.name} building={building} />
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No buildings found</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}