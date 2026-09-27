import { withReadOnlyDescendants } from '../../core/scene-editor/readOnlyHierarchy.ts';
import type { SceneEditorAdapter, SceneEditorObject, EditorTransform } from '../../core/scene-editor/types.ts';
import { writeTransform } from '../../core/scene-editor/transform.ts';
import type { AnimationProject, WeaponHand } from '@/core/model/preset/firstPersonWeaponPreset.ts';
import type { WeaponLabRuntime } from './useWeaponSlot.ts';
export type WeaponEditTarget = 'pose' | 'asset' | 'proxy' | 'grip' | 'attack' | 'muzzle';
export function weaponTransform(project: AnimationProject, hand: WeaponHand, target: WeaponEditTarget, frameId: string): EditorTransform {
  const track = project.weapons[hand];
  if (target === 'pose') { const f = track.keyframes.find(f => f.id === frameId) ?? track.keyframes[0]; return { position: f.position, rotation: f.rotation, scaling: { x: 1, y: 1, z: 1 } }; }
  if (target === 'asset') return { position: track.asset.offset, rotation: track.asset.rotation, scaling: { x: track.asset.scale, y: track.asset.scale, z: track.asset.scale } };
  if (target === 'muzzle') return { position: track.proxy.muzzle.position, rotation: track.proxy.muzzle.rotation, scaling: { x: 1, y: 1, z: 1 } };
  const volume = target === 'proxy' ? track.proxy : track.proxy[target === 'grip' ? 'gripVolume' : 'attackVolume'];
  return { position: volume.center, rotation: volume.rotation, scaling: volume.size };
}
export function updateWeaponTransform(project: AnimationProject, hand: WeaponHand, target: WeaponEditTarget, frameId: string, value: EditorTransform): AnimationProject {
  const track = project.weapons[hand]; const { position, rotation } = value;
  const size = Object.fromEntries(Object.entries(value.scaling).map(([axis, n]) => [axis, Math.max(.001, Math.abs(n))])) as EditorTransform['scaling'];
  const next = target === 'pose' ? { ...track, keyframes: track.keyframes.map(f => f.id === frameId ? { ...f, position, rotation } : f) }
    : target === 'asset' ? { ...track, asset: { ...track.asset, offset: position, rotation, scale: size.x } }
    : target === 'proxy' ? { ...track, proxy: { ...track.proxy, center: position, rotation, size } }
    : target === 'muzzle' ? { ...track, proxy: { ...track.proxy, muzzle: { ...track.proxy.muzzle, position, rotation } } }
    : { ...track, proxy: { ...track.proxy, [target === 'grip' ? 'gripVolume' : 'attackVolume']: { ...track.proxy[target === 'grip' ? 'gripVolume' : 'attackVolume'], center: position, rotation, size } } };
  return { ...project, weapons: { ...project.weapons, [hand]: next } };
}
export function createWeaponSceneAdapter(runtime: WeaponLabRuntime, host: {
  read(): AnimationProject; write(project: AnimationProject): void; frameId(hand: WeaponHand): string;
  editable(): boolean; select(hand: WeaponHand, target: WeaponEditTarget): void; undo(): void; redo(): void;
}): SceneEditorAdapter {
  const resolve = (id: string) => id.split(':') as [WeaponHand, WeaponEditTarget];
  const objects = (): SceneEditorObject[] => (['right', 'left'] as const).flatMap(hand => {
    const slot = runtime.slots[hand]; const track = host.read().weapons[hand];
    return ([['pose', slot.weaponPose, '动画姿态'], ['asset', slot.weaponAsset, '模型安装'], ['proxy', slot.proxyAnchor, '代理体'], ['grip', slot.gripAnchor, '持握体'], ['attack', slot.attackAnchor, '攻击体'], ['muzzle', slot.muzzleAnchor, '发射端']] as const).map(([target, node, name]) => ({
      id: `${hand}:${target}`, parentId: target === 'pose' ? null : `${hand}:pose`, name: `${hand === 'right' ? '右手' : '左手'} · ${name}`, node, target: node,
      channels: target === 'pose' || target === 'muzzle' ? ['position', 'rotation'] : ['position', 'rotation', 'scaling'], minScale: .0001, uniformScale: target === 'asset',
      readonly: !track.enabled || (target === 'grip' && !track.proxy.gripVolume.enabled) || (target === 'attack' && !track.proxy.attackVolume.enabled) || (target === 'muzzle' && !track.proxy.muzzle.enabled),
      description: target === 'pose' ? '所选关键帧' : '武器预设',
    }));
  });
  return {
    objects: () => withReadOnlyDescendants(objects()), canEdit: () => host.editable(),
    select(id) { if (id && !id.includes('/render:')) host.select(...resolve(id)); },
    sync(id) { const [hand, target] = resolve(id); const object = objects().find(o => o.id === id); if (object) writeTransform(object.target!, weaponTransform(host.read(), hand, target, host.frameId(hand))); },
    commit(edit, value) { if (!host.editable()) return; const [hand, target] = resolve(edit.id); host.write(updateWeaponTransform(host.read(), hand, target, host.frameId(hand), value)); },
    undo: host.undo, redo: host.redo,
  };
}
