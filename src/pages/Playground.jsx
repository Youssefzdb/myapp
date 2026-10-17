import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { MessageSquare, Eye, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/playground/TopBar';
import ChatPanel from '@/components/playground/ChatPanel';
import PreviewPanel from '@/components/playground/PreviewPanel';
import { fetchModelCatalog, loadConfirmedModels } from '@/lib/opencode';
import { runAgentLoop } from '@/lib/agentLoop';
import { serializeFiles, extractFiles, ENTRY } from '@/lib/files';

const uid = () => Math.random().toString(36).slice(2, 10);
const newSession = () => 'ses_' + uid() + Date.now().toString(36);

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  text: 'أهلاً! صِف لي التطبيق الذي تريد بناءه وسأولّده لك مع معاينة حية. مثال: "أبنِ لي منصة لعرض المنتجات مع سلة تسوق".',
  reasoning: '',
  live: null,
  error: false,
  partial: false,
};

const SUGGESTIONS = [
  'أبنِ لوحة تحكم تحليلات مع رسوم بيانية',
  'أنشئ متجر إلكتروني بسيط مع سلة شراء',
  'صمّم صفحة هبوط لمنصة SaaS',
  'أبنِ تطبيق إدارة مهام بقوائم Kanban',
];

const toFront = (m) => ({
  id: m.id,
  role: m.role,
  text: m.content,
  reasoning: m.reasoning,
  code: m.code,
  code_uri: m.code_uri,
  version: m.version,
  tools: Array.isArray(m.tool_calls) ? m.tool_calls : [],
  error: false,
  partial: false,
  live: null,
});

// Persist large generated code as a private file and store its uri — the entity
// `code` field can't hold a full multi-file project (size limit), so we upload it
// (stored privately) and keep only the file_uri; restore signs it on demand.
const uploadCodePrivate = async (files) => {
  const serialized = serializeFiles(files);
  if (!serialized.trim()) return null;
  const blob = new Blob([serialized], { type: 'text/plain' });
  const file = new File([blob], `vibe-code-${Date.now()}.txt`, { type: 'text/plain' });
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  return file_uri;
};

const fetchCodeUri = async (file_uri) => {
  try {
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
    if (!signed_url) return '';
    const r = await fetch(signed_url);
    if (!r.ok) return '';
    return await r.text();
  } catch {
    return '';
  }
};

