/**
 * Detect all navigable pages/routes in a generated project so the preview's
 * address bar can list them vertically. Combines file-based pages (src/pages/*,
 * src/features/*, …) with route literals found in the source
 * (<Route path="/x">, to="/x", navigate('/x')).
 */
export function detectPages(files) {
  const pages = new Set(["/"]);
  const add = (p) => {
    if (!p || typeof p !== "string") return;
    const clean = p.split("?")[0].split("#")[0];
    if (!clean.startsWith("/")) return;
    if (clean === "/") return;
    if (/\.(js|ts|tsx|jsx|css|png|jpe?g|svg|webp|gif|json|woff2?|ttf|ico)$/i.test(clean)) return;
    if (clean.startsWith("/api/")) return;
    pages.add(clean);
  };

  // 1. file-based pages → derive a slug from the file name
  for (const path of Object.keys(files)) {
    const m = path.match(/^src\/(?:pages|views|screens|features)\/(.+)\.(?:tsx|jsx|ts|js)$/i);
    if (m) {
      const name = m[1].split("/").pop();
      const slug = "/" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      if (slug && slug !== "/") add(slug);
    }
  }

  // 2. route literals in source
  const routeRe = /(?:<Route[^>]*?\bpath\s*=\s*|\bto\s*=\s*|\bnavigate\s*\(\s*|\bhref\s*=\s*)["'`]([\/][^"'`]+)["'`]/g;
  for (const content of Object.values(files)) {
    if (typeof content !== "string") continue;
    let m;
    while ((m = routeRe.exec(content))) add(m[1]);
  }

  return Array.from(pages).sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));
}