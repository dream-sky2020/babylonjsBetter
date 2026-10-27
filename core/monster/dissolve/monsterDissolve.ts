import type { SpriteAshPreset } from '@/core/sprite/ash/spriteAsh.types';
import { normalizeSpriteAshPreset } from '@/core/sprite/ash/spriteAshPreset';
import { createSpriteNoiseErodeOptions } from '@/core/sprite/dissolve/createSpriteNoiseErodeOptions';
import type { SpriteDissolveEffectState } from '@/core/sprite/dissolve/spriteDissolve.types';
import type { MonsterLayerKey } from '@/core/monster/types/monster.types';

export type MonsterDissolvePreset = SpriteAshPreset & { bottomFillEnd: number; bottomBorderEnd: number };
export type MonsterDissolveLibrary = Record<string, MonsterDissolvePreset>;
const endValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
export function normalizeMonsterDissolvePreset(key: string, value: unknown): MonsterDissolvePreset {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { ...normalizeSpriteAshPreset(key, value), bottomFillEnd: endValue(input.bottomFillEnd), bottomBorderEnd: endValue(input.bottomBorderEnd) };
}
export function normalizeMonsterDissolveLibrary(value: unknown): MonsterDissolveLibrary {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(input).map(([key, preset]) => [key, normalizeMonsterDissolvePreset(key, preset)]));
}
export type MonsterDissolveTarget = { setLayerDissolve(key: MonsterLayerKey, options: SpriteDissolveEffectState): void; setLayerOpacity(key: MonsterLayerKey, opacity: number): void };
export function applyMonsterDissolve(target: MonsterDissolveTarget, preset: MonsterDissolvePreset, progress: number, enabled = true) {
  const p = Math.max(0, Math.min(1, progress));
  const options = { ...createSpriteNoiseErodeOptions(preset, p), enabled };
  for (const key of ['body', 'line'] as const) target.setLayerDissolve(key, options);
  for (const [key, end] of [['bottomFillMask', preset.bottomFillEnd], ['bottomBorder', preset.bottomBorderEnd]] as const)
    target.setLayerOpacity(key, !enabled ? 1 : end === 0 ? 0 : 1 - Math.min(1, p / end));
}
