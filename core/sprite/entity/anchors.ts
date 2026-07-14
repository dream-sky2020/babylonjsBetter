import { Vector3 } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import type { NormalizedUv, SpriteAnchorPreset } from '@/core/sprite/types/sprite-anchors.types.ts';

export const uvToNormalizedAnchor = (uv: NormalizedUv): Vector3 => {
  return new Vector3(uv.u * 2 - 1, 1 - uv.v * 2, 0);
};

export const getBodyAxisAlignedAnchorUv = (
  preset: SpriteAnchorPreset,
  anchorName: keyof SpriteAnchorPreset['anchors']
): NormalizedUv => {
  const anchor = preset.anchors[anchorName];
  return {
    u: anchor.u,
    v: anchor.v
  };
};

export const uvToPlaneLocal = (_mesh: Mesh, uv: NormalizedUv): Vector3 => {
  return new Vector3(uv.u - 0.5, 0.5 - uv.v, 0);
};
