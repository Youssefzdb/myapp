/**
 * Live Project Map — builds a dependency graph of the virtual project and
 * computes the files affected by a change request, so the AI knows exactly
 * what to touch without breaking the rest of the app.
 *
 * Each file node holds: local imports, exports, JSX components used, and REST
 * API collections referenced. The graph is traversed to expand a seed set of
 * files (named in the request) to every file that depends on them.
 */

const EXTS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];

function resolveImport(importer, spec, files) {
  let base;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else {
    const parts = importer.split("/");
    parts.pop();
    for (const seg of spec.split("/")) {
      if (seg === "." || !seg) continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    base = parts.join("/");
  }
  return EXTS.find((e) => files[base + e] !== undefined) || null;
}

/** Builds the map: { [path]: { localImports, exports, components, apis, deps } } */
export function buildProjectMap(files) {
  const map = {};
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== "string") continue;
    const imports = [];
    for (const m of src.matchAll(/import\s+[^;]+\s+from\s+["']([^"']+)["']/g)) imports.push(m[1]);
    const localImports = imports.filter((s) => s.startsWith(".") || s.startsWith("@/"));
    const exports = [];
    for (const m of src.matchAll(/export\s+(?:default\s+)?(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/g)) exports.push(m[1]);
    for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(",")) {
        const nm = part.trim().match(/([A-Za-z_$][\w$]*)/);
        if (nm) exports.push(nm[1]);
      }
    }
    const components = new Set();
    for (const m of src.matchAll(/<([A-Z][\w$]*)(?!\.)\b/g)) components.add(m[1]);
    for (const m of src.matchAll(/<\/([A-Z][\w$]*)(?!\.)\b/g)) components.add(m[1]);
    const apis = new Set();
    for (const m of src.matchAll(/fetch\s*\(\s*["'`]([^"'`]*\/api\/[^"'`]+)["'`]/g)) apis.add(m[1]);
    const deps = localImports.map((s) => resolveImport(path, s, files)).filter(Boolean);
    map[path] = {
      localImports,
      exports: [...new Set(exports)],
      components: [...components],
      apis: [...apis],
      deps,
    };
  }
  return map;
}

/** Reverse dependency: for each file, who imports it. */
export function buildDependents(map) {
  const rev = {};
  for (const p of Object.keys(map)) rev[p] = [];
  for (const [p, info] of Object.entries(map)) {
    for (const d of info.deps) (rev[d] || (rev[d] = [])).push(p);
  }
  return rev;
}

function tokensOf(request) {
  return (String(request || "").toLowerCase().match(/[a-z\u0600-\u06FF_]{3,}/g) || []);
}

/** Seed files whose name/exports/components match request tokens. */
function seedFiles(map, request) {
  const tokens = tokensOf(request);
  const seeds = new Set();
  if (!tokens.length) return seeds;
  for (const [path, info] of Object.entries(map)) {
    const hay = (path + " " + info.exports.join(" ") + " " + info.components.join(" ")).toLowerCase();
    if (tokens.some((t) => hay.includes(t))) seeds.add(path);
  }
  return seeds;
}

/**
 * Returns the set of files affected by a change request:
 * seed matches + their direct dependents (so importers update too).
 */
export function affectedFiles(files, request, opts = {}) {
  const map = buildProjectMap(files);
  const dependents = buildDependents(map);
  const seeds = seedFiles(map, request);
  const out = new Set(seeds);
  for (const s of seeds) for (const d of dependents[s] || []) out.add(d);
  // Always include the entry so composition changes are considered.
  if (files["src/App.tsx"]) out.add("src/App.tsx");
  return {
    map,
    dependents,
    seeds: [...seeds],
    affected: [...out].sort(),
  };
}

/** Renders a compact project map summary for the AI context. */
export function summarizeProjectMap(files, request) {
  const { map, affected, seeds } = affectedFiles(files, request);
  if (!Object.keys(map).length) return "";
  const lines = [];
  lines.push("LIVE PROJECT MAP (files and their relationships):");
  for (const [path, info] of Object.entries(map)) {
    const ex = info.exports.length ? `exports[${info.exports.join(",")}]` : "";
    const cp = info.components.length ? `components[${info.components.join(",")}]` : "";
    const ap = info.apis.length ? `api[${info.apis.join(",")}]` : "";
    const dp = info.deps.length ? `imports[${info.deps.join(",")}]` : "";
    const tag = affected.includes(path) ? " *affected*" : "";
    lines.push(`- ${path} ${[ex, cp, ap, dp].filter(Boolean).join(" ")}${tag}`);
  }
  if (seeds.length) lines.push(`\nChange "${request}" likely affects: ${affected.join(", ")}`);
  else lines.push(`\nNo specific file matched the request; the entry and its direct dependents are marked.`);
  return lines.join("\n");
}