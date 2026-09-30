import type { SceneEnvironmentLight, SceneEnvironmentModel, SceneEnvironmentObject, SceneEnvironmentPreset } from '@/core/scene/sceneEnvironment.types';
import { environmentAppendOrder, normalizeEnvironmentOrder } from '../../core/scene/sceneEnvironment.hierarchy.ts';

export type EnvironmentObjectKind = 'empty' | 'rig' | 'socket' | 'ground' | 'box' | 'cylinder' | 'model' | 'hemispheric' | 'directional' | 'point';

const labels: Record<EnvironmentObjectKind, string> = {
  empty: '空节点', rig: 'Rig', socket: 'Socket 挂点',
  ground: '地面', box: '方盒', cylinder: '圆柱', model: '模型',
  hemispheric: '半球光', directional: '方向光', point: '点光',
};

export function addEnvironmentObject(preset: SceneEnvironmentPreset, kind: EnvironmentObjectKind, modelPath?: string, parentId: string | null = null): { preset: SceneEnvironmentPreset; selectedId: string } {
  preset = normalizeEnvironmentOrder(preset);
  const existing = new Set([...(preset.transformNodes ?? []), ...preset.objects, ...preset.models, ...preset.lights].map(item => item.id));
  const idPrefix = `added-${kind}`;
  let number = 1;
  while (existing.has(`${idPrefix}-${number}`)) number++;
  const id = `${idPrefix}-${number}`;
  const name = `${labels[kind]} ${number}`;
  const order = environmentAppendOrder(preset, parentId);
  if (kind === 'empty' || kind === 'rig' || kind === 'socket') {
    return { preset: { ...preset, transformNodes: [...(preset.transformNodes ?? []), { id, name, role: kind, parentId, order, position: [0, 0, 0] }] }, selectedId: `transform:${id}` };
  }
  if (kind === 'model') {
    if (!modelPath || !/\.(?:glb|gltf)$/i.test(modelPath)) throw new Error('请选择 GLB 或 GLTF 模型文件');
    const fileName = decodeURIComponent(modelPath.split('/').pop() ?? '').replace(/\.(?:glb|gltf)$/i, '');
    const model: SceneEnvironmentModel = { id, parentId, order, name: `${fileName} ${number}`, modelPath: modelPath.replace(/^\/+/, ''), position: [0, 0, 0], scaling: [1, 1, 1] };
    return { preset: { ...preset, models: [...preset.models, model] }, selectedId: `model:${id}` };
  }
  if (kind === 'ground' || kind === 'box' || kind === 'cylinder') {
    const geometry = kind === 'ground' ? { primitive: 'ground' as const, width: 10, height: 10 }
      : kind === 'box' ? { primitive: 'box' as const, width: 1, height: 1, depth: 1 }
        : { primitive: 'cylinder' as const, height: 1, diameterTop: 1, diameterBottom: 1, tessellation: 24 };
    const object: SceneEnvironmentObject = { id, parentId, order, name, geometry, position: [0, kind === 'ground' ? 0 : 0.5, 0], color: '#b8c4d2' };
    return { preset: { ...preset, objects: [...preset.objects, object] }, selectedId: `object:${id}` };
  }
  const base = { id, parentId, order, name, intensity: 1, color: '#ffffff' };
  const light: SceneEnvironmentLight = kind === 'hemispheric'
    ? { ...base, light: { primitive: 'hemispheric', direction: [0, 1, 0], groundColor: '#303840' } }
    : kind === 'directional'
      ? { ...base, light: { primitive: 'directional', direction: [-0.5, -1, -0.5], position: [5, 10, 5] } }
      : { ...base, light: { primitive: 'point', position: [0, 3, 0], range: 20 } };
  return { preset: { ...preset, lights: [...preset.lights, light] }, selectedId: `light:${id}` };
}
