import { requestText } from '@/lib/httpRequest';

// Keep the existing export name for callers; this is direct browser HTTP,
// not an OS curl command. Never forward API credentials to a public proxy.
export async function proxyFetch({ url, method = 'GET', headers = {}, body, signal }) {
  const verb = String(method).trim().toUpperCase();
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(verb)) {
    throw new Error('طريقة HTTP غير مدعومة.');
  }
  const requestHeaders = new Headers(headers);
  try {
    return await requestText(url, {
      method: verb, headers: requestHeaders,
      body: verb === 'GET' || verb === 'HEAD' ? undefined : body, signal,
    });
  } catch (error) {
    if (signal?.aborted || error.name === 'TimeoutError') throw error;
    throw new Error(`تعذّر الطلب المباشر: ${error.message}. قد يكون السبب الشبكة أو سياسة CORS؛ هذه أداة HTTP في المتصفح وليست أمر curl على خادم.`);
  }
}

function githubContentRequest(url) {
  if (!['github.com', 'www.github.com'].includes(url.hostname)) return null;
  const [owner, repository, view, ...path] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repository || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repository)) return null;
  const repo = repository.replace(/\.git$/, '');
  if (!view) {
    // /readme resolves the repository's default branch; never guess main/master.
    return { url: `https://api.github.com/repos/${owner}/${repo}/readme`, headers: { Accept: 'application/vnd.github.raw+json' } };
  }
  if (['blob', 'raw'].includes(view) && path.length >= 2) {
    return { url: `https://raw.githubusercontent.com/${owner}/${repo}/${path.join('/')}` };
  }
  return null;
}

/** Read GitHub content directly; use a reader only for other public web pages. */
export async function proxyFetchText(url, { signal } = {}) {
  const source = new URL(url);
  if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) {
    throw new Error('استخدم رابط HTTP أو HTTPS عامًا دون بيانات دخول.');
  }
  const github = githubContentRequest(source);
  const directOnly = github || ['raw.githubusercontent.com', 'api.github.com'].includes(source.hostname);
  let response;
  try {
    response = await requestText(github?.url || source.href, { headers: github?.headers, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (directOnly) throw new Error(`تعذّرت قراءة GitHub مباشرة: ${error.message}`);
    // This reader is only for public page text, never API methods or credentials.
    response = await requestText('https://r.jina.ai/' + source.href, { signal });
  }
  if (response.status < 200 || response.status >= 300) {
    const limit = response.headers['x-ratelimit-remaining'] === '0';
    throw new Error(`HTTP ${response.status} — ${response.url}\n${limit ? 'بلغ GitHub حد الطلبات العامة؛ حاول لاحقًا.' : response.body.slice(0, 500)}`);
  }
  const readerError = /Warning:\s*Target URL returned error (\d{3})/i.exec(response.body);
  if (readerError) throw new Error(`HTTP ${readerError[1]} — ${source.href}`);
  const text = response.headers['content-type']?.includes('text/html') ? stripHtml(response.body) : response.body;
  return `Source: ${source.href}\n${github ? 'GitHub repository content: ' + response.url + '\n' : ''}\n${text.trim() || 'Empty page.'}${response.truncated ? '\n…[truncated]' : ''}`;
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/g, (_, entity) => ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity]))
    .replace(/\s+/g, ' ')
    .trim();
}