import assert from 'node:assert/strict';
import test from 'node:test';
import { AssetContainer, HemisphericLight, InstancedMesh, MeshBuilder, NullEngine, Ray, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { createModelInstanceBatch } from '../model/prefab/modelInstanceBatch.ts';
import { DEFAULT_DEFORMATION_SETTINGS, DEFAULT_VISUAL_DEFORMATION, deformPosition, resolveDeformation, resolveTargetStrength, parseDeformationSettings, selectDeformationView } from './deformation.ts';
import { getVisualDeformationRegistry } from './visualDeformationRegistry.ts';
import { meshDeformationMatrices } from './deformationMaterial.ts';
import { createEntityContainer } from '../entity/entity.utils.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { encodeDungeonMapDocumentLibraryV3, parseDungeonMapDocumentV3 } from '../map-document/dungeonMapDocument.storageV3.ts';
import { readDeformationSettings } from './deformation.document.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const view = { pitchDeg: 45, yawDeg: 0, projection: 'orthographic' as const };
test('map component uses existing V3 persistence and absent or disabled entities preserve old scenes', () => {
  const settings = { ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true, restoreOutsideOverhead: true };
  const entity = { id: 'overhead', entityType: 'dungeon-overhead-view', enabled: true,
    components: [{ ...settings, id: 'deformation', type: 'visual-deformation', version: 1 }] };
  const make = (entities: typeof entity[]) => migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test',
    map: createDungeonMapData({ id: 'test', width: 2, height: 2, createMapData: () => createEntityContainer(...entities) }),
  }).document;
  assert.equal(readDeformationSettings(make([])), null);
  assert.equal(readDeformationSettings(make([{ ...entity, enabled: false }])), null);
  const saved = encodeDungeonMapDocumentLibraryV3({ test: make([entity]) }).test;
  assert.deepEqual(readDeformationSettings(parseDungeonMapDocumentV3(saved, 'test')), settings);
  assert.throws(() => readDeformationSettings(make([entity, { ...entity, id: 'second', components: [{ ...entity.components[0], id: 'second-config' }] }])));
});
test('height shear preserves the anchor and reference projected height, with identity and partial strength', () => {
  for (const pitchDeg of [15, 30, 45, 60, 89.99]) {
    const c = resolveDeformation({ ...DEFAULT_VISUAL_DEFORMATION }, { ...view, pitchDeg });
    const p = deformPosition([2, 5, 3], [2, 1, 3], c);
    near((p[1] - 1) * Math.cos(pitchDeg * Math.PI / 180) - (p[2] - 3) * Math.sin(pitchDeg * Math.PI / 180), 4);
    assert.deepEqual(deformPosition([2, 1, 3], [2, 1, 3], c), [2, 1, 3]);
    const half = resolveDeformation({ ...DEFAULT_VISUAL_DEFORMATION, strength: .5 }, { ...view, pitchDeg }); near(half.z, c.z / 2);
  }
  assert.deepEqual(resolveDeformation({ ...DEFAULT_VISUAL_DEFORMATION }, null), { x: 0, y: 1, z: 0 });
  assert.deepEqual(resolveDeformation({ ...DEFAULT_VISUAL_DEFORMATION }, { ...view, projection: 'perspective' }), { x: 0, y: 1, z: 0 });
  const yaw = resolveDeformation({ ...DEFAULT_VISUAL_DEFORMATION }, { ...view, yawDeg: 90 }); near(yaw.z, 0); assert.ok(yaw.x < 0);
});
test('selection precedence is deterministic and settings reject invalid values', () => {
  const settings = { ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true, rules: [
    { selector: 'id' as const, value: 'a', strength: .2 }, { selector: 'group' as const, value: 'trees', strength: .8 },
  ] };
  const target = { id: 'a', label: 'A', groupId: 'trees', tags: [], kind: 'model' as const, persistent: true, supported: true };
  near(resolveTargetStrength(target, settings), .2);
  assert.throws(() => parseDeformationSettings({ ...settings, config: { ...settings.config, strength: Infinity } }));
  assert.throws(() => parseDeformationSettings({ ...settings, rules: [{ selector: 'name', value: 'a', strength: 1 }] }));
  assert.throws(() => parseDeformationSettings({ ...settings, restoreOutsideOverhead: 'yes' }));
});
test('deformation can stay active outside overhead and legacy settings default to retaining it', () => {
  const settings = { ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true };
  const configured = { ...view, pitchDeg: 30 };
  assert.equal(selectDeformationView(settings, view, configured), view);
  assert.equal(selectDeformationView(settings, null, configured), configured);
  assert.equal(selectDeformationView({ ...settings, restoreOutsideOverhead: true }, null, configured), null);
  assert.equal(selectDeformationView(settings, null, null), null);
  assert.equal(parseDeformationSettings({ ...settings, restoreOutsideOverhead: undefined }).restoreOutsideOverhead, false);
});
test('shared materials remain independent, GPU matrices match picking/bounds, leases restore and late targets inherit', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const material = new StandardMaterial('shared', scene);
    const a = MeshBuilder.CreateBox('a', { height: 4 }, scene); a.position.y = 2; a.material = material;
    const b = MeshBuilder.CreateBox('b', { height: 4 }, scene); b.position.set(4, 2, 0); b.material = material;
    a.computeWorldMatrix(true); b.computeWorldMatrix(true);
    const originalBounds = a.getBoundingInfo(); const originalPick = a.intersects; const positions = a.getVerticesData('position')!.slice();
    const registry = getVisualDeformationRegistry(scene);
    const removeA = registry.register({ id: 'a', kind: 'model', root: a, meshes: [a], anchor: [0, -2, 0] });
    const lease = registry.acquire('test'); assert.throws(() => registry.acquire('other'));
    lease.apply({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true, selection: 'rules', config: { ...DEFAULT_VISUAL_DEFORMATION, mode: 'manual', shear: 1 },
      rules: [{ selector: 'id', value: 'a', strength: 1 }] }, view);
    registry.register({ id: 'b', kind: 'model', root: b, meshes: [b], anchor: [0, -2, 0] });
    assert.ok(meshDeformationMatrices.has(a)); assert.equal(meshDeformationMatrices.has(b), false); assert.equal(a.material, b.material);
    near(Vector3.TransformCoordinates(new Vector3(0, 1, 0), meshDeformationMatrices.get(a)!.local).z, 3);
    assert.ok(a.getBoundingInfo().boundingBox.maximum.z >= 4.5);
    const hit = scene.pickWithRay(new Ray(new Vector3(0, 3, 8), new Vector3(0, 0, -1)), m => m === a);
    assert.ok(hit?.hit); near(hit.pickedPoint!.z, 3.5);
    assert.deepEqual(a.getVerticesData('position'), positions); near(a.position.y, 2);
    lease.release(); assert.equal(a.getBoundingInfo(), originalBounds); assert.equal(a.intersects, originalPick); assert.equal(meshDeformationMatrices.has(a), false);
    assert.throws(() => lease.apply(DEFAULT_DEFORMATION_SETTINGS, view)); removeA(); a.dispose();
    registry.dispose(); assert.equal(scene.onBeforeActiveMeshesEvaluationObservable.hasObservers(), false);
  } finally { scene.dispose(); engine.dispose(); }
});

