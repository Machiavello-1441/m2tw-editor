import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function EditorSidebarToggle({ collapsed, onToggle }) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? 'Expand editor sidebar' : 'Collapse editor sidebar';
  return <div className="hidden border-b border-border p-2 lg:block">
    <button type="button" onClick={onToggle} title={label} aria-label={label}
      aria-expanded={!collapsed} aria-controls="editor-navigation"
      className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>Collapse sidebar</span>}
    </button>
  </div>;
}