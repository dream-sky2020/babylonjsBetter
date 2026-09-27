import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { ArcRotateCamera, NullEngine, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { createCameraLabController } from './cameraLabController.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('player camera module applies/saves orthographic overhead without changing first-person runtime control', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<!doctype html><canvas></canvas><aside></aside><div id="status"></div>', { url: 'http://localhost/player-camera-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Option', 'location', 'localStorage']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  previous.set('ResizeObserver', globalThis.ResizeObserver);
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  let engine, scene, keyboard, c, disposeModule, labState, viewport;
  try {
    const { LabUi } = await server.ssrLoadModule('/tools/lab-kit/labUi.ts');
    const { LabState } = await server.ssrLoadModule('/tools/lab-kit/lab-state/LabState.ts');
    const { LabKeyboardRouter } = await server.ssrLoadModule('/tools/lab-kit/keyboard/LabKeyboardRouter.ts');
    const { LabViewportManager } = await server.ssrLoadModule('/tools/lab-kit/labViewportManager.ts');
    const { dungeonPlayerCameraLabModule } = await server.ssrLoadModule('/tools/lab-modules/dungeon/dungeon-first-person-camera/dungeonFirstPersonCamera.labModule.ts');
    engine = new NullEngine(); scene = new Scene(engine); keyboard = new LabKeyboardRouter(null); labState = new LabState();
    const camera = new ArcRotateCamera('player', 1, 1, 42, Vector3.Zero(), scene);
    c = createCameraLabController(camera);
    const canvas = document.querySelector('canvas');
    let captured = null;
    canvas.hasPointerCapture = id => captured === id;
    canvas.setPointerCapture = id => { captured = id; };
    canvas.releasePointerCapture = () => { captured = null; };
    const runtime = { map: { id: 'map-a', width: 4, height: 4 }, playerPosition: { tileX: 1, tileY: 2 },
      playerWorldPosition: [3, 0, 8], playerWorldRotationY: .7, playerFacing: 'north' };
    const refs = { current: { loadId: 1, runtime, spawn: { sceneEnvironmentComponent: {
      tileSize: [2, 2, 2], tileSpacing: [2, 2], mapOffset: [0, 0, 0], mapAnchorMode: 'first-tile',
    } } } };
    const services = new Map([['dungeon:map-loader-references', refs]]);
    const handlers = new Map();
    viewport = new LabViewportManager(document.body, canvas, c, () => {});
    const overlay = viewport.openHtmlLayer({ id: 'pause', title: 'Pause', mode: 'overlay' });
    disposeModule = dungeonPlayerCameraLabModule.setup({ engine, scene, canvas, camera, cameraController: c, keyboard, labState,
      viewport,
      ui: new LabUi(document.querySelector('aside'), document.getElementById('status')), services,
      communication: { on: (event, fn) => { handlers.set(event, fn); return () => handlers.delete(event); }, publish: async () => {} },
    });
    const service = services.get('dungeon:player-camera');
    const projection = document.querySelector('[data-player-camera="projection"]');
    const size = document.querySelector('[data-player-camera="orthographicSize"]');
    const changeProjection = value => { projection.value = value; projection.dispatchEvent(new dom.window.Event('change')); };
    assert.ok(c.activeCamera instanceof UniversalCamera); assert.equal(c.state.projection, 'perspective'); assert.equal(projection.disabled, true);
    c.setVerticalFovDeg(73); c.applyPose(); near(c.activeCamera.position.x, 3); near(c.activeCamera.position.y, 2.65);
    await labState.restore({ format: 'lab-state', version: 1, createdAt: '', modules: {} });
    service.setMode('overhead'); assert.equal(c.state.projection, 'perspective'); assert.equal(projection.disabled, false);
    c.setVerticalFovDeg(51); const target = camera.getTarget().clone(); const alpha = camera.alpha;
    changeProjection('orthographic');
    assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA); near(camera.orthoTop, camera.radius * Math.tan(51 * Math.PI / 360));
    assert.ok(camera.getTarget().equals(target)); near(camera.alpha, alpha);
    size.value = '9'; size.dispatchEvent(new dom.window.Event('input')); near(camera.orthoTop, 9);
    engine.getRenderWidth = () => 400; engine.getRenderHeight = () => 800;
    engine.onResizeObservable.notifyObservers(engine); near(camera.orthoRight, 4.5); near(camera.orthoTop, 9);
    changeProjection('perspective'); near(camera.fov, 51 * Math.PI / 180);
    changeProjection('orthographic'); near(camera.orthoTop, 9);
    c.setOrthographicSize(12); scene.onBeforeRenderObservable.notifyObservers(scene); assert.equal(size.value, '12');
    const snapshot = labState.createSnapshot();
    assert.deepEqual(snapshot.modules['dungeon-player-camera'].projection.data, { projection: 'orthographic', orthographicSize: 12 });
    changeProjection('perspective'); await labState.restore(snapshot); near(camera.orthoTop, 12); assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA);
    const invalid = structuredClone(snapshot); invalid.modules['dungeon-player-camera'].projection.data.orthographicSize = -1;
    await assert.rejects(labState.restore(invalid)); near(camera.orthoTop, 12);
    service.setMode('first-person'); assert.equal(c.state.projection, 'perspective'); near(c.activeCamera.fov, 73 * Math.PI / 180);
    await labState.restore(snapshot); assert.equal(c.state.projection, 'perspective');
    runtime.playerWorldPosition = [7, 2, 10]; runtime.playerWorldRotationY = 1.2;
    scene.onBeforeRenderObservable.notifyObservers(scene); near(c.activeCamera.position.x, 7); near(c.activeCamera.position.y, 4.65); near(c.activeCamera.rotation.y, 1.2);
    overlay.show(); assert.equal(viewport.isBabylonInputPaused, true); assert.equal(c.inputEnabled, false);
    keyboard.route({ phase: 'keydown', code: 'KeyV', key: 'v', repeat: false, targetKind: 'canvas' });
    assert.equal(service.mode, 'first-person');
    canvas.dispatchEvent(Object.assign(new dom.window.Event('pointerdown'), { button: 0, pointerId: 1 })); assert.equal(captured, null);
    service.setMode('overhead'); assert.equal(c.inputEnabled, false); assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA);
    refs.current = { ...refs.current, loadId: 2, runtime: { ...runtime, playerWorldPosition: [20, 0, 30] } };
    for (const handler of handlers.values()) handler({ loadId: 2 });
    near(camera.getTarget().x, 20); near(camera.getTarget().z, 30); near(camera.orthoTop, 12);
    overlay.hide(); assert.equal(viewport.isBabylonInputPaused, false); assert.equal(c.inputEnabled, true);
    c.setInputEnabled(false);
    // Mouse disabled alone must not disable the independent V-key consumer.
    keyboard.route({ phase: 'keydown', code: 'KeyV', key: 'v', repeat: false, targetKind: 'canvas' });
    assert.equal(service.mode, 'first-person'); assert.equal(c.inputEnabled, false);
    c.setInputEnabled(true);
    assert.deepEqual(runtime.playerPosition, { tileX: 1, tileY: 2 }); near(runtime.playerWorldRotationY, 1.2);
    disposeModule(); disposeModule = null;
    assert.equal(c.state.mode, 'orbit'); assert.equal(c.state.projection, 'perspective');
    assert.equal(labState.inspect().length, 0); assert.equal(handlers.size, 0);
    assert.equal(scene.onBeforeRenderObservable.hasObservers(), false);
    assert.equal(document.querySelector('[data-player-camera="projection"]'), null);
  } finally {
    disposeModule?.(); viewport?.dispose(); c?.dispose(); keyboard?.dispose(); labState?.dispose(); scene?.dispose(); engine?.dispose();
    await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
