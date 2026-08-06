import { Mesh, type Scene } from '@babylonjs/core';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
import {
  applyExclamationMarkProgressPreset,
  createExclamationMarkProgressMaterial
} from './createExclamationMarkProgressMaterial.ts';
import type { ExclamationMarkPreset } from './exclamationMark.types.ts';
import type { SpriteProgressOptions } from '@/core/sprite/progress/spriteProgress.ts';

export type ExclamationMarkSpriteController = {
  mesh: ReturnType<typeof createAtlasSpritePlane>['mesh'];
  preset: ExclamationMarkPreset;
  setFillPercent: (percent: number) => void;
  setProgress: (progress: SpriteProgressOptions) => void;
  setScale: (scale: number) => void;
  setDebugVisible: (visible: boolean) => void;
  dispose: () => void;
};

export const createExclamationMarkSprite = (
  scene: Scene,
  preset: ExclamationMarkPreset,
  fillPercent = preset.progress.progress ?? 1
): ExclamationMarkSpriteController => {
  const runtimePreset = { ...preset, progress: { ...preset.progress, progress: Math.max(0, Math.min(1, fillPercent)) } };
  const sprite = createAtlasSpritePlane(
    scene,
    encodeURI(`/${preset.imagePath.replace(/^\/+/, '')}`),
    preset.height * preset.scale
  );
  const progressMaterial = createExclamationMarkProgressMaterial(scene, sprite.texture, runtimePreset);
  let runtimeScale = 1;
  const applyDisplaySize = () => {
    const displayHeight = preset.height * preset.scale * runtimeScale;
    const textureSize = sprite.texture.getSize();
    const aspect = textureSize.width > 0 && textureSize.height > 0 ? textureSize.width / textureSize.height : 1;
    sprite.mesh.scaling.x = preset.sizeMode === 'fixed'
      ? preset.width * preset.scale * runtimeScale
      : displayHeight * aspect;
    sprite.mesh.scaling.y = displayHeight;
  };
  sprite.texture.onLoadObservable.add(applyDisplaySize);
  applyDisplaySize();
  sprite.mesh.name = `exclamation_mark_${preset.presetKey}`;
  sprite.mesh.material = progressMaterial.material;
  sprite.mesh.position.copyFromFloats(preset.position[0], preset.position[1], preset.position[2]);
  sprite.mesh.billboardMode = preset.faceCamera ? Mesh.BILLBOARDMODE_Y : 0;
  sprite.mesh.isPickable = false;

  return {
    mesh: sprite.mesh,
    preset,
    setFillPercent: (percent) => {
      runtimePreset.progress.progress = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0));
      applyExclamationMarkProgressPreset(progressMaterial, runtimePreset);
    },
    setProgress: (progress) => {
      runtimePreset.progress = { ...runtimePreset.progress, ...progress };
      applyExclamationMarkProgressPreset(progressMaterial, runtimePreset);
    },
    setScale: (scale) => {
      runtimeScale = Math.max(0.01, Number.isFinite(scale) ? scale : 1);
      applyDisplaySize();
    },
    setDebugVisible: (visible) => { sprite.mesh.showBoundingBox = visible; },
    dispose: () => {
      progressMaterial.dispose();
      sprite.dispose();
    }
  };
};
