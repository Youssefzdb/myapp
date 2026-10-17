import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Real, persistent REST backend for generated apps. The app owner declares
// collections + seed data in server/api.json (stored on PublishedApp.backend_spec
// or passed inline for the preview). This function serves standard CRUD over
// those collections from the BackendData entity — no eval, no arbitrary code.

const parseSpec = (raw) => {
  if (!raw) return null;
  try {
    const spec = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return spec && spec.collections ? spec : null;
  } catch {
    return null;
  }
};

// /api/:collection  or  /api/:collection/:id
const matchPath = (path) => {
  const m = /^\/api\/([^/]+)(?:\/([^/?]+))?/.exec(path || '');
  if (!m) return null;
  return { collection: decodeURIComponent(m[1]), id: m[2] ? decodeURIComponent(m[2]) : null };
};

const ok = (status, body) => Response.json({ status, body });

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const { appId, spec: inlineSpec, method, path, body: reqBody, query } = payload;
    const appKey = String(appId || '').slice(0, 80);
    if (!appKey) return ok(400, { error: 'missing appId' });

    let spec = parseSpec(inlineSpec);
    if (!spec) {
      // published mode — load the declarative spec from the PublishedApp record
      let rec = null;
      try { rec = await base44.asServiceRole.entities.PublishedApp.get(appKey); } catch { /* not found */ }
      if (!rec) return ok(404, { error: 'app not found' });
      spec = parseSpec(rec.backend_spec);
    }
    if (!spec) return ok(404, { error: 'no backend defined' });

    const match = matchPath(path);
    if (!match) return ok(404, { error: 'not found' });
    const { collection, id } = match;
    if (!spec.collections[collection]) return ok(404, { error: 'collection not found' });

    const store = base44.asServiceRole.entities.BackendData;
    const m = String(method || 'GET').toUpperCase();
    const q = { app_id: appKey, collection };

    // lazy seed: populate from spec.seed on first access
    const seed = spec.seed && Array.isArray(spec.seed[collection]) ? spec.seed[collection] : null;
    if (seed && seed.length) {
      const existing = await store.filter(q, { limit: 1, fields: ['ref'] });
      if (!existing.items?.length) {
        const docs = seed.map((d) => ({ app_id: appKey, collection, ref: crypto.randomUUID(), data: d ?? {} }));
        await store.bulkCreate(docs);
      }
    }

    if (m === 'GET' && !id) {
      const limit = Math.min(Number(query?.limit) || 100, 200);
      let sort = '-created_date';
      if (query?.sort && /^-?[a-zA-Z_.]+$/.test(String(query.sort))) sort = String(query.sort);
      const page = await store.filter(q, { sort, limit, fields: ['ref', 'data'] });
      return ok(200, { items: (page.items || []).map((r) => ({ id: r.ref, ...(r.data || {}) })) });
    }

    if (m === 'GET' && id) {
      const page = await store.filter({ ...q, ref: id }, { limit: 1, fields: ['ref', 'data'] });
      if (!page.items?.length) return ok(404, { error: 'not found' });
      const r = page.items[0];
      return ok(200, { id: r.ref, ...(r.data || {}) });
    }

    if (m === 'POST' && !id) {
      const doc = reqBody && typeof reqBody === 'object' ? reqBody : {};
      const ref = crypto.randomUUID();
      await store.create({ app_id: appKey, collection, ref, data: doc });
      return ok(201, { id: ref, ...doc });
    }

    if ((m === 'PUT' || m === 'PATCH') && id) {
      const page = await store.filter({ ...q, ref: id }, { limit: 1, fields: ['ref', 'data'] });
      if (!page.items?.length) return ok(404, { error: 'not found' });
      const doc = reqBody && typeof reqBody === 'object' ? reqBody : {};
      await store.update(page.items[0].id, { data: doc });
      return ok(200, { id, ...doc });
    }

    if (m === 'DELETE' && id) {
      const page = await store.filter({ ...q, ref: id }, { limit: 1, fields: ['ref'] });
      if (!page.items?.length) return ok(404, { error: 'not found' });
      await store.delete(page.items[0].id);
      return ok(200, { ok: true, id });
    }

    return ok(405, { error: 'method not allowed' });
  } catch (error) {
    return ok(500, { error: String(error?.message || error) });
  }
}