import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Search, Copy, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

const CAT_LABELS = {
  monitor: 'Monitors',
  condition: 'Conditions',
  command: 'Commands',
  counter: 'Counters',
  loop: 'Loops',
  diplomacy: 'Diplomacy',
  spawn: 'Spawning',
  misc: 'Misc',
};

const CAT_COLORS = {
  monitor: 'bg-sky-500/20 text-sky-400',
  condition: 'bg-orange-500/20 text-orange-400',
  command: 'bg-green-500/20 text-green-400',
  counter: 'bg-violet-500/20 text-violet-400',
  loop: 'bg-yellow-500/20 text-yellow-400',
  diplomacy: 'bg-pink-500/20 text-pink-400',
  spawn: 'bg-red-500/20 text-red-400',
  misc: 'bg-slate-500/20 text-slate-400',
};

export default function ScriptTemplateSidebar({ onInsert, onClose }) {
  const [search, setSearch] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);
  const [previewId, setPreviewId] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['script-templates'],
    queryFn: () => base44.entities.ScriptTemplate.list(),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const cat = t.category || 'misc';
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    });
    return map;
  }, [filtered]);

  const toggleCat = (cat) => setExpandedCat(prev => prev === cat ? null : cat);

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-700 w-80">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-200">Script Templates</span>
          <span className="text-[9px] text-slate-500">{templates.length}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* search */}
      <div className="px-3 py-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800 border border-slate-700">
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="bg-transparent text-xs text-slate-200 outline-none w-full placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-6 flex justify-center">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-violet-400 rounded-full animate-spin" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">No templates found</div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-400 hover:bg-slate-800/50 border-b border-slate-800/50"
              >
                {expandedCat === cat ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${CAT_COLORS[cat] || CAT_COLORS.misc}`}>
                  {(CAT_LABELS[cat] || cat).toUpperCase()}
                </span>
                <span className="text-slate-600 ml-auto">{items.length}</span>
              </button>

              {expandedCat === cat && items.map(t => (
                <div
                  key={t.id}
                  className="border-b border-slate-800/30"
                >
                  <button
                    onClick={() => setPreviewId(prev => prev === t.id ? null : t.id)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-800/40"
                  >
                    <div className="text-[11px] font-medium text-slate-200">{t.title}</div>
                    {t.description && <div className="text-[10px] text-slate-500 mt-0.5">{t.description}</div>}
                  </button>

                  {previewId === t.id && (
                    <div className="px-4 pb-2">
                      <pre className="text-[10px] text-slate-400 bg-slate-950 rounded p-2 overflow-x-auto whitespace-pre max-h-40 border border-slate-800">
                        {t.code}
                      </pre>
                      <button
                        onClick={() => onInsert(t.code)}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                      >
                        <Copy className="w-3 h-3" /> Insert into Editor
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}