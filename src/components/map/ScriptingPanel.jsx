import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileText, Upload, Download, CheckCircle, AlertTriangle, XCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { AUTOCOMPLETE_BY_PREFIX } from './scriptAutocomplete';

// ── Validator ────────────────────────────────────────────────────────────────
function validateScript(text, stratData) {
  const lines = text.split('\n');
  const errors = [];
  const warnings = [];
  const stack = [];
  const OPEN_TOKENS  = ['monitor_event', 'monitor_conditions', 'if', 'while'];
  const CLOSE_TOKENS = { 'end_monitor': ['monitor_event','monitor_conditions'], 'end_if': ['if'], 'end_while': ['while'] };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim().toLowerCase();
    if (!line || /^(;|--)/.test(line)) return;
    const firstToken = line.split(/\s+/)[0];
    if (OPEN_TOKENS.includes(firstToken)) {
      stack.push({ token: firstToken, line: idx + 1, raw: rawLine.trim() });
    } else if (CLOSE_TOKENS[firstToken]) {
      if (stack.length === 0) {
        errors.push({ line: idx + 1, msg: `Unexpected \`${firstToken}\` — no matching open block`, raw: rawLine.trim() });
      } else {
        const top = stack[stack.length - 1];
        if (!CLOSE_TOKENS[firstToken].includes(top.token)) {
          errors.push({ line: idx + 1, msg: `\`${firstToken}\` closes \`${top.token}\` opened at line ${top.line} — mismatched block type`, raw: rawLine.trim() });
        }
        stack.pop();
      }
    }
  });

  for (const open of stack) {
    errors.push({ line: open.line, msg: `Unclosed \`${open.token}\` block (opened at line ${open.line})`, raw: open.raw });
  }

  const knownChars = new Set(
    (stratData?.items || []).filter(i => i.category === 'character').map(i => (i.name || '').toLowerCase())
  );
  if (knownChars.size > 0) {
    lines.forEach((rawLine, idx) => {
      const cm = rawLine.trim().match(/CharacterName\s+(\S+)/i);
      if (cm && !knownChars.has(cm[1].toLowerCase())) {
        warnings.push({ line: idx + 1, msg: `Unknown character name: "${cm[1]}"`, raw: rawLine.trim() });
      }
    });
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim().toLowerCase();
    if (line === 'endif' || line === 'endmonitor' || line === 'endwhile') {
      warnings.push({ line: idx + 1, msg: `Possible typo: use \`${line.replace('end','end_')}\` instead of \`${line}\``, raw: rawLine.trim() });
    }
  });

  return { errors, warnings };
}

// ── Autocomplete helpers ──────────────────────────────────────────────────────
function getWordBeforeCursor(text, cursorPos) {
  const before = text.slice(0, cursorPos);
  const match = before.match(/(\w+)$/);
  return match ? match[1] : '';
}

const TYPE_COLORS = {
  keyword:   'text-purple-400',
  event:     'text-sky-400',
  command:   'text-green-400',
  condition: 'text-orange-400',
};

const LINE_H = 20; // px — must match textarea line-height

