import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FileText, Upload, Download, CheckCircle, AlertTriangle, XCircle, ChevronRight, ChevronDown, BookOpen, BookMarked, Sparkles } from 'lucide-react';
import { AUTOCOMPLETE_BY_PREFIX } from './scriptAutocomplete';
import ScriptTemplateSidebar from './ScriptTemplateSidebar';
import ScriptReferenceSidebar from './ScriptReferenceSidebar';
import ScriptAIAssistant from './ScriptAIAssistant';

/* ── tiny validator ──────────────────────────────────────────────────────── */
function validateScript(text, stratData) {
  const lines = text.split('\n');
  const errors = [], warnings = [], stack = [];
  const OPEN = ['monitor_event', 'monitor_conditions', 'if', 'while'];
  const CLOSE = { end_monitor: ['monitor_event','monitor_conditions'], end_if: ['if'], end_while: ['while'] };

  lines.forEach((raw, i) => {
    const l = raw.trim().toLowerCase();
    if (!l || /^(;|--)/.test(l)) return;
    const tok = l.split(/\s+/)[0];
    if (OPEN.includes(tok)) stack.push({ tok, ln: i + 1, raw: raw.trim() });
    else if (CLOSE[tok]) {
      if (!stack.length) errors.push({ line: i + 1, msg: `Unexpected \`${tok}\``, raw: raw.trim() });
      else { const top = stack.pop(); if (!CLOSE[tok].includes(top.tok)) errors.push({ line: i + 1, msg: `\`${tok}\` closes \`${top.tok}\` at line ${top.ln}`, raw: raw.trim() }); }
    }
    if (/^(endif|endmonitor|endwhile)$/.test(l)) warnings.push({ line: i + 1, msg: `Typo: use \`${l.replace('end','end_')}\``, raw: raw.trim() });
  });
  stack.forEach(o => errors.push({ line: o.ln, msg: `Unclosed \`${o.tok}\``, raw: o.raw }));

  const chars = new Set((stratData?.items || []).filter(x => x.category === 'character').map(x => (x.name || '').toLowerCase()));
  if (chars.size) lines.forEach((raw, i) => {
    const m = raw.trim().match(/CharacterName\s+(\S+)/i);
    if (m && !chars.has(m[1].toLowerCase())) warnings.push({ line: i + 1, msg: `Unknown character: "${m[1]}"`, raw: raw.trim() });
  });

  return { errors, warnings };
}

