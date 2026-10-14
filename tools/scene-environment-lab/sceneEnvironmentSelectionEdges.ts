import { Color3, MeshBuilder, Vector3, type AbstractMesh, type LinesMesh, type Scene } from '@babylonjs/core';

/** Independent world-space selection bounds also work for hardware instances without highlighting their siblings. */
export function createEnvironmentSelectionEdges(scene: Scene, resolve: (id: string) => readonly AbstractMesh[]) {
  const boxes = new Map<string, { line: LinesMesh; meshes: readonly AbstractMesh[]; signature: string }>();
  const corners = (min: Vector3, max: Vector3) => Array.from({ length: 8 }, (_, i) => new Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z));
  const lines = (min: Vector3, max: Vector3) => { const points = corners(min, max); return points.flatMap((point, i) => [1, 2, 4].filter(bit => !(i & bit)).map(bit => [point, points[i | bit]])); };
  const update = () => {
    for (const box of boxes.values()) {
      const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
      let found = false;
      for (const mesh of box.meshes) {
        if (mesh.isDisposed() || !mesh.isEnabled() || !mesh.getTotalVertices()) continue;
        mesh.computeWorldMatrix();
        const bounds = mesh.getBoundingInfo().boundingBox;
        min.minimizeInPlace(bounds.minimumWorld); max.maximizeInPlace(bounds.maximumWorld); found = true;
      }
      box.line.setEnabled(found);
      if (!found) continue;
      const signature = [...min.asArray(), ...max.asArray()].join(',');
      if (signature !== box.signature) { MeshBuilder.CreateLineSystem(box.line.name, { lines: lines(min, max), instance: box.line }); box.signature = signature; }
    }
  };
  const observer = scene.onBeforeRenderObservable.add(update);
  return {
    set(ids: readonly string[], visible: boolean) {
      const wanted = new Set(visible ? ids : []);
      for (const [id, box] of boxes) if (!wanted.has(id)) { box.line.dispose(); boxes.delete(id); }
      for (const id of wanted) {
        const meshes = resolve(id).filter(mesh => !mesh.isDisposed() && mesh.getTotalVertices());
        if (!meshes.length) continue;
        const existing = boxes.get(id);
        if (existing) { existing.meshes = meshes; continue; }
        const line = MeshBuilder.CreateLineSystem(`editor:selection:${id}`, { lines: lines(Vector3.Zero(), Vector3.One()), updatable: true }, scene);
        line.color = Color3.FromHexString('#ffd166'); line.isPickable = false; line.renderingGroupId = 3;
        boxes.set(id, { line, meshes, signature: '' });
      }
      update();
    },
    dispose() { scene.onBeforeRenderObservable.remove(observer); boxes.forEach(box => box.line.dispose()); boxes.clear(); },
  };
}