// ── Component ─────────────────────────────────────────────────────────────────
export default function ScriptingPanel({ stratData }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  // Autocomplete state
  const [acItems, setAcItems] = useState([]);
  const [acIndex, setAcIndex] = useState(0);
  const [acVisible, setAcVisible] = useState(false);
  const [acPos, setAcPos] = useState({ top: 0, left: 0 });

  const textareaRef = useRef(null);
  const lineNumRef  = useRef(null);
  const fileInputRef = useRef(null);
  const autosaveTimer = useRef(null);
  const acRef = useRef(null);

  // ── Restore from storage ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const cached = localStorage.getItem('m2tw_campaign_script') || sessionStorage.getItem('m2tw_script_raw');
      if (cached) { setText(cached); setFileName('campaign_script.txt'); }
    } catch {}
  }, []);

  // ── Sync line numbers scroll ───────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setScrollTop(ta.scrollTop);
    if (lineNumRef.current) lineNumRef.current.scrollTop = ta.scrollTop;
  }, []);

  // ── Debounced autosave ─────────────────────────────────────────────────────
  const scheduleAutosave = useCallback((val) => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem('m2tw_campaign_script', val);
        sessionStorage.setItem('m2tw_script_raw', val);
      } catch {}
    }, 2000);
  }, []);

  // ── Autocomplete positioning ───────────────────────────────────────────────
  const updateAcPosition = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(ta);
    ['padding','border','font','lineHeight','whiteSpace','wordBreak','overflowWrap','tabSize'].forEach(p => {
      mirror.style[p] = style[p];
    });
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '0', width: ta.offsetWidth + 'px', height: 'auto', overflow: 'hidden', whiteSpace: 'pre' });
    const cursor = ta.selectionStart;
    mirror.textContent = ta.value.slice(0, cursor);
    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);
    document.body.appendChild(mirror);
    const taRect = ta.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    document.body.removeChild(mirror);
    const containerRect = ta.parentElement.getBoundingClientRect();
    setAcPos({
      top:  spanRect.bottom - containerRect.top + ta.scrollTop - (spanRect.top - taRect.top) + 4,
      left: Math.min(spanRect.left - containerRect.left, containerRect.width - 260),
    });
  }, []);

  // ── Handle text change ─────────────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setText(val);
    setValidationResult(null);
    scheduleAutosave(val);

    const cursor = e.target.selectionStart;
    const word = getWordBeforeCursor(val, cursor);
    if (word.length >= 2) {
      const matches = AUTOCOMPLETE_BY_PREFIX(word);
      if (matches.length > 0) {
        setAcItems(matches); setAcIndex(0); setAcVisible(true);
        setTimeout(updateAcPosition, 0);
      } else { setAcVisible(false); }
    } else { setAcVisible(false); }
  }, [scheduleAutosave, updateAcPosition]);

  // ── Insert autocomplete suggestion ────────────────────────────────────────
  const insertSuggestion = useCallback((item) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const val = ta.value;
    const word = getWordBeforeCursor(val, cursor);
    const insert = item.params ? `${item.label} ${item.params}` : item.label;
    const newVal = val.slice(0, cursor - word.length) + insert + val.slice(cursor);
    setText(newVal);
    scheduleAutosave(newVal);
    setAcVisible(false);
    setTimeout(() => {
      ta.focus();
      const newCursor = cursor - word.length + insert.length;
      ta.setSelectionRange(newCursor, newCursor);
    }, 0);
  }, [scheduleAutosave]);

  // ── Keyboard handling ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (acVisible) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex(i => Math.min(i + 1, acItems.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAcIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertSuggestion(acItems[acIndex]); return; }
      if (e.key === 'Escape') { setAcVisible(false); return; }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const s = ta.selectionStart;
      const v = text.substring(0, s) + '  ' + text.substring(ta.selectionEnd);
      setText(v);
      scheduleAutosave(v);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2; }, 0);
    }
  }, [acVisible, acItems, acIndex, insertSuggestion, text, scheduleAutosave]);

  // ── File I/O ───────────────────────────────────────────────────────────────
  const handleLoad = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const t = await file.text();
    setText(t);
    setFileName(file.name);
    try { localStorage.setItem('m2tw_campaign_script', t); sessionStorage.setItem('m2tw_script_raw', t); } catch {}
    setValidationResult(null);
    setAcVisible(false);
    e.target.value = '';
  };

  const handleExport = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName || 'campaign_script.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidate = () => {
    setValidationResult(validateScript(text, stratData));
    setShowValidation(true);
  };

  // ── Line numbers ───────────────────────────────────────────────────────────
  const lineCount = text ? text.split('\n').length : 1;

  const errCount  = validationResult?.errors.length  ?? 0;
  const warnCount = validationResult?.warnings.length ?? 0;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200" onClick={() => setAcVisible(false)}>

      {/* Header bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800 shrink-0 bg-slate-900/60 flex-wrap">
        <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span className="text-[10px] font-semibold text-slate-300 mr-1">{fileName || 'campaign_script.txt'}</span>
        <label className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <Upload className="w-3 h-3" /> Load
          <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleLoad} />
        </label>
        <button onClick={handleExport} disabled={!text} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors">
          <Download className="w-3 h-3" /> Export
        </button>
        <button onClick={handleValidate} disabled={!text} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-violet-700/30 border border-violet-500/40 text-violet-300 hover:bg-violet-700/50 disabled:opacity-40 transition-colors ml-auto">
          <CheckCircle className="w-3 h-3" /> Validate
        </button>
      </div>

      {/* Validation panel */}
      {validationResult && (
        <div className="shrink-0 border-b border-slate-800 max-h-40 overflow-y-auto bg-slate-900/80">
          <button onClick={() => setShowValidation(v => !v)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold hover:bg-slate-800/50">
            {showValidation ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {errCount === 0 && warnCount === 0
              ? <><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Script OK — no issues found</span></>
              : <>
                  {errCount > 0  && <><XCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">{errCount} error{errCount > 1 ? 's' : ''}</span></>}
                  {warnCount > 0 && <><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400">{warnCount} warning{warnCount > 1 ? 's' : ''}</span></>}
                </>
            }
          </button>
          {showValidation && (
            <div className="px-3 pb-2 space-y-0.5">
              {validationResult.errors.map((e, i) => (
                <div key={i} className="flex gap-2 text-[10px]"><span className="text-red-400 shrink-0">L{e.line}</span><span className="text-red-300">{e.msg}</span></div>
              ))}
              {validationResult.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-[10px]"><span className="text-amber-400 shrink-0">L{w.line}</span><span className="text-amber-300">{w.msg}</span></div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor area */}
      {!text ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 p-6">
          <FileText className="w-8 h-8 opacity-30" />
          <p className="text-xs text-center">Load <code className="text-violet-400">campaign_script.txt</code> to begin editing</p>
          <label className="cursor-pointer px-3 py-1.5 rounded bg-violet-700/30 border border-violet-500/40 text-violet-300 hover:bg-violet-700/50 text-xs transition-colors">
            <Upload className="w-3.5 h-3.5 inline mr-1" /> Load campaign_script.txt
            <input type="file" accept=".txt" className="hidden" onChange={handleLoad} />
          </label>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* Line numbers */}
          <div
            ref={lineNumRef}
            className="shrink-0 w-10 overflow-hidden bg-slate-900/60 border-r border-slate-800 select-none"
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', lineHeight: `${LINE_H}px` }}
          >
            <div style={{ paddingTop: 8, paddingBottom: 8, paddingRight: 6, textAlign: 'right' }}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1} style={{ height: LINE_H, color: '#475569', lineHeight: `${LINE_H}px` }}>{i + 1}</div>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="flex-1 relative" onClick={e => e.stopPropagation()}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              wrap="off"
              className="absolute inset-0 w-full h-full resize-none outline-none overflow-auto"
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: '12px',
                lineHeight: `${LINE_H}px`,
                padding: '8px',
                background: 'transparent',
                color: '#cbd5e1',
                caretColor: '#94a3b8',
                whiteSpace: 'pre',
                tabSize: 2,
              }}
            />

            {/* Autocomplete dropdown */}
            {acVisible && acItems.length > 0 && (
              <div
                ref={acRef}
                className="absolute z-50 bg-slate-800 border border-slate-600 rounded shadow-xl overflow-hidden"
                style={{ top: acPos.top, left: acPos.left, minWidth: 240, maxWidth: 320 }}
                onMouseDown={e => e.preventDefault()}
              >
                {acItems.map((item, idx) => (
                  <div
                    key={item.label}
                    onClick={() => insertSuggestion(item)}
                    className={`flex items-start gap-2 px-2 py-1.5 cursor-pointer text-[11px] ${idx === acIndex ? 'bg-slate-700' : 'hover:bg-slate-700/60'}`}
                  >
                    <span className={`shrink-0 w-14 font-semibold text-[9px] uppercase pt-0.5 ${TYPE_COLORS[item.type] || 'text-slate-400'}`}>{item.type}</span>
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
        </div>
      )}

      {/* Status bar */}
      {text && (
        <div className="shrink-0 flex items-center gap-3 px-2 py-1 border-t border-slate-800 bg-slate-900/40">
          <span className="text-[9px] text-slate-500">{lineCount} lines</span>
          <span className="text-[9px] text-slate-600 ml-auto">autosave ✓</span>
        </div>
      )}
    </div>
  );
}