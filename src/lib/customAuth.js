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
  const session = { id: acc.id, email: acc.email };
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