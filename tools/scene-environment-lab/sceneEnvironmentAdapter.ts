import { DirectionalLight, PointLight, TransformNode } from '@babylonjs/core';
import { writeTransform } from '../../core/scene-editor/transform.ts';
import type { EditorTransform, SceneEditorAdapter, SceneEditorObject } from '../../core/scene-editor/types.ts';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset, SceneEnvironmentVector3, SceneEnvironmentLight } from '@/core/scene/sceneEnvironment.types';
const tuple = (v: EditorTransform['position']): SceneEnvironmentVector3 => [v.x, v.y, v.z];
const radians = (v: EditorTransform['rotation']): SceneEnvironmentVector3 => [v.x * Math.PI / 180, v.y * Math.PI / 180, v.z * Math.PI / 180];
export function updateEnvironmentTransform(preset: SceneEnvironmentPreset, id: string, value: EditorTransform): SceneEnvironmentPreset {
  const [kind, ...parts] = id.split(':'); const key = parts.join(':');
  if (kind === 'model') return { ...preset, models: preset.models.map(m => m.id === key ? { ...m, position: tuple(value.position), rotation: radians(value.rotation), scaling: tuple(value.scaling) } : m) };
  if (kind === 'object') return { ...preset, objects: preset.objects.map(o => o.id === key ? { ...o, position: tuple(value.position), rotation: radians(value.rotation) } : o) };
  if (kind === 'light') return { ...preset, lights: preset.lights.map(l => l.id !== key || l.light.primitive === 'hemispheric' ? l : { ...l, light: { ...l.light, position: tuple(value.position) } } as SceneEnvironmentLight) };
  return preset;
}
export function createEnvironmentAdapter(instance: SceneEnvironmentInstance, host: { read(): SceneEnvironmentPreset; write(value: SceneEnvironmentPreset): void; undo(): void; redo(): void }) {
  const proxies = new Map<string, TransformNode>();
  for (const [id, node] of instance.nodes) if (node instanceof PointLight || node instanceof DirectionalLight) {
    const proxy = new TransformNode(`editor:${id}`, node.getScene()); proxy.parent = instance.root; proxy.position.copyFrom(node.position); proxies.set(id, proxy);
  }
  const objects = (): SceneEditorObject[] => {
    const p = host.read();
    return [
      { id: 'scene', name: '场景配置', channels: [] as const, definition: p },
      ...p.objects.map(o => ({ id: `object:${o.id}`, name: o.name, channels: ['position', 'rotation'] as const, definition: o })),
      ...p.models.map(o => ({ id: `model:${o.id}`, name: o.name, channels: ['position', 'rotation', 'scaling'] as const, definition: o })),
      ...p.lights.map(o => ({ id: `light:${o.id}`, name: o.name, channels: o.light.primitive === 'hemispheric' ? [] : ['position'] as const, definition: o })),
    ].flatMap(o => {
      const node = o.id === 'scene' ? instance.root : instance.nodes.get(o.id); if (!node) return [];
      const target = proxies.get(o.id) ?? (node instanceof TransformNode ? node : undefined);
      return [{ id: o.id, name: o.name, parentId: null, node, target, channels: o.channels, readonly: false, description: '场景预设 · 显式保存' }];
    });
  };
  const sync = () => {
    const p = host.read();
    for (const object of objects()) {
      const definition = object.id.startsWith('object:') ? p.objects.find(o => `object:${o.id}` === object.id) : p.models.find(o => `model:${o.id}` === object.id);
      if (definition && object.target) {
        const rotation = definition.rotation ?? [0, 0, 0]; const scale = 'scaling' in definition ? definition.scaling ?? [1, 1, 1] : [1, 1, 1];
        writeTransform(object.target, { position: { x: definition.position[0], y: definition.position[1], z: definition.position[2] }, rotation: { x: rotation[0] * 180 / Math.PI, y: rotation[1] * 180 / Math.PI, z: rotation[2] * 180 / Math.PI }, scaling: { x: scale[0], y: scale[1], z: scale[2] } });
      }
      const light = p.lights.find(l => `light:${l.id}` === object.id);
      if (light && light.light.primitive !== 'hemispheric' && object.target) {
        const position = light.light.position ?? (light.light.primitive === 'directional' ? light.light.direction.map(v => -v) as unknown as SceneEnvironmentVector3 : [0, 0, 0] as const);
        object.target.position.set(...position);
        (object.node as PointLight | DirectionalLight).position.copyFrom(object.target.position);
      }
    }
  };
  const adapter: SceneEditorAdapter = {
    objects, sync,
    preview(edit, value) { const node = instance.nodes.get(edit.id); if (node instanceof PointLight || node instanceof DirectionalLight) node.position.set(value.position.x, value.position.y, value.position.z); },
    commit(edit, value) { host.write(updateEnvironmentTransform(host.read(), edit.id, value)); },
    undo() { host.undo(); sync(); }, redo() { host.redo(); sync(); },
  };
  return { adapter, dispose: () => proxies.forEach(p => p.dispose()) };
}
