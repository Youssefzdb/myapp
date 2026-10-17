import React, { useState } from 'react';
import { Brain, ChevronLeft } from 'lucide-react';

export default function ReasoningBox({ reasoning }) {
  const [open, setOpen] = useState(false);
  if (!reasoning) return null;
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
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-xs">{reasoning}</p>
        </div>
      )}
    </div>
  );
}