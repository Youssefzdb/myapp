import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Copy, Check, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WORKER_CODE = `// Cloudflare Worker — CORS proxy (no tokens, no secrets)
// Deploy: workers.cloudflare.com → New Worker → paste this → Deploy
// Usage from browser:
//   GET  https://<worker>.workers.dev/?target=<ENCODED_URL>
//   POST https://<worker>.workers.dev/?target=<ENCODED_URL>  (body + headers forwarded)
// The Authorization header you send from the client is forwarded as-is.

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Max-Age": "86400",
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("target");
    if (!target) {
      return new Response(JSON.stringify({
        ok: true,
        usage: "Append ?target=<URL-encoded destination>",
        example: "?target=" + encodeURIComponent("https://api.supercool.com/api/v1/posts/generate-cover-image"),
      }, null, 2), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    let targetUrl;
    try { targetUrl = new URL(decodeURIComponent(target)); }
    catch { return new Response("Invalid target", { status: 400, headers: cors }); }

    // Allow only the supercool hosts (optional allowlist — remove to proxy anything)
    const allowed = ["api.supercool.com", "mcp.supercool.com", "api.supercool.sh"];
    if (!allowed.includes(targetUrl.hostname)) {
      return new Response("Host not allowed", { status: 403, headers: cors });
    }

    // Forward headers, strip hop-by-hop / browser-only ones
    const headers = new Headers(request.headers);
    ["host", "origin", "referer", "cf-", "x-forwarded", "via"].forEach((h) => {
      for (const k of headers.keys()) {
        if (k.toLowerCase().startsWith(h)) headers.delete(k);
      }
    });

    const init = { method: request.method, headers };
    if (!["GET", "HEAD"].includes(request.method)) {
      init.body = await request.arrayBuffer();
    }

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), init);
    } catch (e) {
      return new Response("Upstream fetch failed: " + e.message, { status: 502, headers: cors });
    }

    const respHeaders = new Headers(upstream.headers);
    Object.entries(cors).forEach(([k, v]) => respHeaders.set(k, v));
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  }
};
`;

const STEPS = [
  'ادخل workers.cloudflare.com واضغط "Create application" ثم "Create Worker".',
  'امسح الكود الافتراضي والصق الكود أدناه، ثم اضغط "Deploy".',
  'انسخ رابط الـ Worker (مثل https://opencode-proxy.username.workers.dev).',
  'افتح صفحة Test، فعّل "استخدام بروكسي" والصق رابط الـ Worker.',
];

export default function Worker() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(WORKER_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div dir="rtl" className="relative isolate min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold">Cloudflare Worker — CORS Proxy</span>
          </Link>
          <Button asChild variant="ghost" size="sm"><Link to="/">العودة <ArrowRight className="w-4 h-4 mr-1" /></Link></Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="text-base font-bold">خطوات النشر</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pr-5">
            {STEPS.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </section>

        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">كود الـ Worker</h2>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'تم النسخ' : 'نسخ الكود'}
            </Button>
          </div>
          <pre dir="ltr" className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs font-mono leading-relaxed text-foreground whitespace-pre">
            {WORKER_CODE}
          </pre>
        </section>
      </main>
    </div>
  );
}