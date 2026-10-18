// Image generation with Puter.js (powerful: FLUX / Imagen-class models, free for
// the visitor via their Puter account) and Pollinations as a keyless fallback.
// Returns a usable image src (object URL from Puter, or a Pollinations URL).

let puterLoading = null;

function loadPuter() {
  if (puterLoading) return puterLoading;
  puterLoading = new Promise((resolve) => {
    if (window.puter) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.async = true;
    s.onload = () => resolve(!!window.puter);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
    setTimeout(() => resolve(!!window.puter), 8000);
  });
  return puterLoading;
}

const pollinations = (prompt, w, h, seed) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`;

export async function generateShotImage(prompt, { width = 1024, height = 576, seed = 1, signal } = {}) {
  const ok = await loadPuter();
  if (ok && window.puter?.ai?.txt2img) {
    try {
      const race = Promise.race([
        window.puter.ai.txt2img(prompt),
        new Promise((_, rej) => setTimeout(() => rej(new Error('puter timeout')), 30000)),
      ]);
      const res = await race;
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const el = res?.imageElement ?? res;
      const src = el?.src || res?.src || res?.url;
      if (src) return { url: src, source: 'puter' };
    } catch (e) {
      if (signal?.aborted) throw e;
      // fall through to Pollinations
    }
  }
  return { url: pollinations(prompt, width, height, seed), source: 'pollinations' };
}