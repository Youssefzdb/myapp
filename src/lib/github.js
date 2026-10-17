import { base44 } from "@/api/base44Client";

export const GITHUB_CONNECTOR_ID = "6ad3ec94025725ba68967b57";

/** Checks the current user's GitHub connection; returns { connected, login } or throws if not connected. */
export async function checkGithub() {
  const res = await base44.functions.invoke("githubPush", { check: true });
  const data = res?.data;
  if (!data?.connected || !data.login) {
    const error = new Error(data?.error || 'تعذّر التحقق من ربط GitHub.');
    error.code = data?.code;
    throw error;
  }
  return data;
}

/** Disconnects the current user's account and removes its saved credential. */
export async function disconnectGithub() {
  const res = await base44.functions.invoke("githubPush", { disconnect: true });
  if (!res?.data?.disconnected) throw new Error(res?.data?.error || 'تعذّر فصل الربط');
}

/** Pushes the full project files to the user's GitHub repo. */
export async function pushProjectToGithub({ files, repo, private: isPrivate, commitMessage }) {
  const res = await base44.functions.invoke("githubPush", { files, repo, private: !!isPrivate, commitMessage });
  return res?.data;
}