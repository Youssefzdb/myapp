import { base44 } from "@/api/base44Client";

const SESSION_KEY = "vibe_custom_session";

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeSalt() {
  return Math.random().toString(36).slice(2, 12);
}

export async function registerAccount(email, password) {
  const { items } = await base44.entities.Account.filter({ email }, { limit: 1 });
  if (items && items.length) throw new Error("هذا البريد مُسجّل بالفعل");
  const salt = makeSalt();
  const hash = await hashPassword(password, salt);
  const rec = await base44.entities.Account.create({ email, password: `${salt}$${hash}` });
  const session = { id: rec.id, email: rec.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function loginAccount(email, password) {
  const { items } = await base44.entities.Account.filter({ email }, { limit: 1 });
  if (!items || !items.length) throw new Error("بيانات الدخول غير صحيحة");
  const acc = items[0];
  const [salt, hash] = (acc.password || "").split("$");
  if (!salt || !hash) throw new Error("بيانات الدخول غير صحيحة");
  if ((await hashPassword(password, salt)) !== hash) throw new Error("بيانات الدخول غير صحيحة");
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