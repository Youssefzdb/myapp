import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

const report = (error) => {
  if (error) console.warn('[v0] Supabase builder persistence:', error.message || error);
};

export async function createBuilderSession({ sessionKey, title, model }) {
  if (!supabase) return null;
  const { data: project, error: projectError } = await supabase
    .from('builder_projects')
    .insert({ title: title || 'Untitled project', model: model || null })
    .select('id')
    .single();
  if (projectError) { report(projectError); return null; }

  const { data: session, error } = await supabase
    .from('builder_sessions')
    .insert({ project_id: project.id, session_key: sessionKey, owner_id: null })
    .select('id, project_id')
    .single();
  if (error) { report(error); return null; }
  return session;
}

export async function saveBuilderMessage({ sessionId, role, content = '', reasoning = null, status = 'complete', sequence }) {
  if (!supabase || !sessionId) return null;
  const { data, error } = await supabase
    .from('builder_messages')
    .insert({ session_id: sessionId, role, content, reasoning, status, sequence })
    .select('id')
    .single();
  report(error);
  return data;
}

export async function updateBuilderMessage(id, patch) {
  if (!supabase || !id) return;
  const { error } = await supabase.from('builder_messages').update(patch).eq('id', id);
  report(error);
}

export async function saveBuilderTools(messageId, tools = []) {
  if (!supabase || !messageId || !tools.length) return;
  const rows = tools.map((tool, sequence) => ({
    message_id: messageId,
    name: tool.name || 'unknown',
    input: tool.args || {},
    output: String(tool.output || tool.content || '').slice(0, 4000),
    status: tool.status || 'complete',
    duration_ms: tool.durationMs || null,
    sequence,
  }));
  const { error } = await supabase.from('builder_tool_calls').insert(rows);
  report(error);
}

export async function saveBuilderVersion({ projectId, sessionId, versionNumber, prompt, files, activeFile }) {
  if (!supabase || !projectId) return;
  const { error } = await supabase.from('builder_file_versions').insert({
    project_id: projectId,
    session_id: sessionId,
    version_number: versionNumber,
    prompt,
    files,
    active_file: activeFile,
  });
  report(error);
}
