import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createServer, preview } from 'vite';
import { labNavigationPlugin, recoverLabNavigation } from './labNavigation.ts';

const map = '/labs/standalone/dungeon-map-canvas-lab/index.html';
const scene = '/labs/standalone/scene-environment-lab/index.html';
const entries = new Set(['/index.html', map, scene, '/tools/editor/index.html', '/apps/game/index.html']);
const reported = `/labs/labs/standalone/scene-environment-lab${map}`;

test('recovers repeated entry prefixes and the old homepage without losing query strings', () => {
  for (const url of [reported, `/labs${map}`, `/labs${map.slice(0, -10)}`, `/labs/standalone/scene-environment-lab${map}`]) {
    assert.equal(recoverLabNavigation(`${url}?map=box%20room&debug=1`, entries), `${map}?map=box%20room&debug=1`);
  }
  assert.equal(recoverLabNavigation('/labs/index.html?debug=1', entries), '/index.html?debug=1');
  assert.equal(recoverLabNavigation('/labs/unknown/tools/editor/index.html', entries), '/tools/editor/index.html');
  assert.equal(recoverLabNavigation('/labs/unknown/apps/game/index.html', entries), '/apps/game/index.html');
});

test('leaves valid entries, directories, missing pages, assets and APIs alone', () => {
  for (const url of ['/index.html', '/', map, `${map}?preset=1`, map.slice(0, -10), '/labs/unknown/index.html', '/labs/unknown/main.ts', '/api/labs/standalone/dungeon-map-canvas-lab/index.html', '/config/example.json', '//example.test/labs/standalone/dungeon-map-canvas-lab/index.html']) {
    assert.equal(recoverLabNavigation(url, entries), null, url);
  }
  // A real page always takes precedence over suffix recovery.
  assert.equal(recoverLabNavigation(reported, new Set([...entries, reported])), null);
});

for (const mode of ['development', 'preview']) test(`${mode}: redirects malformed URLs, serves real pages, and returns a recoverable 404`, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lab-navigation-'));
  let server;
  try {
    for (const prefix of ['', '/dist']) for (const entry of entries) {
      const file = path.join(root, prefix, entry);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, `<html><head><title>${entry}</title></head><body>entry:${entry}</body></html>`);
    }
    await writeFile(path.join(root, 'asset.js'), 'export const present = true;');
    await writeFile(path.join(root, 'dist/asset.js'), 'export const present = true;');
    const config = {
      root, configFile: false, base: './', appType: 'mpa', logLevel: 'silent',
      plugins: [labNavigationPlugin()], publicDir: false,
      build: { outDir: 'dist', rollupOptions: { input: [...entries].map(entry => path.join(root, entry)) } },
      server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
      preview: { host: '127.0.0.1', port: 0 },
    };
    server = mode === 'development' ? await createServer(config) : await preview(config);
    if (mode === 'development') await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const request = (url, options = {}) => fetch(`${origin}${url}`, { headers: { Accept: 'text/html' }, redirect: 'manual', ...options });
    for (const [bad, expected] of [[reported, map], ['/labs/index.html', '/index.html'], [`/labs${map.slice(0, -10)}`, map]]) {
      const response = await request(`${bad}?preset=box%20room`);
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), `${expected}?preset=box%20room`);
      const target = await request(response.headers.get('location'));
      assert.equal(target.status, 200);
      assert.ok((await target.text()).includes(`entry:${expected}`));
    }
    for (const url of ['/', '/index.html', map, map.slice(0, -10)]) {
      const response = await request(url);
      assert.equal(response.status, 200, url);
      assert.equal(response.headers.get('location'), null);
    }
    const missing = await request('/labs/no-such-lab/index.html');
    assert.equal(missing.status, 404);
    const body = await missing.text();
    assert.ok(body.includes('href="/index.html"'));
    assert.ok(!body.includes('entry:/index.html'));
    const head = await request(reported, { method: 'HEAD' });
    assert.equal(head.status, 302);
    assert.equal(await head.text(), '');
    assert.equal((await request(reported, { method: 'POST' })).status, 404);
    const asset = await request('/asset.js', { headers: { Accept: '*/*' } });
    assert.equal(asset.status, 200);
    assert.ok((await asset.text()).includes('present = true'));
    for (const url of ['/missing.js', '/api/labs/unknown', '/config/no-such.json']) {
      const response = await request(url, { headers: { Accept: '*/*' } });
      assert.equal(response.status, 404);
      assert.ok(!(await response.text()).includes('返回调试入口'));
    }
  } finally {
    if (mode === 'development') await server?.close();
    else if (server) {
      server.httpServer.closeAllConnections();
      await new Promise(resolve => server.httpServer.close(resolve));
    }
    await rm(root, { recursive: true, force: true });
  }
});
