import { Color3, Color4, type ParticleSystem, type Vector3 } from '@babylonjs/core';
import type { SpriteAshPreset } from '@/core/sprite/ash/spriteAsh.types.ts';

export type SpriteDeathParticleProfile = (
  system: ParticleSystem,
  preset: SpriteAshPreset,
  minEmitBox: Vector3,
  maxEmitBox: Vector3
) => number;

export const particleColor = (hex: string, alpha = 1): Color4 => {
  const value = Color3.FromHexString(hex);
  return new Color4(value.r, value.g, value.b, alpha);
};
