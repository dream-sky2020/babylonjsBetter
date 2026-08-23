import type { SpriteAshPreset } from '@/core/sprite/ash/spriteAsh.types.ts';
import type { SpriteDissolveEffectState } from './spriteDissolve.types.ts';

/**
 * 精灵消散预设到通用 noiseErodeModule 的唯一参数入口。
 * 两个 Lab 与正式运行时应复用这里，避免同名预设产生不同的 Shader 参数。
 */
export const createSpriteNoiseErodeOptions = (
  preset: SpriteAshPreset,
  progress = 0
): SpriteDissolveEffectState => ({
  ...preset,
  enabled: true,
  progress: Math.max(0, Math.min(1, Number(progress) || 0))
});
