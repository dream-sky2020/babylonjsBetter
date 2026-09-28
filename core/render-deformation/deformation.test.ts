import assert from 'node:assert/strict';
import test from 'node:test';
import { MeshBuilder, NullEngine, Ray, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
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
