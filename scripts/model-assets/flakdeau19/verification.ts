import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Color4, PBRMaterial } from '@babylonjs/core';
import { createModelEntity, clearModelPrefabCache, getModelTextureCacheStats } from '../../../core/model';
import manifest from './manifest.json';
import declaration from '../../../config/sceneEnvironmentPresets/artist-flakdeau19-model-test.json';
import { parseSceneEnvironmentPreset } from '../../../core/scene/sceneEnvironment.parser';
import { createSceneEnvironmentAsync } from '../../../core/scene/createSceneEnvironment';
const engine = new Engine(document.querySelector('canvas')!, true, { preserveDrawingBuffer: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(.1, .14, .18, 1);
const camera = new ArcRotateCamera('camera', -.9, 1.05, 8, Vector3.Zero(), scene);
camera.minZ = .001;
camera.maxZ = 3000;
new HemisphericLight('light', new Vector3(.3, 1, .2), scene).intensity = 1.2;
async function verify() {
  const models = [];
  let animated = 0;
  for (const entry of manifest.models) {
    const model = await createModelEntity(scene, entry.modelPath, { applyAssetProfile: false });
    const meshes = model.meshes.filter(m => m.getTotalVertices());
    if (!meshes.length) throw Error(`No geometry: ${entry.file}`);
    let low = new Vector3(Infinity, Infinity, Infinity), high = low.negate();
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      low = Vector3.Minimize(low, box.minimumWorld);
      high = Vector3.Maximize(high, box.maximumWorld);
      const material = mesh.material as PBRMaterial;
      if (!material?.albedoTexture) throw Error(`Missing palette material: ${entry.file}`);
      if (!material.albedoTexture.noMipmap) throw Error(`Palette must disable mipmaps: ${entry.file}`);
      if (!mesh.isVerticesDataPresent('uv')) throw Error(`Missing UV: ${entry.file}`);
    }
    if (![...low.asArray(), ...high.asArray()].every(Number.isFinite) || high.subtract(low).length() <= 0) throw Error(`Invalid bounds: ${entry.file}`);
    camera.setTarget(low.add(high).scale(.5));
    camera.radius = high.subtract(low).length() * 1.4;
    await scene.whenReadyAsync();
    scene.render();
    if (!meshes.every(mesh => (mesh.material as PBRMaterial).albedoTexture!.isReady())) throw Error(`Texture not ready: ${entry.file}`);
    models.push({ modelPath: entry.modelPath, sha256: entry.sha256, bounds: [low.asArray(), high.asArray()], meshes: meshes.length,
      triangles: meshes.reduce((n, mesh) => n + mesh.getTotalIndices() / 3, 0), allTexturesReady: true });
    animated += model.animationGroups.length;
    model.dispose();
  }
  const cache = getModelTextureCacheStats(scene);
  clearModelPrefabCache(scene);
  return { count: models.length, animated, cache, allTexturesReady: true, models };
}
async function overview() {
  scene.lights.slice().forEach(light => light.dispose());
  const preset = parseSceneEnvironmentPreset(declaration, declaration.presetKey);
  const instance = await createSceneEnvironmentAsync(scene, preset, { shadowQualityPresets: {} });
  const issues = [];
  for (const { definition, entity } of instance.models) {
    let low = new Vector3(Infinity, Infinity, Infinity), high = low.negate();
    for (const mesh of entity.meshes.filter(m => m.getTotalVertices())) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      low = Vector3.Minimize(low, box.minimumWorld);
      high = Vector3.Maximize(high, box.maximumWorld);
    }
    const dimension = Math.max(...high.subtract(low).asArray());
    if (Math.abs(low.y) > .001 || Math.abs(dimension - 2.8) > .001) issues.push(definition.id);
  }
  await scene.whenReadyAsync();
  if (issues.length || scene.textures.some(t => !t.isReady())) throw Error(`Overview placement or texture failure: ${issues}`);
  camera.setTarget(new Vector3(0, 0, -2));
  camera.alpha = -Math.PI / 2;
  camera.beta = .66;
  camera.radius = 145;
  engine.runRenderLoop(() => scene.render());
  await new Promise(resolve => setTimeout(resolve, 300));
  return { count: instance.models.length, groups: declaration.transformNodes.length, boundsIssues: issues, allTexturesReady: true };
}
(window as any).result = new URLSearchParams(location.search).has('overview') ? overview() : verify();
