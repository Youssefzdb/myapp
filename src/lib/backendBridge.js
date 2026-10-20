import { supabase } from '@/lib/supabaseClient';

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
    const spec = getSpec();
    const reply = (res) => { try { e.source?.postMessage({ type: "backend-res", id: data.id, res }, "*"); } catch { /* ignore */ } };
    if (!supabase) { reply({ status: 503, body: { error: "Supabase is not configured" } }); return; }
    try {
      const match = String(data.path || '').match(/^\/?api\/([A-Za-z_][A-Za-z0-9_]*)(?:\/([^/]+))?\/?$/);
      if (!match) { reply({ status: 404, body: { error: "Use /api/<table> or /api/<table>/<id>" } }); return; }
      const [, table, id] = match;
      const collection = spec?.collections?.find((item) => item.name === table);
      if (spec && !collection) { reply({ status: 404, body: { error: `Collection '${table}' is not in the backend spec` } }); return; }
      const query = supabase.from(table);
      let result;
      if (data.method === 'GET') {
        let request = id ? query.select('*').eq('id', id).maybeSingle() : query.select('*').limit(100);
        result = await request;
      } else if (data.method === 'POST') {
        result = await query.insert(data.body || {}).select().single();
      } else if (data.method === 'PATCH' || data.method === 'PUT') {
        if (!id) { reply({ status: 400, body: { error: 'An id is required for updates' } }); return; }
        result = await query.update(data.body || {}).eq('id', id).select().single();
      } else if (data.method === 'DELETE') {
        if (!id) { reply({ status: 400, body: { error: 'An id is required for deletes' } }); return; }
        result = await query.delete().eq('id', id).select().maybeSingle();
      } else { reply({ status: 405, body: { error: 'Method not supported' } }); return; }
      if (result.error) { reply({ status: 400, body: { error: result.error.message } }); return; }
      reply({ status: 200, body: result.data });
    } catch (err) {
      reply({ status: 500, body: { error: String(err?.message || err) } });
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
