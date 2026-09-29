import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readSceneEnvironmentPresets, writeSceneEnvironmentPreset } from './sceneEnvironmentPresetStore.ts';

const temporary = await mkdtemp(path.join(tmpdir(), 'scene-environment-browser-'));
const dir = path.join(temporary, 'sceneEnvironmentPresets');
await mkdir(dir);
const color = '#ffffff';
const base = { presetKey: 'base', name: 'Browser Base', clearColor: '#123456', objects: [
  { id: 'box', name: 'Browser Box', position: [0, 1, 0], color, geometry: { primitive: 'box', width: 2, height: 2, depth: 2 }, shadow: { cast: true, receive: true } },
  { id: 'ground', name: 'Browser Ground', position: [0, 0, 0], color, geometry: { primitive: 'ground', width: 20, height: 20 }, shadow: { receive: true } },
  { id: 'cylinder', name: 'Browser Cylinder', position: [4, 1, 0], color, geometry: { primitive: 'cylinder', height: 2, diameterTop: 1, diameterBottom: 2 } },
], models: [{ id: 'model', name: 'Browser Model', modelPath: 'resources/Model/GLB/cuboid.glb', position: [-4, 1, 0] }], lights: [
  { id: 'hemi', name: 'Browser Hemi', intensity: .6, color, light: { primitive: 'hemispheric', direction: [0, 1, 0], groundColor: '#111111' } },
  { id: 'sun', name: 'Browser Sun', intensity: 1, color, light: { primitive: 'directional', direction: [0, -1, 1] }, shadow: { qualityPresetKey: 'compact-standard', qualityTier: 'low' } },
  { id: 'point', name: 'Browser Point', intensity: 1, color, light: { primitive: 'point', position: [2, 4, 0], range: 15 } },
] };
const child = { presetKey: 'child', name: 'Browser Child', extendsPresetKey: 'base' };
await writeFile(path.join(dir, 'index.json'), JSON.stringify({ version: 1, presets: { base: 'base.json', child: 'child.json' } }));
await writeFile(path.join(dir, 'base.json'), JSON.stringify(base));
await writeFile(path.join(dir, 'child.json'), JSON.stringify(child));
await writeFile(path.join(temporary, 'shadowQualityPresets.json'), await readFile('config/shadowQualityPresets.json'));
const originalBase = await readFile(path.join(dir, 'base.json'), 'utf8');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{
  name: 'scene-environment-browser-verification',
  resolveId(id) { if (id === 'virtual:scene-environment-verification') return id; },
  load(id) { if (id === 'virtual:scene-environment-verification') return `import { EngineStore } from '@babylonjs/core'; export const scene = () => EngineStore.Instances[0].scenes.find(s => s.getMeshByName('box'));`; },
}] });
// Exercise the real storage boundary with temporary data, never repository preset writes.
server.middlewares.stack.unshift({ route: '', handle: async (req, res, next) => {
  if (req.url?.startsWith('/__scene-production/')) {
    const relative = decodeURIComponent(req.url.split('?')[0].slice('/__scene-production/'.length));
    const root = path.resolve(relative.startsWith('resources/') ? 'public' : 'node_modules/.cache/scene-editor-build');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) { res.statusCode = 400; res.end(); return; }
    try {
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' })[path.extname(target)] ?? 'application/octet-stream');
      res.end(await readFile(target));
    } catch { res.statusCode = 404; res.end('Build first with npm run build:scene-editors'); }
    return;
  }
  if (req.url?.split('?')[0] !== '/api/scene-environment-presets') return next();
  res.setHeader('Content-Type', 'application/json');
  try {
    if (req.method === 'GET') res.end(JSON.stringify({ success: true, data: await readSceneEnvironmentPresets(dir) }));
    else if (req.method === 'PUT') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      await writeSceneEnvironmentPreset(dir, body.presetKey, body.declaration);
      res.end(JSON.stringify({ success: true }));
    } else { res.statusCode = 405; res.end('{}'); }
  } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ success: false, message: String(error) })); }
} });
try {
  await server.listen();
  const port = server.httpServer.address().port;
  const env = { ...process.env, SCENE_ENVIRONMENT_TEST_URL: `http://127.0.0.1:${port}/tools/scene-environment-lab/index.html`, SCENE_ENVIRONMENT_PRODUCTION_URL: `http://127.0.0.1:${port}/__scene-production/tools/scene-environment-lab/index.html` };
  delete env.ELECTRON_RUN_AS_NODE;
  const code = await new Promise((resolve, reject) => {
    const child = spawn(electron, ['scripts/sceneEnvironmentBrowser.cjs'], { env, windowsHide: true, stdio: 'inherit' });
    child.on('exit', resolve); child.on('error', reject);
  });
  if (code !== 0) throw new Error(`Browser tests exited ${code}`);
  if (await readFile(path.join(dir, 'base.json'), 'utf8') !== originalBase) throw new Error('Saving child modified base file');
  const saved = JSON.parse(await readFile(path.join(dir, 'child.json'), 'utf8'));
  if (saved.extendsPresetKey !== 'base' || saved.objects[0].geometry.width !== 6) throw new Error('Child did not retain inheritance and saved geometry');
  console.log('Browser regression passed; base unchanged, child retained inheritance.');
} finally { await server.close(); await rm(temporary, { recursive: true, force: true }); }