export default function Playground() {
  // models — start from confirmed snapshot so the UI is usable immediately
  const [models, setModels] = useState(() => {
    try { return loadConfirmedModels().models; } catch { return []; }
  });
  const [model, setModel] = useState('beam-free');
  const [checking, setChecking] = useState(false);
  // chat
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // project
  const [versions, setVersions] = useState([]);
  const [activeV, setActiveV] = useState(null);
  const [view, setView] = useState('preview');
  const [device, setDevice] = useState('desktop');
  const [activeFile, setActiveFile] = useState(ENTRY);
  const [mobileTab, setMobileTab] = useState('chat');
  const [liveFiles, setLiveFiles] = useState(null);
  // session persistence
  const [sessionId, setSessionId] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const sessionRef = useRef(newSession());
  const abortRef = useRef(null);
  const lastUploadAt = useRef(0);

  const current = versions.find((v) => v.n === activeV) ?? null;
  const files = liveFiles ?? current?.files ?? {};

  // Test models against the live API and keep only the ones that responded ok
  const testModels = async () => {
    const [testRes, catalog] = await Promise.all([
      fetch('https://superagent-2b61d5b9.base44.app/functions/opencodeTestModels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
      fetchModelCatalog(),
    ]);
    const data = await testRes.json();
    const available = [];
    for (const row of data.results || []) {
      if (row.ok === true && row.model) {
        const meta = catalog.find((m) => m.id === row.model);
        available.push({ id: row.model, name: meta?.name ?? row.model });
      }
    }
    available.sort((a, b) => Number(b.id === 'beam-free') - Number(a.id === 'beam-free'));
    return available;
  };

  // Load + test models on mount — only live models appear
  useEffect(() => {
    (async () => {
      try {
        const live = await testModels();
        if (live.length) {
          setModels(live);
          if (!live.some((m) => m.id === model)) setModel(live[0].id);
        } else {
          setModels(loadConfirmedModels().models);
        }
      } catch {
        setModels(loadConfirmedModels().models);
      }
    })();
  }, []);

  // Load last session
  useEffect(() => {
    (async () => {
      try {
        const { items: sessions } = await base44.entities.Session.filter(
          { created_by_id: (await base44.auth.me()).id },
          { sort: '-created_date', limit: 1 }
        );
        if (sessions.length) {
          const s = sessions[0];
          setSessionId(s.id);
          if (s.model) setModel(s.model);
          const { items: msgs } = await base44.entities.Message.filter(
            { session_id: s.id },
            { sort: 'created_date', limit: 200 }
          );
          const mapped = msgs.map(toFront).filter((m) => m.text || m.reasoning);
          if (mapped.length) setMessages(mapped);
          // Reconstruct saved versions from the database (code persisted as a private file uri)
          const restored = [];
          for (const m of msgs) {
            if (m.role === 'assistant' && m.version) {
              let raw = m.code || '';
              if (!raw && m.code_uri) raw = await fetchCodeUri(m.code_uri);
              if (raw && /```/.test(raw)) {
                const { files } = extractFiles(raw);
                if (files && Object.keys(files).length) {
                  restored.push({ n: m.version, files, prompt: m.content || '' });
                }
              }
            }
          }
          if (restored.length) {
            restored.sort((a, b) => a.n - b.n);
            setVersions(restored);
            setActiveV(restored[restored.length - 1].n);
          }
        }
      } catch {
        /* keep welcome */
      } finally {
        setLoadingSession(false);
      }
    })();
  }, []);

  const refreshModels = async () => {
    if (checking || busy) return;
    setChecking(true);
    try {
      const live = await testModels();
      if (live.length) {
        setModels(live);
        if (!live.some((m) => m.id === model)) setModel(live[0].id);
      }
    } catch {
      /* keep existing */
    } finally {
      setChecking(false);
    }
  };

  const send = async (text) => {
    const prompt = (text ?? input).trim();
    if (!prompt || busy || checking) return;

    setInput('');
    setBusy(true);

    const userMsg = { id: uid(), role: 'user', text: prompt };
    const aid = uid();
    const assistantMsg = { id: aid, role: 'assistant', text: '', reasoning: '', tools: [], live: 'يفكّر…', error: false, partial: false };
    setMessages((ms) => [...ms, userMsg, assistantMsg]);
    setLiveFiles(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Persist user message
      let sid = sessionId;
      if (!sid) {
        const s = await base44.entities.Session.create({ title: prompt.slice(0, 40), model });
        sid = s.id;
        setSessionId(sid);
      }
      await base44.entities.Message.create({ session_id: sid, role: 'user', content: prompt });

      // Create the assistant record early so streaming code can be persisted live
      const asstRecord = await base44.entities.Message.create({
        session_id: sid,
        role: 'assistant',
        content: '',
        reasoning: '',
        code: '',
        version: null,
        status: 'running',
      });
      const asstDbId = asstRecord.id;
      let lastVersion = null;
      const toolsAccum = [];

      const history = messages
        .filter((m) => m.role === 'user' || (!m.error && m.text))
        .map((m) => ({ role: m.role, content: m.text }))
        .slice(-12);

      const currentFiles = current?.files ?? {};

      const result = await runAgentLoop({
        prompt,
        history,
        model,
        files: currentFiles,
        signal: ctrl.signal,
        onEvent: (ev) => {
          if (ev.type === 'status') {
            setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, live: ev.text } : m)));
          } else if (ev.type === 'thought') {
            setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, reasoning: ev.text, live: null } : m)));
          } else if (ev.type === 'tool') {
            const tc = ev.call;
            const clean = {
              id: tc.id,
              name: tc.name,
              args: tc.args || {},
              output: tc.output ?? '',
              content: tc.content ?? '',
              status: tc.status,
              url: tc.url ?? '',
              durationMs: tc.durationMs ?? null,
            };
            const ti = toolsAccum.findIndex((t) => t.id === tc.id);
            if (ti >= 0) toolsAccum[ti] = clean; else toolsAccum.push(clean);
            setMessages((ms) => ms.map((m) => {
              if (m.id !== aid) return m;
              const tools = m.tools ? [...m.tools] : [];
              const idx = tools.findIndex((t) => t.id === tc.id);
              if (idx >= 0) tools[idx] = tc;
              else tools.push(tc);
              return { ...m, tools, live: null };
            }));
          } else if (ev.type === 'files') {
            setLiveFiles(ev.files);
            // Persist the live code to private storage (throttled to avoid over-uploading);
            // the entity `code` field can't hold the full project, so we store a file_uri.
            if (Object.keys(ev.files).length) {
              const n = (versions[versions.length - 1]?.n ?? 0) + 1;
              lastVersion = n;
              const now = Date.now();
              if (now - lastUploadAt.current > 3000) {
                lastUploadAt.current = now;
                uploadCodePrivate(ev.files)
                  .then((uri) =>
                    uri
                      ? base44.entities.Message
                          .update(asstDbId, { code_uri: uri, version: n, status: 'streaming' })
                          .catch(() => {})
                      : null
                  )
                  .catch(() => {});
              }
            }
          }
        },
      });

      // Create final version (preserve partial work even if entry not ready)
      let versionBump = null;
      if (result.changed && Object.keys(result.files).length) {
        const n = (versions[versions.length - 1]?.n ?? 0) + 1;
        setVersions((vs) => [...vs, { n, files: result.files, prompt }]);
        setActiveV(n);
        versionBump = n;
        if (result.files[ENTRY] && /export\s+default\s/.test(result.files[ENTRY])) {
          setActiveFile(ENTRY);
          setView('preview');
        }
      }
      setLiveFiles(null);

      // Finalize assistant message
      const finalText = result.changed
        ? (result.summary || 'تم بناء التطبيق ✅')
        : (result.summary || 'لم ينتج النموذج أي ملفات. أعد الصياغة أو جرّب نموذجًا آخر.');
      setMessages((ms) =>
        ms.map((m) =>
          m.id === aid
            ? { ...m, text: finalText, live: null, partial: false }
            : m
        )
      );

      // Final update: upload the final project to private storage and store its uri
      let codeUri = null;
      if (result.changed) {
        try { codeUri = await uploadCodePrivate(result.files); } catch {}
      }
      await base44.entities.Message.update(asstDbId, {
        content: result.summary || 'تم بناء التطبيق',
        code_uri: codeUri ?? undefined,
        version: versionBump ?? lastVersion,
        tool_calls: toolsAccum,
        status: 'done',
      });
    } catch (e) {
      if (ctrl.signal.aborted) {
        setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, live: null, text: m.text || 'تم الإلغاء.' } : m)));
      } else {
        setMessages((ms) =>
          ms.map((m) =>
            m.id === aid
              ? { ...m, error: true, text: 'خطأ: ' + (e?.message || String(e)), live: null }
              : m
          )
        );
      }
      setLiveFiles(null);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const abort = () => abortRef.current?.abort();

  const resetChat = () => {
    abortRef.current?.abort();
    setSessionId(null);
    setMessages([WELCOME]);
    setVersions([]);
    setActiveV(null);
    setActiveFile(ENTRY);
    setInput('');
    setView('preview');
    setLiveFiles(null);
  };

  if (loadingSession) {
    return (
      <div className="h-screen flex flex-col">
        <TopBar model={model} models={models} onModelChange={setModel} onRefreshModels={refreshModels} checking={checking} onNewSession={resetChat} busy={busy} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isEmpty = messages.length <= 1 && !current;

  return (
    <div className="h-screen flex flex-col">
      <TopBar model={model} models={models} onModelChange={setModel} onRefreshModels={refreshModels} checking={checking} onNewSession={resetChat} busy={busy} />

      <div className="hidden md:block flex-1 min-h-0">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={28} minSize={18} maxSize={45}>
            <ChatPanel
              messages={messages}
              input={input}
              setInput={setInput}
              onSend={() => send()}
              isGenerating={busy}
              onAbort={abort}
            />
          </Panel>
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/30 transition-colors" />
          <Panel defaultSize={72} minSize={50}>
            <PreviewPanel
              view={view}
              setView={setView}
              device={device}
              setDevice={setDevice}
              versions={versions}
              activeV={activeV}
              setActiveV={setActiveV}
              files={files}
              activeFile={activeFile}
              setActiveFile={setActiveFile}
            />
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex-1 min-h-0 flex flex-col">
        <div className="flex border-b bg-background">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm ${mobileTab === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            <MessageSquare className="w-4 h-4" />محادثة
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm ${mobileTab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            <Eye className="w-4 h-4" />معاينة
          </button>
        </div>
        <div className="flex-1 min-h-0">
          {mobileTab === 'chat' ? (
            <ChatPanel
              messages={messages}
              input={input}
              setInput={setInput}
              onSend={() => send()}
              isGenerating={busy}
              onAbort={abort}
            />
          ) : (
            <PreviewPanel
              view={view}
              setView={setView}
              device={device}
              setDevice={setDevice}
              versions={versions}
              activeV={activeV}
              setActiveV={setActiveV}
              files={files}
              activeFile={activeFile}
              setActiveFile={setActiveFile}
            />
          )}
        </div>
      </div>
    </div>
  );
}