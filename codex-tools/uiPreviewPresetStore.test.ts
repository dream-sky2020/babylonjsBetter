import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readUiPreviewPresets, writeUiPreviewPresets, handleUiPreviewPresetRequest } from './uiPreviewPresetStore.ts';

const preset = (key: string, name = key) => ({ schemaVersion: 2, presetKey: key, name, canvas: { width: 1280, height: 720 }, rootIds: [], nodes: {} });
async function fixture(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'ui-preset-store-'));
  try { await writeFile(join(dir, 'index.json'), JSON.stringify({ version: 1, presets: {} })); await run(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}
test('UI presets save separate files and catalog; new and edited presets survive a fresh read', async () => fixture(async dir => {
  await writeUiPreviewPresets(dir, { base: preset('base'), other: preset('other') });
  const otherBefore = await readFile(join(dir, 'other.json'), 'utf8');
  await writeUiPreviewPresets(dir, { base: preset('base', '已修改'), created: preset('created', '新界面') });
  const index = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
  assert.equal(index.presets.created.file, 'created.json');
  assert.equal(index.presets.base.name, '已修改');
  const loaded = await readUiPreviewPresets(dir);
  assert.equal(loaded.created.name, '新界面'); assert.equal(loaded.base.canvas.width, 1280);
  assert.equal(await readFile(join(dir, 'other.json'), 'utf8'), otherBefore);
  assert.equal(loaded.other.name, 'other');
  assert.ok((await readdir(dir)).every(file => file.endsWith('.json')));
}));
test('invalid documents and unsafe keys are rejected before any preset is overwritten', async () => fixture(async dir => {
  await writeUiPreviewPresets(dir, { base: preset('base') });
  const before = await readFile(join(dir, 'base.json'), 'utf8');
  for (const key of ['../escape', 'index', 'CON', '__proto__']) {
    await assert.rejects(writeUiPreviewPresets(dir, { base: preset('base', '不应写入'), [key]: preset(key) }));
  }
  await assert.rejects(writeUiPreviewPresets(dir, { base: preset('base', '不应写入'), invalid: { ...preset('invalid'), schemaVersion: 99 } }));
  assert.equal(await readFile(join(dir, 'base.json'), 'utf8'), before);
}));
test('UI preset HTTP PUT writes files that a restarted API reads; bad requests fail', async () => fixture(async dir => {
  const start = async () => {
    const server = createServer((req, res) => { void handleUiPreviewPresetRequest(req, res, dir); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
    return { server, url: `http://127.0.0.1:${address.port}/api/dialogue-preview-presets` };
  };
  let api = await start();
  try {
    const saved = await fetch(api.url, { method: 'PUT', body: JSON.stringify({ fresh: preset('fresh', '保存到文件') }) });
    assert.equal(saved.status, 200); assert.equal((await saved.json()).success, true);
    await new Promise<void>(resolve => api.server.close(() => resolve())); api = await start();
    const loaded = await (await fetch(api.url)).json(); assert.equal(loaded.data.fresh.name, '保存到文件');
    assert.equal(JSON.parse(await readFile(join(dir, 'fresh.json'), 'utf8')).presetKey, 'fresh');
    assert.equal((await fetch(api.url, { method: 'POST' })).status, 405);
    assert.equal((await fetch(api.url, { method: 'PUT', body: '{' })).status, 400);
  } finally { await new Promise<void>(resolve => api.server.close(() => resolve())); }
}));
