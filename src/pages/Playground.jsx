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
import { buildProjectFiles } from '@/lib/preview';
import { pushProjectToGithub } from '@/lib/github';
import { startBackendBridge, parseBackendSpec } from '@/lib/backendBridge';
import { useAuth } from '@/lib/AuthContext';
import { getSession, addProject } from '@/lib/customAuth';

// Scope playground state per account so one user never sees another's draft.
const lsKey = () => {
  const s = getSession();
  return s?.id ? `opencode_playground_v1_${s.id}` : 'opencode_playground_v1';
};
const loadLocal = () => {
  try {
    const raw = localStorage.getItem(lsKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
const saveLocal = (data) => {
  try {
    localStorage.setItem(lsKey(), JSON.stringify(data));
  } catch {
    /* quota exceeded — ignore */
  }
};

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
  const { isAuthenticated } = useAuth();
  const [restored] = useState(() => loadLocal());
  // models — start from confirmed snapshot so the UI is usable immediately
  const [models, setModels] = useState(() => {
    try { return loadConfirmedModels().models; } catch { return []; }
  });
  const [model, setModel] = useState(restored?.model ?? 'beam-free');
  const [effort, setEffort] = useState(restored?.effort ?? 'low');
  const [checking, setChecking] = useState(false);
  const [autoPush, setAutoPush] = useState(restored?.autoPush ?? false);
  const [ghConnected, setGhConnected] = useState(false);
  // chat
  const [messages, setMessages] = useState(restored?.messages?.length ? restored.messages : [WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // project
  const [versions, setVersions] = useState(restored?.versions ?? []);
  const [activeV, setActiveV] = useState(restored?.activeV ?? null);
  const [view, setView] = useState('preview');
  const [device, setDevice] = useState('desktop');
  const [activeFile, setActiveFile] = useState(restored?.activeFile ?? ENTRY);
  const [mobileTab, setMobileTab] = useState('chat');
  const [liveFiles, setLiveFiles] = useState(null);
  // session persistence
  const [sessionId, setSessionId] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const sessionRef = useRef(newSession());
  const abortRef = useRef(null);
  const lastUploadAt = useRef(0);
  const [previewId, setPreviewId] = useState(null);
  const filesRef = useRef({});
  const previewIdRef = useRef(null);

  const current = versions.find((v) => v.n === activeV) ?? null;
  const files = liveFiles ?? current?.files ?? {};
  filesRef.current = files;
  previewIdRef.current = previewId;

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

  // Stable backend namespace for the live preview REST runtime:
  // authenticated users get a durable per-user store; anonymous get a per-session
  // store so data persists across API calls within one preview session.
  useEffect(() => {
    (async () => {
      let id = null;
      try {
        const a = await base44.auth.isAuthenticated();
        if (a) { const me = await base44.auth.me(); if (me?.id) id = "preview_" + me.id; }
      } catch { /* anonymous */ }
      if (!id) id = "preview_" + sessionRef.current;
      setPreviewId(id);
    })();
  }, []);

  // Load a project selected from the Home page (stored briefly in sessionStorage)
  useEffect(() => {
    const raw = sessionStorage.getItem('vibe_load_project');
    if (!raw) return;
    sessionStorage.removeItem('vibe_load_project');
    try {
      const p = JSON.parse(raw);
      if (!p?.code_uri) return;
      setLoadingSession(true);
      fetchCodeUri(p.code_uri).then((txt) => {
        const files = extractFiles(txt);
        if (files && Object.keys(files).length) {
          setVersions([{ n: 1, files, prompt: p.title || '' }]);
          setActiveV(1);
          setMessages([
            WELCOME,
            { id: uid(), role: 'assistant', text: `تم تحميل مشروع: ${p.title || ''}`, reasoning: '', tools: [], live: null, error: false, partial: false },
          ]);
          if (files[ENTRY] && /export\s+default\s/.test(files[ENTRY])) { setActiveFile(ENTRY); setView('preview'); }
        }
        setLoadingSession(false);
      }).catch(() => setLoadingSession(false));
    } catch { /* ignore */ }
  }, []);

  // Bridge fetch('/api/...') from the preview iframe to the platform apiRuntime.
  useEffect(() => startBackendBridge({
    getAppId: () => previewIdRef.current,
    getSpec: () => parseBackendSpec(filesRef.current),
  }), []);

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

  // Persist session to local storage so a refresh restores it (works without login)
  useEffect(() => {
    const t = setTimeout(() => {
      saveLocal({ messages, versions: versions.slice(-6), activeV, model, effort, activeFile, autoPush });
    }, 600);
    return () => clearTimeout(t);
  }, [messages, versions, activeV, model, activeFile, autoPush]);

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

    const persist = isAuthenticated;
    try {
      // Persist user message (only when logged in; otherwise local storage keeps state)
      let sid = sessionId;
      let asstDbId = null;
      if (persist) {
        if (!sid) {
          const s = await base44.entities.Session.create({ title: prompt.slice(0, 40), model });
          sid = s.id;
          setSessionId(sid);
        }
        await base44.entities.Message.create({ session_id: sid, role: 'user', content: prompt });
        const asstRecord = await base44.entities.Message.create({
          session_id: sid,
          role: 'assistant',
          content: '',
          reasoning: '',
          code: '',
          version: null,
          status: 'running',
        });
        asstDbId = asstRecord.id;
      }
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
        effort,
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
              if (persist && asstDbId) {
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
      if (persist && asstDbId) {
        let codeUri = null;
        if (result.changed) {
          try { codeUri = await uploadCodePrivate(result.files); } catch {}
        }
        // Truncate large tool-call fields so the record stays within the
        // entity field size limit (full code lives in code_uri instead).
        const MAX = 1500;
        const safeToolCalls = toolsAccum.map((t) => ({
          ...t,
          content: (t.content || '').slice(0, MAX),
          output: (t.output || '').slice(0, MAX),
          args: t.args && typeof t.args === 'object'
            ? Object.fromEntries(Object.entries(t.args).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, MAX) : v]))
            : t.args,
        }));
        try {
          await base44.entities.Message.update(asstDbId, {
            content: (result.summary || 'تم بناء التطبيق').slice(0, 4000),
            code_uri: codeUri ?? undefined,
            version: versionBump ?? lastVersion,
            tool_calls: safeToolCalls,
            status: 'done',
          });
        } catch { /* field-size guard; the session still works locally */ }
      }

      // Save the project to the signed-in user's private list (each user sees only their own)
      if (result.changed && Object.keys(result.files).length && getSession()) {
        try {
          const saveUri = await uploadCodePrivate(result.files);
          if (saveUri) await addProject({ title: prompt.slice(0, 60), prompt, code_uri: saveUri });
        } catch { /* best-effort */ }
      }

      // Auto-push to the user's GitHub if enabled and connected
      if (autoPush && ghConnected && result.changed && Object.keys(result.files).length) {
        try {
          const gh = await pushProjectToGithub({ files: buildProjectFiles(result.files), repo: 'vibe-app', private: false, commitMessage: 'chore: auto-push generated app' });
          if (gh?.url) {
            setMessages((ms) => ms.map((m) =>
              m.id === aid ? { ...m, text: `${m.text}\n\nتم الرفع التلقائي إلى ${gh.url}` } : m
            ));
          }
        } catch {
          /* auto-push is best-effort; the user can push manually from the GitHub dialog */
        }
      }
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
    try { localStorage.removeItem(lsKey()); } catch {}
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
      <TopBar model={model} models={models} onModelChange={setModel} onRefreshModels={refreshModels} checking={checking} onNewSession={resetChat} busy={busy} effort={effort} onEffortChange={setEffort} files={files} title={(current?.prompt || [...messages].reverse().find((m) => m.role === 'user')?.text || 'تطبيق مُولّد')} autoPush={autoPush} onAutoPushChange={setAutoPush} onGithubConnected={setGhConnected} />
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