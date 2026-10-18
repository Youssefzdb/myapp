import { ENTRY, serializeFiles } from "./files";

const BASE_IMPORTS = {
  react: "https://esm.sh/react@18.3.1",
  "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
  "react-dom": "https://esm.sh/react-dom@18.3.1?deps=react@18.3.1",
  "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1",
  "lucide-react": "https://esm.sh/lucide-react@0.460.0?deps=react@18.3.1",
};

/** Collect bare package imports across all files and map unknown ones to esm.sh. */
export function buildImportMap(files) {
  const imports = { ...BASE_IMPORTS };
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"'./@][^"']*|@[^/"']+\/[^"']+)["']/g;
  for (const src of Object.values(files)) {
    if (typeof src !== "string") continue;
    for (const m of src.matchAll(re)) {
      const spec = m[1];
      if (!spec || spec.startsWith("@/") || imports[spec]) continue;
      if (!/^(@[\w.-]+\/)?[\w.-]+(\/[\w./-]+)?$/.test(spec)) continue;
      imports[spec] = `https://esm.sh/${spec}?deps=react@18.3.1,react-dom@18.3.1`;
    }
  }
  return { imports };
}

/* Runs inside the sandboxed iframe: compiles every file and links relative/@ imports via blob URLs. */
function runtime(files, entry) {
  const B = window.Babel;
  const urls = {};
  const exts = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
  const join = (base, rel) => {
    const parts = base.split("/");
    parts.pop();
    for (const seg of rel.split("/")) {
      if (seg === "." || seg === "") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return parts.join("/");
  };
  const resolve = (from, spec) => {
    const base = spec.startsWith("@/") ? "src/" + spec.slice(2) : join(from, spec);
    for (const e of exts) if (Object.prototype.hasOwnProperty.call(files, base + e)) return base + e;
    throw new Error(`Cannot resolve "${spec}" from ${from}`);
  };
  const build = (path, stack) => {
    if (urls[path]) return urls[path];
    if (stack.includes(path)) throw new Error("Circular import: " + [...stack, path].join(" → "));
    const src = files[path] ?? "";
    let out;
    if (path.endsWith(".css")) {
      const style = document.createElement("style");
      style.setAttribute("data-file", path);
      style.textContent = src;
      document.head.appendChild(style);
      out = "export default {};";
    } else if (path.endsWith(".json")) {
      out = "export default " + src + ";";
    } else {
      try {
        out = B.transform(src, {
          filename: path,
          presets: [["react", { runtime: "automatic" }], "typescript"],
        }).code;
      } catch (e) {
        throw new Error(path + ": " + String(e.message || e));
      }
      out = out.replace(
        /(\bfrom\s*|\bimport\s*\(?\s*)(["'])((?:\.{1,2}\/|@\/)[^"']+)\2/g,
        (_m, pre, q, spec) => pre + q + build(resolve(path, spec), [...stack, path]) + q,
      );
    }
    urls[path] = URL.createObjectURL(new Blob([out], { type: "text/javascript" }));
    return urls[path];
  };
  const appUrl = build(entry, []);
  const boot =
    "import App from '" +
    appUrl +
    "';import {createRoot} from 'react-dom/client';import {useEffect} from 'react';import {jsx} from 'react/jsx-runtime';function Preview(){useEffect(()=>{parent.postMessage({type:'vibe-preview-ready'},'*')},[]);return jsx(App,{})}createRoot(document.getElementById('root')).render(jsx(Preview,{}));";
  const s = document.createElement("script");
  s.type = "module";
  s.textContent = boot;
  document.body.appendChild(s);
}

const safe = (v) =>
  JSON.stringify(v).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

// Intercept fetch('/api/...') inside the sandboxed iframe and route it to the
// platform apiRuntime backend via postMessage to the parent. The parent replies
// with backend-res. This makes the generated REST backend run live in preview.
const BACKEND_SHIM = `
window.__callBackend = function(method, path, body, query) {
  return new Promise(function(resolve) {
    var id = Math.random().toString(36).slice(2);
    function h(e) { if (e.data && e.data.type === 'backend-res' && e.data.id === id) { window.removeEventListener('message', h); resolve(e.data.res); } }
    window.addEventListener('message', h);
    parent.postMessage({ type: 'backend-call', id: id, method: method, path: path, body: body, query: query }, '*');
  });
};
var __origFetch = window.fetch;
window.fetch = function(input, init) {
  init = init || {};
  var url = typeof input === 'string' ? input : (input && input.url) || '';
  if (/^\\/api\\//.test(url)) {
    var method = (init.method || (input && input.method) || 'GET').toUpperCase();
    var body = null;
    if (init.body != null) { try { body = JSON.parse(init.body); } catch (e) { body = String(init.body); } }
    var path = url.split('?')[0];
    var query = {};
    var qs = url.split('?')[1];
    if (qs) { qs.split('&').forEach(function(p) { var kv = p.split('='); if (kv[0]) query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }); }
    return window.__callBackend(method, path, body, query).then(function(res) {
      return new Response(JSON.stringify(res.body == null ? null : res.body), { status: res.status || 200, headers: { 'Content-Type': 'application/json' } });
    });
  }
  return __origFetch.apply(this, arguments);
};
`;

// Virtual route navigation: the address bar in the preview panel posts
// `vibe-navigate`, the iframe sets its hash and echoes `vibe-route` back so the
// parent's history (back/forward) stays in sync. Internal <a href="/x"> links
// navigate the same way instead of being dead-prevented.
const NAV_SHIM = `
window.__vibeNavigate = function(route) {
  route = String(route || '/'); if (route.charAt(0) !== '/' && route.charAt(0) !== '?') route = '/' + route;
  if (location.hash !== '#' + route) location.hash = route;
  parent.postMessage({ type: 'vibe-route', route: route }, '*');
};
window.addEventListener('hashchange', function() {
  var r = location.hash ? location.hash.slice(1) : '/';
  parent.postMessage({ type: 'vibe-route', route: r }, '*');
});
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'vibe-navigate') {
    var r = String(e.data.route || '/');
    if (location.hash !== '#' + r) location.hash = r;
  }
});
`;

/** Builds a self-contained HTML document that compiles and renders a multi-file React project. */
export function buildPreviewHtml(input, storage = {}) {
  const files = typeof input === "string" ? { [ENTRY]: input } : (input ?? {});
  if (!files || !Object.keys(files).length) {
    return `<!doctype html><html><head><meta charset="utf-8"/></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:ui-sans-serif,system-ui,sans-serif;color:#94a3b8;font-size:14px">أرسل طلبًا لبدء المعاينة</body></html>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/@babel/standalone@7.25.6/babel.min.js"></script>
<script type="importmap">${safe(buildImportMap(files))}</script>
<style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif}#__err{display:none;position:fixed;inset:0;padding:24px;background:#1a0b0b;color:#fca5a5;font:13px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow:auto}</style>
</head><body><div id="root"></div><div id="__err"></div>
<script>
var __data=${safe(storage)};
var __storage={getItem:function(k){return Object.prototype.hasOwnProperty.call(__data,String(k))?__data[String(k)]:null},setItem:function(k,v){__data[String(k)]=String(v);parent.postMessage({type:'vibe-storage',values:__data},'*')},removeItem:function(k){delete __data[String(k)];parent.postMessage({type:'vibe-storage',values:__data},'*')},clear:function(){__data={};parent.postMessage({type:'vibe-storage',values:__data},'*')},key:function(i){return Object.keys(__data)[i]||null},get length(){return Object.keys(__data).length}};
Object.defineProperty(window,'localStorage',{value:__storage});
function __showErr(e){var message=String(e&&e.message||e);var el=document.getElementById('__err');el.style.display='block';el.textContent='⚠ '+message;parent.postMessage({type:'vibe-preview-error',message:message},'*');}
window.addEventListener('error',function(e){__showErr(e.error||e.message)});
window.addEventListener('unhandledrejection',function(e){__showErr(e.reason)});
document.addEventListener('click',function(e){if(e.defaultPrevented)return;var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'';e.preventDefault();if(h.charAt(0)==='#'){if(h.length>1){var t=document.getElementById(decodeURIComponent(h.slice(1)));if(t)t.scrollIntoView({behavior:'smooth'})}else window.scrollTo({top:0,behavior:'smooth'});return}if(h.charAt(0)==='/'||h.charAt(0)==='?'){window.__vibeNavigate(h);return}if(/^(https?:|mailto:|tel:)/i.test(h))window.open(h,'_blank','noopener');});
document.addEventListener('submit',function(e){if(!e.defaultPrevented)e.preventDefault();});
${BACKEND_SHIM}
${NAV_SHIM}
try{(${runtime.toString()})(${safe(files)},${safe(files[ENTRY] ? ENTRY : Object.keys(files)[0])});}catch(e){__showErr(e)}
</script></body></html>`;
}

const NODE_BUILTINS = new Set(["fs","path","http","https","url","crypto","os","stream","util","buffer","events","child_process","net","tls","zlib","querystring","assert","timers","worker_threads","readline","dns","dgram","cluster","v8","perf_hooks"]);

export function buildProjectFiles(input) {
  const files = typeof input === "string" ? { [ENTRY]: input } : input;
  const deps = { react: "^18.3.1", "react-dom": "^18.3.1" };
  for (const spec of Object.keys(buildImportMap(files).imports)) {
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    if (NODE_BUILTINS.has(name)) continue;
    if (!deps[name]) deps[name] = name === "lucide-react" ? "^0.460.0" : "latest";
  }
  return {
    "package.json": JSON.stringify(
      {
        name: "generated-app",
        private: true,
        type: "module",
        scripts: { dev: "vite", build: "vite build" },
        dependencies: deps,
        devDependencies: {
          vite: "^5.4.0",
          "@vite/plugin-react": "^4.3.0",
          typescript: "^5.5.0",
          tailwindcss: "^3.4.0",
          postcss: "^8.4.0",
          autoprefixer: "^10.4.0",
        },
      },
      null,
      2,
    ),
    "vite.config.ts": `import { defineConfig } from "vite";\nimport react from "@vite/plugin-react";\nimport { fileURLToPath } from "node:url";\nexport default defineConfig({ plugins: [react()], resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } } });\n`,
    "tsconfig.json": JSON.stringify(
      { compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "bundler", target: "ES2020", strict: true, baseUrl: ".", paths: { "@/*": ["src/*"] } } },
      null,
      2,
    ),
    "tailwind.config.js": `export default { content: ["./index.html", "./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] };\n`,
    "postcss.config.js": `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`,
    "index.html": `<!doctype html>\n<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Generated App</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`,
    "src/index.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
    "src/main.tsx": `import { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\ncreateRoot(document.getElementById("root")!).render(<App />);\n`,
    ...files,
  };
}