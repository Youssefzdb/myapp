import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Image as ImageIcon, Sparkles, ArrowRight, Loader2, Send, KeyRound, Cloud, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Client-side tokens (free tier). Editable from the UI in case they expire.
const DEFAULT_ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYzhlZWJmOWQtYjlhNy00NzNkLWI2MmMtYTUzZGNjNWM1YjAyIiwiZW1haWwiOiJhbm9uLWM4ZWViZjlkLWI5YTctNDczZC1iNjJjLWE1M2RjYzVjNWIwMkBhbm9uLnN1cGVyY29vbC5pbnRlcm5hbCIsInN2IjowLCJpYXQiOjE3OTI0MjcyNzUsImp0aSI6IjU2YzFrUUtnbE0wVmlvQ2hXSVg0bXciLCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzk1MDE5Mjc1fQ.2fWXjwG-39TSBEPFwhMe7xRzyWB8XOSj_fZxymyEUSg';

const DEFAULT_PROXY_URL = 'https://nameless-mode-af36.tarotwithghada.workers.dev';
const DEFAULT_AGENT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5zdXBlcmNvb2wuc2giLCJhdWQiOiJodHRwczovL21jcC5zdXBlcmNvb2wuY29tL21jcCIsInN1YiI6ImM4ZWViZjlkLWI5YTctNDczZC1iNjJjLWE1M2RjYzVjNWIwMiIsImNsaWVudF9pZCI6Im1jcF9jbGllbnRfc3RYZm1hX24xdjcydThjeTBJbHFBMXhMIiwic2NvcGUiOiJhZ2VudCIsIm1jcF9zZXNzaW9uX2lkIjoibWNwX1NuYWRTQXZXNHhGOVNkcTUiLCJzdXJmYWNlIjoibWNwIiwidG9rZW5fdHlwZSI6ImFnZW50X2FjY2VzcyIsImlhdCI6MTc5MjQyNzQwMiwiZXhwIjoxNzkyNTEzODAyfQ.YtO5woyGdAv0i78M1NvkKzplAuBZH8nah7jNfAtQHQI';

const REFRESH_TOKEN = 'rt_AhulVS_5hF7v9IBifUxcsca9IeLRmq2cz6fY3YmiMQsid7ye';
const CLIENT_ID = 'mcp_client_stXfma_n1v72u8cy0IlqA1xL';

const TOKEN_KEY = 'opencode_test_tokens_v1';
const loadTokens = () => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return {
        anon: o.anon || DEFAULT_ANON_JWT,
        agent: o.agent || DEFAULT_AGENT_TOKEN,
        proxy: o.proxy || DEFAULT_PROXY_URL,
        useProxy: o.useProxy !== undefined ? o.useProxy : true,
      };
    }
  } catch { /* ignore */ }
  return { anon: DEFAULT_ANON_JWT, agent: DEFAULT_AGENT_TOKEN, proxy: DEFAULT_PROXY_URL, useProxy: true };
};
const saveTokens = (t) => {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch { /* ignore */ }
};

// Route a URL through the Cloudflare Worker CORS proxy when enabled.
const throughProxy = (tokens, url) => {
  if (!tokens.useProxy || !tokens.proxy) return url;
  const base = tokens.proxy.replace(/\/$/, '');
  return `${base}?target=${encodeURIComponent(url)}`;
};

function CodeBlock({ children }) {
  return (
    <pre dir="ltr" className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
      {children}
    </pre>
  );
}

function Label({ children }) {
  return <span className="text-xs font-semibold text-muted-foreground">{children}</span>;
}

