import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Color4, MultiMaterial, type AbstractMesh } from '@babylonjs/core';
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
  for (const mesh of meshes.filter(m => m.getTotalVertices())) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    low = Vector3.Minimize(low, box.minimumWorld);
    high = Vector3.Maximize(high, box.maximumWorld);
  }
  return [low, high];
}
function checkTextures(meshes: readonly AbstractMesh[], expected: number) {
  const textures = new Set();
  for (const mesh of meshes) {
    if (!mesh.material) throw Error(`Missing material: ${mesh.name}`);
    const materials = mesh.material instanceof MultiMaterial ? mesh.material.subMaterials.filter(m => m) : [mesh.material];
    for (const material of materials) for (const texture of material!.getActiveTextures()) {
      if (!texture.isReady()) throw Error(`Texture not ready: ${texture.name}`);
      textures.add(texture.name);
    }
  }
  if (textures.size !== expected) throw Error(`Texture count ${textures.size}, expected ${expected}`);
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
    await scene.whenReadyAsync();
    scene.render();
    checkTextures(meshes, entry.images.length);
    models.push({ modelPath: entry.modelPath, sha256: entry.sha256, bounds: [low.asArray(), high.asArray()], meshes: meshes.length,
      triangles: meshes.reduce((n, m) => n + m.getTotalIndices() / 3, 0), textures: entry.images.length, animations: model.animationGroups.length, allTexturesReady: true });
    model.dispose();
  }
  const cache = getModelTextureCacheStats(scene);
  clearModelPrefabCache(scene);
  return { count: models.length, cache, allTexturesReady: true, models };
}
async function overview() {
  // The overview spans tens of units; use enough depth precision for the mat/platform gap.
  camera.minZ = .05;
  const response = await fetch('/config/sceneEnvironmentPresets/artist-gataki-model-test.json');
  if (!response.ok) throw Error('Gataki showcase preset missing');
  const declaration = await response.json();
  scene.lights.slice().forEach(light => light.dispose());
  const preset = parseSceneEnvironmentPreset(declaration, declaration.presetKey);
  const instance = await createSceneEnvironmentAsync(scene, preset, { shadowQualityPresets: {} });
  const issues = [];
  for (const { definition, entity } of instance.models) {
    const meshes = entity.meshes.filter(m => m.getTotalVertices());
    const [low, high] = bounds(meshes);
    const entry = manifest.models.find(m => m.modelPath === definition.modelPath)!;
    const surfaceOffset = entry.partProvenance?.kind === 'baked-ground-texture-plane' ? .02 : 0;
    if (Math.abs(low.y - surfaceOffset) > .001 || Math.abs(Math.max(...high.subtract(low).asArray()) - 2.8) > .001) issues.push(definition.id);
    checkTextures(meshes, entry.images.length);
  }
  await scene.whenReadyAsync();
  if (issues.length || scene.textures.some(t => !t.isReady())) throw Error(`Overview placement or texture failure: ${issues}`);
  camera.setTarget(new Vector3(5, .5, -4));
  camera.alpha = -Math.PI / 2;
  camera.beta = .65;
  camera.radius = 86;
  engine.runRenderLoop(() => scene.render());
  (window as any).showDetail = async (category: string) => {
    const entries = instance.models.filter(m => manifest.models.find(e => e.modelPath === m.definition.modelPath)!.category === category);
    const [low, high] = bounds(entries.flatMap(m => m.entity.meshes));
    camera.setTarget(low.add(high).scale(.5));
    camera.alpha = -Math.PI / 2 - .35;
    camera.beta = category === 'Island' ? .65 : 1.05;
    camera.radius = high.subtract(low).length() * (category === 'Island' || category === 'Garbage-Truck-PSX' ? 1.3 : 1);
    await new Promise(resolve => setTimeout(resolve, 250));
  };
  (window as any).showIslandParts = async (prefix: string) => {
    const entries = instance.models.filter(m => m.definition.modelPath.includes(`/Island/Parts/${prefix}`));
    if (!entries.length) throw Error(`Island parts missing: ${prefix}`);
    const [low, high] = bounds(entries.flatMap(m => m.entity.meshes));
    camera.setTarget(low.add(high).scale(.5));
    camera.alpha = -Math.PI / 2;
    camera.beta = prefix === 'BeachMat' ? .12 : .8;
    camera.radius = high.subtract(low).length() * 1.2;
    await new Promise(resolve => setTimeout(resolve, 250));
  };
  await new Promise(resolve => setTimeout(resolve, 300));
  return { count: instance.models.length, groups: declaration.transformNodes.length, boundsIssues: issues, cache: getModelTextureCacheStats(scene), allTexturesReady: true };
}
(window as any).result = new URLSearchParams(location.search).has('overview') ? overview() : verify();
