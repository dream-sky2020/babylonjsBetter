import type { ModelAssetProfile, ModelEntity } from '@/core/model';
import { writeTransform } from '../../core/scene-editor/transform.ts';
import type { EditorTransform, SceneEditorAdapter, SceneEditorObject } from '../../core/scene-editor/types.ts';
export type ComparisonTransform = { position: EditorTransform['position']; rotationDeg: EditorTransform['rotation']; scale: number };
export type NormalizationInstance = { id: number; path: string; entity: ModelEntity; comparison: ComparisonTransform };
export function profileTransform(profile: ModelAssetProfile): EditorTransform {
  return { position: profile.positionOffset, rotation: profile.rotationDeg, scaling: { x: profile.uniformScale, y: profile.uniformScale, z: profile.uniformScale } };
}
export function profileFromTransform(profile: ModelAssetProfile, value: EditorTransform): ModelAssetProfile {
  return { ...profile, positionOffset: value.position, rotationDeg: value.rotation, uniformScale: Math.max(.0001, value.scaling.x) };
}
export function createNormalizationSceneAdapter(host: {
  instances(): NormalizationInstance[]; profile(path: string): ModelAssetProfile;
  writeProfile(path: string, value: ModelAssetProfile): void; writeComparison(id: number, value: ComparisonTransform): void;
  select(id: number | null): void; undo(): void; redo(): void;
}): SceneEditorAdapter {
  const find = (id: string) => host.instances().find(i => i.id === Number(id.split(':')[0]));
  return {
    objects: () => host.instances().flatMap((item): SceneEditorObject[] => [
      { id: `${item.id}:instance`, parentId: null, name: `${item.path.split('/').pop()} #${item.id}`, node: item.entity.root, target: item.entity.root, channels: ['position', 'rotation', 'scaling'], minScale: .0001, uniformScale: true, description: '临时对比 · 不保存' },
      { id: `${item.id}:profile`, parentId: `${item.id}:instance`, name: '资产 Profile 校准', node: item.entity.normalizationRoot, target: item.entity.normalizationRoot, channels: ['position', 'rotation', 'scaling'], spaces: ['local'], minScale: .0001, uniformScale: true, description: '资产校准 · 保存到 Profile' },
    ]),
    select: id => host.select(id ? Number(id.split(':')[0]) : null),
    sync(id) { const item = find(id); if (!item) return;
      if (id.endsWith(':profile')) writeTransform(item.entity.normalizationRoot, profileTransform(host.profile(item.path)));
      else writeTransform(item.entity.root, { position: item.comparison.position, rotation: item.comparison.rotationDeg, scaling: { x: item.comparison.scale, y: item.comparison.scale, z: item.comparison.scale } });
    },
    commit(edit, value) { const item = find(edit.id); if (!item) return;
      if (edit.id.endsWith(':profile')) host.writeProfile(item.path, profileFromTransform(host.profile(item.path), value));
      else host.writeComparison(item.id, { position: value.position, rotationDeg: value.rotation, scale: Math.max(.0001, value.scaling.x) });
    },
    undo: host.undo, redo: host.redo,
  };
}
