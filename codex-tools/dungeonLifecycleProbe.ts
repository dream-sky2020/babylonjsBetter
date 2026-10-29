import { EngineStore } from '@babylonjs/core';
import { getModelPrefabCacheStats } from '../core/model/prefab/modelPrefabCache';
import { getVisualDeformationRegistry } from '../core/render-deformation/visualDeformationRegistry';

export function snapshot() {
  const scene = EngineStore.Instances.flatMap(engine => engine.scenes).find(scene => !scene.isDisposed)!;
  return {
    meshes: scene.meshes.length, nodes: scene.transformNodes.length, materials: scene.materials.length,
    textures: scene.textures.length, lights: scene.lights.length, skeletons: scene.skeletons.length,
    animations: scene.animationGroups.length, runningAnimations: scene.animatables.length,
    contextObservers: scene.getEngine().onContextRestoredObservable.observers.length,
    observers: Object.fromEntries(Object.entries(scene).filter(([key, value]) => key.endsWith('Observable') && value?.observers)
      .map(([key, value]) => [key, value.observers.length])),
    roots: scene.rootNodes.map(node => node.name), prefab: getModelPrefabCacheStats(scene),
    deformation: getVisualDeformationRegistry(scene).list().length,
  };
}
