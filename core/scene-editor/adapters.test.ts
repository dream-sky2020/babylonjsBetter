import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, TransformNode, DirectionalLight, Vector3 } from '@babylonjs/core';
import { createWeaponAnimationExamples } from '../model/preset/firstPersonWeaponExamples.ts';
import { updateWeaponTransform } from '../../tools/model-shake-lab/weaponSceneAdapter.ts';
import { createNormalizationSceneAdapter } from '../../tools/model-asset-normalization-lab/normalizationSceneAdapter.ts';
import { updateEnvironmentTransform, createEnvironmentAdapter } from '../../tools/scene-environment-lab/sceneEnvironmentAdapter.ts';
import { createDefaultAnimationWorkspace } from '../../tools/animation-workbench-lab/animationWorkspace.ts';
import { editWorkspaceTransform } from '../../tools/animation-workbench-lab/animationSceneAdapter.ts';
import { workspaceHistoryReducer } from '../../tools/animation-workbench-lab/useWorkspaceHistory.ts';
import { SceneEditor } from './SceneEditor.ts';
import { readTransform } from './transform.ts';
import type { ModelEntity } from '../model/types/model.types.ts';
import type { ModelAssetProfile } from '../model/types/model-asset-profile.types.ts';
import type { SceneEnvironmentPreset, SceneEnvironmentInstance } from '../scene/sceneEnvironment.types.ts';
const value = { position: { x: 3, y: 4, z: 5 }, rotation: { x: 90, y: 0, z: 0 }, scaling: { x: 2, y: 2, z: 2 } };

test('directional light proxy restores implicit Babylon position on cancel', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const root = new TransformNode('root', scene);
  const light = new DirectionalLight('sun', new Vector3(1, -2, 3), scene); light.parent = root;
  const preset: SceneEnvironmentPreset = { presetKey: 'test', name: 'test', clearColor: '#000000', objects: [], models: [], lights: [{ id: 'sun', name: 'Sun', intensity: 1, color: '#ffffff', light: { primitive: 'directional', direction: [1, -2, 3] } }] };
  const binding = createEnvironmentAdapter({ root, nodes: new Map([['light:sun', light]]) } as unknown as SceneEnvironmentInstance, { read: () => preset, write() { assert.fail('canceled edits must not write'); }, undo() {}, redo() {} });
  const editor = new SceneEditor(scene, binding.adapter); editor.select('light:sun'); editor.begin('position');
  assert.deepEqual(light.position.asArray(), [-1, 2, -3]); editor.preview(value); assert.deepEqual(light.position.asArray(), [3, 4, 5]);
  editor.cancel(); assert.deepEqual(light.position.asArray(), [-1, 2, -3]);
  editor.dispose(); binding.dispose(); scene.dispose(); engine.dispose();
});

test('weapon asset, keyframe and proxy commits preserve other hand and asset normalization boundary', () => {
  const project = createWeaponAnimationExamples()['right-hand-slash']; const id = project.weapons.right.keyframes[0].id;
  const asset = updateWeaponTransform(project, 'right', 'asset', id, value);
  assert.equal(asset.weapons.left, project.weapons.left); assert.deepEqual(asset.weapons.right.asset.offset, value.position);
  assert.equal(asset.weapons.right.keyframes, project.weapons.right.keyframes);
  const pose = updateWeaponTransform(project, 'right', 'pose', id, value);
  assert.equal(pose.weapons.right.asset, project.weapons.right.asset); assert.deepEqual(pose.weapons.right.keyframes[0].rotation, value.rotation);
  const proxy = updateWeaponTransform(project, 'right', 'proxy', id, value);
  assert.deepEqual(proxy.weapons.right.proxy.size, value.scaling); assert.equal(proxy.weapons.right.asset, project.weapons.right.asset);
});
test('normalization adapter separates Profile from instance and cancels without domain writes', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const root = new TransformNode('instance', scene); const normalizationRoot = new TransformNode('profile', scene); normalizationRoot.parent = root;
  let profile: ModelAssetProfile = { modelPath: 'asset.glb', uniformScale: 1, positionOffset: { x: 0, y: 0, z: 0 }, rotationDeg: { x: 0, y: 0, z: 0 }, transparencyPolicy: 'source' } as ModelAssetProfile;
  const instance = { id: 7, path: 'asset.glb', entity: { root, normalizationRoot } as ModelEntity, comparison: { position: { x: 20, y: 0, z: 0 }, rotationDeg: { x: 0, y: 0, z: 0 }, scale: 1 } };
  let writes = 0;
  const editor = new SceneEditor(scene, createNormalizationSceneAdapter({ instances: () => [instance], profile: () => profile, writeProfile: (_path, next) => { writes++; profile = next; }, writeComparison: (_id, next) => { instance.comparison = next; }, select() {}, undo() {}, redo() {} }));
  editor.select('7:instance'); editor.begin('position'); editor.preview(value); editor.commit(); assert.equal(writes, 0); assert.deepEqual(instance.comparison.position, value.position);
  editor.select('7:profile'); editor.begin('position'); editor.preview(value); editor.cancel(); assert.equal(writes, 0);
  editor.begin('position'); editor.preview(value); editor.commit(); assert.equal(writes, 1); assert.deepEqual(profile.positionOffset, value.position);
  assert.deepEqual(readTransform(root).position, instance.comparison.position); editor.dispose(); scene.dispose(); engine.dispose();
});
test('workspace EDIT uses existing history and cancellation restores transaction start', () => {
  const workspace = createDefaultAnimationWorkspace(); const id = workspace.objects[0].id;
  const next = editWorkspaceTransform(workspace, id, 'position', value, 0, 'off', 'override');
  assert.deepEqual(next.objects[0].position, value.position); assert.deepEqual(next.signalGraph, workspace.signalGraph);
  const initial = { past: [], present: workspace, future: [], transactionStart: null };
  const active = workspaceHistoryReducer(workspaceHistoryReducer(initial, { type: 'begin' }), { type: 'commit', update: next });
  const canceled = workspaceHistoryReducer(active, { type: 'cancel' }); assert.equal(canceled.present, workspace); assert.equal(canceled.past.length, 0);
  const committed = workspaceHistoryReducer(active, { type: 'end' }); assert.equal(committed.past.length, 1);
});
test('environment writes supported preset fields only; geometry has no persisted scaling', () => {
  const preset: SceneEnvironmentPreset = { presetKey: 'test', name: 'test', clearColor: '#000000', lights: [{ id: 'light', name: 'light', intensity: 1, color: '#ffffff', light: { primitive: 'point', position: [0, 0, 0] } }], objects: [{ id: 'box', name: 'box', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 }, position: [0, 0, 0], color: '#ffffff' }], models: [{ id: 'model', name: 'model', modelPath: 'test.glb', position: [0, 0, 0] }] };
  const object = updateEnvironmentTransform(preset, 'object:box', value); assert.deepEqual(object.objects[0].rotation, [Math.PI / 2, 0, 0]); assert.equal('scaling' in object.objects[0], false);
  const model = updateEnvironmentTransform(preset, 'model:model', value); assert.deepEqual(model.models[0].scaling, [2, 2, 2]);
  const light = updateEnvironmentTransform(preset, 'light:light', value); assert.deepEqual((light.lights[0].light as { position: unknown }).position, [3, 4, 5]);
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);
});
