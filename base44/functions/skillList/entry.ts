import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Returns the skill catalog, or the full content of skills matching a query.
// Runs server-side so anonymous playground users can load skills too.
export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || "").trim().toLowerCase();
    const base44 = createClientFromRequest(req);

    const { items } = await base44.asServiceRole.entities.Skill.filter(
      {},
      { sort: "category", limit: 200, fields: ["name", "title", "category", "description", "keywords", "content"] }
    );

    if (!query) {
      // Catalog only: name + title + category + description (no heavy content)
      return Response.json({
        count: items.length,
        skills: items.map((s) => ({
          name: s.name, title: s.title, category: s.category,
          description: s.description, keywords: s.keywords || ""
        }))
      });
    }

    // Match against name, title, keywords, description
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = items.filter((s) => {
      const hay = `${s.name} ${s.title} ${s.category} ${s.keywords || ""} ${s.description || ""}`.toLowerCase();
      return terms.some((t) => hay.includes(t));
    });

    return Response.json({
      query,
      count: matches.length,
      skills: matches.map((s) => ({
        name: s.name, title: s.title, category: s.category,
        description: s.description, content: s.content
      }))
    });
  } catch (error) {
    return Response.json({ error: error?.message || "skill list failed" }, { status: 500 });
  }
}