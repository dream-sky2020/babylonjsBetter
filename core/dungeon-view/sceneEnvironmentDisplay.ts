import { DirectionalLight, PointLight, TransformNode } from '@babylonjs/core';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset } from '../scene/sceneEnvironment.types.ts';
import { createDungeonViewConsumer, mapDungeonDisplayPosition, type ResolvedDungeonView } from './dungeonOverheadView.ts';
import { environmentNodeEntries } from '../scene/sceneEnvironment.hierarchy.ts';

/** Map authored world positions into the grid's display space without stretching 3D objects. */
export function applySceneEnvironmentDisplayView(
  instance: SceneEnvironmentInstance,
  preset: SceneEnvironmentPreset,
  view: ResolvedDungeonView | null,
): void {
  for (const { id, definition } of environmentNodeEntries(preset)) {
    const node = instance.nodes.get(id);
    if ('light' in definition) {
      const light = definition.light;
      if (light.primitive === 'hemispheric' || (light.primitive === 'directional' && !light.position)) continue;
      if (node instanceof PointLight || node instanceof DirectionalLight) node.position.set(...(definition.parentId ? light.position! : mapDungeonDisplayPosition(view, light.position!)));
    } else if (node instanceof TransformNode) {
      // A hierarchy is one placed assembly; never map its child-local coordinates again.
      node.position.set(...(definition.parentId ? definition.position : mapDungeonDisplayPosition(view, definition.position)));
      if ('geometry' in definition && definition.geometry.primitive === 'ground') {
        const mesh = instance.groundMeshes?.get(id);
        if (mesh) mesh.scaling.set(view?.scaleX ?? 1, 1, view?.scaleZ ?? 1);
        else {
          // Compatibility with older instances whose ground mesh was the logical node.
          const scale = definition.scaling ?? [1, 1, 1];
          node.scaling.set(scale[0] * (view?.scaleX ?? 1), scale[1], scale[2] * (view?.scaleZ ?? 1));
        }
      }
    }
  }
}

/** The loader owns instances; the overhead coordinator only owns the view lease. */
export function createSceneEnvironmentViewController() {
  let current: { instance: SceneEnvironmentInstance; preset: SceneEnvironmentPreset } | null = null;
  let view: ResolvedDungeonView | null = null;
  const consumer = createDungeonViewConsumer(next => {
    view = next;
    if (current) applySceneEnvironmentDisplayView(current.instance, current.preset, next);
  });
  return {
    consumer,
    setCurrent(instance: SceneEnvironmentInstance | null, preset: SceneEnvironmentPreset | null) {
      if (current && current.instance !== instance) applySceneEnvironmentDisplayView(current.instance, current.preset, null);
      current = instance && preset ? { instance, preset } : null;
      if (current) applySceneEnvironmentDisplayView(current.instance, current.preset, view);
    },
    dispose() { consumer.dispose(); current = null; },
  };
}
