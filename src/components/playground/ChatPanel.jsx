import React, { useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Square, Paperclip, X, Plus, SlidersHorizontal } from 'lucide-react';
import ReasoningBox from './ReasoningBox';
import ToolCalls from './ToolCalls';

const SUGGESTIONS = ['أضف صفحة تسجيل الدخول', 'حسّن التصميم على الهاتف', 'أضف بيانات تجريبية واقعية'];

function StatusLine({ message }) {
  if (!message.live) return null;
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground" aria-live="polite">
      <Loader2 className="size-3 animate-spin text-primary" />
      <span>{message.live}</span>
    </div>
  );
}

export default function ChatPanel({ messages, input, setInput, onSend, isGenerating, onAbort, images = [], onAttachImages, onRemoveImage }) {
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const [showSuggestions, setShowSuggestions] = React.useState(true);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, images]);

  const hasInput = input.trim() || images.length > 0;

  return (
    <section className="flex h-full min-h-0 flex-col bg-sidebar" dir="rtl" aria-label="محادثة البناء">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-3.5" /></div>
          <div className="text-right leading-tight"><p className="text-xs font-semibold">Vibe Studio</p><p className="text-[10px] text-muted-foreground">مساعد بناء التطبيقات</p></div>
        </div>
        <button type="button" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" title="إعدادات المحادثة"><SlidersHorizontal className="size-4" /></button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {messages.map((m) => (
            <article key={m.id} className={m.role === 'user' ? 'flex justify-start' : 'flex justify-end'}>
              {m.role === 'user' ? (
                <div className="max-w-[88%]">
                  {Array.isArray(m.images) && m.images.length > 0 && <div className="mb-2 flex flex-wrap justify-start gap-1.5">{m.images.map((img) => <img key={img.id ?? img.preview} src={img.preview || img.url} alt={img.name || 'مرفق'} className="size-16 rounded-lg border object-cover" />)}</div>}
                  <div className="rounded-2xl rounded-bl-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap">{m.text}</div>
                </div>
              ) : (
                <div className="w-full max-w-[96%]">
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary"><Sparkles className="size-3" /></span><span className="font-medium">Vibe Studio</span>{m.route?.label && <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px]">{m.route.label}</span>}</div>
                  {m.text && <div className="text-sm leading-7 whitespace-pre-wrap">{m.text}</div>}
                  <ToolCalls tools={m.tools} />
                  <ReasoningBox reasoning={m.reasoning} />
                  {m.error && <div className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{m.text}</div>}
                  <StatusLine message={m} />
                  {m.partial && !m.error && <div className="mt-2 text-[11px] text-amber-600">انقطع البث؛ قد يكون الرد غير مكتمل.</div>}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-sidebar-border bg-sidebar px-3 pb-3 pt-2 sm:px-4">
        {messages.length <= 1 && showSuggestions && <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setInput(suggestion); setShowSuggestions(false); }} className="shrink-0 rounded-full border border-border/70 bg-background/60 px-2.5 py-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{suggestion}</button>)}</div>}
        {images.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{images.map((img) => <div key={img.id} className="relative"><img src={img.preview} alt={img.name} className="size-14 rounded-lg border object-cover" />{img.uploading ? <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40"><Loader2 className="size-4 animate-spin text-white" /></div> : <button type="button" onClick={() => onRemoveImage?.(img.id)} className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground" aria-label={`הסר ${img.name}`}><X className="size-3" /></button>}</div>)}</div>}
        <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="rounded-2xl border border-border bg-background shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring/30">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); onSend(); } }} rows={2} placeholder="اطلب من Vibe Studio بناء شيء…" className="max-h-32 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-muted-foreground" aria-label="اكتب طلبك" />
          <div className="flex items-center justify-between px-2.5 pb-2">
            <div className="flex items-center gap-1"><button type="button" onClick={() => fileRef.current?.click()} disabled={isGenerating} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-40" title="إرفاق صور"><Paperclip className="size-4" /></button><button type="button" onClick={() => { setInput(''); setShowSuggestions(true); }} disabled={!input} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-40" title="مسح الطلب"><Plus className="size-4 rotate-45" /></button></div>
            <div className="flex items-center gap-2"><span className="hidden text-[10px] text-muted-foreground sm:inline">Enter للإرسال · Shift+Enter لسطر جديد</span>{isGenerating ? <button type="button" onClick={onAbort} className="flex size-8 items-center justify-center rounded-lg bg-destructive text-destructive-foreground" title="إيقاف التوليد"><Square className="size-3.5" /></button> : <button type="submit" disabled={!hasInput} className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" title="إرسال"><Send className="size-3.5" /></button>}</div>
          </div>
        </form>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const fs = e.target.files; if (fs?.length && onAttachImages) onAttachImages(fs); e.target.value = ''; }} />
        <p className="mt-2 text-center text-[10px] text-muted-foreground/70">قد يخطئ الذكاء الاصطناعي. راجع التغييرات قبل النشر.</p>
      </div>
    </section>
  );
}
