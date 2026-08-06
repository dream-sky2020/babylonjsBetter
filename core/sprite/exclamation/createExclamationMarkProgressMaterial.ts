import type { BaseTexture, Scene } from '@babylonjs/core';
import {
  createSpriteEffectMaterial,
  type StripeShaderMaterialController
} from '@/core/sprite/render/createSpriteEffectMaterial.ts';
import type { SpriteProgressOptions } from '@/core/sprite/progress/spriteProgress.ts';
import type { ExclamationMarkPreset } from './exclamationMark.types.ts';

const toProgressOptions = (preset: ExclamationMarkPreset): SpriteProgressOptions => preset.progress;

export const createExclamationMarkProgressMaterial = (
  scene: Scene,
  texture: BaseTexture,
  preset: ExclamationMarkPreset
): StripeShaderMaterialController => createSpriteEffectMaterial(
  scene,
  `exclamation_mark_progress_${preset.presetKey}`,
  { mode: 'texture' },
  {
    sourceTexture: texture,
    progress: toProgressOptions(preset),
    renderSizePx: texture.getSize()
  }
);

export const applyExclamationMarkProgressPreset = (
  controller: StripeShaderMaterialController,
  preset: ExclamationMarkPreset
): void => {
  controller.updateProgress(toProgressOptions(preset));
};