test('static targets retain bounds/matrices until parent pose or deformation settings change', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const root = MeshBuilder.CreateBox('root', {}, scene), mesh = MeshBuilder.CreateBox('child', {}, scene);
    mesh.parent = root; mesh.material = new StandardMaterial('static', scene);
    const registry = getVisualDeformationRegistry(scene); registry.register({ root, meshes: [mesh], kind: 'model' });
    const lease = registry.acquire('test'); const settings = { ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true };
    lease.apply(settings, view); const bounds = mesh.getBoundingInfo(), matrix = meshDeformationMatrices.get(mesh)!.local;
    for (let i = 0; i < 20; i++) registry.update();
    assert.equal(mesh.getBoundingInfo(), bounds); assert.equal(meshDeformationMatrices.get(mesh)!.local, matrix);
    root.position.y = 3; registry.update(); assert.notEqual(mesh.getBoundingInfo(), bounds);
    const moved = mesh.getBoundingInfo(); lease.apply(settings, { ...view, pitchDeg: 30 }); assert.notEqual(mesh.getBoundingInfo(), moved);
    lease.release();
  } finally { scene.dispose(); engine.dispose(); }
});

test('static sibling assemblies keep cached deformation across render IDs and same-frame parent edits', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const parent = MeshBuilder.CreateBox('map-parent', {}, scene);
    const registry = getVisualDeformationRegistry(scene);
    const roots = Array.from({ length: 8 }, (_, index) => {
      const root = MeshBuilder.CreateBox(`model:${index}`, {}, scene); root.parent = parent; root.position.x = index * 3;
      const normalizer = MeshBuilder.CreateBox(`normalizer:${index}`, {}, scene); normalizer.parent = root;
      const children = Array.from({ length: 2 }, (_, child) => {
        const mesh = MeshBuilder.CreateBox(`mesh:${index}:${child}`, { height: 4 }, scene); mesh.parent = normalizer;
        mesh.position.set(child, 2, 0); mesh.material = new StandardMaterial(mesh.name, scene); return mesh;
      });
      registry.register({ root, meshes: children, kind: 'model' }); return { root, children };
    });
    const lease = registry.acquire('test'); lease.apply({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true }, view);
    const meshes = roots.flatMap(root => root.children);
    const snapshot = () => meshes.map(mesh => ({ bounds: mesh.getBoundingInfo(), local: meshDeformationMatrices.get(mesh)!.local }));
    const stable = snapshot();
    for (let frame = 0; frame < 50; frame++) {
      scene.incrementRenderId();
      // Rendering tools may force recomputation without changing the pose.
      parent.computeWorldMatrix(true); meshes.forEach(mesh => mesh.computeWorldMatrix(true));
      registry.update();
      meshes.forEach(mesh => mesh.computeWorldMatrix());
      meshes.forEach((mesh, i) => { assert.equal(mesh.getBoundingInfo(), stable[i].bounds); assert.equal(meshDeformationMatrices.get(mesh)!.local, stable[i].local); });
    }
    // Edits after evaluation in the SAME render ID must still invalidate descendants.
    parent.position.set(10, 1, 0); registry.update();
    near(meshes[0].getAbsolutePosition().x, 10); near(meshes[0].getAbsolutePosition().y, 3);
    meshes.forEach((mesh, i) => assert.notEqual(mesh.getBoundingInfo(), stable[i].bounds));
    const moved = snapshot(); registry.update();
    meshes.forEach((mesh, i) => assert.equal(mesh.getBoundingInfo(), moved[i].bounds));
    roots[3].root.scaling.y = 2; roots[3].root.rotation.y = .3; registry.update();
    meshes.forEach((mesh, i) => {
      if (i === 6 || i === 7) assert.notEqual(mesh.getBoundingInfo(), moved[i].bounds);
      else assert.equal(mesh.getBoundingInfo(), moved[i].bounds);
    });
    const edited = snapshot(); registry.update();
    meshes.forEach((mesh, i) => assert.equal(mesh.getBoundingInfo(), edited[i].bounds));
    lease.release();
  } finally { scene.dispose(); engine.dispose(); }
});

