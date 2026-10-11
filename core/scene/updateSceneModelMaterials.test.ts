import test from 'node:test';
import assert from 'node:assert/strict';
import { updateSceneModelMaterials } from './updateSceneModelMaterials.ts';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset } from './sceneEnvironment.types.ts';

const preset = (changed = false): SceneEnvironmentPreset => ({ presetKey: 'test', name: 'Test', clearColor: '#000000', objects: [], lights: [], models: ['a', 'b'].map(id => ({ id, name: id, modelPath: 'resources/a.glb', position: [0, 0, 0], ...(changed ? { materialOverrides: [{ selector: { gltfMaterialIndex: 0 }, alphaMode: 'MASK' as const }] } : {}) })) });

test('batch commit failure rolls back earlier models before releasing candidates', async () => {
  const events: string[] = [];
  const values = new Map([['a', 'original-a'], ['b', 'original-b']]);
  const instance = { models: ['a', 'b'].map(id => ({ definition: { id }, entity: { prepareMaterialBindings: async () => {
    let committed = false;
    return {
      validate() {}, commit() { events.push(`commit:${id}`); if (id === 'b') throw Error('commit failed'); committed = true; values.set(id, 'candidate'); },
      rollback() { events.push(`rollback:${id}`); if (committed) { values.set(id, `original-${id}`); committed = false; } },
      finalize() { events.push(`finalize:${id}`); }, dispose() { events.push(`dispose:${id}`); },
    };
  } } })) } as unknown as SceneEnvironmentInstance;
  await assert.rejects(updateSceneModelMaterials(instance, preset(), preset(true), new AbortController().signal), /commit failed/);
  assert.deepEqual([...values.values()], ['original-a', 'original-b']);
  assert.deepEqual(events, ['commit:a', 'commit:b', 'rollback:b', 'rollback:a', 'dispose:a', 'dispose:b']);
});

test('successful batch finalizes old resources only after all commits', async () => {
  const events: string[] = [];
  const instance = { models: ['a', 'b'].map(id => ({ definition: { id }, entity: { prepareMaterialBindings: async () => ({
    validate() { events.push(`validate:${id}`); }, commit() { events.push(`commit:${id}`); }, rollback() { assert.fail('unexpected rollback'); },
    finalize() { events.push(`finalize:${id}`); }, dispose() { events.push(`dispose:${id}`); },
  }) } })) } as unknown as SceneEnvironmentInstance;
  assert.equal(await updateSceneModelMaterials(instance, preset(), preset(true), new AbortController().signal), true);
  assert.deepEqual(events, ['validate:a', 'validate:b', 'commit:a', 'commit:b', 'finalize:a', 'finalize:b', 'dispose:a', 'dispose:b']);
});
