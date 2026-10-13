import { AssetContainer, ArcRotateCamera, Color3, DirectionalLight, Engine, HemisphericLight, InstancedMesh, MeshBuilder, PBRMaterial, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { createModelInstanceBatch } from '../core/model/prefab/modelInstanceBatch.ts';
import { getVisualDeformationRegistry } from '../core/render-deformation/visualDeformationRegistry.ts';
import { DEFAULT_DEFORMATION_SETTINGS } from '../core/render-deformation/deformation.ts';
import { ShadowGenerator } from '@babylonjs/core';
import { createModelEntity } from '../core/model/entity/createModelEntity.ts';
import { clearModelPrefabCache } from '../core/model/prefab/modelPrefabCache.ts';

const output = document.getElementById('result')!;
const errors: string[] = [];
const originalError = console.error;
console.error = (...args) => { errors.push(args.map(String).join(' ')); originalError(...args); };
async function verify() {
  const engine = new Engine(document.getElementById('test') as HTMLCanvasElement, false, { preserveDrawingBuffer: true });
  const renderCase = async (instances: boolean, pbr: boolean) => {
    const scene = new Scene(engine);
    const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 4, 22, new Vector3(0, 2, 0), scene);
    camera.mode = 1; camera.orthoLeft = -8; camera.orthoRight = 8; camera.orthoTop = 6; camera.orthoBottom = -6;
    const stage = new TransformNode('candidate-map', scene); stage.setEnabled(false);
    const ambient = new HemisphericLight('ambient', Vector3.Up(), scene); ambient.intensity = .4; ambient.parent = stage;
    const light = new DirectionalLight('sun', new Vector3(-.4, -1, -.3), scene); light.position.set(8, 15, 8);
    light.parent = stage;
    const shadows = new ShadowGenerator(512, light); shadows.usePercentageCloserFiltering = true;
    const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene); ground.receiveShadows = true; ground.material = new StandardMaterial('ground', scene);
    const original = new AssetContainer(scene), source = MeshBuilder.CreateBox('source', { width: 1.5, height: 4, depth: 1.5 }, scene);
    source.material = pbr ? new PBRMaterial('pbr', scene) : new StandardMaterial('standard', scene);
    if (source.material instanceof PBRMaterial) { source.material.albedoColor = new Color3(.8, .2, .1); source.material.metallic = 0; source.material.roughness = .8; }
    else if (source.material instanceof StandardMaterial) source.material.diffuseColor = new Color3(.8, .2, .1);
    original.meshes = [source]; original.rootNodes = [source]; original.removeAllFromScene();
    const batch = instances ? createModelInstanceBatch(scene, original, undefined, true) : null;
    const registry = getVisualDeformationRegistry(scene), lease = registry.acquire('verification');
    for (let i = 0; i < 3; i++) {
      const entries = (batch?.source ?? original).instantiateModelsToScene(name => `${i}:${name}`, false, { doNotInstantiate: !instances });
      const mesh = entries.rootNodes[0] as InstancedMesh;
      if (instances && !(mesh instanceof InstancedMesh)) throw new Error('hardware instance missing');
      mesh.position.set((i - 1) * 4, 2 + i, 0); mesh.receiveShadows = true; shadows.addShadowCaster(mesh);
      registry.register({ root: mesh, meshes: [mesh], kind: 'model', anchor: [0, -2, 0] });
    }
    lease.apply({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true }, { pitchDeg: 35, yawDeg: 0, projection: 'orthographic' });
    if (registry.list().some(entry => !entry.supported)) throw new Error('unsupported deformation');
    stage.setEnabled(true);
    for (let i = 0; i < 65; i++) { scene.render(); await new Promise(resolve => setTimeout(resolve, 8)); }
    const pixelBuffer = await engine.readPixels(0, 0, 800, 600);
    const pixels = new Uint8Array(pixelBuffer.buffer, pixelBuffer.byteOffset, pixelBuffer.byteLength).slice();
    const depth = scene.enableDepthRenderer(camera);
    for (let i = 0; i < 20; i++) { scene.render(); await new Promise(resolve => setTimeout(resolve, 8)); }
    const depthPixels = await depth.getDepthMap().readPixels();
    const drawsBefore = engine._drawCalls.current; scene.render();
    const drawCalls = engine._drawCalls.current - drawsBefore;
    const materials = scene.materials.length;
    lease.release(); scene.dispose(); batch?.dispose(); original.dispose();
    return { pixels, depthPixels, drawCalls, materials };
  };
  const results: unknown[] = [];
  for (const pbr of [false, true]) {
    const clones = await renderCase(false, pbr), instances = await renderCase(true, pbr);
    let changed = 0;
    clones.pixels.forEach((value, i) => { if (Math.abs(value - instances.pixels[i]) > 3) changed++; });
    let depthChanged = 0;
    if (!clones.depthPixels || !instances.depthPixels) throw new Error('depth output missing');
    const a = clones.depthPixels as Float32Array, b = instances.depthPixels as Float32Array;
    a.forEach((value, i) => { if (Math.abs(value - b[i]) > .00001) depthChanged++; });
    if (changed > 100 || depthChanged > 100) throw new Error(`instance ${pbr ? 'PBR' : 'Standard'} mismatch: color/shadow=${changed}, depth=${depthChanged}`);
    if (instances.drawCalls >= clones.drawCalls) throw new Error(`draw calls not reduced: ${instances.drawCalls}/${clones.drawCalls}`);
    results.push({ pbr, changed, depthChanged, cloneDrawCalls: clones.drawCalls, instanceDrawCalls: instances.drawCalls, sharedMaterials: instances.materials });
  }
  // Exercise the actual map asset and the editor's transition to a private material.
  const preset = await (await fetch('/config/sceneEnvironmentPresets/crossroads.json')).json();
  const definition = preset.models.find((model: { modelPath: string }) => /\/trees\//i.test(model.modelPath)
    && preset.models.filter((other: { modelPath: string }) => other.modelPath === model.modelPath).length > 1);
  if (!definition) throw new Error('crossroads repeat fixture missing');
  const scene = new Scene(engine);
  new ArcRotateCamera('asset-camera', 0, .6, 20, Vector3.Zero(), scene);
  const assetStage = new TransformNode('asset-candidate', scene); assetStage.setEnabled(false);
  const ambient = new HemisphericLight('asset-light', Vector3.Up(), scene); ambient.parent = assetStage;
  const sun = new DirectionalLight('asset-sun', new Vector3(0, -1, 1), scene), shadows = new ShadowGenerator(256, sun);
  sun.parent = assetStage;
  const options = { hardwareInstances: true, instanceShadows: { receive: true, cast: true } };
  const first = await createModelEntity(scene, definition.modelPath, options), second = await createModelEntity(scene, definition.modelPath, options);
  assetStage.setEnabled(true);
  const drawable = first.meshes.find(mesh => mesh.getTotalVertices() > 0)!;
  const sibling = second.meshes.find(mesh => mesh.getTotalVertices() > 0)!;
  if (!drawable.lightSources.includes(ambient) || !drawable.lightSources.includes(sun)) throw new Error('staged tree did not receive activated lights');
  if (!(drawable instanceof InstancedMesh) || !(sibling instanceof InstancedMesh) || drawable.material !== sibling.material) throw new Error('real GLB is not sharing hardware source/material');
  shadows.addShadowCaster(drawable);
  const lease = getVisualDeformationRegistry(scene).acquire('asset');
  lease.apply({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true }, { pitchDeg: 45, yawDeg: 0, projection: 'orthographic' });
  const slot = first.materialSlots()[0]; if (!slot) throw new Error('shared material lost glTF selector');
  const sharedMaterial = sibling.material;
  await first.updateMaterialBindings([{ selector: { gltfMaterialIndex: slot.gltfMaterialIndex }, alphaCutoff: .4 }]);
  const privateMesh = first.meshes.find(mesh => mesh.getTotalVertices() > 0)!;
  if (privateMesh instanceof InstancedMesh || privateMesh.material === sibling.material || sibling.material !== sharedMaterial) throw new Error('material editing changed shared sibling');
  if (!shadows.getShadowMap()!.renderList!.includes(privateMesh) || shadows.getShadowMap()!.renderList!.includes(drawable)) throw new Error('material editing lost shadow caster');
  if (getVisualDeformationRegistry(scene).list().some(entry => !entry.supported)) throw new Error('material editing lost deformation');
  for (let i = 0; i < 20; i++) { scene.render(); await new Promise(resolve => setTimeout(resolve, 8)); }
  results.push({ asset: definition.modelPath, stagedLightsRestored: true, sharedHardwareInstances: true, privateMaterialEdit: true, shadowCasterPreserved: true });
  lease.release(); first.dispose(); second.dispose(); clearModelPrefabCache(scene); scene.dispose();
  engine.dispose(); if (errors.length) throw new Error(errors.join('\n'));
  return results;
}
verify().then(results => { output.textContent = JSON.stringify({ ok: true, results }); }).catch(error => { output.textContent = JSON.stringify({ ok: false, error: String(error), errors }); });
