import React, { useState, useMemo } from 'react';
import { parseBackendSpec } from '@/lib/backendBridge';
import { base44 } from '@/api/base44Client';
import { Database, Loader2, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

const METHOD_STYLE = {
  GET: 'text-blue-500 bg-blue-500/10',
  POST: 'text-green-500 bg-green-500/10',
  PUT: 'text-amber-500 bg-amber-500/10',
  DELETE: 'text-red-500 bg-red-500/10',
};

export default function ApiExplorer({ files, previewId }) {
  const spec = useMemo(() => parseBackendSpec(files), [files]);
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState({});
  const [result, setResult] = useState({}); // collection -> {status, body}
  const [draft, setDraft] = useState({}); // collection -> {field: value}
  const [itemId, setItemId] = useState({}); // collection -> id string

  if (!spec || !spec.collections || !Object.keys(spec.collections).length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground px-6 text-center">
        <Database className="w-8 h-8 opacity-40" />
        <p>لا يوجد backend معرّف. أضف <code className="mx-1 px-1 py-0.5 rounded bg-muted">server/api.json</code> بمجموعات (collections) لتصفّح نقاط النهاية.</p>
      </div>
    );
  }

  const call = async (key, method, path, body) => {
    setLoading((s) => ({ ...s, [key]: true }));
    try {
      const resp = await base44.functions.invoke('apiRuntime', {
        appId: previewId, spec, method, path, body, query: {},
      });
      const d = resp?.data || {};
      setResult((s) => ({ ...s, [key]: { status: d.status || 200, body: d.body ?? d } }));
    } catch (e) {
      const msg = String(e?.message || e);
      const credits = /credit|exhaust|quota|402|payment|disabled|forbidden/i.test(msg);
      setResult((s) => ({ ...s, [key]: { status: 500, body: { error: msg, credits } } }));
    } finally {
      setLoading((s) => ({ ...s, [key]: false }));
    }
  };

  const fieldsOf = (c) => {
    const f = spec.collections[c];
    return f && typeof f === 'object' ? Object.entries(f) : [];
  };

  const toggle = (c) => setOpen((s) => ({ ...s, [c]: !s[c] }));

  const renderResult = (c) => {
    const r = result[c];
    if (!r) return null;
    const ok = r.status >= 200 && r.status < 300;
    return (
      <div className="mt-2 rounded-md border bg-muted/30 overflow-hidden">
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b bg-muted/50">
          <span className={`text-xs font-mono font-semibold ${ok ? 'text-green-500' : 'text-red-500'}`}>{r.status}</span>
          {r.body?.credits ? (
            <span className="text-xs text-amber-600 inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> رصيد التكاملات نفد — لن تعمل نقاط النهاية حتى يُتجدّد الرصيد
            </span>
          ) : null}
        </div>
        <pre className="text-xs font-mono p-2.5 overflow-auto max-h-56 text-foreground/80">
{(() => { try { return JSON.stringify(r.body, null, 2); } catch { return String(r.body); } })()}
        </pre>
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto bg-muted/20" dir="rtl">
      <div className="px-3 py-2.5 border-b bg-background flex items-center gap-2 sticky top-0 z-10">
        <Database className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">متصفّح API</span>
        <span className="text-xs text-muted-foreground">— {Object.keys(spec.collections).length} مجموعة</span>
        {!previewId && <span className="text-xs text-amber-600 mr-auto">في انتظار تهيئة المخزن…</span>}
      </div>

      <div className="p-2 space-y-1.5">
        {Object.keys(spec.collections).map((c) => {
          const fields = fieldsOf(c);
          const isOpen = !!open[c];
          const d = draft[c] || {};
          const id = itemId[c] || '';
          return (
            <div key={c} className="rounded-lg border bg-background overflow-hidden">
              <button
                onClick={() => toggle(c)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors text-right"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <Database className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm font-semibold">{c}</span>
                <span className="text-xs text-muted-foreground">{fields.length} حقل</span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-2.5 border-t">
                  {/* Fields */}
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {fields.map(([f, t]) => (
                        <span key={f} className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {f}: <span className="text-primary">{t}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* GET list */}
                  <Endpoint
                    label="GET"
                    path={`/api/${c}`}
                    onRun={() => call(c, 'GET', `/api/${c}`)}
                    loading={loading[c]}
                  />

                  {/* POST create */}
                  <div className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${METHOD_STYLE.POST}`}>POST</span>
                      <span className="text-xs font-mono text-muted-foreground">/api/{c}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {fields.map(([f]) => (
                        <input
                          key={f}
                          placeholder={f}
                          value={d[f] ?? ''}
                          onChange={(e) => setDraft((s) => ({ ...s, [c]: { ...(s[c] || {}), [f]: e.target.value } }))}
                          className="h-8 rounded-md border bg-background px-2 text-xs font-mono"
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const body = {};
                        fields.forEach(([f, t]) => {
                          const v = d[f];
                          if (v === undefined || v === '') return;
                          body[f] = t === 'number' ? Number(v) : t === 'boolean' ? v === 'true' : v;
                        });
                        call(c, 'POST', `/api/${c}`, body);
                      }}
                      disabled={loading[c]}
                      className="inline-flex items-center gap-1 h-8 rounded-md bg-green-600 text-white px-2.5 text-xs hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading[c] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} إنشاء
                    </button>
                  </div>

                  {/* by id: GET / DELETE */}
                  <div className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${METHOD_STYLE.GET}`}>GET</span>
                      <span className="text-xs font-mono text-muted-foreground">/api/{c}/</span>
                      <input
                        value={id}
                        onChange={(e) => setItemId((s) => ({ ...s, [c]: e.target.value }))}
                        placeholder="id"
                        className="h-7 w-24 rounded-md border bg-background px-2 text-xs font-mono"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => id && call(c, 'GET', `/api/${c}/${id}`)}
                        disabled={loading[c] || !id}
                        className="inline-flex items-center gap-1 h-8 rounded-md border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        {loading[c] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} جلب
                      </button>
                      <button
                        onClick={() => id && call(c, 'DELETE', `/api/${c}/${id}`)}
                        disabled={loading[c] || !id}
                        className={`inline-flex items-center gap-1 h-8 rounded-md px-2.5 text-xs disabled:opacity-50 ${METHOD_STYLE.DELETE}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    </div>
                  </div>

                  {renderResult(c)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Endpoint({ label, path, onRun, loading }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${METHOD_STYLE[label]}`}>{label}</span>
      <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{path}</span>
      <button
        onClick={onRun}
        disabled={loading}
        className="inline-flex items-center gap-1 h-8 rounded-md border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} تجربة
      </button>
    </div>
  );
}