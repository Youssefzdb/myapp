// Supercool OAuth token lifecycle (agent scope).
// The agent access token expires in ~24h; we refresh it with the rotated
// refresh token at https://api.supercool.sh/oauth/token (form-urlencoded).

export const DEFAULT_CLIENT_ID = 'mcp_client_stXfma_n1v72u8cy0IlqA1xL';
export const DEFAULT_REFRESH_TOKEN = 'rt_AhulVS_5hF7v9IBifUxcsca9IeLRmq2cz6fY3YmiMQsid7ye';
export const OAUTH_TOKEN_ENDPOINT = 'https://api.supercool.sh/oauth/token';

const TOKEN_KEY = 'opencode_test_tokens_v1';

export function decodeJwtPayload(jwt) {
  try {
    const part = String(jwt || '').split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function tokenExpiresInSeconds(jwt) {
  const payload = decodeJwtPayload(jwt);
  if (!payload || !payload.exp) return Infinity;
  return payload.exp - Math.floor(Date.now() / 1000);
}

export function isTokenExpiringSoon(jwt, leewaySec = 120) {
  return tokenExpiresInSeconds(jwt) <= leewaySec;
}

export function formatExpiry(jwt) {
  const secs = tokenExpiresInSeconds(jwt);
  if (!Number.isFinite(secs)) return 'غير معروف';
  if (secs <= 0) return 'منتهٍ';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)} يوم`;
  if (h > 0) return `${h} س ${m} د`;
  return `${m} د`;
}

export function loadSupercoolTokens(defaults) {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return {
        anon: o.anon || defaults.anon,
        agent: o.agent || defaults.agent,
        refresh: o.refresh || defaults.refresh,
        clientId: o.clientId || defaults.clientId,
        proxy: o.proxy?.trim() || defaults.proxy,
        useProxy: o.proxyVersion === 2 ? o.useProxy !== false : true,
        proxyVersion: 2,
      };
    }
  } catch { /* ignore */ }
  return { ...defaults, useProxy: true, proxyVersion: 2 };
}

export function saveSupercoolTokens(tokens) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens)); } catch { /* ignore */ }
}

// Refresh the agent access token. The refresh token is rotated on every call,
// so the new one is returned and must replace the stored one.
export async function refreshAgentToken({ refreshToken, clientId, proxy, useProxy, signal }) {
  if (!refreshToken) throw new Error('لا يوجد refresh token. أضِفه من إعدادات الاتصال.');
  if (!clientId) throw new Error('لا يوجد client_id. أضِفه من إعدادات الاتصال.');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  let url = OAUTH_TOKEN_ENDPOINT;
  if (useProxy && proxy) {
    let parsed;
    try { parsed = new URL(proxy.trim()); }
    catch { throw new Error('رابط الـ Worker غير صالح.'); }
    if (parsed.protocol !== 'https:') throw new Error('يجب أن يبدأ رابط الـ Worker بـ https://');
    parsed.searchParams.set('target', OAUTH_TOKEN_ENDPOINT);
    url = parsed.href;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
    signal,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`); }
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(', ') : null;
    throw new Error(detail || data.error_description || data.error || `HTTP ${res.status}`);
  }
  if (!data.access_token) throw new Error('لم تُرجع نقطة التجديد توكن وصول جديد.');
  return {
    agent: data.access_token,
    refresh: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
  };
}