import React from 'react';
import { Sparkles, Plus, Github, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const EFFORT_OPTIONS = [
  { id: "low", name: "سريع" },
  { id: "medium", name: "متوسط" },
  { id: "high", name: "عميق" },
];

export default function TopBar({ model, models, onModelChange, onRefreshModels, checking, onNewSession, busy, effort, onEffortChange }) {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b bg-background">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="leading-none">
          <h1 className="text-sm font-semibold">Vibe Studio</h1>
          <p className="text-[11px] text-muted-foreground mt-1 hidden sm:block">مولّد تطبيقات React بالذكاء الاصطناعي</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 h-9 text-sm">
          <span className="text-muted-foreground text-xs">النموذج</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={!models.length}
            className="bg-transparent outline-none font-medium text-sm cursor-pointer max-w-[140px]"
          >
            {!models.length && <option value={model}>{model}</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={onRefreshModels}
            disabled={checking || busy}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="تحديث النماذج"
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border px-2.5 h-9 text-sm">
          <span className="text-muted-foreground text-xs">التفكير</span>
          <select
            value={effort}
            onChange={(e) => onEffortChange(e.target.value)}
            className="bg-transparent outline-none font-medium text-sm cursor-pointer"
          >
            {EFFORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={onNewSession} disabled={busy}>
          <Plus className="w-4 h-4 mr-1" />جديد
        </Button>
        <a href="https://github.com/Youssefzdb/opencode-free" target="_blank" rel="noreferrer" className="hidden sm:block">
          <Button variant="ghost" size="sm"><Github className="w-4 h-4" /></Button>
        </a>
      </div>
    </header>
  );
}