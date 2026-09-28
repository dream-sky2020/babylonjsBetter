import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcRotateCamera, Matrix, NullEngine, Scene, TransformNode, Vector3, Viewport } from '@babylonjs/core';
import { createCameraLabController } from '../camera/cameraLabController.ts';
import { createEntityContainer } from '../entity/entity.utils.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { readDungeonOverheadView } from './dungeonOverheadView.document.ts';
import { DEFAULT_OVERHEAD_VIEW, resolveOverheadView, mapDungeonDisplayPosition, parseOverheadView, createDungeonViewConsumer, applyDungeonViewToNode, selectDungeonDisplayView } from './dungeonOverheadView.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
test('compensation produces square projected ground cells at multiple pitches/aspects and non-square tile sizes', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  const camera = new ArcRotateCamera('view', 0, 1, 30, Vector3.Zero(), scene);
  const c = createCameraLabController(camera);
  try {
    for (const pitchDeg of [15, 30, 45, 75, 89.99]) for (const yawDeg of [0, 180]) for (const [w, h] of [[800, 600], [400, 900]]) {
      engine.getRenderWidth = () => w; engine.getRenderHeight = () => h;
      const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, pitchDeg, yawDeg }, [3, 0, 7], [4, 1, 2]);
      Object.assign(c.state, { orbitPitchDeg: pitchDeg, orbitYaw: yawDeg * Math.PI / 180, lowerBetaLimit: .0001, upperBetaLimit: Math.PI - .0001 }); c.applyPose();
      c.setProjection('orthographic'); c.setOrthographicSize(20); engine.onResizeObservable.notifyObservers(engine);
      const matrix = camera.getViewMatrix().multiply(camera.getProjectionMatrix(true));
      const project = (p: [number, number, number]) => Vector3.Project(Vector3.FromArray(mapDungeonDisplayPosition(view, p)), Matrix.Identity(), matrix, new Viewport(0, 0, w, h));
      const origin = project([3, 0, 7]);
      near(Vector3.Distance(origin, project([7, 0, 7])), Vector3.Distance(origin, project([3, 0, 9])));
    }
  } finally { c.dispose(); scene.dispose(); engine.dispose(); }
});
test('original/manual mapping is anchored, reversible by clearing, immutable and rejects unsupported automatic angles', () => {
  const p: [number, number, number] = [12, 3, 24];
  const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, proportion: 'manual', scaleX: 2, scaleZ: 3 }, [10, 0, 20], [2, 1, 2]);
  assert.deepEqual(mapDungeonDisplayPosition(view, p), [14, 3, 32]); assert.deepEqual(p, [12, 3, 24]);
  assert.deepEqual(mapDungeonDisplayPosition(null, p), p);
  assert.deepEqual(mapDungeonDisplayPosition(resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, proportion: 'original' }, [10, 0, 20], [2, 1, 2]), p), p);
  assert.ok(Object.isFrozen(view.config));
  assert.throws(() => parseOverheadView({ ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 0 }));
  assert.throws(() => parseOverheadView({ ...DEFAULT_OVERHEAD_VIEW, yawDeg: 45 }));
  assert.throws(() => parseOverheadView({ ...DEFAULT_OVERHEAD_VIEW, projection: 'perspective' }));
  assert.throws(() => parseOverheadView({ ...DEFAULT_OVERHEAD_VIEW, restoreDisplayInFirstPerson: 'yes' }));
  assert.equal(parseOverheadView({ ...DEFAULT_OVERHEAD_VIEW, restoreDisplayInFirstPerson: undefined }).restoreDisplayInFirstPerson, false);
});
test('first-person display keeps configured grid scaling unless restoration is selected', () => {
  const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW }, [0, 0, 0], [2, 1, 2]);
  const restore = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, restoreDisplayInFirstPerson: true }, [0, 0, 0], [2, 1, 2]);
  assert.equal(selectDungeonDisplayView(view, restore), view);
  assert.equal(selectDungeonDisplayView(null, view), view);
  assert.equal(selectDungeonDisplayView(null, restore), null);
  assert.equal(selectDungeonDisplayView(null, null), null);
});
test('exclusive consumer leases restore identity and reject stale owners', () => {
  let current: unknown;
  const consumer = createDungeonViewConsumer(view => { current = view; });
  const lease = consumer.acquire('first'); const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW }, [0, 0, 0], [1, 1, 1]);
  lease.apply(view); assert.equal(current, view); assert.throws(() => consumer.acquire('second'));
  lease.release(); assert.equal(current, null); lease.release(); assert.throws(() => lease.apply(view));
  const next = consumer.acquire('second'); next.apply(view); consumer.dispose(); assert.equal(current, null);
  assert.throws(() => next.apply(view)); next.release(); consumer.dispose();
});
test('grid display root restores its original world coordinates when overhead view is cleared', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const root = new TransformNode('grid-root', scene);
    const tile = new TransformNode('grid-tile', scene); tile.position.set(12, 0, 24); tile.parent = root;
    const consumer = createDungeonViewConsumer(view => applyDungeonViewToNode(root, view));
    const lease = consumer.acquire('overhead');
    const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, proportion: 'manual', scaleX: 2, scaleZ: 3 }, [10, 0, 20], [2, 1, 2]);
    lease.apply(view);
    assert.deepEqual(root.position.asArray(), [-10, 0, -40]);
    assert.deepEqual(root.scaling.asArray(), [2, 1, 3]);
    assert.deepEqual(tile.computeWorldMatrix(true).getTranslation().asArray(), [14, 0, 32]);
    lease.apply(null);
    assert.deepEqual(root.position.asArray(), [0, 0, 0]);
    assert.deepEqual(root.scaling.asArray(), [1, 1, 1]);
    assert.deepEqual(tile.computeWorldMatrix(true).getTranslation().asArray(), [12, 0, 24]);
    lease.release(); consumer.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});
test('map entity resolves only enabled map-scoped configuration, absent means identity', () => {
  const make = (enabled = true) => ({ id: 'overhead', entityType: 'dungeon-overhead-view', enabled,
    components: [{ ...DEFAULT_OVERHEAD_VIEW, id: 'config', type: 'dungeon-overhead-view', version: 1 }] });
  const document = (entities: ReturnType<typeof make>[]) => migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'test',
    map: createDungeonMapData({ id: 'test', width: 2, height: 2, createMapData: () => createEntityContainer(...entities) }),
  }).document;
  assert.equal(readDungeonOverheadView(document([])), null);
  assert.equal(readDungeonOverheadView(document([make(false)])), null);
  assert.deepEqual(readDungeonOverheadView(document([make()])), DEFAULT_OVERHEAD_VIEW);
  const restore = make(); restore.components[0].restoreDisplayInFirstPerson = true;
  assert.equal(readDungeonOverheadView(document([restore]))?.restoreDisplayInFirstPerson, true);
  assert.throws(() => readDungeonOverheadView(document([make(), { ...make(), id: 'second', components: [{ ...make().components[0], id: 'second-config' }] }])));
});
