import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const OPENCODE_CHAT = 'https://superagent-2b61d5b9.base44.app/functions/opencodeChat';
const IMG_MODEL = 'beam-free';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || '').trim();
    if (!prompt || prompt.length > 1000) return Response.json({ error: 'Invalid prompt' }, { status: 400 });

    const svgPrompt =
      'Generate a single self-contained SVG illustration. Output ONLY raw <svg>...</svg> markup — no explanation, no markdown, no code fences. ' +
      'Requirements: viewBox="0 0 400 300", xmlns attribute, all fills/styles inline, no external images, no scripts, no text unless asked. ' +
      'Style: clean, modern, flat vector illustration with a cohesive palette. Subject: ' + prompt;

    const res = await fetch(OPENCODE_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: svgPrompt }],
        model: IMG_MODEL,
        system: 'You output only raw SVG markup. No prose, no fences.',
        reasoning_effort: 'low',
      }),
    });
    if (!res.ok) return Response.json({ error: 'Image model request failed' }, { status: 502 });
    const data = await res.json().catch(() => ({}));
    let svg = String(data.content || '').trim();
    svg = svg.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = svg.indexOf('<svg');
    const end = svg.lastIndexOf('</svg>');
    if (start < 0 || end < 0 || end <= start) return Response.json({ error: 'No SVG produced' }, { status: 502 });
    svg = svg.slice(start, end + 6);
    // Inline data URL — no upload to any server, no Base44 credits consumed.
    const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    return Response.json({ url, prompt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}