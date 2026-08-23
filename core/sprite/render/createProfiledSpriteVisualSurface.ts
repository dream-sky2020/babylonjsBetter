import type { Scene } from '@babylonjs/core';
import { createSpriteEffectMaterial, type StripeMaskMaterialController } from './createSpriteEffectMaterial.ts';
import {
  createStandardSpriteVisualSurface,
  type CreateSpriteVisualSurfaceOptions,
  type SpriteVisualSurface,
  type SpriteVisualSurfaceFactory,
  type SpriteVisualSurfaceRole
} from './spriteVisualSurface.ts';
import type { SpriteVisualEffectState, StripePresetLike } from './spriteVisualEffect.types.ts';

type SpriteVisualSurfaceBackend = 'standard' | 'composed-effects';

/** 上层只声明 role，具体 Recipe/材质选择收口在渲染适配层。 */
export const SPRITE_VISUAL_SURFACE_PROFILES: Readonly<Record<SpriteVisualSurfaceRole, SpriteVisualSurfaceBackend>> = {
  'monster-layer': 'composed-effects',
  'exclamation-mark': 'composed-effects',
  'special-status-icon': 'standard',
  'number-glyph': 'standard',
  'generic-sprite': 'standard',
  'effect-preview': 'composed-effects'
};

const applyEffects = (controller: StripeMaskMaterialController, patch: Partial<SpriteVisualEffectState>) => {
  if (patch.stripe) controller.updatePreset(patch.stripe);
  if (patch.progressMask) controller.updateProgress(patch.progressMask);
  if (patch.layerProgressMask) controller.updateLayerProgress(patch.layerProgressMask);
  if (patch.dissolve) controller.updateDissolve(patch.dissolve);
  if (patch.colorOverlay) controller.updateColorOverlay(patch.colorOverlay.color, patch.colorOverlay.alpha);
};

export const createProfiledSpriteVisualSurface = (
  scene: Scene,
  options: CreateSpriteVisualSurfaceOptions
): SpriteVisualSurface => {
  if (SPRITE_VISUAL_SURFACE_PROFILES[options.role] === 'standard') {
    return createStandardSpriteVisualSurface(scene, options);
  }

  let effects: SpriteVisualEffectState = { ...options.effects };
  const initialStripe: StripePresetLike = effects.stripe ?? { mode: 'texture' };
  const controller = createSpriteEffectMaterial(scene, options.name, initialStripe, {
    sourceTexture: options.sourceTexture,
    progress: effects.progressMask,
    layerProgress: effects.layerProgressMask,
    renderSizePx: options.renderSizePx ?? options.sourceTexture.getSize()
  });
  applyEffects(controller, effects);

  return {
    role: options.role,
    material: controller.material,
    getEffects: () => effects,
    setEffects: (patch) => {
      effects = { ...effects, ...patch };
      applyEffects(controller, patch);
    },
    setTime: controller.updateTime,
    setRenderSize: controller.updateRenderSize,
    dispose: () => {
      controller.dispose();
      options.baseMaterial.dispose();
    }
  };
};

export const DEFAULT_PROFILED_SPRITE_VISUAL_SURFACE_FACTORY: SpriteVisualSurfaceFactory = {
  create: createProfiledSpriteVisualSurface
};
