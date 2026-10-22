import { useMemo, useState } from 'react'
import {
  Archive, ChevronDown, Command, FileCode2, Folder, GitBranch, GitCommit,
  Laptop, Menu, MessageSquare, Paperclip, Play, Plus, Search, Settings2,
  SlidersHorizontal, Sparkles, Terminal, Upload, UserRound, X, Zap
} from 'lucide-react'

const files = [
  { name: 'src', type: 'folder', open: true },
  { name: 'app.ts', type: 'file', indent: 1 },
  { name: 'agent.ts', type: 'file', indent: 1, active: true },
  { name: 'tools.ts', type: 'file', indent: 1 },
  { name: 'package.json', type: 'file' },
  { name: 'README.md', type: 'file' },
]

const initialMessages = [
  { role: 'user', text: 'Review the agent loop and suggest a safer retry strategy.' },
  { role: 'assistant', text: 'I\'ll inspect the agent loop, trace its retry boundaries, then propose a small, testable change.' },
]

function App() {
  const [messages, setMessages] = useState(initialMessages)
  const [prompt, setPrompt] = useState('')
  const [activeFile, setActiveFile] = useState('agent.ts')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [model, setModel] = useState('Claude Sonnet 4')
  const [running, setRunning] = useState(false)

  const code = useMemo(() => activeFile === 'agent.ts' ? `import { runTool } from './tools'\n\nexport async function runAgent(input: string) {\n  const context = await loadContext(input)\n  const plan = await model.generate({ context, input })\n\n  for (const step of plan.steps) {\n    const result = await runTool(step)\n    if (result.status === 'error') {\n      return recover(result, context)\n    }\n  }\n\n  return { status: 'complete', context }\n}` : `export const workspace = {\n  name: 'opencode-web',\n  runtime: 'vercel',\n  streaming: true,\n}` , [activeFile])

  function sendMessage() {
    const value = prompt.trim()
    if (!value || running) return
    setMessages((current) => [...current, { role: 'user', text: value }])
    setPrompt('')
    setRunning(true)
    window.setTimeout(() => {
      setMessages((current) => [...current, { role: 'assistant', text: 'I\'ve queued this in the workspace. I\'ll keep the change focused and show the diff before applying it.' }])
      setRunning(false)
    }, 650)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">⌁</span><span>opencode</span><span className="brand-tag">WEB</span></div>
        <div className="workspace-select"><span className="status-dot" /> my-project <ChevronDown size={14} /></div>
        <div className="top-actions"><button className="icon-button" aria-label="Search"><Search /></button><button className="icon-button" aria-label="Command menu"><Command /></button><button className="avatar"><UserRound size={15} /></button></div>
      </header>

      <div className="workspace">
        {sidebarOpen && <aside className="sidebar left-panel">
          <div className="panel-heading"><span>WORKSPACE</span><button className="icon-button small" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X /></button></div>
          <button className="new-session"><Plus size={15} /> New session <span>⌘ N</span></button>
          <div className="session-list"><div className="session active"><MessageSquare size={14} /><span>Retry strategy review</span><span className="session-time">now</span></div><div className="session"><MessageSquare size={14} /><span>Refactor tool runner</span></div><div className="session"><MessageSquare size={14} /><span>Explore project</span></div></div>
          <div className="sidebar-section"><div className="section-label">PROJECT FILES <button className="icon-button small"><Upload /></button></div>{files.map((file) => <button key={file.name} onClick={() => file.type === 'file' && setActiveFile(file.name)} className={`file-row ${file.active || activeFile === file.name ? 'selected' : ''}`} style={{ paddingLeft: `${14 + (file.indent || 0) * 18}px` }}>{file.type === 'folder' ? <Folder size={14} /> : <FileCode2 size={14} />}<span>{file.name}</span>{file.type === 'folder' && <ChevronDown size={13} className="file-chevron" />}</button>)}</div>
          <div className="sidebar-footer"><button><GitBranch size={14} /> main <span className="footer-count">2</span></button><button><Settings2 size={14} /> Settings</button></div>
        </aside>}

        <section className="main-panel">
          <div className="toolbar"><div className="breadcrumbs"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="icon-button small"><Menu /></button><span>Sessions</span><span className="slash">/</span><strong>Retry strategy review</strong></div><div className="toolbar-actions"><button className="tool-button"><GitBranch size={14} /> main</button><button className="tool-button" onClick={() => setRightOpen(!rightOpen)}><SlidersHorizontal size={14} /> Inspector</button></div></div>
          <div className="conversation">
            <div className="conversation-header"><div><div className="eyebrow">SESSION · 4 MIN AGO</div><h1>Retry strategy review</h1></div><div className="model-picker"><Sparkles size={14} /><select value={model} onChange={(event) => setModel(event.target.value)}><option>Claude Sonnet 4</option><option>GPT-5</option><option>Gemini 2.5 Pro</option></select><ChevronDown size={13} /></div></div>
            <div className="message-stream">{messages.map((message, index) => <article key={index} className={`message ${message.role}`}><div className="message-meta"><span className={`message-icon ${message.role}`}>{message.role === 'user' ? 'you' : <Sparkles size={13} />}</span><span>{message.role === 'user' ? 'You' : 'opencode'}</span><span className="message-time">{index === 0 ? '09:42' : '09:43'}</span></div><p>{message.text}</p>{message.role === 'assistant' && index === 1 && <div className="tool-call"><div><Terminal size={14} /><span>read src/agent.ts</span></div><span className="tool-ok">done</span></div>}</article>)}{running && <div className="thinking"><span className="pulse" /> Thinking through the workspace...</div>}</div>
            <div className="composer-wrap"><div className="composer"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} placeholder="Ask opencode anything..." rows={2} /><div className="composer-footer"><div className="composer-tools"><button className="icon-button small"><Paperclip /></button><span className="hint">Enter to send · Shift Enter for newline</span></div><div className="composer-actions"><button className="context-button"><Zap size={13} /> Agent <ChevronDown size={12} /></button><button className="send-button" onClick={sendMessage} disabled={running || !prompt.trim()}><Play size={13} fill="currentColor" /></button></div></div></div></div>
          </div>
        </section>

        {rightOpen && <aside className="inspector right-panel"><div className="panel-heading"><span>INSPECTOR</span><button className="icon-button small" onClick={() => setRightOpen(false)} aria-label="Close inspector"><X /></button></div><div className="tabs"><button className="tab active">Code</button><button className="tab">Diff <span className="badge">2</span></button></div><div className="file-title"><FileCode2 size={14} /><span>src/{activeFile}</span><button className="icon-button small"><Archive /></button></div><pre className="code"><code>{code.split('\n').map((line, index) => <span key={index} className="code-line"><i>{String(index + 1).padStart(2, '0')}</i><b>{line}</b></span>)}</code></pre><div className="run-card"><div><span className="status-dot green" /> Preview connected</div><button className="run-button"><Play size={13} fill="currentColor" /> Run</button></div></aside>}
      </div>
      <footer className="statusbar"><span><span className="status-dot green" /> All systems operational</span><span>opencode web v0.1.0</span><span>⌘ K commands</span></footer>
    </main>
  )
}

export default App
