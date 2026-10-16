import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('../', import.meta.url));

test('homepage groups entries by destination and every local link exists', () => {
  const dom = new JSDOM(readFileSync(path.join(root, 'index.html'), 'utf8'));
  try {
    const groups = { 'composable-labs': 'labs/composable/', 'standalone-labs': 'labs/standalone/', tools: 'tools/', apps: 'apps/' };
    const destinations = [];
    for (const [id, prefix] of Object.entries(groups)) {
      const section = dom.window.document.querySelector(`section[aria-labelledby="${id}"]`);
      assert.ok(section, `Missing homepage group: ${id}`);
      const links = [...section.querySelectorAll('a[href]')];
      assert.ok(links.length > 0, `Empty homepage group: ${id}`);
      for (const link of links) {
        const destination = link.getAttribute('href').replace(/^\.\//, '');
        assert.ok(destination.startsWith(prefix), `Misplaced homepage entry: ${destination}`);
        assert.ok(existsSync(path.join(root, destination)), `Missing homepage entry: ${destination}`);
        destinations.push(destination);
      }
    }
    assert.equal(new Set(destinations).size, destinations.length, 'Duplicate homepage entries');
    for (const entry of readdirSync(path.join(root, 'labs/composable'))) {
      assert.ok(destinations.includes(`labs/composable/${entry}/index.html`), `Missing composable Lab: ${entry}`);
    }
  } finally {
    dom.window.close();
  }
});

test('build entries exist and Lab directories live under labs', () => {
  const config = readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
  const entries = [...config.matchAll(/path\.resolve\(__dirname, '([^']+\.html)'\)/g)].map(match => match[1]);
  assert.ok(entries.length > 0);
  for (const entry of entries) assert.ok(existsSync(path.join(root, entry)), `Missing build entry: ${entry}`);
  for (const entry of readdirSync(path.join(root, 'labs/composable'))) {
    assert.ok(entries.includes(`labs/composable/${entry}/index.html`), `Unbuilt composable Lab: ${entry}`);
  }
  assert.deepEqual(readdirSync(path.join(root, 'tools')).filter(name => name.endsWith('-lab') || name === 'lab-kit' || name === 'lab-modules'), []);
});
