import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const query = String(body.query || '').trim();
    if (!query || query.length > 500) return Response.json({ error: 'Invalid query' }, { status: 400 });
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Answer concisely with factual, up-to-date information gathered from the web. Be specific (names, numbers, URLs when relevant). Query: ${query}`,
      add_context_from_internet: true,
      model: 'gemini_3_8_flash',
    });
    const content = typeof result === 'string' ? result : (result?.content || JSON.stringify(result));
    const trimmed = content.length > 6000 ? content.slice(0, 6000) + '…[truncated]' : content;
    return Response.json({ content: trimmed, query });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}