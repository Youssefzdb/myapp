import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Play, Terminal as TerminalIcon, Loader2 } from 'lucide-react';

const QUICK_COMMANDS = ['pwd', 'ls', 'find . -maxdepth 2 -type f', 'cat package.json'];

export default function TerminalPanel() {
  const [command, setCommand] = useState('pwd');
  const [lines, setLines] = useState([{ type: 'system', text: 'Sandbox terminal bridge جاهز. نفّذ أمرًا لاختبار الاتصال.' }]);
  const [running, setRunning] = useState(false);

  const run = async (event) => {
    event?.preventDefault();
    const value = command.trim();
    if (!value || running) return;
    setLines((current) => [...current, { type: 'command', text: `$ ${value}` }]);
    setRunning(true);
    try {
      const response = await base44.functions.invoke('sandboxTerminal', { command: value, cwd: '.' });
      const result = response?.data || {};
      setLines((current) => [...current, { type: result.error ? 'error' : 'output', text: result.error || result.stdout || result.output || '(بدون مخرجات)' }]);
    } catch (error) {
      setLines((current) => [...current, { type: 'error', text: `Bridge error: ${error?.message || error}` }]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0b1020] text-slate-100" aria-label="Sandbox terminal">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium"><TerminalIcon className="size-4 text-cyan-400" /> Sandbox terminal bridge</div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {QUICK_COMMANDS.map((item) => <button key={item} type="button" onClick={() => setCommand(item)} className="rounded-md border border-slate-700 px-2 py-1 font-mono text-xs text-slate-300 hover:bg-slate-800">{item}</button>)}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-6" aria-live="polite">
        {lines.map((line, index) => <div key={`${index}-${line.text}`} className={line.type === 'error' ? 'whitespace-pre-wrap text-red-300' : line.type === 'command' ? 'whitespace-pre-wrap text-cyan-300' : 'whitespace-pre-wrap text-slate-300'}>{line.text}</div>)}
        {running && <div className="flex items-center gap-2 text-amber-300"><Loader2 className="size-3 animate-spin" /> running…</div>}
      </div>
      <form onSubmit={run} className="flex shrink-0 gap-2 border-t border-slate-800 p-3">
        <label htmlFor="sandbox-command" className="sr-only">Terminal command</label>
        <input id="sandbox-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="pwd" disabled={running} dir="ltr" className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-cyan-500" />
        <button type="submit" disabled={running || !command.trim()} className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"><Play className="size-3.5" />Run</button>
      </form>
    </section>
  );
}
