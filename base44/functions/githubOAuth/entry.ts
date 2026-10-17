import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const clientId = secrets.get("GITHUB_CLIENT_ID");
    const clientSecret = secrets.get("GITHUB_CLIENT_SECRET");

    if (body.config) {
      return Response.json({ client_id: clientId });
    }

    const code = String(body.code || '').trim();
    const redirectUri = String(body.redirect_uri || '').trim();
    if (!code || !redirectUri) {
      return Response.json({ error: 'missing code or redirect_uri' }, { status: 400 });
    }

    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json().catch(() => ({}));
    if (d.error || !d.access_token) {
      return Response.json({ error: d.error_description || d.error || 'exchange failed' }, { status: 400 });
    }
    return Response.json({ access_token: d.access_token, scope: d.scope });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}