import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FolderOpen } from 'lucide-react';
import { fileListMount } from './sceneryFiles';

export default function SceneryFolders({ mounts, onPick, onError }) {
  const fallback = useRef(null), selected = useRef('mod');
  const pick = async kind => {
    selected.current = kind;
    if (!window.showDirectoryPicker) { fallback.current.click(); return; }
    try {
      const handle = await window.showDirectoryPicker({ id: 'scenery-' + kind, mode: kind === 'mod' ? 'readwrite' : 'read' });
      onPick(kind, handle);
    } catch (error) { if (error.name !== 'AbortError') onError(error.message); }
  };
  return <div className="flex flex-wrap gap-2">
    {['mod', 'game', 'library'].map(kind => <Button key={kind} variant="outline" size="sm" onClick={() => pick(kind)}>
      <FolderOpen className="mr-2 h-4 w-4" />{kind === 'mod' ? 'Mod folder' : kind === 'game' ? 'Game folder' : 'Extra library'}{mounts[kind] ? ': ' + mounts[kind].name : ''}
    </Button>)}
    <Button variant="ghost" size="sm" onClick={() => { selected.current = 'mod'; fallback.current.click(); }}>Use folder import / ZIP export</Button>
    <input aria-label="Import scenery folder" ref={fallback} type="file" webkitdirectory="" multiple hidden onChange={event => {
      if (event.target.files.length) onPick(selected.current, fileListMount([...event.target.files]));
      event.target.value = '';
    }} />
  </div>;
}
