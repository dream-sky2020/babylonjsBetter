import { Mesh, type Scene } from '@babylonjs/core';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
import type { ExclamationMarkPreset } from './exclamationMark.types.ts';
import type { SpriteProgressOptions } from '@/core/sprite/progress/spriteProgress.ts';
import type { SpriteVisualSurfaceFactory } from '@/core/sprite/render/spriteVisualSurface.ts';
import { DEFAULT_PROFILED_SPRITE_VISUAL_SURFACE_FACTORY } from '@/core/sprite/render/createProfiledSpriteVisualSurface.ts';

export type ExclamationMarkSpriteController = {
  mesh: ReturnType<typeof createAtlasSpritePlane>['mesh'];
  baseMesh: ReturnType<typeof createAtlasSpritePlane>['mesh'] | null;
  preset: ExclamationMarkPreset;
  setFillPercent: (percent: number) => void;
  setProgress: (progress: SpriteProgressOptions) => void;
  setBaseProgress: (progress: SpriteProgressOptions) => void;
  setScale: (scale: number) => void;
  setBaseScale: (scale: number) => void;
  setDebugVisible: (visible: boolean) => void;
  dispose: () => void;
};

export const createExclamationMarkSprite = (
  scene: Scene,
  preset: ExclamationMarkPreset,
  fillPercent = preset.progress.progress ?? 1,
  surfaceFactory?: SpriteVisualSurfaceFactory
): ExclamationMarkSpriteController => {
  const runtimePreset = { ...preset, progress: { ...preset.progress, progress: Number.isFinite(fillPercent) ? fillPercent : 1 } };
  const sprite = createAtlasSpritePlane(
    scene,
    encodeURI(`/${preset.imagePath.replace(/^\/+/, '')}`),
    preset.height * preset.scale,
    {
      surfaceRole: 'exclamation-mark',
      surfaceName: `exclamation_mark_progress_${preset.presetKey}`,
      surfaceFactory: surfaceFactory ?? DEFAULT_PROFILED_SPRITE_VISUAL_SURFACE_FACTORY,
      initialEffects: { progressMask: runtimePreset.progress }
    }
  );
  const baseSprite = preset.base.enabled && preset.base.imagePath
    ? createAtlasSpritePlane(scene, encodeURI(`/${preset.base.imagePath.replace(/^\/+/, '')}`), 1, {
      surfaceRole: 'exclamation-mark',
      surfaceName: `exclamation_mark_progress_${preset.presetKey}_base`,
      surfaceFactory: surfaceFactory ?? DEFAULT_PROFILED_SPRITE_VISUAL_SURFACE_FACTORY,
      initialEffects: { progressMask: preset.base.progress }
    })
    : null;
  const baseRuntimePreset = { ...runtimePreset, presetKey: `${preset.presetKey}_base`, progress: { ...preset.base.progress } };
  let runtimeScale = 1;
  let runtimeBaseScale = 1;
  const applyDisplaySize = () => {
    const displayHeight = preset.height * preset.scale * preset.scaleY * runtimeScale;
    const textureSize = sprite.texture.getSize();
    const aspect = textureSize.width > 0 && textureSize.height > 0 ? textureSize.width / textureSize.height : 1;
    sprite.mesh.scaling.x = preset.sizeMode === 'fixed'
      ? preset.width * preset.scale * preset.scaleX * runtimeScale
      : displayHeight * aspect * (preset.scaleX / preset.scaleY);
    sprite.mesh.scaling.y = displayHeight;
    if (baseSprite) {
      const baseSize = baseSprite.texture.getSize();
      const baseAspect = baseSize.width > 0 && baseSize.height > 0 ? baseSize.width / baseSize.height : 1;
      const baseHeight = preset.base.height * preset.base.scale * preset.base.scaleY * runtimeBaseScale;
      const baseWidth = (preset.base.sizeMode === 'fixed' ? preset.base.width * preset.base.scale * preset.base.scaleX : preset.base.height * preset.base.scale * preset.base.scaleY * baseAspect * (preset.base.scaleX / preset.base.scaleY)) * runtimeBaseScale;
      baseSprite.mesh.scaling.x = baseWidth / Math.max(0.0001, sprite.mesh.scaling.x);
      baseSprite.mesh.scaling.y = baseHeight / Math.max(0.0001, sprite.mesh.scaling.y);
    }
  };
  sprite.texture.onLoadObservable.add(applyDisplaySize);
  applyDisplaySize();
  sprite.mesh.name = `exclamation_mark_${preset.presetKey}`;
  sprite.mesh.position.copyFromFloats(preset.position[0], preset.position[1], preset.position[2]);
  sprite.mesh.billboardMode = preset.faceCamera ? Mesh.BILLBOARDMODE_Y : 0;
  sprite.mesh.isPickable = false;
  sprite.mesh.renderingGroupId = 1;
  sprite.mesh.alphaIndex = 1;
  if (baseSprite) {
    baseSprite.mesh.name = `exclamation_mark_base_${preset.presetKey}`;
    baseSprite.mesh.parent = sprite.mesh;
    baseSprite.mesh.position.copyFromFloats(preset.base.offset[0], preset.base.offset[1], preset.base.offset[2]);
    baseSprite.mesh.isPickable = false;
    baseSprite.mesh.renderingGroupId = 1;
    baseSprite.mesh.alphaIndex = 0;
    baseSprite.texture.onLoadObservable.add(applyDisplaySize);
  }

  return {
    mesh: sprite.mesh,
    baseMesh: baseSprite?.mesh ?? null,
    preset,
    setFillPercent: (percent) => {
      runtimePreset.progress.progress = Number.isFinite(percent) ? percent : 0;
      sprite.surface.setEffects({ progressMask: runtimePreset.progress });
    },
    setProgress: (progress) => {
      runtimePreset.progress = { ...runtimePreset.progress, ...progress };
      sprite.surface.setEffects({ progressMask: runtimePreset.progress });
    },
    setBaseProgress: (progress) => {
      if (!baseSprite) return;
      baseRuntimePreset.progress = { ...baseRuntimePreset.progress, ...progress };
      baseSprite.surface.setEffects({ progressMask: baseRuntimePreset.progress });
    },
    setScale: (scale) => {
      runtimeScale = Math.max(0.01, Number.isFinite(scale) ? scale : 1);
      applyDisplaySize();
    },
    setBaseScale: (scale) => {
      runtimeBaseScale = Math.max(0.01, Number.isFinite(scale) ? scale : 1);
      applyDisplaySize();
    },
    setDebugVisible: (visible) => { sprite.mesh.showBoundingBox = visible; if (baseSprite) baseSprite.mesh.showBoundingBox = visible; },
    dispose: () => {
      baseSprite?.dispose?.();
      sprite.dispose?.();
    }
  };
};
