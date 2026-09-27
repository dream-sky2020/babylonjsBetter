import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArcRotateCamera, ArcRotateCameraMouseWheelInput, NullEngine, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { createCameraLabController } from './cameraLabController.ts';
import { calculateOrthographicFrustum } from './orthographicFrustum.ts';
import { applyBattleOrthographicFrustum, clampBattleOrthoSize, createBattleCamera } from './battleCamera.core.ts';

const setup = () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('test', 1, 1, 30, Vector3.Zero(), scene);
  const controller = createCameraLabController(camera);
  return { engine, scene, camera, controller, dispose: () => { scene.dispose(); engine.dispose(); } };
};
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('projection continuity, readback, draft apply and native reset', () => {
  const { camera, controller: c, dispose } = setup();
  const target = camera.getTarget().clone(), alpha = camera.alpha, radius = camera.radius, fov = camera.fov;
  c.setProjection('orthographic');
  near(c.state.orthographicSize, radius * Math.tan(fov / 2));
  assert.ok(camera.getTarget().equals(target)); near(camera.alpha, alpha);
  camera.orthoTop = 17; camera.orthoBottom = -17;
  c.refreshStateFromActiveCamera(); near(c.state.orthographicSize, 17);
  c.state.orthographicSize = 8; c.applyStateToActiveCamera(); near(camera.orthoTop!, 8);
  c.resetActiveCameraToNativeDefaults(); assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA); near(camera.orthoTop!, 8);
  c.setProjection('perspective'); near(camera.radius, radius);
  c.setProjection('orthographic'); near(camera.orthoTop!, 8);
  dispose();
});

test('aspect and battle size semantics stay identical', () => {
  assert.deepEqual(calculateOrthographicFrustum(5, 800, 400), { orthoTop: 5, orthoBottom: -5, orthoLeft: -10, orthoRight: 10 });
  assert.deepEqual(calculateOrthographicFrustum(5, 400, 800), { orthoTop: 5, orthoBottom: -5, orthoLeft: -2.5, orthoRight: 2.5 });
  const { engine, scene, dispose } = setup();
  const camera = createBattleCamera(scene);
  applyBattleOrthographicFrustum(camera, engine, 5);
  near(camera.orthoTop!, 5); near(camera.orthoRight!, 5 * engine.getRenderWidth() / engine.getRenderHeight());
  assert.equal(clampBattleOrthoSize(-1), 1.5); assert.equal(clampBattleOrthoSize(50), 14);
  dispose();
});

test('presets, custom target, lock/unlock and initial reset', () => {
  const { camera, controller: c, dispose } = setup();
  for (const preset of ['top', 'side', 'isometric']) {
    assert.ok(c.applyPreset(preset)); assert.equal(c.state.viewPreset, preset);
    assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA);
    assert.equal(camera.lowerAlphaLimit, camera.upperAlphaLimit);
  }
  c.applyPreset({ id: 'custom', label: 'Custom', view: { orbitCenter: new Vector3(3, 4, 5), orthographicSize: 6 } });
  assert.ok(camera.getTarget().equals(new Vector3(3, 4, 5)));
  c.applyPreset('free'); assert.equal(camera.lowerAlphaLimit, null);
  c.resetInitialPose(); assert.equal(c.state.projection, 'perspective'); near(camera.radius, 42);
  dispose();
});

test('free cameras retain independent FOV, bindings and owned keys', () => {
  const { controller: c, camera, dispose } = setup();
  c.applyPreset('top');
  c.setMode('firstPerson'); assert.ok(c.activeCamera instanceof UniversalCamera);
  assert.equal(c.state.projection, 'perspective'); assert.equal(c.setProjection('orthographic'), false);
  c.setVerticalFovDeg(70);
  c.bindFirstPersonPose({ readPose: () => ({ position: new Vector3(2, 3, 4), yaw: 1, pitch: .2 }) });
  c.applyPose(); assert.ok(c.activeCamera.position.equals(new Vector3(2, 3, 4)));
  c.setMode('drone'); c.setVerticalFovDeg(55); c.setOwnedKeyboardCodes(new Set(['KeyQ', 'KeyW']));
  assert.deepEqual((c.activeCamera as UniversalCamera).keysDownward, [81]);
  c.setMode('firstPerson'); near(c.state.fovDeg, 70);
  c.setMode('drone'); near(c.state.fovDeg, 55);
  c.setMode('orbit'); assert.equal(c.activeCamera, camera); assert.equal(c.state.projection, 'orthographic');
  c.setMode('lockPan'); const y = c.state.lockPlaneValue;
  c.keys.add('KeyD'); c.update(.1); near(c.state.lockPosition.y, y);
  c.setInputEnabled(false); const position = c.state.lockPosition.clone(); c.handlePointerDelta(100, 100); c.update(.1);
  assert.ok(c.state.lockPosition.equals(position));
  dispose();
});

