import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FolderOpen, X, ChevronRight, ChevronDown, FileText, Folder, CheckSquare, Square, Minus, Download } from 'lucide-react';

/**
 * Builds a tree structure from a flat list of File objects.
 * Returns { name, path, children: {}, files: [] }
 */
function buildTree(files) {
  const root = { name: '', path: '', children: {}, files: [] };
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node.children[part]) {
        node.children[part] = { name: part, path: parts.slice(0, i + 1).join('/'), children: {}, files: [] };
      }
      node = node.children[part];
    }
    node.files.push(file);
  }
  return root;
}

/** Collect all file paths under a node (recursively). */
function collectPaths(node) {
  const paths = new Set();
  for (const f of node.files) paths.add(f.webkitRelativePath || f.name);
  for (const child of Object.values(node.children)) {
    for (const p of collectPaths(child)) paths.add(p);
  }
  return paths;
}

/** Count selected files under a node. Returns { selected, total } */
function countSelected(node, selectedPaths) {
  let selected = 0, total = 0;
  for (const f of node.files) {
    total++;
    if (selectedPaths.has(f.webkitRelativePath || f.name)) selected++;
  }
  for (const child of Object.values(node.children)) {
    const c = countSelected(child, selectedPaths);
    selected += c.selected; total += c.total;
  }
  return { selected, total };
}

