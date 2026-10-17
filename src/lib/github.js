import { base44 } from "@/api/base44Client";

export const GITHUB_CONNECTOR_ID = "6ad3ec94025725ba68967b57";

/** Checks the current user's GitHub connection; returns { connected, login } or throws if not connected. */
export async function checkGithub() {
  const res = await base44.functions.invoke("githubPush", { check: true });
  return res?.data;
}

/** Pushes the full project files to the user's GitHub repo. */
export async function pushProjectToGithub({ files, repo, private: isPrivate, commitMessage }) {
  const res = await base44.functions.invoke("githubPush", { files, repo, private: !!isPrivate, commitMessage });
  return res?.data;
}