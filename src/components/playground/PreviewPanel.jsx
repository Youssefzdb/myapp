import React, { useState, useMemo } from 'react';
import { Eye, Code, Monitor, Tablet, Smartphone, Copy, Download, Check, Files } from 'lucide-react';
import CodeView from './CodeView';
import FileTree from './FileTree';
import { buildPreviewHtml, buildProjectFiles } from '@/lib/preview';
import { serializeFiles, totalLines } from '@/lib/files';

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
  setActiveFile
}) {
  const [copied, setCopied] = useState(false);
  const [showTree, setShowTree] = useState(true);

  const fileCount = Object.keys(files).length;
  const lineCount = useMemo(() => totalLines(files), [files]);
  const currentCode = files[activeFile] ?? '';

  const previewDoc = useMemo(() => buildPreviewHtml(files), [files]);

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
          {/* View toggle */}
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
          <div className="h-full w-full flex items-start justify-center p-3 overflow-auto bg-muted/30 flex-1">
            <div style={{ width: DEVICES[device], maxWidth: '100%' }} className="h-full mx-auto">
              <iframe
                title="preview"
                srcDoc={previewDoc}
                className="w-full h-full rounded-lg border bg-white shadow-sm"
                sandbox="allow-scripts allow-popups"
              />
            </div>
          </div>
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