export default function Test() {
  const [tokens, setTokens] = useState(loadTokens);
  const [showTokens, setShowTokens] = useState(false);

  // Image
  const [imgPrompt, setImgPrompt] = useState('neon cyberpunk robot holding a glowing SHADOWX sign');
  const [imgLoading, setImgLoading] = useState(false);
  const [imgResult, setImgResult] = useState(null);
  const [imgError, setImgError] = useState(null);

  // Chat
  const [chatMsg, setChatMsg] = useState('quick test, just say ok');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState(null);
  const [chatError, setChatError] = useState(null);

  const updateToken = (k, v) => {
    const next = { ...tokens, [k]: v };
    setTokens(next);
    saveTokens(next);
  };
  const toggleProxy = () => {
    const next = { ...tokens, useProxy: !tokens.useProxy };
    setTokens(next);
    saveTokens(next);
  };

  const generateImage = async () => {
    setImgLoading(true); setImgError(null); setImgResult(null);
    try {
      const res = await fetch(throughProxy(tokens, 'https://api.supercool.com/api/v1/posts/generate-cover-image'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: imgPrompt }),
      });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 500)}`);
      const url = data?.data?.cover_image_url;
      setImgResult({ url, raw: data });
    } catch (e) {
      setImgError(e.message || String(e));
    } finally {
      setImgLoading(false);
    }
  };

  const sendChat = async () => {
    setChatLoading(true); setChatError(null); setChatResult(null);
    try {
      const body = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'message_agent',
          arguments: { message: chatMsg, request_id: 'my-1' },
        },
      };
      const res = await fetch(throughProxy(tokens, 'https://mcp.supercool.com/mcp'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.agent}`,
          'Accept': 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/event-stream')) {
        const text = await res.text();
        setChatResult({ sse: text, raw: text });
      } else {
        const text = await res.text();
        let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 500)}`);
        setChatResult({ data, raw: text });
      }
    } catch (e) {
      setChatError(e.message || String(e));
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div dir="rtl" className="relative isolate min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold">صفحة Test</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowTokens((s) => !s)}>
              <KeyRound className="w-4 h-4" />التوكنات
            </Button>
            <Button asChild variant="ghost" size="sm"><Link to="/">العودة <ArrowRight className="w-4 h-4 mr-1" /></Link></Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Tokens */}
        {showTokens && (
          <section className="rounded-2xl border bg-card p-5 space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2"><KeyRound className="w-4 h-4" /> التوكنات (قابلة للتعديل)</h2>
            <div className="space-y-1">
              <Label>ANON JWT (الصور)</Label>
              <textarea dir="ltr" value={tokens.anon} onChange={(e) => updateToken('anon', e.target.value)} rows={4}
                className="w-full rounded-lg border bg-background p-2 text-xs font-mono resize-y outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <Label>AGENT TOKEN (chat/MCP)</Label>
              <textarea dir="ltr" value={tokens.agent} onChange={(e) => updateToken('agent', e.target.value)} rows={4}
                className="w-full rounded-lg border bg-background p-2 text-xs font-mono resize-y outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="text-xs text-muted-foreground font-mono" dir="ltr">
              refresh: {REFRESH_TOKEN}<br />client_id: {CLIENT_ID}
            </div>
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label>بروكسي Cloudflare Worker (لتجاوز CORS)</Label>
                <button onClick={toggleProxy} className={`relative w-10 h-5 rounded-full transition-colors ${tokens.useProxy ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-all ${tokens.useProxy ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
              <input dir="ltr" value={tokens.proxy} onChange={(e) => updateToken('proxy', e.target.value)}
                placeholder="https://nameless-mode-af36.tarotwithghada.workers.dev"
                className="w-full rounded-lg border bg-background p-2 text-xs font-mono outline-none focus:ring-1 focus:ring-ring" />
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <Link to="/worker"><Cloud className="w-3 h-3" /> احصل على كود الـ Worker <ExternalLink className="w-3 h-3" /></Link>
              </Button>
            </div>
          </section>
        )}

        {/* Free Chat */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">1) FREE CHAT — MCP agent</h2>
              <p className="text-xs text-muted-foreground font-mono" dir="ltr">POST https://mcp.supercool.com/mcp</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>الرسالة</Label>
            <textarea dir="rtl" value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} rows={2}
              className="w-full rounded-lg border bg-background p-2 text-sm resize-y outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <Button onClick={sendChat} disabled={chatLoading || !chatMsg.trim()}>
            {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
          </Button>
          {chatError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {chatError}
            </div>
          )}
          {chatResult && (
            <div className="space-y-2">
              <Label>Response</Label>
              {chatResult.url ? (
                <p className="text-sm">الرد: {chatResult.reply}</p>
              ) : null}
              <CodeBlock>{typeof chatResult.raw === 'string' ? chatResult.raw : JSON.stringify(chatResult.raw, null, 2)}</CodeBlock>
            </div>
          )}
        </section>

        {/* Free Image */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">2) FREE IMAGE — unlimited, anon OK</h2>
              <p className="text-xs text-muted-foreground font-mono" dir="ltr">POST https://api.supercool.com/api/v1/posts/generate-cover-image</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>الـ prompt</Label>
            <textarea dir="ltr" value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} rows={2}
              className="w-full rounded-lg border bg-background p-2 text-sm resize-y outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <Button onClick={generateImage} disabled={imgLoading || !imgPrompt.trim()}>
            {imgLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} توليد الصورة
          </Button>
          {imgError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {imgError}
            </div>
          )}
          {imgResult?.url && (
            <div className="space-y-2">
              <img src={imgResult.url} alt="generated" className="w-full rounded-lg border" />
              <Label>cover_image_url</Label>
              <CodeBlock>{imgResult.url}</CodeBlock>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}