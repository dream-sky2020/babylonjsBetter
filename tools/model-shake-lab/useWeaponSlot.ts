import { useEffect, useState, type RefObject } from 'react';
import { Color3, Quaternion, type ArcRotateCamera, type Engine, type Scene, type TransformNode, type UniversalCamera } from '@babylonjs/core';
import { createModelEntity, type ModelEntity } from '@/core/model';
import type { WeaponHand, WeaponTrack } from '@/core/model/preset/firstPersonWeaponPreset.ts';
import { createWeaponProxyDebug } from './weaponProxyDebug.ts';

export type WeaponLabRuntime = {
  engine: Engine; scene: Scene; firstPersonCamera: UniversalCamera; orbitCamera: ArcRotateCamera;
  viewmodelRoot: TransformNode;
  slots: Record<WeaponHand, { weaponPose: TransformNode; weaponAsset: TransformNode; proxyAnchor: TransformNode; gripAnchor: TransformNode; attackAnchor: TransformNode; muzzleAnchor: TransformNode }>;
};

/** Each hand owns its own async model generation and debug lifecycle. */
export function useWeaponSlot(runtimeRef: RefObject<WeaponLabRuntime | null>, hand: WeaponHand, track: WeaponTrack, showProxy: boolean, showMarkers: boolean, setStatus: (message: string) => void) {
  const [loading, setLoading] = useState(false);
  const name = hand === 'right' ? '右手' : '左手';
  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return;
    const slot = runtime.slots[hand]; const { asset } = track;
    slot.weaponPose.setEnabled(track.enabled);
    slot.weaponAsset.position.set(asset.offset.x, asset.offset.y, asset.offset.z);
    slot.weaponAsset.scaling.setAll(asset.scale);
    slot.weaponAsset.rotationQuaternion = Quaternion.FromEulerAngles(asset.rotation.x * Math.PI / 180, asset.rotation.y * Math.PI / 180, asset.rotation.z * Math.PI / 180);
    const setAnchor = (node: TransformNode, position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, size = { x: 1, y: 1, z: 1 }) => {
      node.position.set(position.x, position.y, position.z); node.rotationQuaternion = Quaternion.FromEulerAngles(rotation.x * Math.PI / 180, rotation.y * Math.PI / 180, rotation.z * Math.PI / 180); node.scaling.set(size.x, size.y, size.z);
    };
    setAnchor(slot.proxyAnchor, track.proxy.center, track.proxy.rotation, track.proxy.size);
    setAnchor(slot.gripAnchor, track.proxy.gripVolume.center, track.proxy.gripVolume.rotation, track.proxy.gripVolume.size);
    setAnchor(slot.attackAnchor, track.proxy.attackVolume.center, track.proxy.attackVolume.rotation, track.proxy.attackVolume.size);
    setAnchor(slot.muzzleAnchor, track.proxy.muzzle.position, track.proxy.muzzle.rotation);
  }, [runtimeRef, hand, track]);
  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime || !track.enabled) return;
    return createWeaponProxyDebug(runtime.scene, runtime.slots[hand].weaponPose, track.proxy, showProxy, showMarkers, name,
      hand === 'right' ? new Color3(.2, .8, .9) : new Color3(.75, .45, 1));
  }, [runtimeRef, hand, name, track.proxy, track.enabled, showProxy, showMarkers]);
  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return;
    let cancelled = false; let owned: ModelEntity | null = null;
    queueMicrotask(() => { if (!cancelled) setLoading(track.enabled && Boolean(track.asset.path)); });
    if (track.enabled && track.asset.path) {
      void createModelEntity(runtime.scene, track.asset.path).then(entity => {
        if (cancelled || runtimeRef.current !== runtime) { entity.dispose(); return; }
        owned = entity; entity.root.parent = runtime.slots[hand].weaponAsset; entity.stopAnimations();
        setLoading(false); setStatus(name + '模型已挂载 · 继承项目级规范化');
      }).catch(error => { if (!cancelled) { setLoading(false); setStatus(name + '模型加载失败：' + String(error)); } });
    }
    return () => { cancelled = true; owned?.dispose(); };
  }, [runtimeRef, hand, name, track.asset.path, track.enabled, setStatus]);
  return loading;
}