test('batch instances share material but preserve independent deformation, picking and restored instance buffers', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const original = new AssetContainer(scene), source = MeshBuilder.CreateBox('source', { height: 4 }, scene);
    source.material = new StandardMaterial('shared', scene); original.meshes = [source]; original.rootNodes = [source]; original.removeAllFromScene();
    const batch = createModelInstanceBatch(scene, original, undefined, true);
    const aEntries = batch.source.instantiateModelsToScene(name => `a:${name}`, false, { doNotInstantiate: false });
    const bEntries = batch.source.instantiateModelsToScene(name => `b:${name}`, false, { doNotInstantiate: false });
    const a = aEntries.rootNodes[0] as InstancedMesh, b = bEntries.rootNodes[0] as InstancedMesh;
    assert.ok(a instanceof InstancedMesh && b instanceof InstancedMesh); assert.equal(a.material, b.material);
    a.position.set(-3, 2, 0); b.position.set(3, 4, 0);
    const registry = getVisualDeformationRegistry(scene); registry.register({ id: 'a', root: a, meshes: [a], kind: 'model', anchor: [0, -2, 0] });
    registry.register({ id: 'b', root: b, meshes: [b], kind: 'model', anchor: [0, -2, 0] });
    const lease = registry.acquire('test'); lease.apply({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true }, view);
    assert.ok(registry.list().every(entry => entry.supported));
    assert.notEqual(a.instancedBuffers.vdDeform3, b.instancedBuffers.vdDeform3);
    assert.notEqual(a.instancedBuffers.vdDeform3.z, b.instancedBuffers.vdDeform3.z);
    const hit = scene.pickWithRay(new Ray(new Vector3(-3, 2, 10), new Vector3(0, 0, -1)), mesh => mesh === a);
    assert.ok(hit?.hit); assert.equal(hit.pickedMesh, a);
    lease.release(); assert.equal(a.instancedBuffers.vdDeform3.z, 0); assert.equal(b.instancedBuffers.vdDeform3.z, 0);
    aEntries.dispose(); bEntries.dispose(); batch.dispose(); original.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});

test('hidden batch masters follow staged lights, map replacement and later light disposal', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const stage = new TransformNode('staged-map', scene); stage.setEnabled(false);
    const light = new HemisphericLight('staged-light', Vector3.Up(), scene); light.parent = stage;
    const original = new AssetContainer(scene), source = MeshBuilder.CreateBox('source', {}, scene);
    source.material = new StandardMaterial('shared', scene); original.meshes = [source]; original.rootNodes = [source]; original.removeAllFromScene();
    const batch = createModelInstanceBatch(scene, original, undefined, true);
    const entries = batch.source.instantiateModelsToScene(name => `instance:${name}`, false, { doNotInstantiate: false });
    const instance = entries.rootNodes[0] as InstancedMesh;
    assert.deepEqual(instance.lightSources, []);
    stage.setEnabled(true); assert.equal(instance.lightSources.length, 1); assert.equal(instance.lightSources[0], light);
    stage.setEnabled(false); assert.deepEqual(instance.lightSources, []);
    const nextLight = new HemisphericLight('next-map-light', Vector3.Up(), scene);
    assert.equal(instance.lightSources.length, 1); assert.equal(instance.lightSources[0], nextLight);
    nextLight.dispose(); assert.deepEqual(instance.lightSources, []);
    entries.dispose(); batch.dispose(); original.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});
