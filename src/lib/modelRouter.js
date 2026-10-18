/**
 * Smart Model Router — picks the best model for each step of the agent loop
 * based on the task category: planning, quick_edit, coding, vision, security.
 *
 * Goal: better quality, lower cost, less waiting. A strong model is used only
 * for complex planning; a fast model handles small edits; a code-specialized
 * model writes the bulk of files; a vision model analyses attached images; a
 * security-minded model reviews the final result.
 */

export const CATEGORIES = ["planning", "coding", "quick_edit", "vision", "security"];

const PLAN_HINTS = [
  "خطّط", "خطة", "plan", "architecture", "اعمار", "بناء", "أنشئ", "create a", "build a",
  "redesign", "أعد التصميم", "refactor", "إعادة هيكلة", "صمّم", "design a", "from scratch",
  "multi-page", "متعدد", "نظام", "platform", "dashboard", "لوحة",
];
const QUICK_HINTS = [
  "أصلح", "fix", "غيّر", "change the", "أضف زر", "add a button", "نص", "text", "لون",
  "color", "صغير", "small", "typo", "تحسين", "tweak", "rename", "أعد تسمية",
];
const SECURITY_HINTS = [
  "أمان", "security", "vulnerability", "ثغرة", "xss", "injection", "sanitize",
  "تطهير", "حماية", "protect", "unsafe", "خطر",
];

/**
 * Classifies the current step into one of the categories.
 * context: { step, hasImages, isNewProject, changedFilesCount, request }
 */
export function classifyStep(request, context = {}) {
  const p = String(request || "");
  const low = p.toLowerCase();
  if (context.hasImages) return "vision";
  if (context.step === 0 || context.isNewProject) return "planning";
  if (SECURITY_HINTS.some((h) => low.includes(h.toLowerCase()) || p.includes(h))) return "security";
  if (PLAN_HINTS.some((h) => low.includes(h.toLowerCase()) || p.includes(h))) return "planning";
  const smallEdit = (context.changedFilesCount ?? 99) <= 1 && p.length < 160;
  if (smallEdit || QUICK_HINTS.some((h) => low.includes(h.toLowerCase()) || p.includes(h))) return "quick_edit";
  return "coding";
}

// Preference order per category. Matched against model id/name (lowercased).
const PREFERRED = {
  planning: ["opus", "sonnet", "pro", "thinking", "reasoning", "o1", "o3", "4.5", "4.6", "5", "beam-free"],
  coding: ["coder", "code", "codestral", "deepseek", "qwen", "starcoder", "beam-free"],
  vision: ["vision", "gemini", "gpt-4o", "claude-3.5", "sonnet", "opus", "beam-free"],
  security: ["sonnet", "opus", "pro", "reasoning", "beam-free"],
  quick_edit: ["flash", "mini", "fast", "haiku", "turbo", "free", "beam-free"],
};

/**
 * Picks the best available model id for a category, falling back to the
 * user-selected model when no preference matches.
 * available: [{ id, name }]  | fallback: string model id
 */
export function pickModel(category, available = [], fallback) {
  const prefs = PREFERRED[category] || [];
  for (const key of prefs) {
    const k = key.toLowerCase();
    const m = available.find(
      (m) => (m.id || "").toLowerCase().includes(k) || (m.name || "").toLowerCase().includes(k)
    );
    if (m && m.id) return m.id;
  }
  return fallback;
}

export const CATEGORY_LABELS = {
  planning: "تخطيط",
  coding: "برمجة",
  quick_edit: "تعديل سريع",
  vision: "تحليل الصور",
  security: "مراجعة الأمان",
};