function TreeNode({ node, selectedPaths, onTogglePaths, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const childNodes = Object.values(node.children);
  const hasContent = childNodes.length > 0 || node.files.length > 0;
  if (!hasContent && !node.name) return null;

  const { selected, total } = countSelected(node, selectedPaths);
  const allSelected = total > 0 && selected === total;
  const partial = selected > 0 && selected < total;

  const handleCheck = (e) => {
    e.stopPropagation();
    const paths = collectPaths(node);
    onTogglePaths(paths, !allSelected);
  };

  const CheckIcon = allSelected ? CheckSquare : partial ? Minus : Square;
  const checkColor = allSelected ? 'text-amber-400' : partial ? 'text-amber-600' : 'text-slate-600';

  if (!node.name) {
    // Root node — just render children
    return (
      <div>
        {childNodes.sort((a, b) => a.name.localeCompare(b.name)).map(child => (
          <TreeNode key={child.name} node={child} selectedPaths={selectedPaths} onTogglePaths={onTogglePaths} depth={depth} />
        ))}
        {node.files.map(f => (
          <FileLeaf key={f.webkitRelativePath || f.name} file={f} selectedPaths={selectedPaths} onTogglePaths={onTogglePaths} depth={depth} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button onClick={handleCheck} className={`shrink-0 ${checkColor} hover:text-amber-300 transition-colors`}>
          <CheckIcon className="w-3 h-3" />
        </button>
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 flex-1 min-w-0 text-left">
          {open ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />}
          <Folder className="w-3 h-3 text-amber-500/70 shrink-0" />
          <span className="text-[10px] text-slate-300 truncate">{node.name}</span>
          <span className="text-[9px] text-slate-600 ml-1 shrink-0">{selected}/{total}</span>
        </button>
      </div>
      {open && (
        <div>
          {childNodes.sort((a, b) => a.name.localeCompare(b.name)).map(child => (
            <TreeNode key={child.name} node={child} selectedPaths={selectedPaths} onTogglePaths={onTogglePaths} depth={depth + 1} />
          ))}
          {node.files.map(f => (
            <FileLeaf key={f.webkitRelativePath || f.name} file={f} selectedPaths={selectedPaths} onTogglePaths={onTogglePaths} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileLeaf({ file, selectedPaths, onTogglePaths, depth }) {
  const path = file.webkitRelativePath || file.name;
  const selected = selectedPaths.has(path);
  const sizeKb = (file.size / 1024).toFixed(0);

  return (
    <div
      className={`flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer select-none ${selected ? 'bg-amber-900/20' : 'hover:bg-slate-800/30'}`}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
      onClick={() => onTogglePaths(new Set([path]), !selected)}
    >
      <div className={`shrink-0 transition-colors ${selected ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}>
        {selected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
      </div>
      <span className="w-3 shrink-0" />
      <FileText className="w-3 h-3 text-slate-500 shrink-0" />
      <span className={`text-[10px] truncate flex-1 font-mono ${selected ? 'text-slate-200' : 'text-slate-400'}`}>
        {file.name}
      </span>
      <span className="text-[9px] text-slate-600 shrink-0">{sizeKb}KB</span>
    </div>
  );
}

/**
 * CampaignPackagePicker
 * Props:
 *   selectedFiles: Map<relativePath, File>
 *   onChange: (newMap: Map<relativePath, File>) => void
 */
export default function CampaignPackagePicker({ selectedFiles, onChange }) {
  const [allFiles, setAllFiles] = useState([]); // all loaded File objects
  const [tree, setTree] = useState(null);
  const folderRef = useRef();
  const fileRef = useRef();

  const selectedPaths = new Set(selectedFiles.keys());

  const loadFiles = useCallback((newFiles) => {
    setAllFiles(prev => {
      const combined = [...prev];
      const existingPaths = new Set(prev.map(f => f.webkitRelativePath || f.name));
      for (const f of newFiles) {
        const p = f.webkitRelativePath || f.name;
        if (!existingPaths.has(p)) { combined.push(f); existingPaths.add(p); }
      }
      return combined;
    });
  }, []);

  // Derive tree from allFiles — avoids nested setState inside updater (React 18 strict-mode safe)
  useEffect(() => {
    setTree(allFiles.length > 0 ? buildTree(allFiles) : null);
  }, [allFiles]);

  const handleFolderLoad = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    loadFiles(files);
    // Auto-select all newly added files
    const updated = new Map(selectedFiles);
    for (const f of files) updated.set(f.webkitRelativePath || f.name, f);
    onChange(updated);
    // Defer reset so the browser finishes processing the change event
    setTimeout(() => { e.target.value = ''; }, 0);
  };

  const handleFilesLoad = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    loadFiles(files);
    const updated = new Map(selectedFiles);
    for (const f of files) updated.set(f.webkitRelativePath || f.name, f);
    onChange(updated);
    setTimeout(() => { e.target.value = ''; }, 0);
  };

  const handleTogglePaths = useCallback((paths, select) => {
    const updated = new Map(selectedFiles);
    const fileByPath = new Map(allFiles.map(f => [f.webkitRelativePath || f.name, f]));
    for (const p of paths) {
      if (select) {
        const f = fileByPath.get(p);
        if (f) updated.set(p, f);
      } else {
        updated.delete(p);
      }
    }
    onChange(updated);
  }, [selectedFiles, allFiles, onChange]);

  const handleClear = () => {
    setAllFiles([]);
    setTree(null);
    onChange(new Map());
  };

  const totalSize = [...selectedFiles.values()].reduce((s, f) => s + f.size, 0);
  const sizeMb = (totalSize / 1024 / 1024).toFixed(2);

  return (
    <div className="space-y-2">
      {/* Buttons row */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => folderRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          <FolderOpen className="w-3 h-3" /> Add folder
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          <FileText className="w-3 h-3" /> Add files
        </button>
        {allFiles.length > 0 && (
          <button onClick={handleClear}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-red-800/40 text-red-400 hover:bg-red-950/30 transition-colors ml-auto">
            <X className="w-3 h-3" /> Clear all
          </button>
        )}
        <input ref={folderRef} type="file" className="hidden" webkitdirectory="" multiple onChange={handleFolderLoad} />
        <input ref={fileRef} type="file" className="hidden" multiple onChange={handleFilesLoad} />
      </div>

      {/* Stats */}
      {allFiles.length > 0 && (
        <div className="flex items-center gap-3 text-[9px] text-slate-500 px-1">
          <span>{allFiles.length} files loaded</span>
          <span className="text-amber-400 font-semibold">{selectedFiles.size} selected ({sizeMb} MB)</span>
        </div>
      )}

      {/* Tree */}
      {tree ? (
        <div className="border border-slate-700/40 rounded bg-slate-900/30 max-h-64 overflow-y-auto">
          <TreeNode node={tree} selectedPaths={selectedPaths} onTogglePaths={handleTogglePaths} depth={0} />
        </div>
      ) : (
        <div className="border border-dashed border-slate-700/50 rounded p-4 text-center text-[10px] text-slate-600">
          Add a folder or individual files to include them in the export zip.
          <br />
          <span className="text-[9px]">e.g. your campaign map folder, custom textures, etc.</span>
        </div>
      )}
    </div>
  );
}