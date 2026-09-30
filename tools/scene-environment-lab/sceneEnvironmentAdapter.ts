import { DirectionalLight, PointLight, TransformNode } from '@babylonjs/core';
import { writeTransform } from '../../core/scene-editor/transform.ts';
import type { EditorTransform, SceneEditorAdapter, SceneEditorObject } from '../../core/scene-editor/types.ts';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset, SceneEnvironmentVector3, SceneEnvironmentLight } from '@/core/scene/sceneEnvironment.types';
import { environmentNodeEntries, orderedEnvironmentEntries } from '../../core/scene/sceneEnvironment.hierarchy.ts';
import { createEnvironmentMarkers } from './sceneEnvironmentMarkers.ts';
const tuple = (v: EditorTransform['position']): SceneEnvironmentVector3 => [v.x, v.y, v.z];
const radians = (v: EditorTransform['rotation']): SceneEnvironmentVector3 => [v.x * Math.PI / 180, v.y * Math.PI / 180, v.z * Math.PI / 180];
export type EnvironmentModelAssetProperties = {
  position: SceneEnvironmentVector3;
  rotation: SceneEnvironmentVector3;
  scaling: SceneEnvironmentVector3;
};
export function updateEnvironmentTransform(preset: SceneEnvironmentPreset, id: string, value: EditorTransform): SceneEnvironmentPreset {
  const [kind, ...parts] = id.split(':'); const key = parts.join(':');
  if (kind === 'transform') return { ...preset, transformNodes: (preset.transformNodes ?? []).map(o => o.id === key ? { ...o, position: tuple(value.position), rotation: radians(value.rotation), scaling: tuple(value.scaling) } : o) };
  if (kind === 'model') return { ...preset, models: preset.models.map(m => m.id === key ? { ...m, position: tuple(value.position), rotation: radians(value.rotation), scaling: tuple(value.scaling) } : m) };
  if (kind === 'object') return { ...preset, objects: preset.objects.map(o => o.id === key ? { ...o, position: tuple(value.position), rotation: radians(value.rotation), scaling: tuple(value.scaling) } : o) };
  if (kind === 'light') return { ...preset, lights: preset.lights.map(l => l.id !== key || l.light.primitive === 'hemispheric' ? l : { ...l, light: { ...l.light, position: tuple(value.position) } } as SceneEnvironmentLight) };
  return preset;
}
export function createEnvironmentAdapter(instance: SceneEnvironmentInstance, host: { read(): SceneEnvironmentPreset; write(value: SceneEnvironmentPreset): void; undo(): void; redo(): void }) {
  const markers = createEnvironmentMarkers(instance, host.read());
  const assetProperties = new Map((instance.models ?? []).map(({ definition, entity }) => [`model:${definition.id}`, entity.normalizationRoot]));
  const proxies = new Map<string, TransformNode>();
  for (const [id, node] of instance.nodes) if (node instanceof PointLight || node instanceof DirectionalLight) {
    const proxy = new TransformNode(`editor:${id}`, node.getScene()); proxy.parent = node.parent; proxy.position.copyFrom(node.position); proxies.set(id, proxy);
  }
  const objects = (): SceneEditorObject[] => {
    const p = host.read();
    const entries = orderedEnvironmentEntries(p);
    const declared: SceneEditorObject[] = [
      { id: 'scene', name: '场景配置', channels: [], parentId: null, node: instance.root, description: '场景', icon: '▤', draggable: false, acceptsChildren: false },
      ...entries.flatMap(({ id, definition }): SceneEditorObject[] => {
        const node = instance.nodes.get(id); if (!node) return [];
        const target = proxies.get(id) ?? (node instanceof TransformNode ? node : undefined);
        const light = 'light' in definition ? definition.light : undefined;
        const role = 'role' in definition ? definition.role : undefined;
        const description = id.startsWith('transform:') ? ({ empty: '空节点', rig: 'Rig', socket: 'Socket 挂点' }[role ?? 'empty'])
          : light ? ({ hemispheric: '半球光', directional: '方向光', point: '点光' }[light.primitive])
            : id.startsWith('model:') ? '模型' : '几何体';
        return [{ id, name: definition.name, parentId: definition.parentId ?? null, node, target,
          draggable: true, acceptsChildren: !light, pickNodes: markers.markers.has(id) ? [markers.markers.get(id)!] : undefined,
          channels: light ? light.primitive === 'hemispheric' ? [] : ['position'] : ['position', 'rotation', 'scaling'],
          readonly: false, description, icon: light ? '☼' : id.startsWith('transform:') ? role === 'empty' || !role ? '◇' : '✧' : '⬡' }];
      }),
    ];
    // The authoring tree contains declarations only, never the imported render graph.
    return declared;
  };
  const sync = () => {
    const p = host.read();
    const definitions = new Map(environmentNodeEntries(p).map(entry => [entry.id, entry.definition]));
    for (const object of objects()) {
      const definition = definitions.get(object.id);
      if (definition && !('light' in definition) && object.target) {
        const rotation = definition.rotation ?? [0, 0, 0]; const scale = 'scaling' in definition ? definition.scaling ?? [1, 1, 1] : [1, 1, 1];
        writeTransform(object.target, { position: { x: definition.position[0], y: definition.position[1], z: definition.position[2] }, rotation: { x: rotation[0] * 180 / Math.PI, y: rotation[1] * 180 / Math.PI, z: rotation[2] * 180 / Math.PI }, scaling: { x: scale[0], y: scale[1], z: scale[2] } });
      }
      const light = definition && 'light' in definition ? definition : undefined;
      if (light && light.light.primitive !== 'hemispheric' && object.target) {
        const position = light.light.position ?? (light.light.primitive === 'directional' ? light.light.direction.map(v => -v) as unknown as SceneEnvironmentVector3 : [0, 0, 0] as const);
        object.target.position.set(...position);
        (object.node as PointLight | DirectionalLight).position.copyFrom(object.target.position);
      }
    }
    markers.update();
  };
  const adapter: SceneEditorAdapter = {
    objects, sync,
    preview(edit, value) { const node = instance.nodes.get(edit.id); if (node instanceof PointLight || node instanceof DirectionalLight) node.position.set(value.position.x, value.position.y, value.position.z); },
    commit(edit, value) { host.write(updateEnvironmentTransform(host.read(), edit.id, value)); },
    undo() { host.undo(); sync(); }, redo() { host.redo(); sync(); },
  };
  return {
    adapter, setMarkersVisible: markers.setVisible,
    modelAssetProperties(id: string): EnvironmentModelAssetProperties | undefined {
      const node = assetProperties.get(id);
      if (!node || node.isDisposed()) return undefined;
      return { position: tuple(node.position), rotation: tuple(node.rotationQuaternion?.toEulerAngles() ?? node.rotation), scaling: tuple(node.scaling) };
    },
    dispose: () => { markers.dispose(); proxies.forEach(p => p.dispose()); },
  };
}
