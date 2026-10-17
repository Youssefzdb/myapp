/** Virtual project file system helpers: parse multi-file AI output and serialize it back. */

export const ENTRY = "src/App.tsx";

const PATH_RE = /^[\w@.-]+(?:\/[\w@.-]+)*\.(?:tsx|ts|jsx|js|css|json)$/;
const SERVER_RE = /^server\/[\w@./-]+\.(?:js|ts|json|sql)$/;
const ROOT_FILES = new Set([".env", ".env.example", ".gitignore", "README.md"]);

export function normalizePath(raw) {
  let p = raw.trim().replace(/^["'`]|["'`]$/g, "").replace(/\\/g, "/");
  p = p.replace(/^\.?\//, "");
  if (p.includes("..") || p.length > 160) return null;
  if (ROOT_FILES.has(p)) return p;
  if (p.startsWith("server/")) return SERVER_RE.test(p) ? p : null;
  if (!p.startsWith("src/")) p = `src/${p}`;
  return PATH_RE.test(p) ? p : null;
}

/**
 * Extracts every fenced code block that names a file, e.g.
 * ```tsx src/components/Navbar.tsx   or   ```tsx file="src/x.ts"   or a first-line `// file: path`.
 * Falls back to a single unnamed block as src/App.tsx.
 */
export function extractFiles(content) {
  const re = /```([^\n`]*)\n([\s\S]*?)```/g;
  const files = {};
  const deleted = [];
  let firstUnnamed = null;
  let text = content;
  for (const m of content.matchAll(re)) {
    const info = (m[1] ?? "").trim();
    let body = m[2] ?? "";
    let path = null;
    const del = info.match(/^\w*\s*DELETE\s+(\S+)/i);
    if (del?.[1]) {
      const p = normalizePath(del[1]);
      if (p) deleted.push(p);
      text = text.replace(m[0], "");
      continue;
    }
    const fromInfo = info.match(/(?:file(?:name)?=|path=)?["']?([\w@./-]+\.(?:tsx|ts|jsx|js|css|json))["']?/);
    if (fromInfo?.[1]) path = normalizePath(fromInfo[1]);
    if (!path) {
      const head = body.match(/^\s*(?:\/\/|\/\*)\s*(?:file|path)\s*:\s*([\w@./-]+)\s*(?:\*\/)?\s*\n/i);
      if (head?.[1]) {
        path = normalizePath(head[1]);
        if (path) body = body.slice(head[0].length);
      }
    }
    text = text.replace(m[0], "");
    if (path) files[path] = body.trim() + "\n";
    else if (firstUnnamed === null && /^(tsx|jsx|ts|typescript|js|javascript|react)?$/i.test(info))
      firstUnnamed = body.trim() + "\n";
  }
  if (!files[ENTRY] && firstUnnamed) files[ENTRY] = firstUnnamed;
  return { text: text.trim(), files: Object.keys(files).length ? files : null, deleted };
}

/** Applies changed files and deletions on top of the previous project. */
export function mergeFiles(base, changed, deleted = []) {
  const next = { ...base, ...changed };
  for (const p of deleted) if (p !== ENTRY) delete next[p];
  return next;
}

/** Lists local imports that do not resolve to a project file. */
export function missingImports(files) {
  const missing = [];
  const exts = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== "string") continue;
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']((?:\.{1,2}\/|@\/)[^"']+)["']/g)) {
      const spec = m[1];
      let base;
      if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
      else {
        const parts = path.split("/");
        parts.pop();
        for (const seg of spec.split("/")) {
          if (seg === "." || !seg) continue;
          if (seg === "..") parts.pop();
          else parts.push(seg);
        }
        base = parts.join("/");
      }
      if (!exts.some((e) => files[base + e] !== undefined)) missing.push(`${path} → ${spec}`);
    }
  }
  return missing;
}

/** Finds PascalCase JSX components used but not imported or declared locally. */
export function undefinedComponents(files) {
  const problems = [];
  const INTRINSICS = new Set(["Fragment", "React", "Suspense", "StrictMode"]);
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== "string") continue;
    const declared = new Set();
    for (const m of src.matchAll(/\bfunction\s+([A-Z][\w$]*)/g)) declared.add(m[1]);
    for (const m of src.matchAll(/\bconst\s+([A-Z][\w$]*)\s*=/g)) declared.add(m[1]);
    for (const m of src.matchAll(/\bclass\s+([A-Z][\w$]*)/g)) declared.add(m[1]);
    for (const m of src.matchAll(/\bimport\s+\*\s+as\s+([A-Z][\w$]*)/g)) declared.add(m[1]);
    for (const m of src.matchAll(/\bimport\s+([A-Z][\w$]*)\s*(?:,\s*\{([^}]*)\})?\s*from/g)) {
      declared.add(m[1]);
      if (m[2]) for (const p of m[2].split(",")) { const nm = p.trim().match(/([A-Za-z_$][\w$]*)/); if (nm) declared.add(nm[1]); }
    }
    for (const m of src.matchAll(/\bimport\s*\{([^}]*)\}\s*from/g)) {
      for (const p of m[1].split(",")) { const nm = p.trim().match(/([A-Za-z_$][\w$]*)/); if (nm) declared.add(nm[1]); }
    }
    const used = new Set();
    for (const m of src.matchAll(/<([A-Z][\w$]*)(?!\.)\b/g)) used.add(m[1]);
    for (const m of src.matchAll(/<\/([A-Z][\w$]*)(?!\.)\b/g)) used.add(m[1]);
    for (const name of used) {
      if (declared.has(name) || INTRINSICS.has(name)) continue;
      problems.push(`${path} uses <${name}> but it is not imported or declared locally`);
    }
  }
  return problems;
}

/** Detects duplicate named exports and multiple default exports per file. */
export function duplicateExports(files) {
  const problems = [];
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== "string") continue;
    const seen = {};
    const add = (n) => { seen[n] = (seen[n] || 0) + 1; };
    for (const m of src.matchAll(/\bexport\s+(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
    for (const m of src.matchAll(/\bexport\s*\{([^}]+)\}/g)) for (const p of m[1].split(",")) { const nm = p.trim().match(/([A-Za-z_$][\w$]*)/); if (nm) add(nm[1]); }
    for (const [n, c] of Object.entries(seen)) if (c > 1) problems.push(`${path}: '${n}' exported ${c} times`);
    const defs = (src.match(/\bexport\s+default\b/g) || []).length;
    if (defs > 1) problems.push(`${path}: ${defs} default exports`);
  }
  return problems;
}

/** Flags empty or near-empty files (likely truncated writes). */
export function emptyFiles(files) {
  const problems = [];
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== "string") continue;
    const t = src.trim();
    if (t.length < 8) problems.push(`${path} is empty or too short (${t.length} chars)`);
  }
  return problems;
}

/** Detects named/default import mismatches against a target file's exports. */
export function exportMismatches(files) {
  const problems = [];
  const exts = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
  const resolve = (path, spec) => {
    let base;
    if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
    else {
      const parts = path.split("/");
      parts.pop();
      for (const seg of spec.split("/")) {
        if (seg === "." || !seg) continue;
        if (seg === "..") parts.pop();
        else parts.push(seg);
      }
      base = parts.join("/");
    }
    return exts.find((e) => files[base + e] !== undefined);
  };
  const namedExportsOf = (src) => {
    const names = new Set();
    if (typeof src !== "string") return names;
    for (const m of src.matchAll(/\bexport\s+(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(",")) {
        const nm = part.trim().match(/([A-Za-z_$][\w$]*)\s*(?:as\s+([A-Za-z_$][\w$]*))?/);
        if (nm) names.add(nm[2] ?? nm[1]);
      }
    }
    return names;
  };
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== "string") continue;
    for (const m of src.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*["']((?:\.{1,2}\/|@\/)[^"']+)["']/g)) {
      const target = resolve(path, m[2]);
      if (!target) continue;
      const names = namedExportsOf(files[target]);
      for (const part of m[1].split(",")) {
        const nm = part.trim().match(/([A-Za-z_$][\w$]*)\s*(?:as\s+([A-Za-z_$][\w$]*))?/);
        if (!nm) continue;
        const imported = nm[2] ?? nm[1];
        if (imported === "type" || imported === "default") continue;
        if (!names.has(imported)) problems.push(`${path} imports '{${imported}}' from ${target}, which has no such named export`);
      }
    }
    for (const m of src.matchAll(/\bimport\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*["']((?:\.{1,2}\/|@\/)[^"']+)["']/g)) {
      const target = resolve(path, m[2]);
      if (!target) continue;
      if (!/export\s+default\b/.test(files[target])) problems.push(`${path} imports a default export from ${target}, which has none`);
    }
  }
  return problems;
}

export function serializeFiles(files) {
  return Object.entries(files)
    .map(([p, c]) => "```" + p.split(".").pop() + " " + p + "\n" + c.trimEnd() + "\n```")
    .join("\n\n");
}

export function totalLines(files) {
  return Object.values(files).reduce((n, c) => n + c.split("\n").length, 0);
}