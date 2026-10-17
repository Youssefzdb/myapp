import { base44 } from "@/api/base44Client";

const SESSION_KEY = "vibe_custom_session";

export async function registerAccount(email, password) {
  const { items } = await base44.entities.Account.filter({ email }, { limit: 1 });
  if (items && items.length) throw new Error("هذا البريد مُسجّل بالفعل");
  const rec = await base44.entities.Account.create({ email, password });
  const session = { id: rec.id, email: rec.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function loginAccount(email, password) {
  const { items } = await base44.entities.Account.filter({ email }, { limit: 1 });
  if (!items || !items.length) throw new Error("بيانات الدخول غير صحيحة");
  const acc = items[0];
  if ((acc.password || "") !== password) throw new Error("بيانات الدخول غير صحيحة");
  const session = { id: acc.id, email: acc.email, github_token: acc.github_token || "" };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function logoutAccount() {
  localStorage.removeItem(SESSION_KEY);
}

export function getGithubToken() {
  return getSession()?.github_token || "";
}

export async function setGithubToken(token) {
  const s = getSession();
  if (!s) throw new Error("غير مسجّل");
  await base44.entities.Account.update(s.id, { github_token: token || "" });
  const updated = { ...s, github_token: token || "" };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}

export function clearGithubToken() {
  const s = getSession();
  if (!s) return;
  const updated = { id: s.id, email: s.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
}