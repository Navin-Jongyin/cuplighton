const routes = [];
let current = null;

export function register(pattern, loader) {
  const keys = [];
  const regex = new RegExp("^" + pattern.replace(/:([^/]+)/g, (_, k) => {
    keys.push(k);
    return "([^/]+)";
  }) + "$");
  routes.push({ regex, keys, loader, pattern });
}

export function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/dashboard";
  const [path, qs] = raw.split("?");
  const query = {};
  if (qs) new URLSearchParams(qs).forEach((v, k) => { query[k] = v; });
  return { path: path.startsWith("/") ? path : `/${path}`, query };
}

export async function resolve() {
  const { path, query } = parseHash();
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const mod = await r.loader();
      return { path, query, params, page: mod, pattern: r.pattern };
    }
  }
  return { path, query, params: {}, page: await import("./pages/not-found.js") };
}

export function go(path) {
  location.hash = path.startsWith("#") ? path : `#${path}`;
}

export function start(onChange) {
  const run = async () => {
    if (current?.page?.destroy) {
      try { await current.page.destroy(); } catch (e) { console.error(e); }
    }
    current = await resolve();
    await onChange(current);
  };
  window.addEventListener("hashchange", run);
  return run();
}

export function queryString(q) {
  const p = new URLSearchParams(q);
  const s = p.toString();
  return s ? `?${s}` : "";
}
