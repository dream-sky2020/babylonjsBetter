import type { MonsterDeathParameterValues, MonsterDeathVisualDefinition } from '@/core/monster-death-motion/types.ts';
import type { SpriteAshPreset } from '@/core/sprite/ash/spriteAsh.types.ts';
import type { SpriteNoiseErodeOptions } from '@/core/sprite/shader/modules/noiseErode.module.ts';

const numberValue = (values: MonsterDeathParameterValues, key: string, fallback: number): number => {
  const value = Number(values[key]);
  return Number.isFinite(value) ? value : fallback;
};

export const resolveSpriteDissolveProgress = (progress: number, parameters: MonsterDeathParameterValues): number => {
  const start = numberValue(parameters, 'dissolveStart', 0);
  return Math.max(0, Math.min(1, (progress - start) / Math.max(.001, 1 - start)));
};

export const createSpriteDissolveOptions = (
  visual: MonsterDeathVisualDefinition,
  parameters: MonsterDeathParameterValues,
  progress = 0
): SpriteNoiseErodeOptions => ({
  enabled: true,
  progress,
  pattern: visual.spriteEffect?.pattern ?? 'ash',
  directionAngleDeg: 90,
  noiseScale: 7,
  noiseStrength: .62,
  noiseSpeed: .08,
  edgeWidth: .11,
  edgeSoftness: .025,
  edgeColor: '#ffb45b',
  edgeIntensity: 1.35,
  charColor: typeof parameters.ashColor === 'string' ? parameters.ashColor : '#242424',
  charStrength: numberValue(parameters, 'ashStrength', .9),
  seed: 1
});

export const createSpriteDeathParticlePreset = (
  visual: MonsterDeathVisualDefinition,
  parameters: MonsterDeathParameterValues,
  duration: number
): SpriteAshPreset => ({
  presetKey: `spriteDeath_${visual.spriteEffect?.pattern ?? 'ash'}`,
  name: 'Sprite death edge particles',
  effectMode: visual.particles?.presetKey ?? 'ash',
  duration,
  directionAngleDeg: 90,
  noiseScale: 7,
  noiseStrength: .62,
  noiseSpeed: .08,
  edgeWidth: .1,
  edgeSoftness: .025,
  edgeColor: '#ffb45b',
  edgeIntensity: 1.4,
  charColor: '#202020',
  charStrength: .85,
  ashColor: typeof parameters.ashColor === 'string' ? parameters.ashColor : '#b8b8b8',
  ashTrail: .3,
  ashDensity: 1,
  ashOpacity: .9,
  rise: numberValue(parameters, 'rise', 2.6),
  driftX: 0,
  turbulence: numberValue(parameters, 'flutter', .28),
  flickerSpeed: 6,
  seed: 1,
  alphaCutoff: .01
});
