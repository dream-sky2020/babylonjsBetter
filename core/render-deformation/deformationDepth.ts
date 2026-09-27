import { Camera, Matrix, type AbstractMesh, type DepthRenderer, type Effect, type Material, type Scene } from '@babylonjs/core';

export const depthUniforms = ['uVisualDepthOptions', 'uVisualDepthRange', 'uVisualDepthView', 'uVisualDepthProjection'];
export const depthDeclaration = `
uniform vec4 uVisualDepthOptions;
uniform vec2 uVisualDepthRange;
uniform mat4 uVisualDepthView;
uniform mat4 uVisualDepthProjection;
vec4 vdPackDepth(float depth) {
  const vec4 shifts = vec4(255.0*255.0*255.0,255.0*255.0,255.0,1.0);
  const vec4 mask = vec4(0.0,1.0/255.0,1.0/255.0,1.0/255.0);
  vec4 value = fract(depth * shifts); return value - value.xxyz * mask;
}
vec4 vdDepthColor(vec3 positionW) {
  vec4 clip = uVisualDepthProjection * vec4(positionW, 1.0);
  float depth = (clip.z * uVisualDepthOptions.w + uVisualDepthRange.x) / uVisualDepthRange.y;
  if (uVisualDepthOptions.z == 1.0) depth = gl_FragCoord.z;
  if (uVisualDepthOptions.z == 2.0) depth = (uVisualDepthView * vec4(positionW, 1.0)).z;
  return uVisualDepthOptions.y > 0.5 ? vdPackDepth(depth) : vec4(depth, 0.0, 0.0, 1.0);
}
`;
type DepthPass = { camera: Camera; renderer: DepthRenderer; encoding: 'linear' | 'nonlinear' | 'camera-z' };
const passes = new WeakMap<Scene, Map<number, DepthPass>>();
export const deformationDepthMeshes = new WeakSet<AbstractMesh>();

/** Babylon 9.11 compatibility boundary: discovers depth passes also created by CSM/DepthReducer.
 * Only enumeration/encoding use internal state; pass materials are set through the public API.
 */
export function createSceneDeformationDepthBridge(scene: Scene) {
  const owned = new Map<DepthRenderer, () => void>();
  return {
    sync() {
      const renderers = Object.values((scene as Scene & { _depthRenderer?: Record<string, DepthRenderer> })._depthRenderer ?? {});
      for (const [renderer, release] of owned) if (!renderers.includes(renderer)) { release(); owned.delete(renderer); }
      for (const renderer of renderers) {
        if (owned.has(renderer) || passes.get(scene)?.has(renderer.getDepthMap().renderPassId)) continue;
        const encoding = renderer as unknown as { _storeNonLinearDepth?: boolean; _storeCameraSpaceZ?: boolean };
        if (typeof encoding._storeNonLinearDepth !== 'boolean' || typeof encoding._storeCameraSpaceZ !== 'boolean') throw new Error('Babylon 深度编码接口发生变化，需更新显示变形适配器');
        const camera = renderer.getDepthMap().activeCamera ?? scene.activeCamera;
        if (camera) owned.set(renderer, attachDeformationDepthRenderer(scene, renderer, camera,
          encoding._storeCameraSpaceZ ? 'camera-z' : encoding._storeNonLinearDepth ? 'nonlinear' : 'linear'));
      }
    },
    dispose() { owned.forEach(release => release()); owned.clear(); },
  };
}

/** Explicit registration preserves the caller's depth encoding and existing render-pass materials. */
export function attachDeformationDepthRenderer(scene: Scene, renderer: DepthRenderer, camera: Camera,
  encoding: DepthPass['encoding'] = 'linear'): () => void {
  const passId = renderer.getDepthMap().renderPassId;
  const byPass = passes.get(scene) ?? new Map<number, DepthPass>(); passes.set(scene, byPass);
  if (byPass.has(passId)) throw new Error('深度通道已接入显示变形');
  const pass = { renderer, camera, encoding }; byPass.set(passId, pass);
  const previous = new Map<AbstractMesh, Material | undefined>();
  const sync = () => {
    for (const mesh of scene.meshes) {
      if (!mesh.material || !deformationDepthMeshes.has(mesh)) continue;
      if (!previous.has(mesh)) previous.set(mesh, mesh.getMaterialForRenderPass(passId));
      renderer.setMaterialForRendering(mesh, mesh.material);
    }
  };
  const observer = renderer.getDepthMap().onBeforeBindObservable.add(sync);
  let disposed = false;
  const release = () => {
    if (disposed) return; disposed = true;
    byPass.delete(passId); renderer.getDepthMap().onBeforeBindObservable.remove(observer);
    previous.forEach((material, mesh) => { if (!mesh.isDisposed()) mesh.setMaterialForRenderPass(passId, material); }); previous.clear();
  };
  renderer.getDepthMap().onDisposeObservable.addOnce(release);
  return release;
}

export function bindDeformationDepth(effect: Effect | null, scene: Scene): void {
  if (!effect) return;
  const engine = scene.getEngine(); const pass = passes.get(scene)?.get(engine.currentRenderPassId);
  if (!pass) { effect.setFloat4('uVisualDepthOptions', 0, 0, 0, 1); return; }
  const camera = pass.camera; const reverse = engine.useReverseDepthBuffer; const half = engine.isNDCHalfZRange;
  const ortho = camera.mode === Camera.ORTHOGRAPHIC_CAMERA;
  const min = ortho ? (!reverse && half ? 0 : 1) : (reverse && half ? camera.minZ : half ? 0 : camera.minZ);
  const max = ortho ? (reverse && half ? 0 : 1) : (reverse && half ? 0 : camera.maxZ);
  effect.setFloat4('uVisualDepthOptions', 1, pass.renderer.isPacked ? 1 : 0, pass.encoding === 'nonlinear' ? 1 : pass.encoding === 'camera-z' ? 2 : 0, reverse ? -1 : 1);
  effect.setFloat2('uVisualDepthRange', min, min + max);
  effect.setMatrix('uVisualDepthView', camera.getViewMatrix());
  effect.setMatrix('uVisualDepthProjection', camera.getTransformationMatrix() ?? Matrix.Identity());
}
