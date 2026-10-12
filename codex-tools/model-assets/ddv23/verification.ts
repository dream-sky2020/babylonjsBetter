import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Color4, PBRMaterial, type AbstractMesh } from '@babylonjs/core';
import { createModelEntity, clearModelPrefabCache, getModelTextureCacheStats } from '../../../core/model';
import manifest from './manifest.json';
import { parseSceneEnvironmentPreset } from '../../../core/scene/sceneEnvironment.parser';
import { createSceneEnvironmentAsync } from '../../../core/scene/createSceneEnvironment';

const engine = new Engine(document.querySelector('canvas')!, true, { preserveDrawingBuffer: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(.1, .14, .18, 1);
const camera = new ArcRotateCamera('camera', -.9, 1.05, 8, Vector3.Zero(), scene);
camera.minZ = .001;
camera.maxZ = 3000;
new HemisphericLight('light', new Vector3(.3, 1, .2), scene).intensity = 1.2;
function bounds(meshes: readonly AbstractMesh[]) {
  let low = new Vector3(Infinity, Infinity, Infinity), high = low.negate();
  for (const mesh of meshes.filter(m => m && m.getTotalVertices())) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    low = Vector3.Minimize(low, box.minimumWorld);
    high = Vector3.Maximize(high, box.maximumWorld);
  }
  return [low, high];
}
async function verify() {
  const models = [];
  for (const entry of manifest.models) {
    const model = await createModelEntity(scene, entry.modelPath, { applyAssetProfile: false });
    const meshes = model.meshes.filter(m => m.getTotalVertices());
    if (!meshes.length || meshes.some(m => !m.isVerticesDataPresent('uv') || !m.isVerticesDataPresent('normal'))) throw Error(`Missing geometry, UV or normals: ${entry.file}`);
    const [low, high] = bounds(meshes);
    if (![...low.asArray(), ...high.asArray()].every(Number.isFinite) || high.subtract(low).length() <= 0) throw Error(`Invalid bounds: ${entry.file}`);
    camera.setTarget(low.add(high).scale(.5));
    camera.radius = high.subtract(low).length() * 1.4;
    for (const variant of entry.variants) {
      await model.updateMaterialBindings([{ selector: { gltfMaterialIndex: 0 }, textures: { baseColor: { path: variant.texturePath } } }]);
      await scene.whenReadyAsync();
      scene.render();
      if (!meshes.every(m => (m.material as PBRMaterial)?.albedoTexture?.isReady())) throw Error(`Texture not ready: ${entry.file} / ${variant.name}`);
    }
    models.push({ modelPath: entry.modelPath, sha256: entry.sha256, bounds: [low.asArray(), high.asArray()], meshes: meshes.length,
      triangles: meshes.reduce((n, m) => n + m.getTotalIndices() / 3, 0), variants: entry.variants.length, allTexturesReady: true });
    model.dispose();
  }
  const cache = getModelTextureCacheStats(scene);
  clearModelPrefabCache(scene);
  return { count: models.length, variants: models.reduce((n, m) => n + m.variants, 0), cache, allTexturesReady: true, models };
}
async function overview() {
  const response = await fetch('/config/sceneEnvironmentPresets/artist-ddv23-model-test.json');
  if (!response.ok) throw Error('DDV23 showcase preset missing');
  const declaration = await response.json();
  scene.lights.slice().forEach(light => light.dispose());
  const preset = parseSceneEnvironmentPreset(declaration, declaration.presetKey);
  const instance = await createSceneEnvironmentAsync(scene, preset, { shadowQualityPresets: {} });
  const issues = [], textures = new Set(), materials = new Set();
  for (const { definition, entity } of instance.models) {
    const meshes = entity.meshes.filter(m => m.getTotalVertices());
    const [low, high] = bounds(meshes);
    if (Math.abs(low.y) > .001 || Math.abs(Math.max(...high.subtract(low).asArray()) - 2.8) > .001) issues.push(definition.id);
    for (const mesh of meshes) {
      const material = mesh.material as PBRMaterial;
      const expected = definition.materialOverrides?.[0]?.textures?.baseColor?.path;
      if (!expected || !material.albedoTexture?.name.endsWith(expected)) issues.push(`${definition.id}:texture`);
      if (materials.has(material)) issues.push(`${definition.id}:material-isolation`);
      materials.add(material);
      textures.add(expected);
    }
  }
  await scene.whenReadyAsync();
  if (issues.length || scene.textures.some(t => !t.isReady()) || textures.size !== 11) throw Error(`Overview placement, texture or isolation failure: ${issues}`);
  camera.setTarget(new Vector3(0, .5, 0));
  camera.alpha = -Math.PI / 2;
  camera.beta = .75;
  camera.radius = 29;
  engine.runRenderLoop(() => scene.render());
  await new Promise(resolve => setTimeout(resolve, 300));
  return { count: instance.models.length, groups: declaration.transformNodes.length, uniqueVariantTextures: textures.size, independentMaterials: materials.size,
    boundsIssues: issues, cache: getModelTextureCacheStats(scene), allTexturesReady: true };
}
(window as any).result = new URLSearchParams(location.search).has('overview') ? overview() : verify();
