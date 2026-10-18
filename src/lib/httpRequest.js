// Bounded browser HTTP requests. No Base44 functions and no third-party relay.
const MAX_BYTES = 1024 * 1024;

export async function requestText(url, { signal, ...options } = {}) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('استخدم رابط HTTP أو HTTPS دون بيانات دخول داخل الرابط.');
  }
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('انتهت مهلة الطلب (15 ثانية).', 'TimeoutError')), 15000);
  try {
    const response = await fetch(target.href, {
      ...options, mode: 'cors', credentials: 'omit', signal: controller.signal,
    });
    let body = '';
    let bytes = 0;
    let truncated = false;
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const remaining = MAX_BYTES - bytes;
          body += decoder.decode(value.subarray(0, remaining), { stream: true });
          bytes += Math.min(value.byteLength, remaining);
          if (value.byteLength > remaining) {
            truncated = true;
            await reader.cancel();
            break;
          }
        }
        body += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    return {
      status: response.status, statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body, truncated, url: response.url || target.href,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}