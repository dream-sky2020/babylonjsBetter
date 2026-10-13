import type { Scene } from '@babylonjs/core';
import { getVisualDeformationRegistry } from '../render-deformation/visualDeformationRegistry.ts';
import type { SceneEnvironmentPreset } from './sceneEnvironment.types.ts';

export type SceneRenderWarmupResult = { meshCount: number; hiddenFrames: number; durationMs: number };
export type SceneRenderWarmupOptions = { signal?: AbortSignal; timeoutMs?: number; onProgress?: (message: string) => void };
const pending = new WeakMap<Scene, Promise<unknown>>();

/** Caller must cover the canvas and suspend normal rendering/input throughout this operation.
 * Use the real main/shadow/depth passes, after final lighting and deformation have been applied.
 */
export async function warmupSceneRendering(scene: Scene, settings: SceneEnvironmentPreset['renderWarmup'], options: SceneRenderWarmupOptions = {}): Promise<SceneRenderWarmupResult | null> {
  if (!settings?.enabled) return null;
  const previous = pending.get(scene);
  const operation = (async () => {
    if (previous) await previous.catch(() => {});
    options.signal?.throwIfAborted();
    return prepareRendering(scene, options);
  })();
  pending.set(scene, operation);
  try { return await operation; }
  finally { if (pending.get(scene) === operation) pending.delete(scene); }
}

async function prepareRendering(scene: Scene, options: SceneRenderWarmupOptions): Promise<SceneRenderWarmupResult> {
  const engine = scene.getEngine(), started = performance.now(), timeout = options.timeoutMs ?? 60000;
  const previousClipping = scene.skipFrustumClipping;
  const check = () => {
    options.signal?.throwIfAborted();
    if (scene.isDisposed) throw new Error('场景预热期间 Scene 已销毁');
    if (performance.now() - started >= timeout) throw new Error('场景预热超时，材质或阴影尚未准备完成');
  };
  let hiddenFrames = 0;
  try {
    check();
    if (!scene.activeCamera) throw new Error('场景预热需要有效相机');
    scene.skipFrustumClipping = true;
    getVisualDeformationRegistry(scene).update();
    // Visible means eligible for drawing, not inside the current camera frustum.
    const meshes = scene.meshes.filter(mesh => mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && mesh.getTotalVertices() > 0);
    options.onProgress?.('正在准备完整场景的画面与阴影……');
    let readyFrames = 0;
    while (readyFrames < 2) {
      check();
      let ready = true;
      // Complete checks start material and shadow compilation for ALL meshes, including off-screen instances.
      for (const mesh of meshes) {
        if (mesh.isDisposed()) throw new Error('预热对象已销毁');
        if (!mesh.isReady(true)) ready = false;
        for (const subMesh of mesh.subMeshes ?? []) {
          const error = subMesh.effect?.getCompilationError();
          if (error) throw new Error(`场景材质编译失败：${error}`);
        }
      }
      if (ready) {
        options.onProgress?.('正在完成全场景隐藏渲染……');
        // Do not update camera controls or advance animations during loading.
        scene.render(false, true); hiddenFrames++; readyFrames++;
      } else readyFrames = 0;
      await new Promise<void>(resolve => setTimeout(resolve, 16));
    }
    check();
    // Drain the submitted GPU work during loading, rather than its first interactive frame.
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let aborted: (() => void) | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        aborted = () => reject(options.signal!.reason);
        deadline = setTimeout(() => reject(new Error('场景预热超时，图形提交尚未完成')), Math.max(1, timeout - (performance.now() - started)));
        options.signal?.addEventListener('abort', aborted, { once: true });
        engine.readPixels(0, 0, 1, 1).then(() => resolve(), reject);
      });
    } finally {
      clearTimeout(deadline);
      if (aborted) options.signal?.removeEventListener('abort', aborted);
    }
    check();
    return { meshCount: meshes.length, hiddenFrames, durationMs: performance.now() - started };
  } finally {
    scene.skipFrustumClipping = previousClipping;
    if (!scene.isDisposed) scene.resetCachedMaterial();
  }
}
