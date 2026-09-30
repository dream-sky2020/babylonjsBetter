import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcRotateCamera, Camera, MeshBuilder, NullEngine, PointerEventTypes, PointerInfo, Ray, Scene, TransformNode, Vector3, type Node } from '@babylonjs/core';
import { moveEnvironmentNode, environmentWorldMatrices } from './sceneEnvironmentHierarchy.ts';
import { orderedEnvironmentEntries } from '../../core/scene/sceneEnvironment.hierarchy.ts';
import { addEnvironmentObject } from './sceneEnvironmentObjects.ts';
import { createEnvironmentAdapter } from './sceneEnvironmentAdapter.ts';
import { createEnvironmentMarkers } from './sceneEnvironmentMarkers.ts';
import { SceneEditor } from '../../core/scene-editor/SceneEditor.ts';
import { DocumentHistory } from '../../core/scene-editor/DocumentHistory.ts';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset } from '../../core/scene/sceneEnvironment.types.ts';
import type { EditorHierarchyDropIntent } from '../../core/ui/editor-kit/ObjectHierarchy.tsx';
import type { ModelEntity } from '../../core/model/types/model.types.ts';

const preset = (): SceneEnvironmentPreset => ({ presetKey: 'p', name: 'P', clearColor: '#000000',
  transformNodes: [{ id: 'rig', name: 'Rig', position: [10, 2, 3], rotation: [0, .4, 0], scaling: [2, 2, 2] }],
  objects: [{ id: 'a', name: 'A', position: [1, 2, 3], color: '#ffffff', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 } }],
  models: [{ id: 'm', name: 'M', modelPath: 'test.glb', position: [4, 0, 0] }],
  lights: [{ id: 'l', name: 'L', color: '#ffffff', intensity: 1, light: { primitive: 'point', position: [0, 3, 0] } }],
});
const drop = (source: string, targetId: string | null, placement: EditorHierarchyDropIntent['placement'], parentId: string | null = null): EditorHierarchyDropIntent => ({ sourceIds: [source], targetId, placement, parentId, targetIndex: 999 });
const order = (p: SceneEnvironmentPreset, parent: string | null = null) => orderedEnvironmentEntries(p).filter(e => (e.definition.parentId ?? null) === parent).map(e => e.id);
const near = (a: ArrayLike<number>, b: ArrayLike<number>) => Array.from(a).forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-4));

test('cross-type sibling sorting is directional, no-op stable, atomic in history and survives JSON', () => {
  const p = preset();
  const history = new DocumentHistory(p, () => {});
  const next = moveEnvironmentNode(p, drop('light:l', 'object:a', 'before'));
  assert.deepEqual(order(next), ['transform:rig', 'light:l', 'object:a', 'model:m']);
  assert.deepEqual(next.objects[0].position, p.objects[0].position);
  assert.equal(moveEnvironmentNode(next, drop('light:l', 'object:a', 'before')), next);
  const after = moveEnvironmentNode(next, drop('light:l', 'model:m', 'after'));
  assert.deepEqual(order(after), order(p));
  history.set(next); history.undo(); assert.deepEqual(history.value, p); history.redo(); assert.deepEqual(history.value, next);
  assert.deepEqual(order(JSON.parse(JSON.stringify(history.value))), order(next));
  const added = addEnvironmentObject(next, 'empty');
  assert.equal(order(added.preset).at(-1), added.selectedId);
  const rootOrder = order(added.preset);
  const child = addEnvironmentObject(added.preset, 'rig', undefined, added.selectedId);
  const grandchild = addEnvironmentObject(child.preset, 'socket', undefined, child.selectedId);
  assert.deepEqual(order(grandchild.preset), rootOrder, 'adding to an earlier typed array must not reorder unrelated siblings');
});

test('inside/root moves keep world transforms and place children across mixed types, ignoring UI-only indices', () => {
  const p = preset();
  const world = environmentWorldMatrices(p).get('object:a')!.asArray();
  const inside = moveEnvironmentNode(p, drop('object:a', 'transform:rig', 'inside', 'transform:rig'));
  near(environmentWorldMatrices(inside).get('object:a')!.asArray(), world);
  const more = moveEnvironmentNode(inside, drop('model:m', 'object:a', 'before', 'transform:rig'));
  assert.deepEqual(order(more, 'transform:rig'), ['model:m', 'object:a']);
  const root = moveEnvironmentNode(more, drop('object:a', null, 'root-end'));
  assert.equal(order(root).at(-1), 'object:a');
  near(environmentWorldMatrices(root).get('object:a')!.asArray(), world);
  assert.deepEqual(order(root, 'transform:rig'), ['model:m']);
  assert.throws(() => moveEnvironmentNode(more, drop('transform:rig', 'object:a', 'inside', 'object:a')), /后代/);
  assert.throws(() => moveEnvironmentNode(p, drop('object:a', 'light:l', 'inside', 'light:l')), /父节点/);
  assert.throws(() => moveEnvironmentNode(p, drop('model:m/render:part:0', null, 'root-end')), /只读/);
  assert.throws(() => moveEnvironmentNode(p, drop('object:a', 'model:m/render:part:0', 'before')), /声明节点/);
  assert.throws(() => moveEnvironmentNode(p, drop('object:a', 'scene', 'before')), /声明节点/);
  assert.throws(() => moveEnvironmentNode(p, drop('object:a', 'model:m', 'inside', null)), /已改变/);
  const shear = preset(); shear.transformNodes![0].scaling = [2, 1, 3];
  const snapshot = JSON.stringify(shear);
  assert.throws(() => moveEnvironmentNode(shear, drop('object:a', 'transform:rig', 'inside', 'transform:rig')), /剪切/);
  assert.equal(JSON.stringify(shear), snapshot);
});

