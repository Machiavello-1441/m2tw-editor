import React, { useState, useRef } from 'react';
import { X, Sparkles, Send, Copy, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SYSTEM_PROMPT = `You are an expert Medieval 2 Total War (M2TW) campaign script writer.
You know the complete M2TW scripting language including:
- monitor_event / end_monitor blocks using WhenToTest events
- Conditions (Trait, Attribute, I_TurnNumber, I_EventCounter, I_CompareCounter, I_SettlementOwner, I_NumberOfSettlements, etc.)
- Commands (set_counter, inc_counter, add_money, spawn_army, move_character, add_trait, give_settlement, etc.)
- Script structure: campaign_script with monitor_event blocks
- Indentation convention: 2 or 4 spaces per level
- Comments with semicolons (;)
- The "not" keyword for negation
- while / end_while loops
- if / else / end_if blocks

Always output clean, commented, valid M2TW campaign script code.
When the user asks for script snippets, output ONLY the script code block (no markdown fences), preceded by a brief one-line comment explaining what it does.
When explaining or discussing, you may use plain text.`;

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-5 h-5 rounded bg-violet-900/60 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3 text-violet-400" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
        isUser ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-200'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

const QUICK_PROMPTS = [
  'Write a monitor that fires at turn 10 and gives england 2000 gold',
  'Write a monitor that spawns a rebel army when a settlement is taken',
  'Write a condition block checking if a faction has more than 5 settlements',
  'Write a crusade trigger monitor that fires when a crusade is called',
  'Write a monitor that adds a trait to a character after winning a battle',
];

export default function ScriptAIAssistant({ onInsert, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I can help you write M2TW campaign scripts. Ask me to generate a monitor_event block, explain a condition, or write specific scripting logic.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const scrollBottom = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const send = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');
    setShowQuick(false);

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);
    scrollBottom();

    try {
      const history = newMessages.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
      const prompt = `${SYSTEM_PROMPT}\n\nConversation history:\n${history}\n\nNow respond as Assistant:`;
      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setLoading(false);
    scrollBottom();
  };

  // Extract code blocks from last assistant message for quick insert
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const hasCode = lastAssistant && /monitor_event|set_counter|add_money|if |while /i.test(lastAssistant.content);

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-700 w-80">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-200">AI Script Assistant</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-5 h-5 rounded bg-violet-900/60 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3 h-3 text-violet-400" />
            </div>
            <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
              <span className="text-[11px] text-slate-400">Generating...</span>
            </div>
          </div>
        )}
        {/* Quick insert button */}
        {hasCode && !loading && (
          <button
            onClick={() => {
              // Extract the script-looking part from last assistant message
              const lines = lastAssistant.content.split('\n');
              const codeLines = lines.filter(l =>
                /^\s*(monitor_event|end_monitor|if |end_if|while|end_while|WhenToTest|Condition|and |not |set_counter|inc_counter|add_money|add_trait|move_character|give_settlement|spawn_army|;)/.test(l.trim()) || l.trim() === ''
              );
              const snippet = codeLines.length > 2 ? codeLines.join('\n').trim() : lastAssistant.content.trim();
              onInsert(snippet);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium bg-violet-700/40 hover:bg-violet-700/60 text-violet-300 border border-violet-600/30 transition-colors"
          >
            <Copy className="w-3 h-3" /> Insert script into editor
          </button>
        )}
        <div ref={bottomRef} />
      </div>

      {/* quick prompts */}
      {showQuick && (
        <div className="px-3 pb-2 border-t border-slate-800 pt-2 shrink-0">
          <button onClick={() => setShowQuick(false)} className="text-[9px] text-slate-600 mb-1.5 flex items-center gap-1">
            Quick prompts <ChevronDown className="w-3 h-3" />
          </button>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => send(p)}
                className="w-full text-left text-[10px] px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/40 transition-colors">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* input */}
      <div className="px-3 py-2 border-t border-slate-700 shrink-0">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask for a script snippet..."
            disabled={loading}
            className="flex-1 h-7 px-2 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-7 h-7 flex items-center justify-center rounded bg-violet-700/60 hover:bg-violet-700 disabled:opacity-40 text-violet-200 transition-colors"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}