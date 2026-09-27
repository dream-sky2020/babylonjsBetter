import { ArcRotateCamera, Color3, Color4, Engine, Matrix, MeshBuilder, PBRMaterial, StandardMaterial, ParticleSystem, GPUParticleSystem, RawTexture, Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import { createDeformationSamples } from './deformationSamples';
import { getVisualDeformationRegistry } from '@/core/render-deformation/visualDeformationRegistry.ts';
import { DEFAULT_DEFORMATION_SETTINGS } from '@/core/render-deformation/deformation.ts';
import { attachDeformationDepthRenderer } from '@/core/render-deformation/deformationDepth.ts';
import { registerParticleDeformation } from '@/core/render-deformation/particleDeformation.ts';

declare global { interface Window { deformationVerification: Promise<unknown> } }
window.deformationVerification = (async () => {
  const canvas = document.getElementById('test') as HTMLCanvasElement;
  const engine = new Engine(canvas, false, { preserveDrawingBuffer: true }); const scene = new Scene(engine); scene.clearColor = new Color4(.03, .05, .08, 1);
  const errors: string[] = []; const originalError = console.error; console.error = (...args) => { errors.push(args.map(String).join(' ')); originalError(...args); };
  const camera = new ArcRotateCamera('test-camera', Math.PI / 2, Math.PI / 4, 22, new Vector3(0, 2, 0), scene); camera.mode = 1;
  camera.orthoTop = 6; camera.orthoBottom = -6; camera.orthoLeft = -8; camera.orthoRight = 8; camera.minZ = .1; camera.maxZ = 100;
  const samples = createDeformationSamples(scene);
  // Objects outside the demo group stand in for existing map geometry and models.
  const sceneMaterials = [new StandardMaterial('scene-standard', scene), new PBRMaterial('scene-pbr', scene)];
  const sceneObjects = sceneMaterials.map((material, index) => {
    const mesh = MeshBuilder.CreateBox(`scene-object-${index}`, { size: .9 }, scene);
    mesh.position.set(index ? 6.5 : -6.5, -2.5, 1.5); mesh.material = material;
    material.emissiveColor = new Color3(.08, .12, .16);
    return mesh;
  });
  const shadows = new ShadowGenerator(256, samples.light); shadows.normalBias = 0; shadows.transparencyShadow = true; samples.meshes.forEach(m => shadows.addShadowCaster(m));
  const registry = getVisualDeformationRegistry(scene); const lease = registry.acquire('verification');
  const texture = RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene, false, false);
  const particles = [new ParticleSystem('cpu', 16, scene), new GPUParticleSystem('gpu', { capacity: 16 }, scene)];
  for (const [index, system] of particles.entries()) {
    system.particleTexture = texture; system.emitter = new Vector3(index, 1, 0); system.emitRate = 0;
    system.minLifeTime = 10; system.maxLifeTime = 10; system.minSize = .1; system.maxSize = .1; registerParticleDeformation(scene, system); system.start();
  }
  const render = async (frames = 4) => { for (let i = 0; i < frames; i++) { await new Promise(resolve => setTimeout(resolve, 20)); engine.beginFrame(); scene.render(); engine.endFrame(); } };
  const readPixels = async () => { const data = await engine.readPixels(0, 0, 800, 600); return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice(); };
  await render(15);
  const before = await readPixels();
  samples.light.setEnabled(false); await render(4);
  const withoutSampleLight = await readPixels();
  const patchDifference = (position: Vector3) => {
    const p = Vector3.Project(position, Matrix.Identity(), camera.getTransformationMatrix(), camera.viewport.toGlobal(800, 600));
    let changed = 0;
    for (let y = Math.round(600 - p.y) - 4; y <= Math.round(600 - p.y) + 4; y++) for (let x = Math.round(p.x) - 4; x <= Math.round(p.x) + 4; x++) {
      const offset = (y * 800 + x) * 4;
      for (let channel = 0; channel < 3; channel++) if (Math.abs(before[offset + channel] - withoutSampleLight[offset + channel]) > 1) changed++;
    }
    return changed;
  };
  const sceneLightingDifference = sceneObjects.map(mesh => patchDifference(mesh.getAbsolutePosition()));
  const sampleLightingDifference = patchDifference(samples.meshes[0].getAbsolutePosition());
  if (sceneLightingDifference.some(value => value !== 0)) throw new Error(`示例补光改变了原场景颜色：${sceneLightingDifference}`);
  if (!sampleLightingDifference) throw new Error('示例补光没有实际照亮测试物体');
  samples.light.setEnabled(true); await render(4);
  const shadowBefore = await shadows.getShadowMap()!.readPixels();
  lease.apply({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true, rules: [{ selector: 'id', value: 'sample:half', strength: 0 }] },
    { pitchDeg: 45, yawDeg: 0, projection: 'orthographic' });
  await render(25);
  if (!samples.shader.material.shadowDepthWrapper?.getEffect(samples.sprite.subMeshes[0], shadows, shadows.getShadowMap()!.renderPassId)?.effect?.isReady()) {
    throw new Error('已编译精灵在启用变形后没有接入阴影');
  }
  const after = await readPixels();
  let changed = 0; for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 5) changed++;
  if (changed < 100) throw new Error(`变形没有改变画面：${changed}`);
  const shadowAfter = await shadows.getShadowMap()!.readPixels();
  let shadowChanged = 0;
  if (shadowBefore && shadowAfter) {
    const a = new Uint8Array(shadowBefore.buffer, shadowBefore.byteOffset, shadowBefore.byteLength);
    const b = new Uint8Array(shadowAfter.buffer, shadowAfter.byteOffset, shadowAfter.byteLength);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) shadowChanged++;
  }
  if (!shadowChanged) throw new Error('阴影没有随顶点变形更新');
  const unselected = Vector3.Project(samples.meshes[1].getAbsolutePosition(), Matrix.Identity(), camera.getTransformationMatrix(), camera.viewport.toGlobal(800, 600));
  let sharedDifference = 0;
  for (let y = 0; y < 600; y++) for (let x = Math.round(unselected.x) - 15; x < Math.round(unselected.x) + 15; x++) {
    const offset = (y * 800 + x) * 4; for (let c = 0; c < 4; c++) if (Math.abs(before[offset + c] - after[offset + c]) > 5) sharedDifference++;
  }
  if (sharedDifference > 10) throw new Error(`共享材质污染未选对象：${sharedDifference}`);
  const depth = scene.enableDepthRenderer(camera); const releaseDepth = attachDeformationDepthRenderer(scene, depth, camera);
  await render(15);
  const depthPixels = await depth.getDepthMap().readPixels();
  if (!depthPixels || !(depthPixels instanceof Float32Array)) throw new Error('未取得浮点深度图');
  let validDepth = 0; for (let i = 0; i < depthPixels.length; i += 4) if (depthPixels[i] > 0 && depthPixels[i] < 1) validDepth++;
  if (validDepth < 100) throw new Error(`深度图未生成：${validDepth}`);
  for (const system of particles) for (const mode of [0, 1, 2, 3]) {
    const effect = system.getCustomEffect(mode); if (!effect?.isReady()) throw new Error(`粒子 Shader 未就绪：${system.name}/${mode}: ${effect?.getCompilationError()}`);
  }
  const particleDraws = [0, 0];
  particles.forEach((system, index) => {
    system.onBeforeDrawParticlesObservable.add(() => { particleDraws[index]++; });
    system.emitRate = 50;
  });
  await render(30);
  if (particleDraws.some(count => !count)) throw new Error(`粒子没有实际执行绘制：${particleDraws}`);
  releaseDepth(); await render(3); // The scene bridge must discover and reattach the existing depth renderer.
  scene.disableDepthRenderer(camera); particles.forEach(p => p.dispose());
  lease.release(); await render(8);
  const restored = await readPixels();
  let difference = 0; for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - restored[i]) > 5) difference++;
  if (difference > 100) throw new Error(`关闭后画面未恢复：${difference}`);
  if (errors.length) throw new Error(errors.join('\n').slice(0, 8000));
  const result = { webgl: engine.webGLVersion, sceneLightingDifference, sampleLightingDifference, changed, restoredDifference: difference, sharedDifference, validDepth, shadowChanged, particleDraws, materialSharing: samples.meshes[0].material === samples.meshes[1].material, targets: registry.list().length };
  samples.dispose(); texture.dispose(); scene.dispose(); engine.dispose(); console.error = originalError;
  return result;
})();
