import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { NullEngine, Scene, FreeCamera, Vector3 } from '@babylonjs/core';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { createEntityContainer } from '../../../../core/entity/entity.utils.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';

test('loader warms after view publication, keeps loading paused and fails closed until retry', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/dungeon-warmup-${process.pid}`, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<aside></aside><div id="status"></div>');
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Option']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  const engine = new NullEngine(), scene = new Scene(engine); new FreeCamera('camera', Vector3.Zero(), scene);
  let cleanup;
  try {
    const { dungeonMapLoaderLabModule } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-map-loader/dungeonMapLoader.labModule.ts');
    const { LabMemoryRegistry } = await server.ssrLoadModule('/labs/kit/shared-memory/LabMemory.ts');
    const { LabUi } = await server.ssrLoadModule('/labs/kit/labUi.ts');
    const { DUNGEON_LIBRARIES_MEMORY } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-libraries/dungeonLibraries.memory.ts');
    const { DUNGEON_SESSION_INFO_MEMORY } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-map-loader/dungeonSession.memory.ts');
    const { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } = await server.ssrLoadModule('/core/dungeon-runtime/dungeonRuntimeAssembly.ts');
    const { dungeonMapSwitchRequest } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol.ts');
    const mapEntity = { id: 'map', entityType: 'map', components: [{ id: 'scene', type: 'scene-environment', version: 3,
      presetKey: 'environment', mapAnchorMode: 'first-tile', mapOffset: [0, 0, 0], tileSize: [1, 1, 1], tileSpacing: [1, 1] }] };
    const spawn = { id: 'spawn', entityType: 'spawn-point', components: [{ id: 'actor', type: 'actor-spawn', version: 1, tileX: 0, tileY: 0 }] };
    const doc = migrateDungeonMapToDocumentV2({ presetKey: 'map', name: 'Map', map: createDungeonMapData({ id: 'map', width: 2, height: 2,
      createMapData: () => createEntityContainer(mapEntity, spawn) }) }).document;
    const preset = { presetKey: 'environment', name: 'Environment', clearColor: '#000000', renderWarmup: { enabled: true },
      models: [], lights: [], objects: [{ id: 'box', name: 'Box', position: [1000, 0, 0], color: '#ffffff', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 } }] };
    const memory = new LabMemoryRegistry(), services = new Map(), handlers = new Map(), layers = [];
    memory.scope('libraries').acquire(DUNGEON_LIBRARIES_MEMORY).replace({ maps: { map: doc }, environments: { environment: preset }, shadows: {} });
    const session = memory.scope('observer').acquire(DUNGEON_SESSION_INFO_MEMORY);
    let published = 0, frames = 0, fail = false;
    const assembly = () => services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    cleanup = dungeonMapLoaderLabModule.setup({ scene, services, memory: memory.scope('dungeon-map-loader'), scheduler: { isPaused: false, register: () => () => {} },
      ui: new LabUi(document.querySelector('aside'), document.querySelector('#status')),
      labState: { registerReference: () => ({ markChanged() {}, unregister() {} }) },
      viewport: { openHtmlLayer(options) {
        assert.equal(options.pauseBabylonRendering, true); assert.equal(options.closable, false);
        const layer = { root: document.createElement('div'), content: document.createElement('div'), disposed: false,
          dispose() { this.disposed = true; } }; layers.push(layer); return layer;
      } },
      communication: { handle(protocol, callback) { handlers.set(protocol, callback); }, async publish() {
        published++; assert.equal(assembly().isPaused, true); assert.equal(session.current.status, 'loading');
        for (const mesh of scene.meshes) mesh.isReady = () => true;
      } },
    });
    scene.render = () => {
      frames++; assert.ok(published > 0); assert.equal(assembly().isPaused, true);
      assert.equal(session.current.status, 'loading'); assert.equal(scene.skipFrustumClipping, true);
      assert.equal(layers.at(-1).disposed, false);
      if (fail) throw new Error('test warmup failure');
    };
    engine.readPixels = async () => new Uint8Array(4);
    const switchMap = () => handlers.get(dungeonMapSwitchRequest)({ presetKey: 'map' });
    assert.equal((await switchMap()).loaded, true); assert.equal(frames, 2);
    assert.equal(session.current.status, 'ready'); assert.equal(assembly().isPaused, false); assert.equal(layers.at(-1).disposed, true);
    fail = true;
    await assert.rejects(switchMap(), /test warmup failure/);
    assert.equal(session.current.status, 'failed'); assert.equal(assembly().isPaused, true); assert.equal(layers.at(-1).disposed, false);
    fail = false;
    assert.equal((await switchMap()).loaded, true); assert.equal(assembly().isPaused, false); assert.ok(layers.every(layer => layer.disposed));
    preset.renderWarmup.enabled = false;
    const previousFrames = frames, previousLayers = layers.length;
    assert.equal((await switchMap()).loaded, true); assert.equal(frames, previousFrames); assert.equal(layers.length, previousLayers);
  } finally {
    cleanup?.dispose(); scene.dispose(); engine.dispose(); await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
