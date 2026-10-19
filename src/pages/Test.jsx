import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Image as ImageIcon, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CHAT = {
  title: '1) FREE CHAT — MCP agent',
  endpoint: 'POST https://mcp.supercool.com/mcp',
  headers: 'Authorization: Bearer <AGENT_TOKEN> + Accept: application/json, text/event-stream (+ Content-Type: application/json)',
  token: 'anonymous JWT + OAuth consent chain (DCR → authorize → POST api.supercool.com/oauth/authorize/complete {"req_id":"...","decision":"approve"} → token exchange at api.supercool.sh/oauth/token) → token scope agent, valid 24h, free.',
  request: `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"message_agent","arguments":{"message":"quick test, just say ok","request_id":"my-1"}}}`,
  response: `{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Ok."}],"structuredContent":{"supercool":{"type":"message_agent","status":"answered","reply":"Ok.","work":[],"items":[],"cursor":"eyJ...","notes":[]}}}}`,
  note: 'El chat = free (LLM inference). Tools: message_agent, wait_for_updates, get_work.',
};

const IMAGE = {
  title: '2) FREE IMAGE — unlimited, anon OK',
  endpoint: 'POST https://api.supercool.com/api/v1/posts/generate-cover-image',
  auth: 'Bearer <ANON_JWT> (mzyan anonymous!)',
  request: `{"prompt":"neon cyberpunk robot holding a glowing SHADOWX sign"}`,
  response: `{"code":0,"data":{"cover_image_url":"https://d38kszyerljeoa.cloudfront.net/posts/<user_id>/e73ebef2a172.webp"}}`,
  note: '→ 2048×2048 WebP, 0 credits, bla rate limit.',
  extra: 'Wani extra: POST /creator/generate {"model_id":"flux-schnell","prompt":"..."} = 3cr/image → 1024×1024 JPEG; response {"job_id":"..."} w poll GET /creator/jobs/<job_id>.',
};

function CodeBlock({ children }) {
  return (
    <pre dir="ltr" className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
      {children}
    </pre>
  );
}

function Row({ label, value }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <CodeBlock>{value}</CodeBlock>
    </div>
  );
}

export default function Test() {
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
          <Button asChild variant="ghost" size="sm"><Link to="/">العودة <ArrowRight className="w-4 h-4 mr-1" /></Link></Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Chat card */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold">{CHAT.title}</h2>
          </div>
          <Row label="Endpoint" value={CHAT.endpoint} />
          <Row label="Headers" value={CHAT.headers} />
          <Row label="Token" value={CHAT.token} />
          <Row label="Request" value={CHAT.request} />
          <Row label="Response (SSE data: line)" value={CHAT.response} />
          <p className="text-sm text-muted-foreground">{CHAT.note}</p>
        </section>

        {/* Image card */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold">{IMAGE.title}</h2>
          </div>
          <Row label="Endpoint" value={IMAGE.endpoint} />
          <Row label="Auth" value={IMAGE.auth} />
          <Row label="Request" value={IMAGE.request} />
          <Row label="Response" value={IMAGE.response} />
          <p className="text-sm text-muted-foreground">{IMAGE.note}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{IMAGE.extra}</p>
        </section>
      </main>
    </div>
  );
}