test('resize observer and camera disposal cleanup', () => {
  const { engine, scene, camera, controller: c, dispose } = setup();
  c.setProjection('orthographic'); c.setOrthographicSize(4);
  engine.getRenderWidth = () => 400; engine.getRenderHeight = () => 800;
  engine.onResizeObservable.notifyObservers(engine);
  near(camera.orthoRight!, 2); near(camera.orthoTop!, 4);
  camera.dispose(); assert.equal(scene.cameras.length, 0);
  assert.equal(engine.onResizeObservable.hasObservers(), false);
  c.dispose(); dispose();
});

test('orthographic native wheel hook clamps zoom, pauses and restores native perspective input', () => {
  const { camera, controller: c, dispose } = setup();
  const wheel = camera.inputs.attached.mousewheel as ArcRotateCameraMouseWheelInput;
  const original = wheel.customComputeDeltaFromMouseWheel;
  c.setView({ projection: 'orthographic', orthographicSize: 5, orthographicMinSize: 2, orthographicMaxSize: 8 });
  const radius = camera.radius;
  const zoom = (delta: number) => wheel.customComputeDeltaFromMouseWheel!(delta, wheel, {} as WheelEvent);
  assert.equal(zoom(1e6), 0); near(camera.orthoTop!, 2); near(camera.radius, radius);
  zoom(-1e6); near(camera.orthoTop!, 8);
  c.setInputEnabled(false); zoom(100); near(camera.orthoTop!, 8);
  c.setMode('drone'); c.setMode('orbit'); c.update(.1); near(camera.orthoTop!, 8);
  c.setProjection('perspective'); assert.equal(wheel.customComputeDeltaFromMouseWheel, original);
  c.setProjection('orthographic'); c.dispose(); assert.equal(wheel.customComputeDeltaFromMouseWheel, original);
  dispose();
});

test('custom initial preset resets correctly; unlocked limits and horizontal FOV read back', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const camera = new ArcRotateCamera('custom', 1, 1, 20, Vector3.Zero(), scene);
  const c = createCameraLabController(camera, { viewPreset: 'custom' }, [{
    id: 'custom', label: 'custom', view: { projection: 'orthographic', orthographicSize: 6, orbitYaw: .5, viewLocked: true },
  }]);
  near(camera.orthoTop!, 6); c.applyPreset('free'); c.reset(); near(camera.orthoTop!, 6);
  assert.equal(c.state.viewPreset, 'custom');
  c.setView({ viewLocked: false, projection: 'perspective', lowerAlphaLimit: .2, upperAlphaLimit: .4 });
  near(camera.alpha, .4); near(c.state.upperAlphaLimit!, .4);
  camera.lowerAlphaLimit = .3; c.refreshStateFromActiveCamera(); near(c.state.lowerAlphaLimit!, .3);
  c.setHorizontalFovDeg(80); c.refreshStateFromActiveCamera();
  engine.getRenderWidth = () => 800; engine.getRenderHeight = () => 800;
  engine.onResizeObservable.notifyObservers(engine); near(c.state.horizontalFovDeg, 80); near(c.state.fovDeg, 80);
  c.resetInitialPose(); assert.equal(c.state.projection, 'orthographic'); near(camera.orthoTop!, 6);
  scene.dispose(); engine.dispose();
});

test('locked orbit survives native input; resize does not write an unrelated active camera', () => {
  const { engine, scene, camera, controller: c, dispose } = setup();
  c.applyPreset('isometric');
  const alpha = camera.alpha, beta = camera.beta;
  camera.inertialAlphaOffset = .2; camera.inertialBetaOffset = .2;
  scene.render(); near(camera.alpha, alpha); near(camera.beta, beta);
  const external = new UniversalCamera('external', Vector3.Zero(), scene);
  external.fov = 1.1; external.minZ = .4; external.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
  scene.activeCamera = external;
  engine.onResizeObservable.notifyObservers(engine);
  near(external.fov, 1.1); near(external.minZ, .4); assert.equal(external.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA);
  dispose();
});
