import { OPENCODE_BASE } from "./opencode";

// The agent's own build models are text-only, but this free catalog model is a
// vision-language model reachable through the same opencodeChat endpoint, so we
// analyze the screenshot here (no platform integration credits) and feed the
// resulting spec into the build agent as text.
const VISION_MODEL = "nemotron-3.5-super-vl-free";

const ANALYSIS_PROMPT = `You are a senior front-end engineer reverse-engineering reference screenshot(s) so another AI can rebuild a pixel-accurate clone (99-100% fidelity). Examine every pixel. If multiple images are attached, they are different views/screens of the same product — analyze each and label which is which.

Output an EXHAUSTIVE structured spec in English (plain text with section headers, no preamble):

1. GLOBAL: direction (RTL/LTR), page background color (hex), max content width, overall layout/grid, density, corner-radius scale, shadow style, visual mood.
2. HEADER/NAV: background (hex), height, logo (position + describe so it can be regenerated), nav items (verbatim text + order), any search/auth controls, CTAs (text + exact button color hex), mobile vs desktop layout.
3. HERO: exact heading copy verbatim, subheading copy verbatim, CTA button(s) (text + color), imagery (describe precisely: subject, style, palette, composition, aspect ratio so it can be regenerated), alignment, spacing.
4. EVERY SUBSEQUENT SECTION in top-to-bottom order: for each — purpose, layout, components it contains, spacing/rhythm, exact hex colors for background/text/borders, typography (approx px size + weight), icons used (name them), and all visible copy verbatim. Include grids/cards/lists and their item structure.
5. FOOTER: columns, links verbatim, colors.
6. COLOR PALETTE: full list of hex values actually used, labeled by role (background, surface, primary, text, muted, border, accent).
7. TYPOGRAPHY: the font feel (sans/serif/mono, weight usage) and a concrete size scale (h1/h2/body/small in px).
8. IMAGES: for every image region, a precise generation prompt (subject + style + palette + composition + aspect) so a clone can regenerate a matching asset.
9. INTERACTIONS inferred: hover states, toggles, tabs, filters, forms, buttons — list what must actually work.

Be exhaustive and concrete with hex colors and verbatim copy. The downstream clone must match 99-100%. Do not summarize or skip regions. Do not write code. Output the spec only.`;

export async function analyzeImages(imageUrls, signal) {
  const content = [{ type: "text", text: ANALYSIS_PROMPT }];
  for (const url of imageUrls) content.push({ type: "image_url", image_url: { url } });
  const r = await fetch(`${OPENCODE_BASE}/opencodeChat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content }],
      model: VISION_MODEL,
      system: "You are a precise visual analyst. Output the spec only.",
      stream: false,
    }),
    signal,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || d?.message || `فشل تحليل الصورة (${r.status})`);
  const text = String(d.content || "").trim();
  if (!text) throw new Error("لم يُرجع تحليل الصورة محتوى");
  return text;
}

/**
 * Vision-based verification of the LIVE preview screenshot. The free VL model
 * actually "sees" the rendered preview and judges whether it rendered a real
 * app — and, when reference image(s) the user sent are attached, how closely
 * the preview matches the clone target. Returns { ok, issues, notes }.
 */
export async function verifyScreenshot(screenshotUrl, { task, referenceUrls } = {}, signal) {
  const hasRef = Array.isArray(referenceUrls) && referenceUrls.length > 0;
  const content = [];
  content.push({
    type: "text",
    text:
`You are a senior front-end reviewer verifying a LIVE rendered preview.${task ? ` The user's request: "${task}".` : ""}
A screenshot of the rendered preview is attached${hasRef ? ", followed by the reference image(s) the user wanted to clone" : ""}.
Check the preview for: blank/empty page, raw unstyled HTML, a visible error/crash, badly broken layout (overlapping/cut-off/giant text), and whether a real app actually rendered.${hasRef ? " ALSO judge how closely the preview matches the reference: section order, color palette, layout, spacing, typography, and visible content. List concrete fidelity gaps toward a 99-100% clone." : ""}
Be lenient about minor polish and about empty data states — an empty-data state is NOT a failure.
Respond ONLY with compact JSON: {"ok": boolean, "issues": string, "notes": string}. If ok is true, issues must be "". If ok is false, issues must be a concise numbered list of concrete problems to fix (not suggestions).`,
  });
  content.push({ type: "image_url", image_url: { url: screenshotUrl } });
  if (hasRef) for (const u of referenceUrls) content.push({ type: "image_url", image_url: { url: u } });

  const r = await fetch(`${OPENCODE_BASE}/opencodeChat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content }],
      model: VISION_MODEL,
      system: "You are a precise visual reviewer. Output JSON only.",
      stream: false,
    }),
    signal,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || d?.message || `فشل التحقق البصري (${r.status})`);
  const raw = String(d.content || "").trim();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
  }
  if (parsed && typeof parsed.ok === "boolean") {
    return { ok: parsed.ok, issues: String(parsed.issues || ""), notes: String(parsed.notes || "") };
  }
  // Unparseable verdict — don't block the build; pass with the raw note.
  return { ok: true, issues: "", notes: raw.slice(0, 200) };
}