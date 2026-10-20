import React, { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { MessageSquare, Eye, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/playground/TopBar';
import ChatPanel from '@/components/playground/ChatPanel';
import PreviewPanel from '@/components/playground/PreviewPanel';
import { fetchModelCatalog, loadConfirmedModels } from '@/lib/opencode';
import { runAgentLoop } from '@/lib/agentLoop';
import { analyzeImages, extractImageUrls } from '@/lib/vision';
import { extractFiles, ENTRY } from '@/lib/files';
import { saveLocalCode, readLocalCode, isLocalCodeUri } from '@/lib/localCode';
import { buildProjectFiles } from '@/lib/preview';
import { pushProjectToGithub } from '@/lib/github';
import { startBackendBridge, parseBackendSpec } from '@/lib/backendBridge';
import { useAuth } from '@/lib/AuthContext';
import { getSession, addProject, updateProject } from '@/lib/customAuth';
import { saveLocalProject, updateLocalProject } from '@/lib/localProjects';
import { createBuilderSession, saveBuilderMessage, updateBuilderMessage, saveBuilderTools, saveBuilderVersion } from '@/lib/builderDb';

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

// Persist the generated project code in the browser (localStorage) — no Base44
// upload, no integration credits. One local key per project is reused across
// updates so storage never accumulates duplicate blobs. Returns a local handle
// "local:<key>" used everywhere the old file_uri was used.
const uploadCodePrivate = async (files, existingUri = null) => saveLocalCode(files, existingUri);

const fetchCodeUri = async (code_uri) => {
  try {
    if (isLocalCodeUri(code_uri)) return readLocalCode(code_uri) || '';
    // Legacy Base44 private-file handles (credits currently exhausted) — best effort.
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: code_uri });
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
  const [pendingImages, setPendingImages] = useState([]);
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
  const [builderProjectId, setBuilderProjectId] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const sessionRef = useRef(newSession());
  const abortRef = useRef(null);
  const lastUploadAt = useRef(0);
  // One project entry per conversation: created on first generation, updated
  // on every following message so a conversation isn't saved as many projects.
  const projectRef = useRef({ localId: null, accountId: null, codeUri: null });
  const [previewId, setPreviewId] = useState(null);
  const filesRef = useRef({});
  const previewIdRef = useRef(null);
  const pendingImagesRef = useRef([]);
  const uploadPromises = useRef({});

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

  useEffect(() => { pendingImagesRef.current = pendingImages; }, [pendingImages]);

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

  const attachImages = async (fileList) => {
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue;
      const id = uid();
      const preview = URL.createObjectURL(file);
      setPendingImages((p) => [...p, { id, name: file.name, preview, uploading: true }]);
      uploadPromises.current[id] = (async () => {
        try {
          // Convert the attached image to a data URL entirely in the browser —
          // no Base44 upload, no integration credits. The data URL is passed
          // straight to the free vision model (opencodeChat).
          const dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error('read failed'));
            r.readAsDataURL(file);
          });
          setPendingImages((p) => p.map((x) => (x.id === id ? { ...x, uploading: false } : x)));
          return { id, name: file.name, preview, url: dataUrl };
        } catch (e) {
          setPendingImages((p) => p.filter((x) => x.id !== id));
          URL.revokeObjectURL(preview);
          delete uploadPromises.current[id];
          return null;
        }
      })();
    }
  };
  const removeImage = (id) => {
    setPendingImages((p) => {
      const x = p.find((y) => y.id === id);
      if (x) URL.revokeObjectURL(x.preview);
      return p.filter((y) => y.id !== id);
    });
    delete uploadPromises.current[id];
  };

  const send = async (text) => {
    let prompt = (text ?? input).trim();
    const linkedImageUrls = extractImageUrls(prompt);
    const haveImgs = pendingImagesRef.current.length > 0 || linkedImageUrls.length > 0;
    if (haveImgs && !prompt.replace(/https?:\/\/\S+/g, '').trim()) {
      prompt = "ابنِ نسخة مطابقة بنسبة 99-100% من الموقع/التصميم الظاهر في الصورة المرفقة.";
    }
    if ((!prompt && !haveImgs) || busy || checking) return;

    const attached = pendingImagesRef.current.slice();
    setInput('');
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const userMsg = { id: uid(), role: 'user', text: prompt, images: attached.map((x) => ({ id: x.id, name: x.name, preview: x.preview })) };
    const aid = uid();
    const assistantMsg = { id: aid, role: 'assistant', text: '', reasoning: '', tools: [], live: attached.length ? 'يحلّل الصورة…' : 'يفكّر…', error: false, partial: false };
    setMessages((ms) => [...ms, userMsg, assistantMsg]);
    setLiveFiles(null);

    setPendingImages([]);

    let referenceUrls = [];
    let enriched = prompt;
    if (attached.length || linkedImageUrls.length) {
      const entries = attached.length
        ? (await Promise.all(attached.map((x) => uploadPromises.current[x.id]))).filter(Boolean)
        : [];
      const attachedUrls = entries.map((e) => e.url).filter(Boolean);
      // Re-host linked image URLs through a backend function so the vision model
      // can fetch them (some hosts like catbox are blocked for the model).
      let linkedUrls = [...linkedImageUrls];
      if (linkedUrls.length) {
        const rehosted = await Promise.all(linkedUrls.map(async (u) => {
          try {
            const res = await base44.functions.invoke('rehostImage', { url: u });
            return res?.data?.data_url || u;
          } catch { return u; }
        }));
        linkedUrls = rehosted.filter(Boolean);
      }
      referenceUrls = [...attachedUrls, ...linkedUrls];
      if (referenceUrls.length) {
        try {
          const spec = await analyzeImages(referenceUrls, ctrl.signal);
          enriched = `[REFERENCE IMAGES — pixel-accurate clone target]\n${spec}\n\nUser instruction: ${prompt}`;
        } catch (e) {
          if (ctrl.signal.aborted) throw e;
        }
      }
      setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, live: 'يفكّر…' } : m)));
    }

    const persist = true;
    try {
      // Persist every builder run in Supabase, including anonymous preview sessions.
      let sid = sessionId;
      let projectId = null;
      let userDbId = null;
      let asstDbId = null;
      if (!sid) {
        const session = await createBuilderSession({ sessionKey: sessionRef.current, title: prompt.slice(0, 40), model });
        if (session) {
          sid = session.id;
          projectId = session.project_id;
          setBuilderProjectId(projectId);
          setSessionId(sid);
        }
      }
      if (sid) {
        const sequence = messages.filter((m) => m.role === 'user').length + 1;
        await saveBuilderMessage({ sessionId: sid, role: 'user', content: prompt, sequence });
        const asstRecord = await saveBuilderMessage({ sessionId: sid, role: 'assistant', content: '', reasoning: '', status: 'streaming', sequence: sequence + 1 });
        asstDbId = asstRecord?.id || null;
      }
      let lastVersion = null;
      const toolsAccum = [];

      const history = messages
        .filter((m) => m.role === 'user' || (!m.error && m.text))
        .map((m) => ({ role: m.role, content: m.text }))
        .slice(-12);

      const currentFiles = current?.files ?? {};

      const result = await runAgentLoop({
        prompt: enriched,
        task: prompt,
        referenceImages: referenceUrls,
        history,
        model,
        availableModels: models,
        files: currentFiles,
        effort,
        signal: ctrl.signal,
        onEvent: (ev) => {
          if (ev.type === 'status') {
            setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, live: ev.text } : m)));
          } else if (ev.type === 'route') {
            setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, route: { label: ev.label, model: ev.model, category: ev.category } } : m)));
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
            // Persist the live code to local browser storage (throttled). One
            // local key per project is reused so storage never accumulates
            // duplicate blobs across streamed updates / messages.
            if (Object.keys(ev.files).length) {
              const n = (versions[versions.length - 1]?.n ?? 0) + 1;
              lastVersion = n;
              if (persist && asstDbId) {
                const now = Date.now();
                if (now - lastUploadAt.current > 3000) {
                  lastUploadAt.current = now;
                  uploadCodePrivate(ev.files, projectRef.current.codeUri)
                    .then((uri) => {
                      if (!uri) return null;
                      projectRef.current.codeUri = uri;
                      return updateBuilderMessage(asstDbId, { status: 'streaming' }).catch(() => {});
                    })
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

      // Persist the final project to local browser storage ONCE (reusing the
      // same local key the streamed updates already wrote to) — no Base44
      // upload, no integration credits. The same handle feeds the session
      // message and the Home project entry.
      let saveUri = null;
      if (result.changed && Object.keys(result.files).length) {
        try {
          saveUri = await uploadCodePrivate(result.files, projectRef.current.codeUri);
          if (saveUri) projectRef.current.codeUri = saveUri;
        } catch { /* storage unavailable */ }
      }

      // Finalize the assistant message and persist its reasoning/tool trace.
      if (asstDbId) {
        await updateBuilderMessage(asstDbId, {
          content: (result.summary || 'تم بناء التطبيق').slice(0, 4000),
          reasoning: messages.find((m) => m.id === aid)?.reasoning || null,
          status: 'complete',
        });
        await saveBuilderTools(asstDbId, toolsAccum);
      }
      if ((projectId || builderProjectId) && versionBump) {
        await saveBuilderVersion({ projectId: projectId || builderProjectId, sessionId: sid, versionNumber: versionBump, prompt, files: result.files, activeFile });
      }

      // Save the project so it appears on Home. One entry per conversation:
      // created on the first generation, then updated on each following message
      // (so a conversation isn't saved as many separate projects).
      if (result.changed && Object.keys(result.files).length) {
        const title = prompt.slice(0, 60);
        if (projectRef.current.localId) {
          try { updateLocalProject(projectRef.current.localId, { prompt, code_uri: saveUri || "" }); } catch {}
        } else {
          try {
            const entry = saveLocalProject({ title, prompt, code_uri: saveUri || "" });
            projectRef.current.localId = entry.id;
          } catch {}
        }
        if (getSession()) {
          if (projectRef.current.accountId) {
            try { await updateProject(projectRef.current.accountId, { prompt, code_uri: saveUri || "" }); } catch {}
          } else if (saveUri) {
            try {
              const entry = await addProject({ title, prompt, code_uri: saveUri });
              projectRef.current.accountId = entry.id;
            } catch {}
          }
        }
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
    projectRef.current = { localId: null, accountId: null, codeUri: null };
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
              images={pendingImages}
              onAttachImages={attachImages}
              onRemoveImage={removeImage}
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
              previewId={previewId}
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
              images={pendingImages}
              onAttachImages={attachImages}
              onRemoveImage={removeImage}
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
              previewId={previewId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
