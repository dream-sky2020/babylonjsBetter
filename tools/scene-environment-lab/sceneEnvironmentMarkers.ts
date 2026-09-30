import { Camera, Color3, MeshBuilder, Quaternion, StandardMaterial, TransformNode, Vector3, type Mesh } from '@babylonjs/core';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset } from '../../core/scene/sceneEnvironment.types.ts';

/** Borrow domain nodes; own only these editor visuals and the render subscription. */
export function createEnvironmentMarkers(instance: SceneEnvironmentInstance, preset: SceneEnvironmentPreset) {
  const scene = instance.root.getScene();
  const root = new TransformNode('editor:environment-markers', scene);
  root.doNotSerialize = true;
  const markers = new Map<string, Mesh>();
  for (const definition of preset.transformNodes ?? []) {
    const id = `transform:${definition.id}`;
    const marker = MeshBuilder.CreatePolyhedron(`editor:marker:${id}`, { type: 1, size: .35 }, scene);
    marker.parent = root;
    marker.doNotSerialize = true;
    marker.rotationQuaternion = Quaternion.Identity();
    marker.isPickable = true;
    const material = new StandardMaterial(`editor:marker-material:${id}`, scene);
    material.doNotSerialize = true;
    material.disableLighting = true;
    material.emissiveColor = Color3.FromHexString(definition.role === 'socket' ? '#f5bc6a' : definition.role === 'rig' ? '#77bfff' : '#b7cbd9');
    marker.material = material;
    const axes = MeshBuilder.CreateLineSystem(`editor:marker-axes:${id}`, {
      lines: [[Vector3.Zero(), new Vector3(1, 0, 0)], [Vector3.Zero(), new Vector3(0, 1, 0)], [Vector3.Zero(), new Vector3(0, 0, 1)]],
    }, scene);
    axes.color = material.emissiveColor;
    axes.parent = marker;
    axes.isPickable = false;
    axes.doNotSerialize = true;
    markers.set(id, marker);
  }
  const update = () => {
    const camera = scene.activeCamera;
    for (const [id, marker] of markers) {
      const node = instance.nodes.get(id);
      const enabled = Boolean(node && !node.isDisposed() && node.isEnabled());
      marker.setEnabled(enabled);
      if (!enabled || !node) continue;
      const world = node.computeWorldMatrix(true);
      marker.position.copyFrom(world.getTranslation());
      // Parent scaling affects the authored assembly, never the size of the editor handle.
      world.decompose(undefined, marker.rotationQuaternion!);
      let size = .4;
      if (camera) {
        const height = Math.max(1, scene.getEngine().getRenderHeight() * camera.viewport.height);
        if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA && camera.orthoTop !== null && camera.orthoBottom !== null) {
          size = Math.abs(camera.orthoTop - camera.orthoBottom) * 22 / height;
        } else {
          const depth = Math.abs(Vector3.TransformCoordinates(marker.position, camera.getViewMatrix()).z);
          size = 2 * Math.max(camera.minZ, depth) * Math.tan(camera.fov / 2) * 22 / height;
        }
      }
      marker.scaling.setAll(Math.max(.001, size));
      marker.computeWorldMatrix(true);
    }
  };
  update();
  const observer = scene.onBeforeRenderObservable.add(update);
  let disposed = false;
  return {
    markers, update,
    setVisible(visible: boolean) { root.setEnabled(visible); },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.onBeforeRenderObservable.remove(observer);
      root.dispose(false, true);
      markers.clear();
    },
  };
}
