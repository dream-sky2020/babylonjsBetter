import { EngineStore } from '@babylonjs/core';

/** Read-only probe shared by the migrated Lab browser checks. */
export function snapshot() {
  const scenes = EngineStore.Instances.flatMap(engine => engine.scenes).filter(scene => !scene.isDisposed);
  return {
    scenes: scenes.length,
    meshes: scenes.reduce((sum, scene) => sum + scene.meshes.length, 0),
    monsterLayers: scenes.flatMap(scene => scene.meshes).filter(mesh => /^placement_.*_(body|line|bottomBorder|bottomFillMask)$/.test(mesh.name)).length,
    helpers: scenes.flatMap(scene => scene.meshes).filter(mesh => /^(cell_|marker_)/.test(mesh.name)).length,
    ready: scenes.length > 0 && scenes.every(scene => scene.isReady()),
  };
}
