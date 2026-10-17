import { base44 } from "@/api/base44Client";

export async function getGithubConfig() {
  const res = await base44.functions.invoke("githubOAuth", { config: true });
  return res?.data;
}

export async function exchangeGithubCode(code, redirect_uri) {
  const res = await base44.functions.invoke("githubOAuth", { code, redirect_uri });
  return res?.data;
}

export async function checkGithub(token) {
  const res = await base44.functions.invoke("githubPush", { check: true, token });
  const data = res?.data;
  if (!data?.connected || !data.login) {
    const error = new Error(data?.error || "تعذّر التحقق من ربط GitHub.");
    error.code = data?.code;
    error.reconnectRequired = data?.reconnectRequired;
    throw error;
  }
  return data;
}

export async function pushProjectToGithub({ files, repo, private: isPrivate, commitMessage, token }) {
  const res = await base44.functions.invoke("githubPush", { files, repo, private: !!isPrivate, commitMessage, token });
  return res?.data;
}