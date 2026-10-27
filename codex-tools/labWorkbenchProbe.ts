import { EngineStore, Matrix, Vector3, UtilityLayerRenderer } from '@babylonjs/core';
const scene = () => EngineStore.Instances.flatMap(engine => engine.scenes).find(value => !value.isDisposed)!;
export function visualObjectsSnapshot() {
  const current = scene();
  const transform = (node: import('@babylonjs/core').TransformNode) => ({ position: node.position.asArray(), rotation: (node.rotationQuaternion?.toEulerAngles() ?? node.rotation).asArray(), scaling: node.scaling.asArray() });
  return { ready: current.isReady(), objects: current.transformNodes.filter(node => node.metadata?.monsterVisualObjectId && !node.metadata.monsterVisualLayer).map(root => ({
    id: root.metadata.monsterVisualObjectId as string, name: root.name, enabled: root.isEnabled(), transform: transform(root),
    layers: current.transformNodes.filter(node => node.metadata?.monsterVisualObjectId === root.metadata.monsterVisualObjectId && node.metadata.monsterVisualLayer).map(node => ({
      key: node.metadata.monsterVisualLayer as string, uniqueId: node.uniqueId, enabled: node.isEnabled(), transform: transform(node), meshCount: node.getChildMeshes().length,
      spriteRotation: node.getChildMeshes()[0]?.rotation.asArray(),
    })),
  })), environmentRoots: current.rootNodes.filter(node => node.name.startsWith('scene_environment_')).length };
}
export function monsterDissolveSnapshot() {
  const current = scene();
  return { ...visualObjectsSnapshot(), particles: current.particleSystems.map(system => ({ name: system.name, updateSpeed: system.updateSpeed,
    emitterParent: (system.emitter as import('@babylonjs/core').Mesh)?.parent?.name })),
    layers: current.transformNodes.filter(node => node.metadata?.monsterVisualLayer).map(node => {
      const mesh = node.getChildMeshes().find(mesh => mesh.material), material = mesh?.material as import('@babylonjs/core').ShaderMaterial;
      const floats = (material as unknown as { _floats?: Record<string, number> })?._floats;
      return { id: node.metadata.monsterVisualObjectId as string, key: node.metadata.monsterVisualLayer as string, enabled: node.isEnabled(),
        opacity: floats?.uSpriteOpacity ?? 1, dissolve: floats?.uMySpriteNoiseErodeEnabled ?? 0, progress: floats?.uMySpriteNoiseErodeProgress ?? 0, vertices: mesh?.getTotalVertices(), uniqueId: mesh?.uniqueId };
    }) };
}
export function pointForMonster(id: string) {
  const current = scene(), node = current.getTransformNodeByName(`movementAnchor_${id}`)!;
  const bounds = node.getHierarchyBoundingVectors(true), center = bounds.min.add(bounds.max).scale(.5);
  const engine = current.getEngine(), canvas = engine.getRenderingCanvas()!, rect = canvas.getBoundingClientRect();
  const projected = Vector3.Project(center, Matrix.Identity(), current.getTransformMatrix(), current.activeCamera!.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
  return { x: Math.round(rect.left + projected.x * rect.width / engine.getRenderWidth()), y: Math.round(rect.top + projected.y * rect.height / engine.getRenderHeight()) };
}
export function frameForMonster(id: string) {
  const current = scene(), node = current.getTransformNodeByName(`movementAnchor_${id}`)!;
  const { min, max } = node.getHierarchyBoundingVectors(true), engine = current.getEngine();
  const viewport = current.activeCamera!.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const points = [min.x, max.x].flatMap(x => [min.y, max.y].flatMap(y => [min.z, max.z].map(z =>
    Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), current.getTransformMatrix(), viewport))));
  return { left: Math.min(...points.map(p => p.x)) / engine.getRenderWidth(), right: Math.max(...points.map(p => p.x)) / engine.getRenderWidth(),
    top: Math.min(...points.map(p => p.y)) / engine.getRenderHeight(), bottom: Math.max(...points.map(p => p.y)) / engine.getRenderHeight() };
}
export function snapshot(id: string) {
  const current = scene(), node = current.getTransformNodeByName(`movementAnchor_${id}`);
  return { enabled: node?.isEnabled(), roots: current.rootNodes.length,
    environmentEnabled: current.rootNodes.filter(root => root.name.startsWith('scene_environment_')).map(root => root.isEnabled()),
    camera: current.activeCamera?.position.asArray(),
    layers: current.meshes.filter(mesh => mesh.name.startsWith(`placement_${id}_`)).length,
    selectedRoots: current.rootNodes.filter(node => node.name.startsWith('monsterFormation')).length };
}
export function viewportSnapshot() {
  const current = scene(), engine = current.getEngine(), canvas = engine.getRenderingCanvas()!;
  return { sceneId: current.uid, frameId: current.getFrameId(), width: engine.getRenderWidth(), height: engine.getRenderHeight(),
    bounds: canvas.getBoundingClientRect().toJSON() };
}
export function sceneObjectTransform(name: string) {
  const node = scene().getNodeByName(name) as import('@babylonjs/core').TransformNode;
  if (!node) throw new Error(`Missing scene node: ${name}`);
  return { position: node.position.asArray(), rotation: (node.rotationQuaternion?.toEulerAngles() ?? node.rotation).asArray(), scaling: node.scaling.asArray() };
}
/** Read-only projection of the visible red translation handle for native-pointer regression. */
export function translationHandle() {
  const current = scene(), engine = current.getEngine(), rect = engine.getRenderingCanvas()!.getBoundingClientRect();
  const utilities = [UtilityLayerRenderer._DefaultUtilityLayer, UtilityLayerRenderer._DefaultKeepDepthUtilityLayer].filter(layer => layer && layer.originalScene === current).map(layer => layer!.utilityLayerScene);
  for (const utility of utilities) {
    const mesh = utility.meshes.find(mesh => {
      const color = (mesh.material as import('@babylonjs/core').StandardMaterial)?.diffuseColor;
      return mesh.name === 'cylinder' && mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && color && color.r > color.g + .2 && color.r > color.b + .2;
    });
    if (!mesh) continue;
    mesh.computeWorldMatrix(true);
    const project = (value: Vector3) => Vector3.Project(value, Matrix.Identity(), utility.getTransformMatrix(), current.activeCamera!.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    const point = project(mesh.getBoundingInfo().boundingBox.centerWorld);
    const origin = project(mesh.parent!.getWorldMatrix().getTranslation());
    const dx = point.x - origin.x, dy = point.y - origin.y, length = Math.hypot(dx, dy) || 1;
    return { x: Math.round(rect.left + point.x), y: Math.round(rect.top + point.y),
      toX: Math.round(rect.left + point.x + dx / length * 40), toY: Math.round(rect.top + point.y + dy / length * 40) };
  }
  return null;
}
