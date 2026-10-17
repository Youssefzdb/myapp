import { base44 } from "@/api/base44Client";

/** Parse the declarative backend spec (server/api.json) from the generated files. */
export function parseBackendSpec(files) {
  try {
    const raw = files?.["server/api.json"];
    if (!raw) return null;
    const spec = JSON.parse(raw);
    return spec && spec.collections ? spec : null;
  } catch {
    return null;
  }
}

/** Parse a backend_spec string stored on a PublishedApp record. */
export function parseSpecString(raw) {
  try {
    if (!raw) return null;
    const spec = typeof raw === "string" ? JSON.parse(raw) : raw;
    return spec && spec.collections ? spec : null;
  } catch {
    return null;
  }
}

/**
 * Bridges fetch('/api/...') calls from the sandboxed preview/published iframe to
 * the platform apiRuntime backend function. Install once on mount; the getters
 * read live refs so the listener always uses the current spec/appId.
 */
export function startBackendBridge({ getAppId, getSpec }) {
  const handler = async (e) => {
    const data = e.data;
    if (!data || data.type !== "backend-call") return;
    const appId = getAppId();
    const spec = getSpec();
    const reply = (res) => { try { e.source?.postMessage({ type: "backend-res", id: data.id, res }, "*"); } catch { /* ignore */ } };
    if (!appId || !spec) { reply({ status: 404, body: { error: "no backend" } }); return; }
    try {
      const resp = await base44.functions.invoke("apiRuntime", {
        appId, spec, method: data.method, path: data.path, body: data.body, query: data.query,
      });
      const d = resp?.data || {};
      reply({ status: d.status || 200, body: d.body ?? d });
    } catch (err) {
      reply({ status: 500, body: { error: String(err?.message || err) } });
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}