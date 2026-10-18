import React, { useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Square, Paperclip, X } from 'lucide-react';
import ReasoningBox from './ReasoningBox';
import ToolCalls from './ToolCalls';

export default function ChatPanel({ messages, input, setInput, onSend, isGenerating, onAbort, images = [], onAttachImages, onRemoveImage }) {
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, images]);

  const hasInput = input.trim() || images.length > 0;

  return (
    <div className="flex flex-col h-full bg-sidebar" dir="rtl">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {m.role === 'user' ? (
              <div className="max-w-[85%]">
                {Array.isArray(m.images) && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5 justify-end">
                    {m.images.map((img) => (
                      <img key={img.id ?? img.preview} src={img.preview || img.url} alt={img.name || ''} className="w-20 h-20 object-cover rounded-lg border" />
                    ))}
                  </div>
                )}
                <div className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                  {m.text}
                </div>
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
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((img) => (
              <div key={img.id} className="relative">
                <img src={img.preview} alt={img.name} className="w-16 h-16 object-cover rounded-lg border" />
                {img.uploading ? (
                  <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                ) : (
                  <button type="button" onClick={() => onRemoveImage?.(img.id)} className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = e.target.files;
              if (fs && fs.length && onAttachImages) onAttachImages(fs);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isGenerating}
            className="shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center disabled:opacity-40"
            title="إرفاق صور"
          >
            <Paperclip className="w-4 h-4" />
          </button>
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
            placeholder="صِف التطبيق أو أرفق صورة موقع لتطابقها…"
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
              disabled={!hasInput || isGenerating}
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