// Fetches a remote image server-side and returns it as a base64 data URL so the
// vision model can read it. Some direct image hosts (e.g. catbox.moe) are blocked
// for the model's image fetcher; fetching here (no CORS, no integration credits)
// and inlining the bytes as a data URL lets the VL model see the image.

const BLOCKED_HOSTS =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fe80:|fc00:)/i;

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || "").trim();
    if (!url) return Response.json({ error: "url required" }, { status: 400 });

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return Response.json({ error: "invalid url" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return Response.json({ error: "only http(s) allowed" }, { status: 400 });
    }
    if (BLOCKED_HOSTS.test(parsed.hostname)) {
      return Response.json({ error: "blocked host" }, { status: 400 });
    }

    const r = await fetch(parsed.href, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return Response.json({ error: `fetch failed (${r.status})` }, { status: 502 });
    const contentType = (r.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    const buf = await r.arrayBuffer();
    if (buf.byteLength === 0) return Response.json({ error: "empty image" }, { status: 502 });
    if (buf.byteLength > 12 * 1024 * 1024) {
      return Response.json({ error: "image too large" }, { status: 413 });
    }

    // base64 in chunks to avoid call-stack overflow on large buffers
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const b64 = btoa(binary);
    return Response.json({ data_url: `data:${contentType};base64,${b64}` });
  } catch (error) {
    return Response.json({ error: error?.message || "rehost failed" }, { status: 500 });
  }
}