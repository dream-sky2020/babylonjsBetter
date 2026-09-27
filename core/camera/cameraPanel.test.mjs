import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { createCameraLabController } from './cameraLabController.ts';
import { createFloatingCameraControlPanel } from '../ui/FloatingCameraControlPanel.ts';

test('panel projection/preset, dirty draft, apply/reset and free-camera controls match Camera', () => {
  const dom = new JSDOM('<!doctype html><div id="host"></div>');
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Option']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  const engine = new NullEngine(), scene = new Scene(engine);
  const camera = new ArcRotateCamera('panel-test', 1, 1, 10, Vector3.Zero(), scene);
  const c = createCameraLabController(camera);
  const panel = createFloatingCameraControlPanel(document.getElementById('host'), c);
  const field = name => panel.element.querySelector(`[data-field="${name}"]`);
  const select = (name, value) => { field(name).value = value; field(name).dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  const input = (name, value) => { field(name).value = value; field(name).dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  const click = role => panel.element.querySelector(`[data-role="${role}"]`).click();
  try {
    select('projection', 'orthographic');
    assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA);
    assert.equal(field('fovDeg').parentElement.style.display, 'none');
    assert.equal(field('orbitRadius').disabled, true);
    input('orthographicSize', '7'); panel.syncFromController(); assert.equal(field('orthographicSize').value, '7');
    assert.notEqual(camera.orthoTop, 7); click('apply'); assert.equal(camera.orthoTop, 7);
    select('viewPreset', 'isometric'); assert.equal(c.state.viewPreset, 'isometric');
    assert.equal(field('viewLocked').value, 'true');
    click('native-defaults'); assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA); assert.equal(camera.orthoTop, 7);
    camera.orthoTop = 9; camera.orthoBottom = -9; click('refresh'); assert.equal(field('orthographicSize').value, '9');
    click('initial-pose'); assert.equal(field('projection').value, 'perspective');
    select('mode', 'drone');
    assert.equal(field('projection').closest('section').style.display, 'none');
    const rotation = panel.element.querySelector('[data-drone-only] [data-field="freeRotationYDeg"]');
    rotation.value = '60'; rotation.dispatchEvent(new dom.window.Event('input', { bubbles: true })); click('apply');
    assert.ok(Math.abs(c.state.yaw - Math.PI / 3) < 1e-6);
    input('fovDeg', '65'); click('apply'); assert.ok(Math.abs(c.activeCamera.fov - 65 * Math.PI / 180) < 1e-6);
    select('mode', 'orbit'); assert.equal(field('projection').value, 'perspective');
    panel.dispose(); assert.equal(document.getElementById('host').children.length, 0);
  } finally {
    panel.dispose(); scene.dispose(); engine.dispose(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