/* ── main component ──────────────────────────────────────────────────────── */
export default function ScriptingPanel({ stratData }) {
  const [text, setText]       = useState('');
  const [fileName, setFileName] = useState(null);
  const [validation, setValidation] = useState(null);
  const [showValid, setShowValid]   = useState(false);

  const [showTemplates, setShowTemplates] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const openSidebar = (name) => {
    setShowTemplates(name === 'templates');
    setShowReference(name === 'reference');
    setShowAI(name === 'ai');
  };

  // autocomplete
  const [acItems, setAcItems]     = useState([]);
  const [acIdx, setAcIdx]         = useState(0);
  const [acShow, setAcShow]       = useState(false);
  const [acPos, setAcPos]         = useState({ top: 0, left: 0 });

  const editorRef   = useRef(null);   // the scrollable wrapper div
  const textareaRef = useRef(null);
  const saveTimer   = useRef(null);

  /* restore */
  useEffect(() => {
    try {
      const c = localStorage.getItem('m2tw_campaign_script') || sessionStorage.getItem('m2tw_script_raw');
      if (c) { setText(c); setFileName('campaign_script.txt'); }
    } catch {}
  }, []);

  /* line count */
  const lineCount = useMemo(() => text ? text.split('\n').length : 1, [text]);

  /* build a single string for line numbers — avoids thousands of DOM nodes */
  const lineNumberText = useMemo(() => {
    const nums = [];
    for (let i = 1; i <= lineCount; i++) nums.push(i);
    return nums.join('\n');
  }, [lineCount]);

  /* debounced save */
  const save = useCallback((v) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem('m2tw_campaign_script', v); sessionStorage.setItem('m2tw_script_raw', v); } catch {}
    }, 2000);
  }, []);

  /* autocomplete helpers */
  const wordBefore = (val, cur) => { const m = val.slice(0, cur).match(/(\w+)$/); return m ? m[1] : ''; };

  const updateAcPos = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const lines = before.split('\n');
    const row = lines.length - 1;
    const col = lines[row].length;
    const lh = 20;
    setAcPos({ top: (row + 1) * lh + 4 - ta.scrollTop, left: Math.min(col * 7.22 + 8, 400) });
  }, []);

  const insertAc = useCallback((item) => {
    const ta = textareaRef.current; if (!ta) return;
    const cur = ta.selectionStart;
    const w = wordBefore(ta.value, cur);
    const ins = item.params ? `${item.label} ${item.params}` : item.label;
    const nv = ta.value.slice(0, cur - w.length) + ins + ta.value.slice(cur);
    setText(nv); save(nv); setAcShow(false);
    setTimeout(() => { ta.focus(); const p = cur - w.length + ins.length; ta.setSelectionRange(p, p); }, 0);
  }, [save]);

  /* onChange */
  const onChange = useCallback((e) => {
    const v = e.target.value;
    setText(v); setValidation(null); save(v);
    const w = wordBefore(v, e.target.selectionStart);
    if (w.length >= 2) {
      const m = AUTOCOMPLETE_BY_PREFIX(w);
      if (m.length) { setAcItems(m); setAcIdx(0); setAcShow(true); setTimeout(updateAcPos, 0); return; }
    }
    setAcShow(false);
  }, [save, updateAcPos]);

  /* onKeyDown */
  const onKey = useCallback((e) => {
    if (acShow) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(i => Math.min(i + 1, acItems.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAcIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertAc(acItems[acIdx]); return; }
      if (e.key === 'Escape') { setAcShow(false); return; }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target, s = ta.selectionStart;
      const nv = text.slice(0, s) + '  ' + text.slice(ta.selectionEnd);
      setText(nv); save(nv);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2; }, 0);
    }
  }, [acShow, acItems, acIdx, insertAc, text, save]);

  /* file I/O */
  const loadFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const t = await f.text();
    setText(t); setFileName(f.name); setValidation(null); setAcShow(false);
    try { localStorage.setItem('m2tw_campaign_script', t); sessionStorage.setItem('m2tw_script_raw', t); } catch {}
    e.target.value = '';
  };
  const exportFile = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = fileName || 'campaign_script.txt'; a.click();
  };
  const doValidate = () => { setValidation(validateScript(text, stratData)); setShowValid(true); };

  /* insert snippet at cursor (or end) */
  const insertSnippet = useCallback((code) => {
    const ta = textareaRef.current;
    const cur = ta ? ta.selectionStart : text.length;
    const before = text.slice(0, cur);
    const after  = text.slice(cur);
    const prefix = before.length && !before.endsWith('\n') ? '\n' : '';
    const suffix = after.length && !after.startsWith('\n') ? '\n' : '';
    const nv = before + prefix + code + suffix + after;
    setText(nv); save(nv);
    setTimeout(() => { if (ta) { ta.focus(); const p = cur + prefix.length + code.length; ta.setSelectionRange(p, p); } }, 0);
  }, [text, save]);

  const ec = validation?.errors.length ?? 0;
  const wc = validation?.warnings.length ?? 0;

  const TYPE_CLR = { keyword: 'text-purple-400', event: 'text-sky-400', command: 'text-green-400', condition: 'text-orange-400' };

  /* ── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <div className="h-full flex bg-slate-950 text-slate-200">
      <div className="flex-1 flex flex-col min-w-0" onClick={() => setAcShow(false)}>

        {/* toolbar */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800 shrink-0 bg-slate-900/60 flex-wrap">
          <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-[10px] font-semibold text-slate-300 mr-1">{fileName || 'campaign_script.txt'}</span>
          <label className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700">
            <Upload className="w-3 h-3" /> Load
            <input type="file" accept=".txt" className="hidden" onChange={loadFile} />
          </label>
          <button onClick={exportFile} disabled={!text} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 disabled:opacity-40">
            <Download className="w-3 h-3" /> Export
          </button>
          <div className="flex gap-1 ml-auto">
            <button onClick={() => openSidebar(showTemplates ? null : 'templates')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${showTemplates ? 'bg-violet-700/30 border-violet-500/40 text-violet-300' : 'bg-slate-800 border-slate-600/40 text-slate-300 hover:bg-slate-700'}`}>
              <BookOpen className="w-3 h-3" /> Templates
            </button>
            <button onClick={() => openSidebar(showReference ? null : 'reference')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${showReference ? 'bg-emerald-700/30 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-600/40 text-slate-300 hover:bg-slate-700'}`}>
              <BookMarked className="w-3 h-3" /> Reference
            </button>
            <button onClick={() => openSidebar(showAI ? null : 'ai')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${showAI ? 'bg-violet-700/30 border-violet-500/40 text-violet-300' : 'bg-slate-800 border-slate-600/40 text-slate-300 hover:bg-slate-700'}`}>
              <Sparkles className="w-3 h-3" /> AI
            </button>
          </div>
          <button onClick={doValidate} disabled={!text} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-violet-700/30 border border-violet-500/40 text-violet-300 hover:bg-violet-700/50 disabled:opacity-40">
            <CheckCircle className="w-3 h-3" /> Validate
          </button>
        </div>

        {/* validation */}
        {validation && (
          <div className="shrink-0 border-b border-slate-800 max-h-40 overflow-y-auto bg-slate-900/80">
            <button onClick={() => setShowValid(v => !v)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold hover:bg-slate-800/50">
              {showValid ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {ec === 0 && wc === 0
                ? <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Script OK</span></span>
                : <span className="flex items-center gap-2">
                    {ec > 0 && <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">{ec} error{ec > 1 ? 's' : ''}</span></span>}
                    {wc > 0 && <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400">{wc} warning{wc > 1 ? 's' : ''}</span></span>}
                  </span>
              }
            </button>
            {showValid && (
              <div className="px-3 pb-2 space-y-0.5">
                {validation.errors.map((e, i) => (
                  <div key={'e'+i} className="flex gap-2 text-[10px]"><span className="text-red-400 shrink-0">L{e.line}</span><span className="text-red-300">{e.msg}</span></div>
                ))}
                {validation.warnings.map((w, i) => (
                  <div key={'w'+i} className="flex gap-2 text-[10px]"><span className="text-amber-400 shrink-0">L{w.line}</span><span className="text-amber-300">{w.msg}</span></div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* editor */}
        {!text ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 p-6">
            <FileText className="w-8 h-8 opacity-30" />
            <p className="text-xs text-center">Load <code className="text-violet-400">campaign_script.txt</code></p>
            <label className="cursor-pointer px-3 py-1.5 rounded bg-violet-700/30 border border-violet-500/40 text-violet-300 hover:bg-violet-700/50 text-xs">
              <Upload className="w-3.5 h-3.5 inline mr-1" /> Load file
              <input type="file" accept=".txt" className="hidden" onChange={loadFile} />
            </label>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden relative" ref={editorRef} onClick={e => e.stopPropagation()}>
            <pre
              aria-hidden
              className="absolute left-0 top-0 w-12 select-none pointer-events-none text-right pr-2 border-r border-slate-800 bg-slate-900/70 z-10"
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 12,
                lineHeight: '20px',
                padding: '8px 6px 8px 0',
                color: '#475569',
                transform: 'translateY(0px)',
              }}
              id="script-line-nums"
            >
              {lineNumberText}
            </pre>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={onChange}
              onKeyDown={onKey}
              onScroll={() => {
                const ta = textareaRef.current;
                if (!ta) return;
                const gutter = document.getElementById('script-line-nums');
                if (gutter) gutter.style.transform = `translateY(${-ta.scrollTop}px)`;
              }}
              spellCheck={false}
              wrap="off"
              className="absolute inset-0 w-full h-full resize-none outline-none"
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 12,
                lineHeight: '20px',
                padding: '8px 8px 8px 56px',
                background: '#020617',
                color: '#cbd5e1',
                caretColor: '#94a3b8',
                whiteSpace: 'pre',
                tabSize: 2,
                overflowX: 'auto',
                overflowY: 'auto',
              }}
            />

            {acShow && acItems.length > 0 && (
              <div
                className="absolute z-50 bg-slate-800 border border-slate-600 rounded shadow-xl overflow-hidden"
                style={{ top: acPos.top, left: acPos.left + 56, minWidth: 240, maxWidth: 320 }}
                onMouseDown={e => e.preventDefault()}
              >
                {acItems.map((item, i) => (
                  <div key={item.label} onClick={() => insertAc(item)}
                    className={`flex items-start gap-2 px-2 py-1.5 cursor-pointer text-[11px] ${i === acIdx ? 'bg-slate-700' : 'hover:bg-slate-700/60'}`}>
                    <span className={`shrink-0 w-14 font-semibold text-[9px] uppercase pt-0.5 ${TYPE_CLR[item.type] || 'text-slate-400'}`}>{item.type}</span>
                    <div className="min-w-0">
                      <span className="text-slate-100 font-mono">{item.label}</span>
                      {item.params && <span className="text-slate-500 ml-1">{item.params}</span>}
                      {item.desc && <div className="text-slate-500 text-[10px] truncate">{item.desc}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* status bar */}
        {text && (
          <div className="shrink-0 flex items-center gap-3 px-2 py-1 border-t border-slate-800 bg-slate-900/40">
            <span className="text-[9px] text-slate-500">{lineCount} lines</span>
            <span className="text-[9px] text-slate-600 ml-auto">autosave ✓</span>
          </div>
        )}
      </div>

      {showTemplates && (
        <div onClick={e => e.stopPropagation()}>
          <ScriptTemplateSidebar
            onInsert={insertSnippet}
            onClose={() => setShowTemplates(false)}
          />
        </div>
      )}
      {showReference && (
        <div onClick={e => e.stopPropagation()}>
          <ScriptReferenceSidebar
            onInsert={insertSnippet}
            onClose={() => setShowReference(false)}
          />
        </div>
      )}
      {showAI && (
        <div onClick={e => e.stopPropagation()}>
          <ScriptAIAssistant
            onInsert={insertSnippet}
            onClose={() => setShowAI(false)}
          />
        </div>
      )}
    </div>
  );
}