import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Visual verification of the live preview screenshot against the user's task.
// Runs InvokeLLM with vision (server-side per the Core routing rule).
export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl = String(body?.image_url || "").trim();
    const task = String(body?.task || "").trim();
    if (!imageUrl) return Response.json({ error: "image_url required" }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const prompt =
      "You are a senior front-end reviewer. A web app was generated for this user request:\n" +
      `"${task}"\n\n` +
      "A screenshot of the LIVE rendered preview is attached. Verify the preview visually matches the request. " +
      "Check for: an essentially empty/blank page; raw unstyled HTML (default browser styles, no layout); " +
      "a visible error/crash screen; badly broken layout (overlapping/cut-off content, giant unformatted text); " +
      "and whether the MAIN feature the user asked for is visible and recognizable. " +
      "Be lenient about minor aesthetic polish and about empty data states (seed data may be sparse) — an empty-data state is NOT a failure. " +
      "Respond ONLY as JSON: { \"ok\": boolean, \"issues\": string, \"notes\": string }. " +
      "If ok is true, issues must be empty. If ok is false, issues must be a concise numbered list of concrete visual problems to fix (not suggestions).";

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [imageUrl],
      response_json_schema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          issues: { type: "string" },
          notes: { type: "string" }
        },
        required: ["ok", "issues"]
      }
    });

    const out = res && typeof res === "object" ? res : { ok: true, issues: "", notes: "" };
    return Response.json(out);
  } catch (error) {
    return Response.json({ error: error?.message || "verify failed" }, { status: 500 });
  }
}