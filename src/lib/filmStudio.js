// Film Studio pipeline (client-side, no Base44 credits). A text AI takes an idea
// and returns a structured shot plan (script → breakdown → shot prompts), then
// storyboard images are generated free via Pollinations and played back as a
// timed slideshow with browser TTS narration.
import { sendChat } from "./opencode";

const SYSTEM = `You are a film studio script supervisor running the Film Studio Skills pipeline (studio-init → film-breakdown → shot-prompt) for a SHORT video (15-35 seconds, 4-7 shots).
The user gives an idea. You output ONLY a JSON object — no prose, no markdown, no code fences — with this EXACT shape:
{
  "title": string,
  "logline": string,
  "durationSec": number,
  "aspectRatio": "16:9",
  "shots": [
    {
      "id": 1,
      "durationSec": number,
      "narration": string,
      "imagePrompt": string,
      "onScreenText": string
    }
  ]
}
Rules:
- Sum of shots' durationSec must equal durationSec (±2s).
- narration: Arabic voiceover line for THIS shot, ≤ 18 words, natural spoken tone. Read in order, the shots form a coherent story.
- imagePrompt: English, self-contained, detailed cinematic prompt for an image model (subject, composition, lighting, color palette, lens, mood, style). Never reference other shots. No text-in-image.
- onScreenText: short Arabic label shown over the shot (≤ 4 words), or "" if none.
Respond now with the JSON object only.`;

export async function generateVideoPlan({ idea, model, effort, signal, onStatus }) {
  onStatus?.("يكتب السيناريو ويفكّك اللقطات…");
  const res = await sendChat({
    prompt: `Idea:\n"""\n${idea}\n"""\n\nReturn the JSON video plan now.`,
    history: [],
    model,
    effort,
    system: SYSTEM,
    signal,
  });
  const plan = extractJson(res.content);
  if (!plan || !Array.isArray(plan.shots) || !plan.shots.length) {
    throw new Error("لم يُرجِع النموذج خطة فيديو صالحة. حاول صياغة الفكرة بتفصيل أكثر.");
  }
  // Normalize + give each shot a stable seed for its image.
  plan.shots = plan.shots.map((s, i) => ({
    id: s.id ?? i + 1,
    durationSec: Math.max(2, Math.min(12, Number(s.durationSec) || 4)),
    narration: String(s.narration || "").trim(),
    imagePrompt: String(s.imagePrompt || "cinematic establishing shot, soft natural light, 16:9").trim(),
    onScreenText: String(s.onScreenText || "").trim(),
  }));
  plan.aspectRatio = plan.aspectRatio || "16:9";
  return plan;
}

function extractJson(text) {
  if (!text) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

export function shotImageUrl(prompt, { width = 1024, height = 576, seed = 1 } = {}) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
}