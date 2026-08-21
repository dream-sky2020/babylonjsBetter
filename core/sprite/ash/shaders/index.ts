import type { SpriteAshEffectMode } from '../spriteAsh.types';
import { spriteNoiseErodeShader } from './spriteNoiseErodeShader';
import type { SpriteAshShaderDefinition } from './spriteAshShader.types';

const VARIANTS: Record<SpriteAshEffectMode, number> = {
  ash: 0,
  frost: 1,
  void: 2,
  blackShards: 3,
  embers: 3,
  pixel: 3
};

export const getSpriteAshShader = (mode: SpriteAshEffectMode): SpriteAshShaderDefinition => ({
  ...spriteNoiseErodeShader,
  mode,
  variant: VARIANTS[mode] ?? 0
});

export { SPRITE_ASH_UNIFORMS } from './spriteAshShader.types';
