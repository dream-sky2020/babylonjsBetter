import { Color3, Color4, Vector3, type ParticleSystem } from '@babylonjs/core';
import type { SpriteAshPreset } from '@/core/sprite/ash/spriteAsh.types.ts';

export type SpriteDeathParticleProfile = (
  system: ParticleSystem,
  preset: SpriteAshPreset,
  minEmitBox: Vector3,
  maxEmitBox: Vector3
) => void;

export const particleColor = (hex: string, alpha = 1): Color4 => {
  const value = Color3.FromHexString(hex);
  return new Color4(value.r, value.g, value.b, alpha);
};

/** 将以“90°向上”为基准的 2D 粒子运动向量旋转到消散方向。 */
export const rotateParticleMotion = (vector: Vector3, directionAngleDeg: number): Vector3 => {
  const radians = (directionAngleDeg - 90) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return new Vector3(
    vector.x * cos - vector.y * sin,
    vector.x * sin + vector.y * cos,
    vector.z
  );
};
