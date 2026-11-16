import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('the project Vite config serves editor APIs, Lab saves and static assets on one port', async () => {
  const root = await mkdtemp(join(tmpdir(), 'babylon-vite-backend-'))
  let server
  try {
    const publicResources = join(root, 'public', 'resources')
    await mkdir(publicResources, { recursive: true })
    await writeFile(join(publicResources, 'sample.glb'), 'model asset')
    await writeFile(join(root, 'index.html'), '<!doctype html><title>Development root</title>')
    server = await createServer({
      root,
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      cacheDir: join(root, '.vite'),
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { host: '127.0.0.1', port: 0, strictPort: false, open: false, hmr: false, watch: null },
    })
    await server.listen()
    const origin = 'http://127.0.0.1:' + server.httpServer.address().port
    assert.equal(server.config.define['import.meta.env.VITE_SAME_ORIGIN_DEV_BACKEND'], true)
    const health = await fetch(origin + '/health')
    assert.equal((await health.json()).ok, true)
    const labId = 'test-lab'
    const data = { format: 'lab-config', version: 1, labId, modules: { example: { speed: 1 } } }
    const endpoint = origin + '/api/lab-configs/' + labId
    const put = await fetch(endpoint, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, revision: null }),
    })
    assert.equal(put.status, 200)
    const saved = await put.json()
    assert.match(saved.revision, /^[a-f0-9]{64}$/)
    assert.deepEqual(await (await fetch(endpoint)).json(), saved)
    assert.deepEqual(JSON.parse(await readFile(join(root, 'config', 'labs', labId + '.json'), 'utf8')), data)

    const slots = await fetch(origin + '/api/lab-saves', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labId, action: 'directory' }),
    })
    assert.equal(slots.status, 200)
    assert.deepEqual(await slots.json(), { path: 'saves/' + labId })
    const checkpoint = JSON.stringify({
      format: 'lab-checkpoint', version: 1, labId, modules: {}, createdAt: '2026-11-16T12:00:00Z',
    })
    const slotId = 'check.json'
    const write = await fetch(origin + '/api/lab-saves', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ labId, action: 'write', id: slotId, text: checkpoint, expectedRevision: null }),
    })
    assert.equal(write.status, 200)
    const read = await fetch(origin + '/api/lab-saves', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ labId, action: 'read', id: slotId }),
    })
    assert.equal(await read.json(), checkpoint)
    assert.equal((await fetch(origin + '/saves/' + labId + '/' + slotId)).ok, false)
    const model = await fetch(origin + '/resources/sample.glb')
    assert.equal(await model.text(), 'model asset')
    assert.equal((await fetch(origin + '/api/model-assets')).status, 200)
    assert.match(await (await fetch(origin + '/')).text(), /Development root/)
  } finally {
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
})

