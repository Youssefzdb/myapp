import React, { useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Square, FileCode } from 'lucide-react';
import ReasoningBox from './ReasoningBox';
import ToolCalls from './ToolCalls';

export default function ChatPanel({ messages, input, setInput, onSend, isGenerating, onAbort }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-sidebar" dir="rtl">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {m.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                {m.text}
              </div>
            ) : (
              <div className="max-w-[92%] w-full">
                <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5" /> Vibe Studio
                </div>
                {m.text && <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</div>}
                <ToolCalls tools={m.tools} />
                <ReasoningBox reasoning={m.reasoning} />
                {m.error && (
                  <div className="mt-2 text-xs text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5">{m.text}</div>
                )}
                {m.live && !m.text && !m.reasoning && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />{m.live}
                  </div>
                )}
                {m.live && (m.text || m.reasoning) && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />{m.live}
                  </div>
                )}
                {m.partial && !m.error && (
                  <div className="mt-1.5 text-[11px] text-amber-600">⚠ انقطع البث؛ قد يكون الرد غير مكتمل.</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder="صِف التطبيق أو المكوّن الذي تريد بناءه..."
            className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring max-h-40"
          />
          {isGenerating ? (
            <button
              type="button"
              onClick={onAbort}
              className="shrink-0 h-10 w-10 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center"
              title="إيقاف"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="shrink-0 h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}