import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const url = String(body.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return Response.json({ error: 'Invalid URL' }, { status: 400 });
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VibeStudioBot/1.0)' },
      redirect: 'follow',
    });
    const type = res.headers.get('content-type') || '';
    let text = '';
    if (type.includes('text/html')) {
      const html = await res.text();
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      text = await res.text();
    }
    if (text.length > 8000) text = text.slice(0, 8000) + '…[truncated]';
    return Response.json({ content: text, status: res.status, url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}