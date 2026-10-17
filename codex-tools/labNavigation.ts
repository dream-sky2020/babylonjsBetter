import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

/** Recover only known HTML entries, never arbitrary assets or API requests. */
export function recoverLabNavigation(url: string, entries: ReadonlySet<string>): string | null {
  const queryAt = url.indexOf('?');
  const pathname = queryAt < 0 ? url : url.slice(0, queryAt);
  const query = queryAt < 0 ? '' : url.slice(queryAt);
  const entry = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  if (entries.has(entry)) return null;
  // The old composable Lab home link went up two levels instead of three.
  if (pathname === '/labs/index.html' && entries.has('/index.html')) return `/index.html${query}`;
  if (!/^\/(labs|tools|apps)\//.test(pathname)) return null;
  const roots = [...pathname.matchAll(/(?=\/(?:labs|tools|apps)\/)/g)].reverse();
  for (const match of roots) {
    if (match.index === 0) continue;
    const candidate = pathname.slice(match.index);
    const canonical = candidate.endsWith('/') ? `${candidate}index.html` : candidate;
    if (entries.has(canonical)) return `${canonical}${query}`;
  }
  return null;
}

export function labNavigationPlugin(): Plugin {
  let entries = new Set<string>();
  const install = (server: ViteDevServer | PreviewServer, htmlRoot: string) => {
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const target = recoverLabNavigation(req.url ?? '/', entries);
      if (!target) return next();
      res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' });
      res.end();
    });
    // Vite rewrites directory URLs here, but transforms real HTML after post hooks.
    return () => server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const pathname = (req.url ?? '/').split('?')[0];
      if (!req.headers.accept?.includes('text/html') && !pathname.endsWith('.html')) return next();
      let decoded;
      try { decoded = decodeURIComponent(pathname); } catch { return next(); }
      const file = path.resolve(htmlRoot, `.${decoded}`);
      const relative = path.relative(htmlRoot, file);
      if (!relative.startsWith('..') && !path.isAbsolute(relative) && existsSync(file)) return next();
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>页面不存在</title><body><h1>页面不存在</h1><p>此地址没有对应的 Lab 或页面。</p><a href="/index.html">返回调试入口</a></body></html>');
    });
  };
  return {
    name: 'lab-navigation',
    configResolved(config) {
      const input = config.build.rollupOptions.input ?? {};
      const files = typeof input === 'string' ? [input] : Object.values(input);
      entries = new Set(files.filter(file => file.endsWith('.html')).map(file => `/${path.relative(config.root, path.resolve(config.root, file)).split(path.sep).join('/')}`));
    },
    configureServer: server => install(server, server.config.root),
    configurePreviewServer: server => install(server, path.resolve(server.config.root, server.config.build.outDir)),
  };
}
