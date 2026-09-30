import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcRotateCamera, Matrix, MeshBuilder, Node, NullEngine, PointLight, Scene, TransformNode, Vector3, Viewport } from '@babylonjs/core';
import type { SceneEnvironmentPreset } from '../scene/sceneEnvironment.types.ts';
import { createCameraLabController } from '../camera/cameraLabController.ts';
import { createEntityContainer } from '../entity/entity.utils.ts';
import type { ISceneEnvironmentComponent } from '../entity/components/scene-environment.component.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { resolveDungeonMapTileWorldLayout } from '../scene/dungeonMapSceneLayout.ts';
import { readDungeonOverheadView } from './dungeonOverheadView.document.ts';
import { DEFAULT_OVERHEAD_VIEW, resolveOverheadView, mapDungeonDisplayPosition, parseOverheadView, createDungeonViewConsumer, applyDungeonViewToNode, selectDungeonDisplayView } from './dungeonOverheadView.ts';
import { applySceneEnvironmentDisplayView, createSceneEnvironmentViewController } from './sceneEnvironmentDisplay.ts';

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
test('environment model anchors follow actual grid centers and spacing under both map anchors and display ratios', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    for (const mapAnchorMode of ['first-tile', 'map-center'] as const) {
      const component: ISceneEnvironmentComponent = {
        id: 'environment', type: 'scene-environment', version: 3, enabled: true, presetKey: 'test',
        mapAnchorMode, mapOffset: [10, 2, -7], tileSpacing: [6, 5], tileSize: [4, 1, 2],
      };
      const center = resolveDungeonMapTileWorldLayout(component, 5, 4, 3, 2).center;
      const nextCenter = resolveDungeonMapTileWorldLayout(component, 5, 4, 3, 3).center;
      for (const config of [
        { ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 30 },
        { ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 75 },
        { ...DEFAULT_OVERHEAD_VIEW, proportion: 'manual' as const, scaleX: 1.5, scaleZ: 2.5 },
      ]) {
        const gridRoot = new TransformNode('grid-root', scene);
        const tile = new TransformNode('tile', scene); tile.position.set(...center); tile.parent = gridRoot;
        const nextTile = new TransformNode('next-tile', scene); nextTile.position.set(...nextCenter); nextTile.parent = gridRoot;
        const environmentRoot = new TransformNode('environment-root', scene);
        const model = new TransformNode('model', scene); model.parent = environmentRoot;
        const preset: SceneEnvironmentPreset = { presetKey: 'test', name: 'Test', clearColor: '#000000', objects: [], lights: [],
          models: [{ id: 'model', name: 'Model', modelPath: 'resources/model.glb', position: center }] };
        const instance = { presetKey: 'test', root: environmentRoot, models: [],
          nodes: new Map<string, Node>([['model:model', model]]), dispose: () => environmentRoot.dispose() };
        const view = resolveOverheadView(config, component.mapOffset, component.tileSize);
        applyDungeonViewToNode(gridRoot, view);
        applySceneEnvironmentDisplayView(instance, preset, view);
        const displayedTile = tile.computeWorldMatrix(true).getTranslation();
        const displayedModel = model.computeWorldMatrix(true).getTranslation();
        for (const axis of ['x', 'y', 'z'] as const) near(displayedModel[axis], displayedTile[axis]);
        near(nextTile.computeWorldMatrix(true).getTranslation().z - displayedTile.z, component.tileSpacing[1] * view.scaleZ);
        applyDungeonViewToNode(gridRoot, null);
        applySceneEnvironmentDisplayView(instance, preset, null);
        near(model.computeWorldMatrix(true).getTranslation().z, center[2]);
        gridRoot.dispose(); environmentRoot.dispose();
      }
    }
  } finally { scene.dispose(); engine.dispose(); }
});
test('scene objects follow grid coordinates while 3D model size and authored positions stay unchanged', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const root = new TransformNode('environment', scene);
    const box = MeshBuilder.CreateBox('box', { size: 2 }, scene); box.parent = root;
    const ground = MeshBuilder.CreateGround('ground', { width: 8, height: 8 }, scene); ground.parent = root;
    const model = new TransformNode('model', scene); model.parent = root; model.scaling.set(2, 2, 2);
    const light = new PointLight('light', Vector3.Zero(), scene); light.parent = root;
    const preset: SceneEnvironmentPreset = {
      presetKey: 'test', name: 'Test', clearColor: '#000000',
      objects: [
        { id: 'box', name: 'Box', geometry: { primitive: 'box', width: 2, height: 2, depth: 2 }, position: [12, 1, 24], color: '#ffffff' },
        { id: 'ground', name: 'Ground', geometry: { primitive: 'ground', width: 8, height: 8 }, position: [10, 0, 20], color: '#ffffff' },
      ],
      models: [{ id: 'model', name: 'Model', modelPath: 'resources/model.glb', position: [12, 0, 24], scaling: [2, 2, 2] }],
      lights: [{ id: 'light', name: 'Light', intensity: 1, color: '#ffffff', light: { primitive: 'point', position: [12, 3, 24] } }],
    };
    const instance = { presetKey: 'test', root, models: [], nodes: new Map<string, Node>([['object:box', box], ['object:ground', ground], ['model:model', model], ['light:light', light]]), dispose: () => root.dispose() };
    const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, proportion: 'manual', scaleX: 2, scaleZ: 3 }, [10, 0, 20], [2, 1, 2]);
    applySceneEnvironmentDisplayView(instance, preset, view);
    assert.deepEqual(box.position.asArray(), [14, 1, 32]); assert.deepEqual(box.scaling.asArray(), [1, 1, 1]);
    assert.deepEqual(model.position.asArray(), [14, 0, 32]); assert.deepEqual(model.scaling.asArray(), [2, 2, 2]);
    assert.deepEqual(ground.scaling.asArray(), [2, 1, 3]); assert.deepEqual(light.position.asArray(), [14, 3, 32]);
    assert.deepEqual(preset.objects[0].position, [12, 1, 24]);
    applySceneEnvironmentDisplayView(instance, preset, null);
    assert.deepEqual(box.position.asArray(), [12, 1, 24]); assert.deepEqual(model.position.asArray(), [12, 0, 24]);
    assert.deepEqual(ground.scaling.asArray(), [1, 1, 1]); assert.deepEqual(light.position.asArray(), [12, 3, 24]);
  } finally { scene.dispose(); engine.dispose(); }
});
test('scene view lease follows replacement instances and restores the old instance', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const preset: SceneEnvironmentPreset = { presetKey: 'test', name: 'Test', clearColor: '#000000',
      objects: [{ id: 'box', name: 'Box', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 }, position: [2, 0, 3], color: '#ffffff' }], models: [], lights: [] };
    const make = () => {
      const root = new TransformNode('environment', scene);
      const box = MeshBuilder.CreateBox('box', { size: 1 }, scene); box.parent = root;
      return { box, instance: { presetKey: 'test', root, models: [], nodes: new Map<string, Node>([['object:box', box]]), dispose: () => root.dispose() } };
    };
    const first = make(); const second = make();
    const controller = createSceneEnvironmentViewController();
    const lease = controller.consumer.acquire('overhead');
    const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, proportion: 'manual', scaleX: 2, scaleZ: 3 }, [0, 0, 0], [1, 1, 1]);
    controller.setCurrent(first.instance, preset); lease.apply(view);
    assert.deepEqual(first.box.position.asArray(), [4, 0, 9]);
    controller.setCurrent(second.instance, preset);
    assert.deepEqual(first.box.position.asArray(), [2, 0, 3]);
    assert.deepEqual(second.box.position.asArray(), [4, 0, 9]);
    lease.release(); assert.deepEqual(second.box.position.asArray(), [2, 0, 3]);
    controller.setCurrent(null, null); controller.dispose();
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
