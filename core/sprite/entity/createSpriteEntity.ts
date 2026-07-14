import { Vector3, type Mesh, type Scene } from '@babylonjs/core';
import type {
  NormalizedUv,
  SpriteAnchorPreset,
  SpritePresetSource
} from '@/core/sprite/types/sprite-anchors.types.ts';
import type { SpriteFrameRegion } from '@/core/sprite/types/sprite.types.ts';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
import { getSpriteAnchorPreset } from '@/core/sprite/preset/spritePresetRepository.ts';
import { toSpritePresetKey } from '@/core/sprite/preset/spritePresetKeys.ts';
import { getBodyAxisAlignedAnchorUv, uvToPlaneLocal } from '@/core/sprite/entity/anchors.ts';

export type SpriteEntity = {
  mesh: Mesh;
  texturePath: string;
  preset: SpriteAnchorPreset;
  frameRegion: SpriteFrameRegion | null;
  setFrameRegion: (frameRegion: SpriteFrameRegion | null) => void;
  getAnchorUv: (anchorName: keyof SpriteAnchorPreset['anchors']) => NormalizedUv;
  getAnchorWorldPosition: (anchorName: keyof SpriteAnchorPreset['anchors']) => Vector3;
  refreshPreset: () => SpriteAnchorPreset;
};

export const createSpriteEntity = (
  scene: Scene,
  texturePath: string,
  baseSize: number = 2.5,
  presetSource: SpritePresetSource = 'merged',
  frameRegion: SpriteFrameRegion | null = null
): SpriteEntity => {
  const iconPlane = createAtlasSpritePlane(scene, texturePath, baseSize);
  const mesh = iconPlane.mesh;
  iconPlane.setFrameRegion(frameRegion);
  let currentPreset = getSpriteAnchorPreset(texturePath, presetSource);

  return {
    mesh,
    texturePath: toSpritePresetKey(texturePath),
    preset: currentPreset,
    frameRegion,
    setFrameRegion(nextFrameRegion) {
      this.frameRegion = nextFrameRegion;
      iconPlane.setFrameRegion(nextFrameRegion);
    },
    getAnchorUv(anchorName) {
      return getBodyAxisAlignedAnchorUv(currentPreset, anchorName);
    },
    getAnchorWorldPosition(anchorName) {
      const uv = getBodyAxisAlignedAnchorUv(currentPreset, anchorName);
      const localPos = uvToPlaneLocal(mesh, uv);
      return Vector3.TransformCoordinates(localPos, mesh.getWorldMatrix());
    },
    refreshPreset() {
      currentPreset = getSpriteAnchorPreset(texturePath, presetSource);
      this.preset = currentPreset;
      return currentPreset;
    }
  };
};
