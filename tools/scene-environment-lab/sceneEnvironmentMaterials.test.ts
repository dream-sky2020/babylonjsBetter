import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { SceneEnvironmentInstance } from '@/core/scene/sceneEnvironment.types';
import { collectEnvironmentMaterials } from './sceneEnvironmentMaterials.ts';
import { createEnvironmentSelectionEdges } from './sceneEnvironmentSelectionEdges.ts';

test('material catalog groups by identity, counts each model once and includes geometry', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const shared = new StandardMaterial('same name', scene), separate = new StandardMaterial('same name', scene);
    const a = MeshBuilder.CreateBox('a', {}, scene), b = MeshBuilder.CreateBox('b', {}, scene), c = MeshBuilder.CreateBox('c', {}, scene);
    a.material = b.material = shared; c.material = separate;
    const instance = { models: [{ definition: { id: 'one' }, entity: { meshes: [a, b] } }, { definition: { id: 'two' }, entity: { meshes: [b] } }, { definition: { id: 'three' }, entity: { meshes: [c] } }], groundMeshes: new Map([['object:ground', a]]) } as unknown as SceneEnvironmentInstance;
    const entries = collectEnvironmentMaterials(instance);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0].objectIds, ['model:one', 'model:two', 'object:ground']);
    assert.equal(entries[0].modelCount, 2); assert.equal(entries[0].geometryCount, 1);
    assert.notEqual(entries[0].id, entries[1].id);
    assert.equal(entries[1].modelCount, 1);
  } finally { scene.dispose(); engine.dispose(); }
});

test('selection bounds isolate hardware instances, track transforms and release only owned lines', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const source = MeshBuilder.CreateBox('source', {}, scene), a = source.createInstance('a'), b = source.createInstance('b');
    const edges = createEnvironmentSelectionEdges(scene, id => id === 'a' ? [a] : [b]);
    edges.set(['a'], true);
    assert.equal(scene.meshes.filter(mesh => mesh.name.startsWith('editor:selection:')).length, 1);
    assert.equal(source.showBoundingBox, false); assert.equal(b.showBoundingBox, false);
    a.position = new Vector3(5, 0, 0); scene.onBeforeRenderObservable.notifyObservers(scene);
    const line = scene.getMeshByName('editor:selection:a')!;
    assert.ok(line.getBoundingInfo().boundingBox.minimum.x > 4);
    assert.equal(line.isPickable, false);
    edges.set([], false); assert.equal(line.isDisposed(), true);
    edges.set(['b'], true); edges.dispose();
    assert.equal(scene.meshes.length, 3);
    assert.equal(source.isDisposed(), false);
  } finally { scene.dispose(); engine.dispose(); }
});
