import { DirectionalLight, PointLight, TransformNode } from '@babylonjs/core';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset } from '../scene/sceneEnvironment.types.ts';
import { createDungeonViewConsumer, mapDungeonDisplayPosition, type ResolvedDungeonView } from './dungeonOverheadView.ts';

/** Map authored world positions into the grid's display space without stretching 3D objects. */
export function applySceneEnvironmentDisplayView(
  instance: SceneEnvironmentInstance,
  preset: SceneEnvironmentPreset,
  view: ResolvedDungeonView | null,
): void {
  for (const object of preset.objects) {
    const node = instance.nodes.get(`object:${object.id}`);
    if (!(node instanceof TransformNode)) continue;
    node.position.set(...mapDungeonDisplayPosition(view, object.position));
    // A ground plane represents the map surface; its footprint follows grid scale.
    if (object.geometry.primitive === 'ground') node.scaling.set(view?.scaleX ?? 1, 1, view?.scaleZ ?? 1);
  }
  for (const model of preset.models) {
    const node = instance.nodes.get(`model:${model.id}`);
    if (node instanceof TransformNode) node.position.set(...mapDungeonDisplayPosition(view, model.position));
  }
  for (const definition of preset.lights) {
    const light = definition.light;
    if (light.primitive === 'hemispheric' || (light.primitive === 'directional' && !light.position)) continue;
    const node = instance.nodes.get(`light:${definition.id}`);
    if (node instanceof PointLight || node instanceof DirectionalLight) node.position.set(...mapDungeonDisplayPosition(view, light.position!));
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
