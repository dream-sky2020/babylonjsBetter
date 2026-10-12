import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Color4, MultiMaterial, PBRMaterial, type AbstractMesh } from '@babylonjs/core';
import { createModelEntity, clearModelPrefabCache, getModelTextureCacheStats } from '../../../core/model';
import manifest from './manifest.json';
import { parseSceneEnvironmentPreset } from '../../../core/scene/sceneEnvironment.parser';
import { createSceneEnvironmentAsync } from '../../../core/scene/createSceneEnvironment';

const engine = new Engine(document.querySelector('canvas')!, true, { preserveDrawingBuffer: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(.1, .14, .18, 1);
const camera = new ArcRotateCamera('camera', -.9, 1.05, 8, Vector3.Zero(), scene);
camera.minZ = .001; camera.maxZ = 3000;
new HemisphericLight('light', new Vector3(.3, 1, .2), scene).intensity = 1.2;
function bounds(meshes: readonly AbstractMesh[]) {
  let low = new Vector3(Infinity, Infinity, Infinity), high = low.negate();
  for (const mesh of meshes.filter(m => m.getTotalVertices())) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    low = Vector3.Minimize(low, box.minimumWorld); high = Vector3.Maximize(high, box.maximumWorld);
  }
  return [low, high];
}
function materials(meshes: readonly AbstractMesh[]) {
  return [...new Set(meshes.flatMap(m => m.material instanceof MultiMaterial ? m.material.subMaterials.filter(Boolean) : [m.material]))] as PBRMaterial[];
}
function checkTextures(meshes: readonly AbstractMesh[]) {
  for (const material of materials(meshes)) {
    if (!material || !material.albedoTexture?.isReady()) throw Error('Base color or material missing');
    if (material.getActiveTextures().some(t => !t.isReady())) throw Error('Material texture not ready');
  }
}
const binding = (indices: number[], texturePath: string) => indices.map(gltfMaterialIndex => ({ selector: { gltfMaterialIndex }, textures: { baseColor: { path: texturePath } } }));
async function verify() {
  const models = [];
  for (const entry of manifest.models) {
    const model = await createModelEntity(scene, entry.modelPath, { applyAssetProfile: false });
    const meshes = model.meshes.filter(m => m.getTotalVertices());
    if (!meshes.length || meshes.some(m => !m.isVerticesDataPresent('uv') || !m.isVerticesDataPresent('normal'))) throw Error(`Missing geometry/UV/normal: ${entry.file}`);
    const [low, high] = bounds(meshes);
    if (![...low.asArray(), ...high.asArray()].every(Number.isFinite) || high.subtract(low).length() <= 0) throw Error(`Bounds invalid: ${entry.file}`);
    if (model.animationGroups.length !== entry.animations) throw Error(`Animations missing: ${entry.name}`);
    camera.setTarget(low.add(high).scale(.5)); camera.radius = high.subtract(low).length() * 1.4;
    const originalEmission = [...new Set(materials(meshes).map(m => m.emissiveTexture?.name).filter(Boolean))].sort().join('|');
    for (const variant of entry.variants) {
      await model.updateMaterialBindings(binding(entry.materialIndices, variant.texturePath));
      await scene.whenReadyAsync(); scene.render(); checkTextures(meshes);
      if (materials(meshes).some(m => !m.albedoTexture?.name.endsWith(variant.texturePath))) throw Error(`Variant binding failed: ${entry.name} / ${variant.name}`);
      const currentEmission = [...new Set(materials(meshes).map(m => m.emissiveTexture?.name).filter(Boolean))].sort().join('|');
      if (currentEmission !== originalEmission) throw Error('Emission changed during variant swap');
    }
    if (entry.name === 'RetroCar') {
      const all = materials(meshes);
      if (!all.some(m => m.emissiveTexture?.isReady()) || !all.some(m => Math.abs(m.alpha - .2) < .001)) throw Error('Car emission or glass lost');
    }
    const animations = [];
    for (const group of model.animationGroups) {
      group.start(false); group.goToFrame((group.from + group.to) / 2);
      scene.render();
      const animatedBounds = bounds(meshes).flatMap(v => v.asArray());
      if (!animatedBounds.every(Number.isFinite)) throw Error('Animated geometry invalid');
      animations.push({ name: group.name, from: group.from, to: group.to, targets: group.targetedAnimations.length });
      group.stop(); group.reset();
    }
    models.push({ modelPath: entry.modelPath, sha256: entry.sha256, bounds: [low.asArray(), high.asArray()], meshes: meshes.length,
      triangles: meshes.reduce((n,m) => n + m.getTotalIndices()/3,0), variants: entry.variants.length, animations, allTexturesReady: true });
    model.dispose();
  }
  const cache = getModelTextureCacheStats(scene); clearModelPrefabCache(scene);
  return { count: models.length, variants: manifest.variantCount, cache, allTexturesReady: true, models };
}
async function overview() {
  camera.minZ = .05;
  const response = await fetch('/config/sceneEnvironmentPresets/artist-bricchi-games-model-test.json');
  if (!response.ok) throw Error('Preset missing');
  const declaration = await response.json();
  scene.lights.slice().forEach(l => l.dispose());
  const instance = await createSceneEnvironmentAsync(scene, parseSceneEnvironmentPreset(declaration, declaration.presetKey), { shadowQualityPresets: {} });
  const issues: string[] = [], used = new Set<PBRMaterial>();
  for (const { definition, entity } of instance.models) {
    const meshes = entity.meshes.filter(m => m.getTotalVertices());
    const [low, high] = bounds(meshes);
    if (Math.abs(low.y) > .001 || Math.abs(Math.max(...high.subtract(low).asArray()) - 2.8) > .001) issues.push(definition.id);
    checkTextures(meshes);
    const expected = definition.materialOverrides?.[0]?.textures?.baseColor?.path;
    for (const material of materials(meshes)) {
      if (!expected || !material.albedoTexture?.name.endsWith(expected) || used.has(material)) issues.push(`${definition.id}:texture-or-isolation`);
      used.add(material);
    }
  }
  await scene.whenReadyAsync();
  if (issues.length) throw Error(`Layout/material failure: ${issues}`);
  camera.setTarget(new Vector3(0,.6,1)); camera.alpha = -Math.PI/2; camera.beta = .7; camera.radius = 46;
  engine.runRenderLoop(() => scene.render());
  (window as any).showDetail = async (category: string) => {
    const entries = instance.models.filter(m => manifest.models.find(e => e.modelPath === m.definition.modelPath)!.category === category);
    const [low,high] = bounds(entries.flatMap(m=>m.entity.meshes));
    camera.setTarget(low.add(high).scale(.5)); camera.alpha = -Math.PI/2-.35; camera.beta = 1.05; camera.radius = high.subtract(low).length()*1.6;
    await new Promise(resolve => setTimeout(resolve,250));
  };
  await new Promise(resolve => setTimeout(resolve,300));
  return { count: instance.models.length, groups: declaration.transformNodes.length, boundsIssues: issues, independentMaterials: used.size, cache: getModelTextureCacheStats(scene), allTexturesReady: true };
}
(window as any).result = new URLSearchParams(location.search).has('overview') ? overview() : verify();
