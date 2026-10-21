import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Eye, Code, Monitor, Tablet, Smartphone, Copy, Download, Check, Files, ArrowLeft, ArrowRight, RotateCw, Globe, Database, List } from 'lucide-react';
import CodeView from './CodeView';
import FileTree from './FileTree';
import ApiExplorer from './ApiExplorer';
import { buildPreviewHtml } from '@/lib/preview';
import { serializeFiles, totalLines } from '@/lib/files';
import { detectPages } from '@/lib/pages';

const DEVICES = { desktop: '100%', tablet: '768px', mobile: '390px' };

export default function PreviewPanel({
  view,
  setView,
  device,
  setDevice,
  versions,
  activeV,
  setActiveV,
  files,
  activeFile,
  setActiveFile,
  previewId,
}) {
  const [copied, setCopied] = useState(false);
  const [showTree, setShowTree] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);

  // Virtual route navigation (address bar + back/forward) for the preview iframe
  const iframeRef = useRef(null);
  const [history, setHistory] = useState(['/']);
  const [idx, setIdx] = useState(0);
  const [routeInput, setRouteInput] = useState('/');
  const [showPages, setShowPages] = useState(false);

  const pages = useMemo(() => detectPages(files), [files]);

  const fileCount = Object.keys(files).length;
  const lineCount = useMemo(() => totalLines(files), [files]);
  const currentCode = files[activeFile] ?? '';
  const previewDoc = useMemo(() => buildPreviewHtml(files), [files]);

  // Reset navigation whenever the preview content is rebuilt
  useEffect(() => {
    setHistory(['/']); setIdx(0); setRouteInput('/');
    setPreviewLoading(Boolean(fileCount));
  }, [previewDoc, fileCount]);

  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!d) return;
      if (d.type === 'vibe-preview-ready') { setHistory(['/']); setIdx(0); setRouteInput('/'); return; }
      if (d.type === 'vibe-route') {
        const r = d.route || '/';
        setRouteInput(r);
        setHistory((h) => {
          const cur = h[idx] ?? '/';
          if (r === cur) return h;
          const nh = h.slice(0, idx + 1);
          nh.push(r);
          return nh;
        });
        setIdx((i) => (history[i] === r ? i : i + 1));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [idx, history]);

  const postNavigate = (route) => {
    const win = iframeRef.current?.contentWindow;
    if (win) win.postMessage({ type: 'vibe-navigate', route }, '*');
  };
  const go = (override) => {
    let r = (override ?? routeInput).trim() || '/';
    if (r.charAt(0) !== '/' && r.charAt(0) !== '?') r = '/' + r;
    setHistory((h) => { const nh = h.slice(0, idx + 1); nh.push(r); return nh; });
    setIdx((i) => i + 1);
    setRouteInput(r);
    postNavigate(r);
  };
  const back = () => {
    if (idx <= 0) return;
    const ni = idx - 1;
    setIdx(ni); setRouteInput(history[ni] || '/');
    postNavigate(history[ni] || '/');
  };
  const forward = () => {
    if (idx >= history.length - 1) return;
    const ni = idx + 1;
    setIdx(ni); setRouteInput(history[ni] || '/');
    postNavigate(history[ni] || '/');
  };
  const reload = () => postNavigate(history[idx] || '/');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode || serializeFiles(files));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const download = () => {
    const blob = new Blob([previewDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibe-app-v${activeV ?? 1}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Toolbar */}
      <div className="h-12 shrink-0 flex items-center justify-between gap-2 px-3 border-b bg-background overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle: preview | code | api */}
          <div className="inline-flex rounded-lg border p-0.5 shrink-0">
            <button
              onClick={() => setView('preview')}
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm ${view === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              <Eye className="w-4 h-4" />معاينة
            </button>
            <button
              onClick={() => setView('code')}
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm ${view === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              <Code className="w-4 h-4" />كود
            </button>
            <button
              onClick={() => setView('api')}
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm ${view === 'api' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              <Database className="w-4 h-4" />API
            </button>
          </div>

          {view === 'code' && fileCount > 0 && (
            <button
              onClick={() => setShowTree((s) => !s)}
              className={`inline-flex items-center gap-1 h-8 rounded-md border px-2.5 text-sm ${showTree ? 'bg-muted' : 'text-muted-foreground'}`}
              title="شجرة الملفات"
            >
              <Files className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {view === 'preview' && (
          <div className="inline-flex rounded-lg border p-0.5 shrink-0">
            {Object.keys(DEVICES).map((k) => (
              <button
                key={k}
                onClick={() => setDevice(k)}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${device === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                title={k}
              >
                {k === 'desktop' ? <Monitor className="w-4 h-4" /> : k === 'tablet' ? <Tablet className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {versions.length > 0 && (
            <select
              value={activeV ?? ''}
              onChange={(e) => setActiveV(Number(e.target.value))}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              {versions.map((v) => (
                <option key={v.n} value={v.n}>v{v.n}</option>
              ))}
            </select>
          )}
          {fileCount > 0 && (
            <span className="hidden sm:inline text-xs text-muted-foreground">{fileCount} ملف · {lineCount} سطر</span>
          )}
          <button onClick={copy} disabled={!fileCount} className="inline-flex items-center gap-1 h-8 rounded-md border bg-background px-2.5 text-sm hover:bg-muted disabled:opacity-40">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'تم' : 'نسخ'}
          </button>
          <button onClick={download} disabled={!fileCount} className="inline-flex items-center gap-1 h-8 rounded-md border bg-background px-2.5 text-sm hover:bg-muted disabled:opacity-40">
            <Download className="w-3.5 h-3.5" />تنزيل
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {view === 'preview' ? (
          <div className="flex flex-col w-full flex-1 min-h-0">
            {/* Address bar — navigate the app's virtual routes */}
            <div className="relative h-10 shrink-0 flex items-center gap-1 px-2 border-b bg-background">
              <button onClick={back} disabled={idx <= 0} className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted disabled:opacity-30" title="رجوع">
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={forward} disabled={idx >= history.length - 1} className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted disabled:opacity-30" title="تقدّم">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button onClick={reload} className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted" title="تحديث">
                <RotateCw className="w-4 h-4" />
              </button>
              <div className="flex-1 flex items-center gap-1.5 h-8 rounded-md border bg-muted/40 px-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  value={routeInput}
                  onChange={(e) => setRouteInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
                  placeholder="/"
                  dir="ltr"
                  className="flex-1 bg-transparent text-sm font-mono outline-none min-w-0"
                />
              </div>
              <button
                onClick={() => setShowPages((s) => !s)}
                className={`inline-flex items-center gap-1 h-8 rounded-md border px-2 text-xs ${showPages ? 'bg-muted' : 'text-muted-foreground'}`}
                title="كل الصفحات"
              >
                <List className="w-3.5 h-3.5" />الصفحات
              </button>

              {/* Vertical list of all detected pages */}
              {showPages && (
                <div className="absolute z-20 left-2 right-2 top-11 max-h-72 overflow-auto rounded-md border bg-background shadow-lg">
                  <div className="px-2.5 py-1.5 text-xs text-muted-foreground border-b sticky top-0 bg-background">
                    الصفحات ({pages.length})
                  </div>
                  {pages.map((p) => (
                    <button
                      key={p}
                      onClick={() => { go(p); setShowPages(false); }}
                      className={`w-full text-left px-2.5 py-2 text-sm font-mono hover:bg-muted border-b last:border-0 ${p === (history[idx] || '/') ? 'bg-muted/60' : ''}`}
                      dir="ltr"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex-1 min-h-0 flex items-start justify-center p-3 overflow-auto bg-muted/30">
              {previewLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/30 pointer-events-none">
                  <span className="rounded-md border bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm">جاري تحميل المعاينة…</span>
                </div>
              )}
              <div style={{ width: DEVICES[device], maxWidth: '100%' }} className="h-full mx-auto">
                <iframe
                  ref={iframeRef}
                  title="preview"
                  srcDoc={previewDoc}
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => setPreviewLoading(false)}
                  className="w-full h-full rounded-lg border bg-white shadow-sm"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              </div>
            </div>
          </div>
        ) : view === 'api' ? (
          <ApiExplorer files={files} previewId={previewId} />
        ) : (
          <>
            {showTree && fileCount > 0 && (
              <div className="w-44 shrink-0 border-l overflow-y-auto bg-background">
                <FileTree files={files} activeFile={activeFile} onSelect={setActiveFile} />
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-hidden">
              {fileCount > 0 ? (
                <CodeView code={currentCode} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  لا يوجد كود بعد — أرسل طلبًا للبدء
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
