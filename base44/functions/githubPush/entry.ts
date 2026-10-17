import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const CONNECTOR_ID = "6ad3ec94025725ba68967b57";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
    if (!accessToken) return Response.json({ error: 'GitHub not connected' }, { status: 400 });

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const t = (ms) => AbortSignal.timeout(ms);

    // Status check only — verifies the connection and returns the GitHub login.
    if (body.check) {
      const meRes = await fetch('https://api.github.com/user', { headers, signal: t(15000) });
      if (!meRes.ok) return Response.json({ error: 'GitHub auth failed' }, { status: 401 });
      const me = await meRes.json();
      return Response.json({ connected: true, login: me.login, avatar: me.avatar_url });
    }

    const files = body.files && typeof body.files === 'object' ? body.files : {};
    const fileCount = Object.keys(files).length;
    if (!fileCount) return Response.json({ error: 'No files to push' }, { status: 400 });

    const repoName = String(body.repo || 'vibe-app').trim().replace(/\s+/g, '-').slice(0, 60);
    const isPrivate = !!body.private;
    const commitMessage = String(body.commitMessage || 'chore: push generated app').slice(0, 200);

    const meRes = await fetch('https://api.github.com/user', { headers, signal: t(15000) });
    if (!meRes.ok) return Response.json({ error: 'GitHub auth failed' }, { status: 401 });
    const me = await meRes.json();
    const owner = me.login;

    // Ensure repo exists
    let defaultBranch = 'main';
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers, signal: t(15000) });
    if (checkRes.ok) {
      const rd = await checkRes.json();
      defaultBranch = rd.default_branch || 'main';
    } else if (checkRes.status === 404) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST', headers,
        body: JSON.stringify({ name: repoName, private: isPrivate, auto_init: false }),
        signal: t(15000),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}));
        return Response.json({ error: d.message || 'repo create failed' }, { status: createRes.status });
      }
    } else {
      const d = await checkRes.json().catch(() => ({}));
      return Response.json({ error: d.message || 'repo check failed' }, { status: 500 });
    }

    const gitApi = (path, init) => fetch(`https://api.github.com/repos/${owner}/${repoName}/git/${path}`, { ...init, headers, signal: t(30000) });

    // Current branch state
    let parentSha = null;
    let baseTreeSha = null;
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`, { headers, signal: t(15000) });
    if (refRes.ok) {
      const refData = await refRes.json();
      parentSha = refData.object.sha;
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${parentSha}`, { headers, signal: t(15000) });
      if (commitRes.ok) {
        const cd = await commitRes.json();
        baseTreeSha = cd.tree.sha;
      }
    }

    // Create blobs (batched for speed)
    const paths = Object.keys(files);
    const blobResults = await Promise.all(paths.map(async (path) => {
      const r = await gitApi('blobs', { method: 'POST', body: JSON.stringify({ content: String(files[path] ?? ''), encoding: 'utf-8' }) });
      if (!r.ok) throw new Error(`blob failed for ${path}: ${(await r.json().catch(() => ({}))).message || r.status}`);
      return { path, sha: (await r.json()).sha };
    }));

    const entries = blobResults.map(({ path, sha }) => ({ path, mode: '100644', type: 'blob', sha }));

    // Create tree
    const treeBody = { tree: entries };
    if (baseTreeSha) treeBody.base_tree = baseTreeSha;
    const treeRes = await gitApi('trees', { method: 'POST', body: JSON.stringify(treeBody) });
    if (!treeRes.ok) {
      const d = await treeRes.json().catch(() => ({}));
      return Response.json({ error: d.message || 'tree create failed' }, { status: 500 });
    }
    const tree = await treeRes.json();

    // Create commit
    const commitBody = { message: commitMessage, tree: tree.sha };
    if (parentSha) commitBody.parents = [parentSha];
    const commitRes = await gitApi('commits', { method: 'POST', body: JSON.stringify(commitBody) });
    if (!commitRes.ok) {
      const d = await commitRes.json().catch(() => ({}));
      return Response.json({ error: d.message || 'commit create failed' }, { status: 500 });
    }
    const commit = await commitRes.json();

    // Create or update ref
    if (parentSha) {
      const u = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`, {
        method: 'PATCH', headers, body: JSON.stringify({ sha: commit.sha }), signal: t(15000),
      });
      if (!u.ok) {
        const d = await u.json().catch(() => ({}));
        return Response.json({ error: d.message || 'ref update failed' }, { status: 500 });
      }
    } else {
      const c = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs`, {
        method: 'POST', headers, body: JSON.stringify({ ref: `refs/heads/${defaultBranch}`, sha: commit.sha }), signal: t(15000),
      });
      if (!c.ok) {
        const d = await c.json().catch(() => ({}));
        return Response.json({ error: d.message || 'ref create failed' }, { status: 500 });
      }
    }

    return Response.json({
      ok: true, owner, repo: repoName, branch: defaultBranch,
      url: `https://github.com/${owner}/${repoName}`,
      commitSha: commit.sha, commitUrl: commit.html_url, files: fileCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}