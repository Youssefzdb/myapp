// Supercool "free" tools for the app-building agent loop.
// Reuses the tokens the user edits on the /test page (localStorage), so the
// same anon/agent credentials power both the test page and the playground.
import {
  loadSupercoolTokens,
  saveSupercoolTokens,
  refreshAgentToken,
  DEFAULT_REFRESH_TOKEN,
  DEFAULT_CLIENT_ID,
} from './supercoolAuth';
import { parseSupercoolChat } from './supercoolResponse';

export const DEFAULT_ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYzhlZWJmOWQtYjlhNy00NzNkLWI2MmMtYTUzZGNjNWM1YjAyIiwiZW1haWwiOiJhbm9uLWM4ZWViZjlkLWI5YTctNDczZC1iNjJjLWE1M2RjYzVjNWIwMkBhbm9uLnN1cGVyY29vbC5pbnRlcm5hbCIsInN2IjowLCJpYXQiOjE3OTI0MjcyNzUsImp0aSI6IjU2YzFrUUtnbE0wVmlvQ2hXSVg0bXciLCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzk1MDE5Mjc1fQ.2fWXjwG-39TSBEPFwhMe7xRzyWB8XOSj_fZxymyEUSg';

export const DEFAULT_AGENT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5zdXBlcmNvb2wuc2giLCJhdWQiOiJodHRwczovL21jcC5zdXBlcmNvb2wuY29tL21jcCIsInN1YiI6ImM4ZWViZjlkLWI5YTctNDczZC1iNjJjLWE1M2RjYzVjNWIwMiIsImNsaWVudF9pZCI6Im1jcF9jbGllbnRfc3RYZm1hX24xdjcydThjeTBJbHFBMXhMIiwic2NvcGUiOiJhZ2VudCIsIm1jcF9zZXNzaW9uX2lkIjoibWNwX1NuYWRTQXZXNHhGOVNkcTUiLCJzdXJmYWNlIjoibWNwIiwidG9rZW5fdHlwZSI6ImFnZW50X2FjY2VzcyIsImlhdCI6MTc5MjQyNzQwMiwiZXhwIjoxNzkyNTEzODAyfQ.YtO5woyGdAv0i78M1NvkKzplAuBZH8nah7jNfAtQHQI';

export const DEFAULT_PROXY_URL = 'https://nameless-mode-af36.tarotwithghada.workers.dev';

const DEFAULTS = {
  anon: DEFAULT_ANON_JWT,
  agent: DEFAULT_AGENT_TOKEN,
  refresh: DEFAULT_REFRESH_TOKEN,
  clientId: DEFAULT_CLIENT_ID,
  proxy: DEFAULT_PROXY_URL,
};

const getTokens = () => loadSupercoolTokens(DEFAULTS);

function throughProxy(url, tokens) {
  if (!tokens.useProxy) return url;
  const proxy = new URL((tokens.proxy || DEFAULT_PROXY_URL).trim());
  if (proxy.protocol !== 'https:') throw new Error('يجب أن يبدأ رابط الـ Worker بـ https://');
  proxy.searchParams.set('target', url);
  return proxy.href;
}

// Free image generation (anon token). Returns a public image URL.
export async function supercoolGenerateImage(prompt, { signal } = {}) {
  const tokens = getTokens();
  const url = throughProxy('https://api.supercool.com/api/v1/posts/generate-cover-image', tokens);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`); }
  if (!res.ok || data.code !== 0) throw new Error(data.detail || data.msg || `HTTP ${res.status}`);
  const img = data?.data?.cover_image_url;
  if (!img) throw new Error('لم تُرجع الخدمة رابط صورة');
  return img;
}

// Free chat with the Supercool MCP agent (agent token, auto-refreshed).
export async function supercoolChat(message, { signal } = {}) {
  let tokens = getTokens();
  const requestId = crypto.randomUUID();
  const body = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: { name: 'message_agent', arguments: { message, request_id: requestId } },
  };
  const doFetch = (tok) =>
    fetch(throughProxy('https://mcp.supercool.com/mcp', tok), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tok.agent}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  let res = await doFetch(tokens);
  if (res.status === 401) {
    const refreshed = await refreshAgentToken({
      refreshToken: tokens.refresh,
      clientId: tokens.clientId,
      proxy: tokens.proxy,
      useProxy: tokens.useProxy,
      signal,
    });
    tokens = { ...tokens, agent: refreshed.agent, refresh: refreshed.refresh };
    saveSupercoolTokens(tokens);
    res = await doFetch(tokens);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 500)}`);
  const parsed = parseSupercoolChat(text, res.headers.get('content-type') || '');
  return parsed.reply || text;
}