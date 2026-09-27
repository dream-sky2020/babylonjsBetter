import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, TransformNode, Quaternion, ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { SceneEditor } from './SceneEditor.ts';
import { DocumentHistory } from './DocumentHistory.ts';
import { readTransform, writeTransform } from './transform.ts';
import type { SceneEditorObject } from './types.ts';

test('drag previews never write domain; one commit, undo/redo, cancel and lifecycle', async () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  new ArcRotateCamera('camera', 0, 1, 10, Vector3.Zero(), scene);
  const parent = new TransformNode('parent', scene); parent.rotation.y = .3;
  const node = new TransformNode('render-node', scene); node.parent = parent; node.rotationQuaternion = Quaternion.FromEulerAngles(.1, .2, .3);
  const history = new DocumentHistory(readTransform(node), value => writeTransform(node, value));
  let commits = 0; let editable = true;
  let objects: SceneEditorObject[] = [{ id: 'domain-id', name: 'Object', parentId: null, node, target: node, channels: ['position', 'rotation', 'scaling'] }];
  const observerCount = scene.onPointerObservable.observers.length;
  const editor = new SceneEditor(scene, { objects: () => objects, canEdit: () => editable, commit: (_edit, value) => { commits++; history.set(value); }, undo: () => history.undo(), redo: () => history.redo() });
  editor.select('domain-id'); assert.equal(editor.begin('position', 'gizmo'), true);
  for (let i = 1; i <= 30; i++) editor.preview({ ...readTransform(node), position: { x: i, y: 0, z: 0 } });
  assert.equal(history.value.position.x, 0); editor.commit(); assert.equal(commits, 1); assert.equal(history.value.position.x, 30);
  editor.undo(); assert.equal(node.position.x, 0); editor.redo(); assert.equal(node.position.x, 30);
  editor.begin('rotation'); const original = node.rotationQuaternion!.clone();
  editor.preview({ ...readTransform(node), rotation: { x: 80, y: 45, z: 20 } }); editor.cancel();
  assert.ok(node.rotationQuaternion!.equalsWithEpsilon(original, .00001)); assert.equal(commits, 1);
  editor.begin(); node.position.x = 90; editable = false; editor.commit(); assert.equal(node.position.x, 30);
  editable = true; editor.begin(); node.position.x = 60; objects = []; editor.refresh(); assert.equal(editor.selectedId, null); assert.equal(node.position.x, 30);
  editor.dispose(); editor.dispose(); await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(scene.isDisposed, false); assert.equal(scene.onPointerObservable.observers.length, observerCount);
  scene.dispose(); engine.dispose();
});

test('channel and uniform scale restrictions also constrain numeric previews', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const node = new TransformNode('proxy', scene);
  const editor = new SceneEditor(scene, { objects: () => [{ id: 'asset', name: 'Asset', parentId: null, node, target: node, channels: ['scaling'], uniformScale: true }], commit() {} });
  editor.select('asset'); assert.equal(editor.begin('position'), false); editor.begin('scaling');
  editor.preview({ position: { x: 99, y: 0, z: 0 }, rotation: { x: 90, y: 0, z: 0 }, scaling: { x: 2, y: 3, z: 4 } });
  assert.equal(node.position.x, 0); assert.deepEqual(node.scaling.asArray(), [2, 2, 2]); editor.cancel(); assert.equal(node.scaling.x, 1);
  editor.dispose(); scene.dispose(); engine.dispose();
});

test('all gizmo observable gestures suspend input and commit exactly once', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const node = new TransformNode('target', scene);
  const inputs: boolean[] = []; let commits = 0;
  const editor = new SceneEditor(scene, {
    objects: () => [{ id: 'stable', parentId: null, name: 'Target', node, target: node, channels: ['position', 'rotation', 'scaling'] }],
    commit: () => { commits++; },
  }, { cameraInput: suspended => inputs.push(suspended) });
  editor.select('stable');
  const cases = [
    [editor.gizmo.gizmos.positionGizmo!, 'position', () => { node.position.x += 1; }],
    [editor.gizmo.gizmos.rotationGizmo!, 'rotation', () => { node.rotation.y += .1; }],
    [editor.gizmo.gizmos.scaleGizmo!, 'scaling', () => { node.scaling.x += .1; }],
  ] as const;
  for (const [gizmo, channel, mutate] of cases) {
    editor.mode = channel; editor.refresh();
    gizmo.onDragStartObservable.notifyObservers({} as never);
    assert.equal(editor.editing, true);
    for (let i = 0; i < 10; i++) { mutate(); gizmo.onDragObservable.notifyObservers({} as never); }
    gizmo.onDragEndObservable.notifyObservers({} as never);
    assert.equal(editor.editing, false);
  }
  assert.equal(commits, 3); assert.deepEqual(inputs, [true, false, true, false, true, false]);
  editor.dispose(); scene.dispose(); engine.dispose();
});
