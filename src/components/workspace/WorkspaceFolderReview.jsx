import React from 'react';
import { Button } from '@/components/ui/button';
import { workspaceEditors } from '@/components/workspace/workspaceFolderCatalog';

export default function WorkspaceFolderReview({ folders, selected, onSelect, onOpen, onCancel }) {
  const folder = folders[selected];
  return <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
    <h4 className="text-sm font-semibold">{folders.length > 1 ? 'Choose the mod to edit' : 'Folder found — open it to start editing'}</h4>
    {folders.length > 1 && <label className="block text-xs">Detected game / mod folders
      <select className="mt-1 w-full rounded-md border border-input bg-background p-2 text-foreground" value={selected} onChange={event => onSelect(Number(event.target.value))}>
        {folders.map((item, index) => <option key={item.prefix} value={index}>{item.name} · {item.files.length.toLocaleString()} files</option>)}
      </select>
    </label>}
    <p className="text-xs break-all"><strong>{folder.name}</strong> · {folder.files.length.toLocaleString()} files found<br />{folder.prefix}</p>
    <p className="text-xs text-muted-foreground">Available editors: {workspaceEditors(folder.files).map(editor => editor.label).join(', ')}. Images and file contents load only when needed.</p>
    <p className="text-xs text-muted-foreground">Opening this folder replaces current editor data. Export any unsaved edits first. Your installed mod will not be changed.</p>
    <div className="flex flex-wrap gap-2"><Button onClick={onOpen}>Open {folder.name}</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
  </div>;
}