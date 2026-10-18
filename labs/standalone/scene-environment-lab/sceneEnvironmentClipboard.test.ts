import test from 'node:test';
import assert from 'node:assert/strict';
import type { SceneEnvironmentPreset } from '../../../core/scene/sceneEnvironment.types.ts';
import { validateEnvironmentHierarchy } from '../../../core/scene/sceneEnvironment.hierarchy.ts';
import { copyEnvironmentSelection, deleteEnvironmentSelection, pasteEnvironmentSelection } from './sceneEnvironmentClipboard.ts';

const preset = (): SceneEnvironmentPreset => ({
  presetKey: 'test', name: 'Test', clearColor: '#000000',
  transformNodes: [{ id: 'group', name: 'Group', position: [2, 0, 0], order: 0 }],
  objects: [{ id: 'box', name: 'Box', parentId: 'transform:group', order: 0, position: [1, 0, 0], color: '#ffffff', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 } }],
  models: [{ id: 'model', name: 'Model', parentId: 'object:box', order: 0, modelPath: 'resources/example.glb', position: [0, 0, 0], materialOverrides: [] }],
  lights: [{ id: 'lamp', name: 'Lamp', order: 1, intensity: 1, color: '#ffffff', light: { primitive: 'point', position: [0, 1, 0] } }],
});

test('copy and delete selected roots include descendants once', () => {
  const source = preset();
  const copied = copyEnvironmentSelection(source, ['model:model', 'transform:group', 'object:box', 'light:lamp']);
  assert.deepEqual(copied.roots, ['transform:group', 'light:lamp']);
  assert.equal(copied.models.length, 1);
  source.models[0].materialOverrides?.push({ selector: { gltfMaterialIndex: 0 }, textures: {} });
  assert.equal(copied.models[0].materialOverrides?.length, 0, 'clipboard owns a snapshot');
  const deleted = deleteEnvironmentSelection(source, ['transform:group']);
  assert.deepEqual([deleted.transformNodes?.length, deleted.objects.length, deleted.models.length, deleted.lights.length], [0, 0, 0, 1]);
  validateEnvironmentHierarchy(deleted);
});

test('paste creates unique IDs and retains copied hierarchy, properties and sibling order', () => {
  const source = preset();
  const copied = copyEnvironmentSelection(source, ['transform:group', 'light:lamp']);
  const result = pasteEnvironmentSelection(source, copied, null);
  validateEnvironmentHierarchy(result.preset);
  assert.deepEqual(result.selectedIds, ['transform:group-copy-1', 'light:lamp-copy-1']);
  assert.equal(result.preset.objects.find(item => item.id === 'box-copy-1')?.parentId, 'transform:group-copy-1');
  assert.equal(result.preset.models.find(item => item.id === 'model-copy-1')?.parentId, 'object:box-copy-1');
  assert.equal(result.preset.models.find(item => item.id === 'model-copy-1')?.modelPath, 'resources/example.glb');
  assert.equal(result.preset.lights.find(item => item.id === 'lamp-copy-1')?.order, 3);
});

test('cut then paste preserves IDs when free and can move a subtree under another node', () => {
  const source = preset();
  const copied = copyEnvironmentSelection(source, ['object:box']);
  const without = deleteEnvironmentSelection(source, ['object:box']);
  const result = pasteEnvironmentSelection(without, copied, 'transform:group', true);
  validateEnvironmentHierarchy(result.preset);
  assert.deepEqual(result.selectedIds, ['object:box']);
  assert.equal(result.preset.models[0].parentId, 'object:box');
  assert.equal(result.preset.objects[0].name, 'Box');
});
