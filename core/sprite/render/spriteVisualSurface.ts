import type { BaseTexture, Material, Scene } from '@babylonjs/core';
import type { SpriteVisualEffectState } from './spriteVisualEffect.types.ts';

export type SpriteVisualSurfaceRole =
  | 'monster-layer'
  | 'exclamation-mark'
  | 'special-status-icon'
  | 'number-glyph'
  | 'generic-sprite'
  | 'effect-preview';

export type SpriteVisualSurface = {
  readonly role: SpriteVisualSurfaceRole;
  readonly material: Material;
  getEffects: () => Readonly<SpriteVisualEffectState>;
  setEffects: (patch: Partial<SpriteVisualEffectState>) => void;
  setTime: (timeSeconds: number) => void;
  setRenderSize: (widthPx: number, heightPx: number) => void;
  dispose: () => void;
};

export type CreateSpriteVisualSurfaceOptions = {
  role: SpriteVisualSurfaceRole;
  name: string;
  sourceTexture: BaseTexture;
  baseMaterial: Material;
  effects?: SpriteVisualEffectState;
  renderSizePx?: { width: number; height: number };
};

export type SpriteVisualSurfaceFactory = {
  create: (scene: Scene, options: CreateSpriteVisualSurfaceOptions) => SpriteVisualSurface;
};

/**
 * 默认轻量后端。通用平面不会因此静态依赖完整 Shader 系统。
 */
export const createStandardSpriteVisualSurface = (
  _scene: Scene,
  options: CreateSpriteVisualSurfaceOptions
): SpriteVisualSurface => {
  let effects: SpriteVisualEffectState = { ...options.effects };
  return {
    role: options.role,
    material: options.baseMaterial,
    getEffects: () => effects,
    setEffects: (patch) => { effects = { ...effects, ...patch }; },
    setTime: () => undefined,
    setRenderSize: () => undefined,
    dispose: () => options.baseMaterial.dispose()
  };
};

export const createSpriteVisualSurface = createStandardSpriteVisualSurface;

export const DEFAULT_SPRITE_VISUAL_SURFACE_FACTORY: SpriteVisualSurfaceFactory = {
  create: createStandardSpriteVisualSurface
};
