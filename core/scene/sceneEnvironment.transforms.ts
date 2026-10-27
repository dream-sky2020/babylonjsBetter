import { DirectionalLight, PointLight, TransformNode } from '@babylonjs/core';
import type { EditorTransform } from '../scene-editor/types.ts';
import { writeTransform } from '../scene-editor/transform.ts';
import { environmentNodeEntries } from './sceneEnvironment.hierarchy.ts';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset, SceneEnvironmentVector3, SceneEnvironmentLight } from './sceneEnvironment.types.ts';

const tuple = (v: EditorTransform['position']): SceneEnvironmentVector3 => [v.x, v.y, v.z];
const radians = (v: EditorTransform['rotation']): SceneEnvironmentVector3 => [v.x * Math.PI / 180, v.y * Math.PI / 180, v.z * Math.PI / 180];
/** Shared authored-data write boundary. Preview nodes are never a source of preset state. */
export function updateEnvironmentTransform(preset: SceneEnvironmentPreset, id: string, value: EditorTransform): SceneEnvironmentPreset {
  const [kind, ...parts] = id.split(':'); const key = parts.join(':');
  if (kind === 'transform') return { ...preset, transformNodes: (preset.transformNodes ?? []).map(o => o.id === key ? { ...o, position: tuple(value.position), rotation: radians(value.rotation), scaling: tuple(value.scaling) } : o) };
  if (kind === 'model') return { ...preset, models: preset.models.map(m => m.id === key ? { ...m, position: tuple(value.position), rotation: radians(value.rotation), scaling: tuple(value.scaling) } : m) };
  if (kind === 'object') return { ...preset, objects: preset.objects.map(o => o.id === key ? { ...o, position: tuple(value.position), rotation: radians(value.rotation), scaling: tuple(value.scaling) } : o) };
  if (kind === 'light') return { ...preset, lights: preset.lights.map(l => l.id !== key || l.light.primitive === 'hemispheric' ? l : { ...l, light: { ...l.light, position: tuple(value.position) } } as SceneEnvironmentLight) };
  return preset;
}
export function readEnvironmentTransform(preset: SceneEnvironmentPreset, id: string): EditorTransform {
  const entry = environmentNodeEntries(preset).find(entry => entry.id === id);
  if (!entry) throw new Error(`场景声明不存在：${id}`);
  const definition = entry.definition;
  let position: readonly number[] = [0, 0, 0], rotation: readonly number[] = [0, 0, 0], scaling: readonly number[] = [1, 1, 1];
  if ('light' in definition) {
    if (definition.light.primitive === 'point') position = definition.light.position;
    else if (definition.light.primitive === 'directional') position = definition.light.position ?? definition.light.direction.map(value => -value);
  } else { position = definition.position; rotation = definition.rotation ?? rotation; scaling = definition.scaling ?? scaling; }
  return { position: { x: position[0], y: position[1], z: position[2] },
    rotation: { x: rotation[0] * 180 / Math.PI, y: rotation[1] * 180 / Math.PI, z: rotation[2] * 180 / Math.PI },
    scaling: { x: scaling[0], y: scaling[1], z: scaling[2] } };
}
export function syncEnvironmentTransform(instance: SceneEnvironmentInstance, id: string, value: EditorTransform, proxy?: TransformNode) {
  const node = instance.nodes.get(id);
  if (!node || node.isDisposed()) return;
  if (node instanceof TransformNode) writeTransform(node, value);
  if (proxy && !proxy.isDisposed()) writeTransform(proxy, value);
  if (node instanceof PointLight || node instanceof DirectionalLight) node.position.set(value.position.x, value.position.y, value.position.z);
}
