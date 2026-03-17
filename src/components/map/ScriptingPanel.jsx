import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileText, Upload, Download, CheckCircle, AlertTriangle, XCircle, ChevronRight, ChevronDown } from 'lucide-react';

// ── Syntax token rules ────────────────────────────────────────────────────────
const BLOCK_OPEN  = /^(monitor_event|monitor_conditions|if|while|declare_counter)\b/i;
const BLOCK_CLOSE = /^(end_monitor|end_if|end_while)\b/i;
const KEYWORDS    = /\b(monitor_event|monitor_conditions|end_monitor|if|else|end_if|while|end_while|declare_counter|set_counter|change_counter|inc_counter|dec_counter|clear_counter|store_counter|restore_counter|and|not|or)\b/g;
const EVENTS      = /\b(FactionTurnStart|FactionTurnEnd|GeneralCaptureSettlement|SettlementTurnStart|CharacterTurnStart|CharacterTurnEnd|GeneralAssaultSettlement|PreBattle|PostBattle|EndOfTurn|StartOfTurn|FactionDestroyed|BattleStarted|BattleEnded|CharacterComesOfAge|CharacterDies|NewCharacter|FactionLeaderDied|AmbassadorAudience|DiplomacySucceeded|DiplomacyFailed|RebelsSpawned|BuildingCompleted|TechnologyResearched|UnitBuilt|UnitDisbanded|TradeRouteSucceeded|TradeRouteFailed)\b/g;
const COMMANDS    = /\b(console_command|add_money|add_population|spawn_army|create_unit|create_building|destroy_building|set_building_health|move_character|kill_character|give_ancillary|remove_ancillary|give_trait|remove_trait|win_campaign|lose_campaign|show_message|play_sound|play_movie|trigger_advice|set_counter|change_counter|declare_counter|spawn_agent|destroy_army|make_faction_ai|make_faction_player|set_faction_standing|set_region_religion|set_counter_value|historic_event|show_me_message|disable_movement|enable_movement|set_scroll_speed|clear_objectives|set_objective|destroy_unit|disband_unit|add_unit_to_army|transfer_unit|make_alliance|break_alliance|offer_peace|declare_war)\b/g;
const CONDITIONS  = /\b(FactionIsLocal|FactionIsHuman|FactionType|FactionIsAlive|FactionIsDefeated|SettlementName|TargetSettlementName|RegionName|CharacterName|CharacterType|IsGeneral|IsMerchant|IsSpy|IsAssassin|IsPriest|IsAdmiral|IsPrincess|IsNakedFanatic|IsGunpowderUnit|TurnNumber|ResourceType|SettlementLevel|SettlementMinLevel|SettlementMaxLevel|CharacterInRegion|FactionInRegion|CounterValue|I_CounterEqualTo|I_CounterLessThan|I_CounterGreaterThan|I_TurnNumber|I_NumberOfSettlements|I_NumberOfUnits|I_IsAlly|I_IsEnemy|I_IsSameTeam|MoneyBalance|PopulationSize)\b/g;

