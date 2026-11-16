import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, before, after } from 'node:test'
import { createBackend } from './server.mjs'

let root
let base
let server
let selection
const configPath = (...names) => join(root, 'config', ...names)
const publicPath = (...names) => join(root, 'public', ...names)

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'babylon-node-backend-'))
  await mkdir(publicPath('resources'), { recursive: true })
  await mkdir(join(root, 'python', 'Identity_Skill_Icons'), { recursive: true })
  server = createBackend({ root, pick: async () => selection })
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  base = 'http://127.0.0.1:' + server.address().port
})

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve))
  if (root) await rm(root, { recursive: true, force: true })
})

async function request(path, method = 'GET', body) {
  const headers = body === undefined ? {} : { 'Content-Type': 'application/json' }
  const response = await fetch(base + path, { method, headers, body: JSON.stringify(body) })
  return [response.status, await response.json()]
}

test('health, CORS and preflight from the Vite development site', async () => {
  const origin = 'http://127.0.0.1:1184'
  const health = await fetch(base + '/health', { headers: { Origin: origin } })
  assert.equal(health.status, 200)
  assert.equal((await health.json()).ok, true)
  assert.equal(health.headers.get('access-control-allow-origin'), origin)
  const preflight = await fetch(base + '/api/lab-configs/sample', {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' },
  })
  assert.match(preflight.headers.get('access-control-allow-methods'), /PUT/)
  const external = await fetch(base + '/api/pick_public_image', {
    method: 'POST', headers: { Origin: 'https://example.test' },
  })
  assert.equal(external.status, 403)
})

test('config route writes valid data and rejects invalid documents without changing disk', async () => {
  const endpoint = '/api/model-shoot-configs'
  assert.deepEqual(await request(endpoint), [200, { success: true, count: 0, data: {} }])
  const document = { example: { modelPath: 'example', fireIntervalMs: 200, recoilAngleDeg: 5 } }
  const put = await request(endpoint, 'PUT', document)
  assert.equal(put[0], 200)
  const stored = await readFile(configPath('modelShootConfigs.json'), 'utf8')
  assert.deepEqual(JSON.parse(stored), document)
  const invalid = await request(endpoint, 'PUT', { example: { ...document.example, recoilAngleDeg: 999 } })
  assert.equal(invalid[0], 400)
  assert.deepEqual(invalid[1].errors.slice(0, 1), ['root[example].recoilAngleDeg out of range'])
  assert.equal(await readFile(configPath('modelShootConfigs.json'), 'utf8'), stored)
})

test('Lab optimistic revision allows only one concurrent write and files can be read after reconnecting', async () => {
  const endpoint = '/api/lab-configs/test-lab'
  const data = { format: 'lab-config', version: 1, labId: 'test-lab', modules: { state: { value: 1 } } }
  const [status, first] = await request(endpoint, 'PUT', { data, revision: null })
  assert.equal(status, 200)
  assert.match(first.revision, /^[a-f0-9]{64}$/)
  assert.deepEqual(await request(endpoint), [200, first])
  const results = await Promise.all([2, 3].map(value => request(endpoint, 'PUT', {
    data: { ...data, modules: { state: { value } } }, revision: first.revision,
  })))
  assert.deepEqual(results.map(([code]) => code).sort(), [200, 409])
  const latest = results.find(([code]) => code === 200)[1]
  assert.deepEqual(await request(endpoint), [200, latest])
  assert.equal(await readFile(configPath('labs', 'test-lab.json'), 'utf8'), JSON.stringify(latest.data, null, 2) + '\n')
  assert.deepEqual(await readdir(configPath('labs')), ['test-lab.json'])
})

test('split UI and scene catalogs keep their existing on-disk structures', async () => {
  const endpoint = '/api/dialogue-preview-presets'
  const makePreset = key => ({
    schemaVersion: 2, presetKey: key, name: key, canvas: { width: 800, height: 600, gridSize: 8 },
    nodes: {}, rootIds: [],
  })
  const data = { example: makePreset('example') }
  assert.equal((await request(endpoint, 'PUT', data))[0], 200)
  assert.deepEqual(await request(endpoint), [200, { success: true, count: 1, data }])
  assert.deepEqual(JSON.parse(await readFile(configPath('uiPreviewPresets', 'index.json'))), {
    version: 1, presets: { example: { presetKey: 'example', name: 'example', file: 'example.json' } },
  })
  assert.equal((await request(endpoint, 'PUT', { INDEX: makePreset('INDEX') }))[0], 400)
  await writeFile(configPath('uiPreviewPresets', 'unindexed.json'), '{}')
  assert.equal((await request(endpoint, 'PUT', { renamed: makePreset('renamed') }))[0], 200)
  assert.deepEqual((await readdir(configPath('uiPreviewPresets'))).sort(), ['index.json', 'renamed.json', 'unindexed.json'])

  await mkdir(configPath('sceneEnvironmentPresets'))
  const scene = join('sceneEnvironmentPresets', 'sample.json')
  await writeFile(configPath('sceneEnvironmentPresets', 'index.json'), JSON.stringify({ version: 1, presets: { sample: 'sample.json' } }))
  await writeFile(configPath(scene), JSON.stringify({ presetKey: 'sample' }))
  assert.equal((await request('/api/scene-environment-presets'))[0], 200)
  await writeFile(configPath(scene), JSON.stringify({ presetKey: 'sample', extendsPresetKey: 'sample' }))
  assert.equal((await request('/api/scene-environment-presets'))[0], 500)
})

test('images upload, resolve, stream, select and write atlas JSON within public', async () => {
  const form = new FormData()
  form.append('file', new Blob([Buffer.from([1, 2, 3, 4])], { type: 'image/png' }), 'test image.PNG')
  form.append('subdir', 'test-assets')
  const upload = await fetch(base + '/api/upload_image', { method: 'POST', body: form })
  assert.equal(upload.status, 200)
  const image = await upload.json()
  assert.equal(image.url, '/resources/test-assets/test_image.png')
  const served = await fetch(base + image.url)
  assert.equal(served.headers.get('content-type'), 'image/png')
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), new Uint8Array([1, 2, 3, 4]))
  assert.equal((await request('/api/find_resource_by_name?name=test_image.png'))[1].resourcePath, image.resourcePath)
  selection = publicPath('resources', 'test-assets', 'test_image.png')
  assert.equal((await request('/api/pick_public_image', 'POST', {}))[1].publicPath, image.resourcePath)
  const proxied = await fetch(base + '/proxy_local_image?path=' + encodeURIComponent(selection))
  assert.equal(proxied.status, 200)
  selection = ''
  assert.deepEqual(await request('/api/pick_public_image', 'POST', {}), [200, {
    success: false, message: 'cancelled', cancelled: true,
  }])
  const data = { meta: { image: 'test_image.png' }, frames: {} }
  assert.equal((await request('/api/atlas-json', 'PUT', { path: '../outside', data }))[0], 403)
  assert.equal((await request('/api/atlas-json', 'PUT', { path: 'public/resources/test-assets/sheet', data }))[0], 200)
  assert.deepEqual(JSON.parse(await readFile(publicPath('resources', 'test-assets', 'sheet.json'))), data)
})
