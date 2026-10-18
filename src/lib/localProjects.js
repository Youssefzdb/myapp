/**
 * Browser-local project list so generated projects always appear on Home,
 * even without a custom-account login and even when file upload is unavailable.
 * The signed-in Account list (customAuth) is still updated separately when possible.
 */
const KEY = "vibe_projects_local";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function getLocalProjects() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveLocalProject({ title, prompt, code_uri }) {
  const list = getLocalProjects();
  const entry = {
    id: uid(),
    title: (title || "مشروع").slice(0, 80),
    prompt: prompt || "",
    code_uri: code_uri || "",
    created_date: new Date().toISOString(),
  };
  list.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  return entry;
}

export function updateLocalProject(id, { title, prompt, code_uri }) {
  const list = getLocalProjects();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  list[i] = {
    ...list[i],
    title: title != null ? title : list[i].title,
    prompt: prompt != null ? prompt : list[i].prompt,
    code_uri: code_uri != null ? code_uri : list[i].code_uri,
  };
  localStorage.setItem(KEY, JSON.stringify(list));
  return list[i];
}

export function deleteLocalProject(id) {
  const list = getLocalProjects().filter((p) => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}