function tokenize(line) {
  // Comments
  if (/^\s*(;|--)/.test(line)) {
    return `<span class="sc-comment">${esc(line)}</span>`;
  }
  let out = esc(line);
  // Apply color classes via spans — order matters (most specific first)
  out = out.replace(EVENTS,     m => `<span class="sc-event">${m}</span>`);
  out = out.replace(COMMANDS,   m => `<span class="sc-cmd">${m}</span>`);
  out = out.replace(CONDITIONS, m => `<span class="sc-cond">${m}</span>`);
  out = out.replace(KEYWORDS,   m => `<span class="sc-kw">${m}</span>`);
  // Numbers
  out = out.replace(/\b(\d+)\b/g, '<span class="sc-num">$1</span>');
  // Quoted strings
  out = out.replace(/(&quot;[^&]*&quot;)/g, '<span class="sc-str">$1</span>');
  return out;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildHighlightedHTML(text) {
  return text.split('\n').map(tokenize).join('\n');
}

// ── Validator ────────────────────────────────────────────────────────────────
function validateScript(text, stratData) {
  const lines = text.split('\n');
  const errors = [];
  const warnings = [];

  // Stack-based block matching
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

  // Unclosed blocks
  for (const open of stack) {
    errors.push({ line: open.line, msg: `Unclosed \`${open.token}\` block (opened at line ${open.line})`, raw: open.raw });
  }

  // Cross-reference character names from stratData if available
  const knownChars = new Set(
    (stratData?.items || []).filter(i => i.category === 'character').map(i => (i.name || '').toLowerCase())
  );

  if (knownChars.size > 0) {
    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();
      // CharacterName <name> checks
      const cm = line.match(/CharacterName\s+(\S+)/i);
      if (cm && !knownChars.has(cm[1].toLowerCase())) {
        warnings.push({ line: idx + 1, msg: `Unknown character name: "${cm[1]}" (not found in descr_strat.txt)`, raw: line });
      }
    });
  }

  // Warn about common typos
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim().toLowerCase();
    if (line === 'endif' || line === 'endmonitor' || line === 'endwhile') {
      warnings.push({ line: idx + 1, msg: `Possible typo: use \`${line.replace('end','end_')}\` instead of \`${line}\``, raw: rawLine.trim() });
    }
  });

  return { errors, warnings };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ScriptingPanel({ stratData }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const fileInputRef = useRef(null);

  // Restore from localStorage/sessionStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('m2tw_campaign_script') || sessionStorage.getItem('m2tw_script_raw');
      if (cached) { setText(cached); setFileName('campaign_script.txt'); }
    } catch {}
  }, []);

  const syncScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop  = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setText(val);
    try { sessionStorage.setItem('m2tw_script_raw', val); } catch {}
    setValidationResult(null);
  }, []);

  const handleLoad = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const t = await file.text();
    setText(t);
    setFileName(file.name);
    try { sessionStorage.setItem('m2tw_script_raw', t); localStorage.setItem('m2tw_campaign_script', t); } catch {}
    setValidationResult(null);
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
    const result = validateScript(text, stratData);
    setValidationResult(result);
    setShowValidation(true);
  };

  const highlightedHTML = buildHighlightedHTML(text || '');

  const errCount  = validationResult?.errors.length  ?? 0;
  const warnCount = validationResult?.warnings.length ?? 0;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
      {/* Header bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800 shrink-0 bg-slate-900/60 flex-wrap">
        <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span className="text-[10px] font-semibold text-slate-300 mr-1">{fileName || 'campaign_script.txt'}</span>
        <label className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <Upload className="w-3 h-3" /> Load
          <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleLoad} />
        </label>
        <button
          onClick={handleExport}
          disabled={!text}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          <Download className="w-3 h-3" /> Export
        </button>
        <button
          onClick={handleValidate}
          disabled={!text}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-violet-700/30 border border-violet-500/40 text-violet-300 hover:bg-violet-700/50 disabled:opacity-40 transition-colors ml-auto"
        >
          <CheckCircle className="w-3 h-3" /> Validate
        </button>
      </div>

      {/* Validation result panel */}
      {validationResult && (
        <div className="shrink-0 border-b border-slate-800 max-h-40 overflow-y-auto bg-slate-900/80">
          <button
            onClick={() => setShowValidation(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold hover:bg-slate-800/50"
          >
            {showValidation ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {errCount === 0 && warnCount === 0
              ? <><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Script OK — no issues found</span></>
              : <>
                  {errCount > 0 && <><XCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">{errCount} error{errCount > 1 ? 's' : ''}</span></>}
                  {warnCount > 0 && <><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400">{warnCount} warning{warnCount > 1 ? 's' : ''}</span></>}
                </>
            }
          </button>
          {showValidation && (
            <div className="px-3 pb-2 space-y-0.5">
              {validationResult.errors.map((e, i) => (
                <div key={i} className="flex gap-2 text-[10px]">
                  <span className="text-red-400 shrink-0">L{e.line}</span>
                  <span className="text-red-300">{e.msg}</span>
                </div>
              ))}
              {validationResult.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-[10px]">
                  <span className="text-amber-400 shrink-0">L{w.line}</span>
                  <span className="text-amber-300">{w.msg}</span>
                </div>
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
          <p className="text-[10px] text-center text-slate-600">Syntax highlighting for monitor_event, if/end_if, commands, events &amp; conditions</p>
          <label className="cursor-pointer px-3 py-1.5 rounded bg-violet-700/30 border border-violet-500/40 text-violet-300 hover:bg-violet-700/50 text-xs transition-colors">
            <Upload className="w-3.5 h-3.5 inline mr-1" /> Load campaign_script.txt
            <input type="file" accept=".txt" className="hidden" onChange={handleLoad} />
          </label>
        </div>
      ) : (
        <div className="flex-1 relative font-mono text-xs overflow-hidden">
          {/* Highlighted pre (visual layer) */}
          <pre
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 p-2 overflow-auto pointer-events-none whitespace-pre leading-5 text-slate-300"
            style={{ tabSize: 2 }}
            dangerouslySetInnerHTML={{ __html: highlightedHTML + '\n' }}
          />
          {/* Transparent textarea (input layer) */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onScroll={syncScroll}
            spellCheck={false}
            className="absolute inset-0 p-2 w-full h-full bg-transparent text-transparent caret-slate-300 resize-none outline-none leading-5 overflow-auto"
            style={{ tabSize: 2, caretColor: '#94a3b8' }}
          />
          <style>{`
            .sc-kw   { color: #c084fc; font-weight: 600; }
            .sc-event{ color: #38bdf8; }
            .sc-cmd  { color: #4ade80; }
            .sc-cond { color: #fb923c; }
            .sc-num  { color: #fbbf24; }
            .sc-str  { color: #f9a8d4; }
            .sc-comment { color: #6b7280; font-style: italic; }
          `}</style>
        </div>
      )}

      {/* Legend */}
      {text && (
        <div className="shrink-0 flex flex-wrap gap-x-3 gap-y-0.5 px-2 py-1 border-t border-slate-800 bg-slate-900/40">
          {[
            ['sc-kw','Keywords'],['sc-event','Events'],['sc-cmd','Commands'],['sc-cond','Conditions'],['sc-num','Numbers'],['sc-comment','Comments'],
          ].map(([cls, label]) => (
            <span key={cls} className="text-[9px] flex items-center gap-1">
              <style>{`.legend-${cls} { color: var(--${cls}-color); }`}</style>
              <span className={cls} style={{ display:'inline' }} dangerouslySetInnerHTML={{ __html: `<span class="${cls}">■</span>` }} />
              <span className="text-slate-500">{label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}