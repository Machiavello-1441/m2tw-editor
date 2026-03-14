import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EOP_API, EOP_EVENTS } from './m2tweop_api';

// All known M2TWEOP keywords for syntax highlighting
const KEYWORDS = ['function', 'end', 'if', 'then', 'else', 'elseif', 'for', 'do', 'while', 'repeat', 'until', 'local', 'return', 'not', 'and', 'or', 'in', 'nil', 'true', 'false', 'break'];
const EOP_NAMESPACES = ['M2TWEOP', 'stratmap', 'imgui'];
const EOP_FUNCTIONS = [...new Set(EOP_API.map(a => a.name))];
const EOP_EVENT_NAMES = EOP_EVENTS.map(e => e.name);
const ALL_COMPLETIONS = [
  ...KEYWORDS,
  ...EOP_NAMESPACES,
  ...EOP_API.map(a => a.sig.split('(')[0]),
  ...EOP_EVENT_NAMES,
];

function tokenizeLua(line) {
  // Returns array of {text, type} tokens
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    // Comment
    if (line[i] === '-' && line[i + 1] === '-') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }
    // String
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) { if (line[j] === '\\') j++; j++; }
      tokens.push({ text: line.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }
    // Number
    if (/[0-9]/.test(line[i]) || (line[i] === '-' && /[0-9]/.test(line[i + 1]))) {
      let j = i; if (line[j] === '-') j++;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }
    // Identifier or keyword
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_.:]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let type = 'ident';
      if (KEYWORDS.includes(word)) type = 'keyword';
      else if (EOP_NAMESPACES.some(ns => word.startsWith(ns + '.') || word === ns)) type = 'eop';
      else if (EOP_EVENT_NAMES.includes(word)) type = 'event';
      else if (EOP_FUNCTIONS.includes(word)) type = 'func';
      tokens.push({ text: word, type });
      i = j;
      continue;
    }
    // Operator/punctuation
    tokens.push({ text: line[i], type: 'punct' });
    i++;
  }
  return tokens;
}

const TOKEN_COLORS = {
  keyword: '#c792ea',
  eop: '#82aaff',
  event: '#c3e88d',
  func: '#82aaff',
  string: '#c3e88d',
  number: '#f78c6c',
  comment: '#546e7a',
  ident: '#eeffff',
  punct: '#89ddff',
};

export default function LuaCodeEditor({ value, onChange, height = '100%' }) {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const [autocomplete, setAutocomplete] = useState({ show: false, items: [], pos: { top: 0, left: 0 }, query: '' });
  const [selectedAc, setSelectedAc] = useState(0);

  // Sync scroll
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleChange = (e) => {
    onChange(e.target.value);
    updateAutocomplete(e.target);
  };

  const updateAutocomplete = (ta) => {
    const pos = ta.selectionStart;
    const text = ta.value.slice(0, pos);
    const match = text.match(/[\w.:]+$/);
    if (!match || match[0].length < 2) { setAutocomplete(a => ({ ...a, show: false })); return; }
    const query = match[0].toLowerCase();
    const items = ALL_COMPLETIONS.filter(c => c.toLowerCase().includes(query) && c.toLowerCase() !== query).slice(0, 10);
    if (items.length === 0) { setAutocomplete(a => ({ ...a, show: false })); return; }

    // Estimate caret position (rough)
    const lines = text.split('\n');
    const lineNum = lines.length - 1;
    const lineStart = text.lastIndexOf('\n') + 1;
    const col = pos - lineStart;
    const top = (lineNum + 1) * 18;
    const left = col * 7.2;
    setAutocomplete({ show: true, items, pos: { top, left }, query: match[0] });
    setSelectedAc(0);
  };

  const applyAutocomplete = (item) => {
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const text = ta.value;
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const match = before.match(/[\w.:]+$/);
    if (!match) return;
    const newBefore = before.slice(0, before.length - match[0].length) + item;
    const newVal = newBefore + after;
    onChange(newVal);
    setAutocomplete(a => ({ ...a, show: false }));
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = newBefore.length;
      ta.focus();
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (autocomplete.show) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedAc(i => Math.min(i + 1, autocomplete.items.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedAc(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyAutocomplete(autocomplete.items[selectedAc]); return; }
      if (e.key === 'Escape') { setAutocomplete(a => ({ ...a, show: false })); return; }
    }
    // Tab → indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const newVal = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
      onChange(newVal);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
    }
  };

  const highlighted = value.split('\n').map((line, i) => {
    const tokens = tokenizeLua(line);
    return (
      <div key={i} style={{ minHeight: '18px', lineHeight: '18px', whiteSpace: 'pre' }}>
        {tokens.map((t, j) => (
          <span key={j} style={{ color: TOKEN_COLORS[t.type] || '#eeffff' }}>{t.text}</span>
        ))}
        {'\n'}
      </div>
    );
  });

  const sharedStyle = {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    fontSize: '13px',
    lineHeight: '18px',
    tabSize: 2,
    padding: '12px',
    margin: 0,
    border: 'none',
    outline: 'none',
    whiteSpace: 'pre',
    overflowWrap: 'normal',
    wordBreak: 'normal',
  };

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden', background: '#0f1117', borderRadius: '6px' }}>
      {/* Highlighted layer */}
      <div
        ref={highlightRef}
        onScroll={syncScroll}
        style={{
          ...sharedStyle,
          position: 'absolute', inset: 0, overflow: 'hidden',
          color: 'transparent', background: 'transparent', pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {highlighted}
      </div>
      {/* Editable textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        spellCheck={false}
        style={{
          ...sharedStyle,
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          resize: 'none', background: 'transparent',
          color: 'rgba(255,255,255,0.1)',
          caretColor: '#ffcb6b',
          zIndex: 2, overflow: 'auto',
        }}
      />
      {/* Autocomplete dropdown */}
      {autocomplete.show && (
        <div style={{
          position: 'absolute',
          top: `${autocomplete.pos.top + 12}px`,
          left: `${autocomplete.pos.left + 12}px`,
          background: '#1e2230',
          border: '1px solid #303550',
          borderRadius: '4px',
          zIndex: 100,
          minWidth: '200px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          {autocomplete.items.map((item, i) => (
            <div
              key={item}
              onMouseDown={() => applyAutocomplete(item)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
                background: i === selectedAc ? '#2d3250' : 'transparent',
                color: item.includes('.') ? '#82aaff' : EOP_EVENT_NAMES.includes(item) ? '#c3e88d' : KEYWORDS.includes(item) ? '#c792ea' : '#eeffff',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}