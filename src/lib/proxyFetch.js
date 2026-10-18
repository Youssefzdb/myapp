/**
 * Browser-side "curl" through free CORS proxies — no Base44 function, no
 * integration credits. corsproxy.io forwards method + headers + body; allorigins
 * raw is a GET-only fallback. Returns { status, headers, body }.
 *
 * Browser security makes a TRUE arbitrary curl (any host, any method, raw
 * headers) impossible without a server — these free proxies are the closest
 * equivalent and need no signup or credits.
 */
const PROXIES = [
  {
    name: "corsproxy.io",
    build: (url) => "https://corsproxy.io/?url=" + encodeURIComponent(url),
    supportsMethod: true,
    passthroughHeaders: true,
  },
  {
    name: "allorigins",
    build: (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
    supportsMethod: false,
    passthroughHeaders: false,
  },
];

export async function proxyFetch({ url, method = "GET", headers = {}, body, signal }) {
  if (!url) throw new Error("url required");
  if (!/^https?:\/\//i.test(url)) throw new Error("Invalid URL (must start with http(s)://)");

  const wantMethod = String(method || "GET").toUpperCase();
  const isSimpleGet = wantMethod === "GET" && !body;
  let lastErr = null;

  for (const p of PROXIES) {
    // Skip proxies that can't honor the requested method/body
    if (!p.supportsMethod && (!isSimpleGet)) continue;
    try {
      const res = await fetch(p.build(url), {
        method: p.supportsMethod ? wantMethod : "GET",
        headers: p.passthroughHeaders ? headers : undefined,
        body: p.supportsMethod && body && wantMethod !== "GET" && wantMethod !== "HEAD" ? body : undefined,
        signal,
      });
      if (!res.ok) { lastErr = new Error(`${p.name}: HTTP ${res.status}`); continue; }
      const text = await res.text();
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: text,
      };
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }
  throw new Error("fetch failed via all proxies: " + (lastErr?.message || "unknown"));
}

/** Markdown-clean GET fetch (Jina Reader first, then raw HTML proxies). */
export async function proxyFetchText(url, { signal } = {}) {
  if (!url) throw new Error("url required");
  if (!/^https?:\/\//i.test(url)) throw new Error("Invalid URL");
  let text = "";
  try {
    const r = await fetch("https://r.jina.ai/" + url, { signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    text = await r.text();
  } catch (e) {
    if (signal?.aborted) throw e;
    const r2 = await fetch("https://corsproxy.io/?url=" + encodeURIComponent(url), { signal }).catch(() => null);
    if (r2 && r2.ok) {
      const html = await r2.text();
      text = stripHtml(html);
    } else {
      const r3 = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(url), { signal }).catch(() => null);
      if (!r3 || !r3.ok) throw new Error("fetch failed: " + (e?.message || "no proxy"));
      text = stripHtml(await r3.text());
    }
  }
  text = (text || "").trim();
  return text || "Empty page.";
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}