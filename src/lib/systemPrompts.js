/**
 * Editable AI system prompts — stored in browser localStorage so the user can
 * tune the agent's behaviour directly from the website with no backend and no
 * integration credits. Each prompt has a built-in DEFAULT; the user's override
 * (if any) is loaded at runtime and a "reset to default" restores it.
 */

const STORAGE_KEY = 'opencode_system_prompts_v1';

// Built-in defaults are sourced from the agent loop at first run. We keep a
// copy here so the dialog can show the default for comparison / reset even
// before the agent module has been imported.
export const PROMPT_DEFS = {
  agent: {
    name: 'وكيل البناء',
    description: 'تعليمات وكيل بناء التطبيقات (حلقة الأدوات).',
    default: '', // populated lazily from agentLoop's built-in prompt (see below)
  },
};

let store = null;

const load = () => {
  if (store) return store;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    store = raw ? JSON.parse(raw) : {};
  } catch {
    store = {};
  }
  return store;
};

const save = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* quota */ }
};

// The agent default is injected by agentLoop.js on first import so this module
// stays the single source of truth for overrides without duplicating the long
// prompt text here.
let agentDefault = '';
export const setAgentDefault = (text) => {
  agentDefault = text || '';
  PROMPT_DEFS.agent.default = agentDefault;
};

/** Returns the effective prompt (override if present, otherwise default). */
export const getPrompt = (id) => {
  const s = load();
  if (s[id] && typeof s[id] === 'string' && s[id].trim()) return s[id];
  if (id === 'agent') return agentDefault;
  return PROMPT_DEFS[id]?.default || '';
};

/** Save a user override for a prompt id. Empty string clears the override. */
export const setPrompt = (id, text) => {
  const s = load();
  if (!text || !text.trim()) delete s[id];
  else s[id] = text;
  save();
};

/** Remove the override and fall back to the built-in default. */
export const resetPrompt = (id) => {
  const s = load();
  delete s[id];
  save();
  return getPrompt(id);
};

export const isOverridden = (id) => {
  const s = load();
  return typeof s[id] === 'string' && s[id].trim().length > 0;
};