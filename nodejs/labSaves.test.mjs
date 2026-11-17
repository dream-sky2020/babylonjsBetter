import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LAB_SAVE_DEV_ROUTE } from '../runtime/labSaveFile.mjs';
import { createBackend } from './server.mjs';

test('the Node.js backend creates Lab directories and reads and writes only checkpoints within saves', async () => {
  const temp = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(temp, 'lab-save-api-'));
  let server;
  try {
    server = createBackend({ root });
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const labId = 'dungeon-interaction-lab';
    const request = async (action, data = {}, headers = {}) => {
      const response = await fetch(origin + LAB_SAVE_DEV_ROUTE, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ labId, action, ...data }),
      });
      return { status: response.status, data: await response.json() };
    };
    const defaultPath = `saves/${labId}`;
    const toDefault = await request('directory');
    assert.deepEqual(toDefault, { status: 200, data: { path: defaultPath } });
    assert.equal((await stat(path.join(root, defaultPath))).isDirectory(), true);
    const archive = {
      labId, format: 'lab-checkpoint', version: 1, createdAt: '2026-11-16T12:00:00Z', modules: {},
      slot: { name: '测试', saveCount: 1, revision: 'first' },
    };
    const id = 'slot.json', text = JSON.stringify(archive);
    assert.equal((await request('write', { id, text, expectedRevision: null })).status, 200);
    assert.equal(await readFile(path.join(root, defaultPath, id), 'utf8'), text);
    assert.equal((await request('read', { id })).data, text);
    assert.deepEqual((await request('list')).data.map(row => row.id), [id]);
    assert.deepEqual((await request('list', { labId: 'other-lab', directory: defaultPath })).data, []);
    assert.equal((await request('write', { id, text, expectedRevision: 'stale' })).status, 400);
    assert.equal((await request('write', { id: '../outside.json', text, expectedRevision: null })).status, 400);
    assert.equal((await request('directory', { directory: 'saves/../../outside' })).status, 400);
    assert.equal((await request('directory', { directory: 'public/test' })).status, 400);
    assert.equal((await request('directory', { directory: 'saves/拒绝' }, { Origin: 'https://example.org' })).status, 403);
    assert.equal((await request('directory', {}, { Origin: 'http://localhost:4550' })).status, 403);
    const manual = await request('directory', { directory: 'saves\\测试目录\\子目录' });
    assert.deepEqual(manual, { status: 200, data: { path: 'saves/测试目录/子目录' } });
    assert.equal((await stat(path.join(root, manual.data.path))).isDirectory(), true);
    assert.deepEqual((await request('list', { directory: manual.data.path })).data, []);
    assert.equal((await request('read', { id })).data, text);
    const outside = path.join(root, 'other');
    await mkdir(outside);
    await writeFile(path.join(outside, id), text);
    await symlink(outside, path.join(root, 'saves', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal((await request('list', { directory: 'saves/linked' })).status, 400);
    assert.equal((await fetch(`${origin}/${defaultPath}/${id}`)).ok, false);

    assert.equal((await request('delete', { id, expectedRevision: 'stale' })).status, 400);
    assert.equal((await request('delete', { id, expectedRevision: 'first', labId: 'other-lab', directory: defaultPath })).status, 400);
    assert.equal((await request('delete', { id: '../slot.json', expectedRevision: 'first' })).status, 400);
    assert.equal((await request('delete', { id, expectedRevision: 'first', directory: 'saves/linked' })).status, 400);
    assert.equal(await readFile(path.join(outside, id), 'utf8'), text);
    assert.equal((await request('read', { id })).data, text);
    const updated = JSON.stringify({ ...archive, slot: { ...archive.slot, revision: 'second' } });
    const [write, deletion] = await Promise.all([
      request('write', { id, text: updated, expectedRevision: 'first' }),
      request('delete', { id, expectedRevision: 'first' }),
    ]);
    assert.deepEqual([write.status, deletion.status].sort(), [200, 400]);
    if (write.status === 200) {
      assert.equal((await request('read', { id })).data, updated);
      assert.deepEqual(await request('delete', { id, expectedRevision: 'second' }), { status: 200, data: null });
    }
    await assert.rejects(stat(path.join(root, defaultPath, id)), { code: 'ENOENT' });
    assert.deepEqual((await request('list')).data, []);
    assert.equal((await request('read', { id })).status, 400);
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (path.dirname(path.resolve(root)) === temp && path.basename(root).startsWith('lab-save-api-')) {
      await rm(root, { recursive: true, force: true });
    }
  }
});