test('editor markers are scale-independent, pick their declaration, toggle locally, and dispose without touching domain nodes', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const camera = new ArcRotateCamera('camera', 0, 1, 20, Vector3.Zero(), scene);
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA; camera.orthoTop = 10; camera.orthoBottom = -10;
    const root = new TransformNode('root', scene), rig = new TransformNode('rig', scene); rig.parent = root; rig.position.set(2, 3, 4); rig.scaling.set(5, 2, 3);
    const p = preset(); p.objects = []; p.models = []; p.lights = [];
    const instance = { presetKey: 'p', root, nodes: new Map<string, Node>([['transform:rig', rig]]), models: [], dispose: () => root.dispose() };
    const baseline = scene.onBeforeRenderObservable.observers.length;
    const markers = createEnvironmentMarkers(instance, p);
    const marker = markers.markers.get('transform:rig')!;
    near(marker.position.asArray(), [2, 3, 4]); assert.equal(marker.doNotSerialize, true);
    const scale = marker.scaling.x; rig.scaling.setAll(9); rig.position.x = 8; markers.update();
    assert.equal(marker.scaling.x, scale); near(marker.position.asArray(), [8, 3, 4]);
    camera.orthoTop = 20; camera.orthoBottom = -20; markers.update(); assert.equal(marker.scaling.x, scale * 2);
    markers.setVisible(false); assert.equal(marker.isEnabled(), false);
    markers.setVisible(true); markers.update(); assert.equal(marker.isEnabled(), true);
    rig.setEnabled(false); markers.update(); assert.equal(marker.isEnabled(), false); rig.setEnabled(true); markers.update();
    const editor = new SceneEditor(scene, { objects: () => [{ id: 'transform:rig', name: 'Rig', node: rig, target: rig, parentId: null, channels: ['position'], pickNodes: [marker] }], commit() {} });
    const pick = scene.pickWithRay(new Ray(marker.position.add(new Vector3(0, 0, -10)), new Vector3(0, 0, 1)), mesh => mesh === marker)!;
    assert.equal(pick.hit, true);
    scene.onPointerObservable.notifyObservers(new PointerInfo(PointerEventTypes.POINTERTAP, { button: 0 } as PointerEvent, pick));
    assert.equal(editor.selectedId, 'transform:rig');
    editor.dispose(); markers.dispose(); markers.dispose();
    assert.equal(rig.isDisposed(), false); assert.equal(scene.meshes.length, 0);
    assert.equal(scene.onBeforeRenderObservable.observers.filter(o => !o._willBeUnregistered).length, baseline);
  } finally { scene.dispose(); engine.dispose(); }
});

test('authoring tree contains declarations only, preserves authored children, and picks imported meshes as their model', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const p = preset(); p.objects = []; p.lights = []; p.transformNodes![0].parentId = 'model:m';
    const make = () => {
      const root = new TransformNode('root', scene), model = new TransformNode('model', scene), rig = new TransformNode('rig', scene);
      model.parent = root; rig.parent = model;
      const normalizationRoot = new TransformNode('model:asset-profile', scene); normalizationRoot.parent = model;
      normalizationRoot.position.set(1, 2, 3); normalizationRoot.scaling.setAll(2);
      const imported = MeshBuilder.CreateBox('body', {}, scene); imported.parent = normalizationRoot;
      const duplicate = MeshBuilder.CreateBox('body', {}, scene); duplicate.parent = normalizationRoot;
      const namedLikeProperty = MeshBuilder.CreateBox('actual:asset-profile', {}, scene); namedLikeProperty.parent = normalizationRoot;
      const nested = new TransformNode('GLTF internal wrapper', scene); nested.parent = imported;
      const leaf = MeshBuilder.CreateBox('nested render mesh', {}, scene); leaf.parent = nested;
      const helper = new TransformNode('editor:helper', scene); helper.parent = model;
      const instance: SceneEnvironmentInstance = { presetKey: 'p', root, models: [{ definition: p.models[0], entity: { root: model, normalizationRoot } as ModelEntity }], nodes: new Map([['model:m', model], ['transform:rig', rig]]), dispose: () => root.dispose() };
      const binding = createEnvironmentAdapter(instance, { read: () => p, write() { assert.fail('read-only selection must not commit'); }, undo() {}, redo() {} });
      return { instance, binding, imported };
    };
    const first = make(); const objects = first.binding.adapter.objects();
    assert.deepEqual(objects.map(o => o.id).sort(), ['model:m', 'scene', 'transform:rig']);
    assert.equal(objects.find(o => o.id === 'transform:rig')!.parentId, 'model:m');
    assert.deepEqual(first.binding.modelAssetProperties('model:m'), { position: [1, 2, 3], rotation: [0, 0, 0], scaling: [2, 2, 2] });
    const editor = new SceneEditor(scene, first.binding.adapter);
    // Canvas picking still resolves an imported mesh to its editable model owner.
    scene.onPointerObservable.notifyObservers(new PointerInfo(PointerEventTypes.POINTERTAP, { button: 0 } as PointerEvent, { pickedMesh: first.imported } as never));
    assert.equal(editor.selectedId, 'model:m'); editor.dispose(); first.binding.dispose(); first.instance.dispose();
    const second = make(); assert.deepEqual(second.binding.adapter.objects().map(o => o.id), objects.map(o => o.id));
    second.binding.dispose(); second.instance.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});
