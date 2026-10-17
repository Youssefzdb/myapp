import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CodeView({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="relative h-full overflow-auto bg-slate-950" dir="ltr">
      <button
        onClick={copy}
        className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-md bg-slate-800 text-slate-200 px-2 py-1 text-xs hover:bg-slate-700"
      >
        {copied ? <><Check className="w-3 h-3" />تم النسخ</> : <><Copy className="w-3 h-3" />نسخ</>}
      </button>
      <pre className="p-4 text-xs leading-relaxed text-slate-200 font-mono whitespace-pre">
        <code>{code || ''}</code>
      </pre>
    </div>
  );
}