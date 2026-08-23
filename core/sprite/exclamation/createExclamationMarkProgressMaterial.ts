import type { BaseTexture, Scene, ShaderMaterial } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import {
  type StripeShaderMaterialController
} from '@/core/sprite/render/createSpriteEffectMaterial.ts';
import { createProfiledSpriteVisualSurface } from '@/core/sprite/render/createProfiledSpriteVisualSurface.ts';
import type { SpriteProgressOptions } from '@/core/sprite/progress/spriteProgress.ts';
import type { ExclamationMarkPreset } from './exclamationMark.types.ts';

const toProgressOptions = (preset: ExclamationMarkPreset): SpriteProgressOptions => preset.progress;

export const createExclamationMarkProgressMaterial = (
  scene: Scene,
  texture: BaseTexture,
  preset: ExclamationMarkPreset
): StripeShaderMaterialController => {
  const surface = createProfiledSpriteVisualSurface(scene, {
    role: 'exclamation-mark',
    name: `exclamation_mark_progress_${preset.presetKey}`,
    sourceTexture: texture,
    baseMaterial: new StandardMaterial(`exclamation_mark_fallback_${preset.presetKey}`, scene),
    effects: { progressMask: toProgressOptions(preset) },
    renderSizePx: texture.getSize()
  });
  return {
    material: surface.material as ShaderMaterial,
    updatePreset: (stripe) => surface.setEffects({ stripe }),
    updateProgress: (progress) => surface.setEffects({ progressMask: progress }),
    updateLayerProgress: (progress) => surface.setEffects({ layerProgressMask: progress }),
    updateDissolve: (dissolve) => surface.setEffects({ dissolve }),
    updateNoiseErode: (dissolve) => surface.setEffects({ dissolve }),
    updateColorOverlay: (color, alpha) => surface.setEffects({ colorOverlay: { color, alpha } }),
    updateTime: surface.setTime,
    updateRenderSize: surface.setRenderSize,
    dispose: surface.dispose
  };
};

export const applyExclamationMarkProgressPreset = (
  controller: StripeShaderMaterialController,
  preset: ExclamationMarkPreset
): void => {
  controller.updateProgress(toProgressOptions(preset));
};
