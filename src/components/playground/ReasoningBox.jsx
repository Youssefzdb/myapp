import React, { useState } from 'react';
import { Brain, ChevronLeft } from 'lucide-react';

const MAX_LINES = 4;

export default function ReasoningBox({ reasoning }) {
  const [open, setOpen] = useState(false);
  if (!reasoning) return null;

  // Hide the upstream "No reasoning available." placeholder — it's not real
  // chain-of-thought, just a marker that the model had nothing to reason about.
  if (/^no reasoning available\.?$/i.test(reasoning.trim())) return null;

  // Keep only the last few lines so the box never spirals into "over-thinking"
  const allLines = reasoning.split('\n');
  const start = Math.max(0, allLines.length - MAX_LINES);
  const visibleLines = allLines.slice(start);
  const visible = visibleLines.join('\n').trim();
  const truncated = allLines.length > MAX_LINES;

  return (
    <div className="mt-3 rounded-lg border bg-muted/40 text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-right"
      >
        <Brain className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">عملية التفكير</span>
        <ChevronLeft className={`w-4 h-4 mr-auto transition-transform ${open ? '-rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3">
          {truncated && (
            <p className="text-muted-foreground/60 text-xs mb-1">… تفكير سابق</p>
          )}
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-xs">{visible}</p>
        </div>
      )}
    </div>
  );
}