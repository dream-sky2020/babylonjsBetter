import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, FreeCamera, Vector3, MeshBuilder } from '@babylonjs/core';
import { warmupSceneRendering } from './sceneRenderWarmup.ts';

function fixture() {
  const engine = new NullEngine(); const scene = new Scene(engine);
  new FreeCamera('camera', Vector3.Zero(), scene);
  const visible = MeshBuilder.CreateBox('offscreen', {}, scene); visible.position.x = 10000;
  const disabled = MeshBuilder.CreateBox('disabled', {}, scene); disabled.setEnabled(false);
  const hidden = MeshBuilder.CreateBox('hidden-source', {}, scene); hidden.isVisible = false;
  const checks: boolean[] = []; let frames = 0; let reads = 0;
  visible.isReady = complete => { checks.push(Boolean(complete)); return checks.length > 1; };
  disabled.isReady = hidden.isReady = () => { throw new Error('inactive mesh compiled'); };
  scene.render = (cameras, animations) => {
    assert.equal(scene.skipFrustumClipping, true); assert.equal(cameras, false); assert.equal(animations, true); frames++;
  };
  engine.readPixels = async () => { reads++; return new Uint8Array(4); };
  return { engine, scene, visible, checks, counts: () => ({ frames, reads }), dispose: () => { scene.dispose(); engine.dispose(); } };
}
test('disabled warmup does not inspect or render the scene', async () => {
  assert.equal(await warmupSceneRendering(null as unknown as Scene, undefined), null);
  assert.equal(await warmupSceneRendering(null as unknown as Scene, { enabled: false }), null);
});
test('compiles offscreen eligible meshes and renders twice, then restores culling', async () => {
  const f = fixture();
  try {
    const result = await warmupSceneRendering(f.scene, { enabled: true });
    assert.equal(result?.meshCount, 1); assert.equal(result?.hiddenFrames, 2);
    assert.deepEqual(f.counts(), { frames: 2, reads: 1 }); assert.ok(f.checks.every(Boolean));
    assert.equal(f.scene.skipFrustumClipping, false);
  } finally { f.dispose(); }
});
test('aborted and timed out warmups restore the original culling value', async () => {
  const f = fixture(); const abort = new AbortController();
  try {
    f.scene.skipFrustumClipping = true;
    f.visible.isReady = () => { abort.abort(); return false; };
    await assert.rejects(warmupSceneRendering(f.scene, { enabled: true }, { signal: abort.signal }), { name: 'AbortError' });
    assert.equal(f.scene.skipFrustumClipping, true);
    f.scene.skipFrustumClipping = false; f.visible.isReady = () => false;
    await assert.rejects(warmupSceneRendering(f.scene, { enabled: true }, { timeoutMs: 1 }), /超时/);
    assert.equal(f.scene.skipFrustumClipping, false); assert.equal(f.counts().frames, 0);
  } finally { f.dispose(); }
});
test('concurrent warmups serialize their temporary scene settings', async () => {
  const f = fixture();
  try {
    await Promise.all([warmupSceneRendering(f.scene, { enabled: true }), warmupSceneRendering(f.scene, { enabled: true })]);
    assert.equal(f.scene.skipFrustumClipping, false); assert.deepEqual(f.counts(), { frames: 4, reads: 2 });
  } finally { f.dispose(); }
});
