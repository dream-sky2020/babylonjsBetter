import test from 'node:test';
import assert from 'node:assert/strict';
import type { SceneEnvironmentPreset } from '../../core/scene/sceneEnvironment.types.ts';
import { isEnvironmentTransformOnlyChange } from './sceneEnvironmentTransformPreview.ts';

const preset = (): SceneEnvironmentPreset => ({
  presetKey: 'p', name: 'P', clearColor: '#000000',
  transformNodes: [{ id: 'rig', name: 'Rig', position: [0, 0, 0] }],
  models: [{ id: 'model', name: 'Model', modelPath: 'model.glb', position: [0, 0, 0] }],
  objects: [{ id: 'box', name: 'Box', position: [0, 0, 0], color: '#ffffff', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 } }],
  lights: [{ id: 'sun', name: 'Sun', intensity: 1, color: '#ffffff', light: { primitive: 'directional', direction: [0, -1, 0] } }],
});

test('batch transforms and optional defaults can update in place in both history directions', () => {
  const previous = preset(), next = structuredClone(previous);
  for (const definition of [...next.transformNodes!, ...next.models, ...next.objects]) {
    definition.position = [1, 2, 3]; definition.rotation = [.1, .2, .3]; definition.scaling = [2, 3, 4];
  }
  if (next.lights[0].light.primitive === 'directional') next.lights[0].light.position = [3, 4, 5];
  assert.equal(isEnvironmentTransformOnlyChange(previous, next), true);
  assert.equal(isEnvironmentTransformOnlyChange(next, previous), true);
});

test('resource, hierarchy, geometry and light changes must still rebuild even alongside a transform', () => {
  const previous = preset();
  const mutations: Array<(next: SceneEnvironmentPreset) => void> = [
    next => { next.models[0].modelPath = 'other.glb'; },
    next => { next.models[0].parentId = 'transform:rig'; },
    next => { next.models[0].materialOverrides = []; },
    next => { next.models[0].animation = { autoplay: true }; },
    next => { next.objects[0].geometry = { primitive: 'ground', width: 2, height: 2 }; },
    next => { next.objects[0].shadow = { cast: true }; },
    next => { next.lights[0].intensity = 2; },
    next => { if (next.lights[0].light.primitive === 'directional') next.lights[0].light.direction = [1, -1, 0]; },
    next => { next.transformNodes = []; },
    next => { next.clearColor = '#ffffff'; },
  ];
  for (const mutate of mutations) {
    const next = structuredClone(previous); next.models[0].position = [1, 2, 3]; mutate(next);
    assert.equal(isEnvironmentTransformOnlyChange(previous, next), false);
  }
});
