import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core';

test('LabKit routes owned keys, preserves preferences and pauses input across projection changes', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<!doctype html><div id="stage"></div><aside></aside><div id="status"></div>', { url: 'http://localhost/camera-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Option', 'location', 'localStorage']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  let engine, scene, keyboard, system;
  try {
    const { LabUi } = await server.ssrLoadModule('/tools/lab-kit/labUi.ts');
    const { LabKeyboardRouter } = await server.ssrLoadModule('/tools/lab-kit/keyboard/LabKeyboardRouter.ts');
    const { createLabCameraSystem } = await server.ssrLoadModule('/tools/lab-kit/camera/labCameraSystem.ts');
    engine = new NullEngine(); scene = new Scene(engine);
    const camera = new ArcRotateCamera('labkit', 1, 1, 30, Vector3.Zero(), scene);
    let attachmentCount = 0;
    const attach = camera.attachControl.bind(camera);
    camera.attachControl = (...args) => { attachmentCount += 1; attach(...args); };
    keyboard = new LabKeyboardRouter(null);
    const ui = new LabUi(document.querySelector('aside'), document.getElementById('status'));
    system = createLabCameraSystem(document.getElementById('stage'), ui, camera, keyboard, { projection: 'orthographic', orthographicSize: 11 });
    assert.equal(camera.orthoTop, 11);
    const checkboxes = document.querySelectorAll('[data-lab-panel="system-camera"] input[type="checkbox"]');
    // Floating panel, pointer, keyboard, interception, prevent-default.
    checkboxes[2].checked = true; checkboxes[2].dispatchEvent(new dom.window.Event('change'));
    system.controller.setMode('drone'); system.update(.016);
    assert.deepEqual(system.controller.activeCamera.keysUp, [87]);
    const player = keyboard.register({ id: 'player', label: 'Player', keys: ['KeyW'], priority: 100, onKeyDown: () => 'handled' });
    assert.deepEqual(system.controller.activeCamera.keysUp, []);
    player.dispose(); assert.deepEqual(system.controller.activeCamera.keysUp, [87]);
    system.controller.setMode('lockPan'); system.update(.016);
    const event = { phase: 'keydown', code: 'KeyD', key: 'd', repeat: false, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, targetKind: 'canvas' };
    keyboard.route(event); assert.equal(system.controller.keys.has('KeyD'), true);
    system.setInputEnabled(false); assert.equal(system.controller.keys.size, 0);
    const countWhilePaused = attachmentCount;
    system.controller.applyPreset('top'); system.update(.016);
    assert.equal(attachmentCount, countWhilePaused);
    assert.deepEqual(camera.keysUp, []); assert.equal(camera.inputs.attachedToElement, false);
    system.setInputEnabled(true); system.update(.016);
    assert.ok(attachmentCount > countWhilePaused);
    assert.deepEqual(camera.keysUp, [38]); assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA);
    checkboxes[0].checked = true; checkboxes[0].dispatchEvent(new dom.window.Event('change'));
    assert.equal(system.floatingPanel.visible, true);
    system.dispose(); system = undefined;
    assert.equal(document.querySelector('[data-lab-panel="system-camera"]'), null);
    assert.equal(scene.cameras.length, 1);
    assert.equal(engine.onResizeObservable.hasObservers(), false);
    const nextUi = new LabUi(document.createElement('aside'), document.createElement('div'));
    system = createLabCameraSystem(document.getElementById('stage'), nextUi, camera, keyboard);
    assert.equal(system.floatingPanel.visible, true);
    assert.deepEqual(camera.keysUp, [38]);
  } finally {
    system?.dispose(); keyboard?.dispose(); scene?.dispose(); engine?.dispose();
    await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
