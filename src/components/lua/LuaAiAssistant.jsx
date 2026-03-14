import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, Copy, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { EOP_API, EOP_EVENTS } from './m2tweop_api';

const QUICK_PROMPTS = [
  { label: 'onTurnStart skeleton', prompt: 'Write a complete onTurnStart function that gives every faction 500 gold per turn using M2TWEOP Lua API.' },
  { label: 'Custom campaign event', prompt: 'Write a Lua script that triggers a custom event when a settlement named "Jerusalem" is captured.' },
  { label: 'ImGUI debug panel', prompt: 'Create a full onImGuiRender function showing faction count, local player faction name, cursor tile coordinates, and buttons to reload script and toggle console.' },
  { label: 'Religion spread modifier', prompt: 'Write a Lua script using onSettlementTurnStart to boost religion spread in settlements above population 5000.' },
  { label: 'Ancillary system', prompt: 'Write a Lua script using onCharacterTurnStart to randomly award a custom ancillary to generals with high command stars.' },
  { label: 'Battle outcome hook', prompt: 'Write a complete onBattleEnded function that logs the winner and loser faction names and settlement involved.' },
];

// Build API context summary for the LLM
const API_CONTEXT = `
Available M2TWEOP Lua API functions (${EOP_API.length} total):
${EOP_API.map(e => `- ${e.sig} → ${e.returns} : ${e.desc}`).join('\n')}

Available M2TWEOP Events (${EOP_EVENTS.length} total):
${EOP_EVENTS.map(e => `- ${e.name}(${e.params.map(p => p.name).join(', ')}) : ${e.description}`).join('\n')}

Key rules for M2TWEOP Lua:
- The main entry point file is luaPluginScript.lua placed at <mod>/eopData/eopScripts/
- Functions like onPluginLoad, onTurnStart etc are called automatically by EOP
- Always use M2TWEOP.logGame() for debug output (not print)
- imgui functions only work inside onImGuiRender()
- stratmap.game functions only work during campaign (not battle)
- Always handle nil returns from getFaction(), getSettlement() etc
`;

export default function LuaAiAssistant({ onInsert }) {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const bottomRef = useRef();

  const sendMessage = async (text) => {
    const userMsg = text || prompt.trim();
    if (!userMsg) return;
    setPrompt('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

    const fullPrompt = `You are an expert M2TWEOP (Medieval II Total War Engine Overhaul Project) Lua scripter.
Your job is to write clean, working Lua scripts using the M2TWEOP API.

${API_CONTEXT}

${history ? `Previous conversation:\n${history}\n\n` : ''}User request: ${userMsg}

Rules:
- Write complete, working Lua code
- Add helpful comments explaining what the code does
- Only use functions from the M2TWEOP API listed above
- Handle nil values defensively (check with if x then)
- Format code blocks with \`\`\`lua ... \`\`\`
- Keep explanations brief, focus on the code`;

    try {
      const result = await base44.integrations.Core.InvokeLLM({ prompt: fullPrompt });
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const extractCode = (content) => {
    const match = content.match(/```(?:lua)?\n([\s\S]*?)```/);
    return match ? match[1] : content;
  };

  const handleCopy = (content, idx) => {
    navigator.clipboard.writeText(extractCode(content));
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleInsert = (content) => {
    onInsert(extractCode(content));
  };

  const renderMessage = (msg, idx) => {
    const isUser = msg.role === 'user';
    const parts = msg.content.split(/(```(?:lua)?\n[\s\S]*?```)/g);

    return (
      <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[90%] ${isUser ? 'bg-primary/20 border border-primary/30' : 'bg-accent/30 border border-border'} rounded-xl px-3 py-2.5`}>
          {parts.map((part, pi) => {
            const codeMatch = part.match(/```(?:lua)?\n([\s\S]*?)```/);
            if (codeMatch) {
              return (
                <div key={pi} className="mt-2 mb-1">
                  <div className="bg-background rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/30 border-b border-border">
                      <span className="text-[10px] font-mono text-muted-foreground">lua</span>
                      <div className="ml-auto flex gap-1">
                        <button
                          onClick={() => handleCopy(msg.content, idx)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copied === idx ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {copied === idx ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={() => handleInsert(msg.content)}
                          className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors ml-2"
                        >
                          ↗ Insert into editor
                        </button>
                      </div>
                    </div>
                    <pre className="p-3 text-[11px] font-mono text-foreground/90 overflow-auto max-h-64 whitespace-pre-wrap">
                      {codeMatch[1]}
                    </pre>
                  </div>
                </div>
              );
            }
            return <p key={pi} className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{part}</p>;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground">AI Lua Assistant</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Ask for help writing M2TWEOP Lua scripts. The AI knows all {EOP_API.length} API functions and {EOP_EVENTS.length} events.
        </p>
        {/* Quick prompts */}
        <div className="mt-2 flex flex-wrap gap-1">
          {QUICK_PROMPTS.map(qp => (
            <button
              key={qp.label}
              onClick={() => sendMessage(qp.prompt)}
              disabled={loading}
              className="px-2 py-0.5 text-[10px] rounded-full border border-border hover:bg-accent/30 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2 py-8">
            <Sparkles className="w-8 h-8 opacity-20" />
            <p className="text-xs">Ask me to write any M2TWEOP Lua script.<br />I know the full API and all event hooks.</p>
          </div>
        )}
        {messages.map((msg, idx) => renderMessage(msg, idx))}
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">Writing script…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Describe the Lua script you need…"
            rows={2}
            disabled={loading}
            className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <Button
            size="icon"
            className="h-full w-9 shrink-0"
            onClick={() => sendMessage()}
            disabled={loading || !prompt.trim()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Enter to send · Shift+Enter for newline · Code is inserted into the active script</p>
      </div>
    </div>
  );
}